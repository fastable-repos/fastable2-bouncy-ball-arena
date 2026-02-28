import { useState, useRef, useEffect, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Ball {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
}

interface Obstacle {
  x: number
  y: number
  width: number
  height: number
}

interface HighScore {
  score: number
  date: string
}

type GravityLevel = 'low' | 'normal' | 'high'

interface Settings {
  gravity: GravityLevel
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CANVAS_W = 760
const CANVAS_H = 500
const GRAVITY: Record<GravityLevel, number> = { low: 0.15, normal: 0.35, high: 0.7 }
const DAMPING = 0.75
const WALL_DAMPING = 0.78
const COMBO_WINDOW_MS = 1000
const MIN_BOUNCE_VEL = 0.8
const BALL_COLORS = ['#ff2d78', '#00f5ff', '#39ff14', '#ff8c00', '#bf5fff']
const LS_HS = 'bouncyball_highscores'
const LS_SET = 'bouncyball_settings'

// ── Helpers ───────────────────────────────────────────────────────────────────

let _nextId = 0
const genId = () => _nextId++

function loadHighScores(): HighScore[] {
  try {
    const raw = localStorage.getItem(LS_HS)
    if (!raw) return []
    return JSON.parse(raw) as HighScore[]
  } catch (e) {
    console.error('Failed to load high scores', e)
    return []
  }
}

function persistHighScore(score: number, current: HighScore[]): HighScore[] {
  if (score <= 0) return current
  const updated = [...current, { score, date: new Date().toISOString() }]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
  try {
    localStorage.setItem(LS_HS, JSON.stringify(updated))
  } catch (e) {
    console.error('Failed to save high scores', e)
  }
  return updated
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(LS_SET)
    if (!raw) return { gravity: 'normal' }
    return JSON.parse(raw) as Settings
  } catch (e) {
    console.error('Failed to load settings', e)
    return { gravity: 'normal' }
  }
}

function persistSettings(s: Settings) {
  try {
    localStorage.setItem(LS_SET, JSON.stringify(s))
  } catch (e) {
    console.error('Failed to save settings', e)
  }
}

function generateObstacles(): Obstacle[] {
  return [
    { x: 80,  y: 160, width: 120, height: 18 },
    { x: 280, y: 100, width: 90,  height: 16 },
    { x: 480, y: 200, width: 110, height: 18 },
    { x: 150, y: 320, width: 100, height: 16 },
    { x: 380, y: 360, width: 130, height: 18 },
    { x: 600, y: 280, width: 90,  height: 16 },
  ]
}

// Circle–AABB collision: returns true if collision occurred and mutates ball
function resolveCircleRect(ball: Ball, obs: Obstacle): boolean {
  const cx = Math.max(obs.x, Math.min(ball.x, obs.x + obs.width))
  const cy = Math.max(obs.y, Math.min(ball.y, obs.y + obs.height))
  const dx = ball.x - cx
  const dy = ball.y - cy
  const distSq = dx * dx + dy * dy
  if (distSq >= ball.radius * ball.radius) return false

  const dist = Math.sqrt(distSq) || 0.001
  const nx = dx / dist
  const ny = dy / dist
  const dot = ball.vx * nx + ball.vy * ny

  if (dot < 0) {
    ball.vx -= 2 * dot * nx
    ball.vy -= 2 * dot * ny
    ball.vx *= DAMPING
    ball.vy *= DAMPING
  }

  // push ball out of obstacle
  const overlap = ball.radius - dist
  ball.x += nx * overlap
  ball.y += ny * overlap
  return true
}

// ── App ───────────────────────────────────────────────────────────────────────

const OBSTACLES = generateObstacles()

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Physics refs (mutable, used in rAF loop)
  const ballsRef        = useRef<Ball[]>([])
  const scoreRef        = useRef(0)
  const comboRef        = useRef(1)
  const lastBounceRef   = useRef(0)
  const settingsRef     = useRef<Settings>(loadSettings())
  const animRef         = useRef<number>(0)
  const dragStart       = useRef<{ x: number; y: number } | null>(null)
  const dragCurrent     = useRef<{ x: number; y: number } | null>(null)

  // UI state
  const [score,          setScore]         = useState(0)
  const [combo,          setCombo]         = useState(1)
  const [ballCount,      setBallCount]     = useState(0)
  const [highScores,     setHighScores]    = useState<HighScore[]>(loadHighScores)
  const [settings,       setSettings]      = useState<Settings>(loadSettings)
  const [showHS,         setShowHS]        = useState(false)
  const [showSettings,   setShowSettings]  = useState(false)
  const [hasLaunched,    setHasLaunched]   = useState(false)

  // Keep settingsRef in sync with state
  useEffect(() => { settingsRef.current = settings }, [settings])

  // ── Bounce handler (called from loop) ──────────────────────────────────────
  const onBounce = useCallback(() => {
    const now = Date.now()
    if (now - lastBounceRef.current < COMBO_WINDOW_MS) {
      comboRef.current = Math.min(comboRef.current + 1, 10)
    } else {
      comboRef.current = 1
    }
    lastBounceRef.current = now
    scoreRef.current += comboRef.current
    setScore(scoreRef.current)
    setCombo(comboRef.current)
  }, [])

  // ── Physics + Render loop ─────────────────────────────────────────────────
  const loop = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = CANVAS_W
    const H = CANVAS_H
    const g = GRAVITY[settingsRef.current.gravity]
    const balls = ballsRef.current
    const now = Date.now()

    // Reset combo display if no bounce for a while
    if (comboRef.current > 1 && now - lastBounceRef.current > COMBO_WINDOW_MS) {
      comboRef.current = 1
      setCombo(1)
    }

    // ── Physics update ──────────────────────────────────────────────────────
    for (const b of balls) {
      b.vy += g
      b.x  += b.vx
      b.y  += b.vy

      // Left wall
      if (b.x - b.radius < 0) {
        b.x = b.radius
        if (Math.abs(b.vx) > MIN_BOUNCE_VEL) {
          b.vx = Math.abs(b.vx) * WALL_DAMPING
          onBounce()
        } else {
          b.vx = 0
        }
      }
      // Right wall
      if (b.x + b.radius > W) {
        b.x = W - b.radius
        if (Math.abs(b.vx) > MIN_BOUNCE_VEL) {
          b.vx = -Math.abs(b.vx) * WALL_DAMPING
          onBounce()
        } else {
          b.vx = 0
        }
      }
      // Ceiling
      if (b.y - b.radius < 0) {
        b.y = b.radius
        if (Math.abs(b.vy) > MIN_BOUNCE_VEL) {
          b.vy = Math.abs(b.vy) * DAMPING
          onBounce()
        } else {
          b.vy = 0
        }
      }
      // Floor
      if (b.y + b.radius > H) {
        b.y = H - b.radius
        if (Math.abs(b.vy) > MIN_BOUNCE_VEL) {
          b.vy = -Math.abs(b.vy) * DAMPING
          b.vx *= 0.97
          onBounce()
        } else {
          b.vy = 0
          b.vx *= 0.95
        }
      }

      // Obstacle collisions
      for (const obs of OBSTACLES) {
        if (resolveCircleRect(b, obs)) {
          const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy)
          if (speed > MIN_BOUNCE_VEL) onBounce()
        }
      }
    }

    // ── Draw ────────────────────────────────────────────────────────────────
    // Background
    ctx.fillStyle = '#0d0d2b'
    ctx.fillRect(0, 0, W, H)

    // Star field (decorative)
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 137.5 + 23) % W)
      const sy = ((i * 97.3  + 47) % H)
      const sr = i % 3 === 0 ? 1.5 : 0.8
      ctx.beginPath()
      ctx.arc(sx, sy, sr, 0, Math.PI * 2)
      ctx.fill()
    }

    // Obstacles
    for (const obs of OBSTACLES) {
      ctx.save()
      ctx.shadowColor = '#00f5ff'
      ctx.shadowBlur  = 12
      ctx.fillStyle   = 'rgba(0,245,255,0.12)'
      ctx.strokeStyle = 'rgba(0,245,255,0.65)'
      ctx.lineWidth   = 2
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height)
      ctx.strokeRect(obs.x, obs.y, obs.width, obs.height)
      ctx.restore()
    }

    // Drag indicator
    if (dragStart.current && dragCurrent.current) {
      const { x: sx, y: sy } = dragStart.current
      const { x: ex, y: ey } = dragCurrent.current
      ctx.save()
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'
      ctx.lineWidth   = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(ex, ey)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.beginPath()
      ctx.arc(sx, sy, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // Balls
    for (const b of balls) {
      ctx.save()
      ctx.shadowColor = b.color
      ctx.shadowBlur  = 22
      const grad = ctx.createRadialGradient(
        b.x - b.radius * 0.3, b.y - b.radius * 0.3, b.radius * 0.05,
        b.x, b.y, b.radius
      )
      grad.addColorStop(0, '#ffffff')
      grad.addColorStop(0.3, b.color)
      grad.addColorStop(1, b.color + '77')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    animRef.current = requestAnimationFrame(loop)
  }, [onBounce])

  // Start / stop loop
  useEffect(() => {
    animRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animRef.current)
  }, [loop])

  // ── Input helpers ──────────────────────────────────────────────────────────
  function canvasCoords(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect   = canvas.getBoundingClientRect()
    const scaleX = CANVAS_W / rect.width
    const scaleY = CANVAS_H / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    }
  }

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = canvasCoords(e)
    dragStart.current   = pos
    dragCurrent.current = pos
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragStart.current) return
    dragCurrent.current = canvasCoords(e)
  }, [])

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragStart.current) return
    const end = canvasCoords(e)
    const { x: sx, y: sy } = dragStart.current
    const dx = sx - end.x
    const dy = sy - end.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    let vx: number, vy: number
    if (dist < 5) {
      // Simple click → random upward launch
      vx = (Math.random() - 0.5) * 6
      vy = -(4 + Math.random() * 5)
    } else {
      const speed = Math.min(dist * 0.18, 16)
      vx = (dx / dist) * speed
      vy = (dy / dist) * speed
    }

    const color  = BALL_COLORS[Math.floor(Math.random() * BALL_COLORS.length)]
    const radius = 12 + Math.random() * 8
    const ball: Ball = { id: genId(), x: sx, y: sy, vx, vy, radius, color }
    ballsRef.current = [...ballsRef.current, ball]
    setBallCount(ballsRef.current.length)
    setHasLaunched(true)

    dragStart.current   = null
    dragCurrent.current = null
  }, [])

  // ── Reset ──────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    const currentScore = scoreRef.current
    const updated = persistHighScore(currentScore, highScores)
    setHighScores(updated)

    ballsRef.current  = []
    scoreRef.current  = 0
    comboRef.current  = 1
    setScore(0)
    setCombo(1)
    setBallCount(0)
    setHasLaunched(false)
  }, [highScores])

  // ── Gravity setting ────────────────────────────────────────────────────────
  const handleGravity = useCallback((level: GravityLevel) => {
    const s: Settings = { gravity: level }
    setSettings(s)
    persistSettings(s)
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex flex-col select-none"
      style={{ background: '#0f0f1a', fontFamily: "'Courier New', monospace" }}
    >
      {/* ── Header ── */}
      <header
        className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{ borderBottom: '1px solid rgba(0,245,255,0.2)' }}
      >
        <h1
          className="text-xl font-bold tracking-widest"
          style={{ color: '#00f5ff', textShadow: '0 0 12px #00f5ff' }}
        >
          BOUNCY BALL ARENA
        </h1>
        <div className="flex gap-2">
          {[
            { label: 'HIGH SCORES', action: () => { setShowHS(true); setShowSettings(false) }, testId: 'btn-highscores' },
            { label: 'SETTINGS',    action: () => { setShowSettings(true); setShowHS(false) }, testId: 'btn-settings'   },
          ].map(({ label, action, testId }) => (
            <button
              key={label}
              onClick={action}
              data-testid={testId}
              className="px-3 py-1 text-xs font-bold rounded transition-all"
              style={{
                background: 'rgba(0,245,255,0.08)',
                color: '#00f5ff',
                border: '1px solid rgba(0,245,255,0.35)',
              }}
            >
              {label}
            </button>
          ))}
          <button
            onClick={handleReset}
            data-testid="reset-button"
            className="px-3 py-1 text-xs font-bold rounded transition-all"
            style={{
              background: 'rgba(255,45,120,0.12)',
              color: '#ff2d78',
              border: '1px solid rgba(255,45,120,0.45)',
            }}
          >
            RESET
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Canvas area ── */}
        <div className="flex-1 relative flex items-center justify-center p-4">

          {/* HUD: score + ball count (top-left) */}
          <div className="absolute top-6 left-6 z-10 flex flex-col gap-2">
            <div
              className="px-3 py-1 rounded"
              style={{ background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(0,245,255,0.3)' }}
            >
              <div className="text-xs" style={{ color: '#555' }}>SCORE</div>
              <div
                className="text-3xl font-bold"
                style={{ color: '#00f5ff', textShadow: '0 0 8px #00f5ff' }}
                data-testid="score-display"
              >
                {score}
              </div>
            </div>
            <div
              className="px-3 py-1 rounded"
              style={{ background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(57,255,20,0.3)' }}
            >
              <div className="text-xs" style={{ color: '#555' }}>BALLS</div>
              <div
                className="text-xl font-bold"
                style={{ color: '#39ff14', textShadow: '0 0 8px #39ff14' }}
                data-testid="ball-count"
              >
                {ballCount}
              </div>
            </div>
          </div>

          {/* HUD: combo (top-right) */}
          <div className="absolute top-6 right-6 z-10">
            <div
              className="px-3 py-1 rounded"
              style={{ background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,140,0,0.3)' }}
            >
              <div className="text-xs" style={{ color: '#555' }}>COMBO</div>
              <div
                className="text-3xl font-bold"
                style={{ color: '#ff8c00', textShadow: '0 0 8px #ff8c00' }}
                data-testid="combo-display"
              >
                {combo}x
              </div>
            </div>
          </div>

          {/* Canvas */}
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            data-testid="game-canvas"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{
              cursor: 'crosshair',
              border: '2px solid #00f5ff',
              boxShadow: '0 0 30px rgba(0,245,255,0.35), 0 0 60px rgba(0,245,255,0.1)',
              maxWidth: '100%',
              maxHeight: 'calc(100vh - 80px)',
              display: 'block',
            }}
          />

          {/* Instruction overlay */}
          {!hasLaunched && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              data-testid="instruction-overlay"
            >
              <div className="text-center">
                <p
                  className="text-2xl font-bold tracking-wider"
                  style={{
                    color: '#00f5ff',
                    textShadow: '0 0 20px #00f5ff, 0 0 40px #00f5ff',
                  }}
                >
                  Click to Launch a Ball
                </p>
                <p className="text-sm mt-2" style={{ color: 'rgba(0,245,255,0.55)' }}>
                  Drag to aim · release to fire
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Side panel ── */}
        {(showHS || showSettings) && (
          <div
            className="w-72 shrink-0 flex flex-col"
            style={{ borderLeft: '1px solid rgba(0,245,255,0.2)', background: 'rgba(0,0,0,0.6)' }}
          >

            {/* High Scores panel */}
            {showHS && (
              <div className="flex-1 p-5" data-testid="highscores-panel">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-bold tracking-widest" style={{ color: '#00f5ff' }}>
                    HIGH SCORES
                  </h2>
                  <button
                    onClick={() => setShowHS(false)}
                    data-testid="close-highscores"
                    className="text-sm"
                    style={{ color: '#555' }}
                  >
                    ✕ Close
                  </button>
                </div>

                {highScores.length === 0 ? (
                  <p
                    className="text-center text-sm mt-8"
                    style={{ color: '#444' }}
                    data-testid="no-scores-message"
                  >
                    No scores yet.<br />Start playing!
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs" style={{ color: '#555' }}>
                        <th className="text-left pb-2">#</th>
                        <th className="text-right pb-2">SCORE</th>
                        <th className="text-right pb-2">DATE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {highScores.map((hs, i) => (
                        <tr
                          key={i}
                          style={{
                            color: i === 0 ? '#ffd700' : '#ccc',
                            borderTop: '1px solid rgba(255,255,255,0.05)',
                          }}
                        >
                          <td className="py-2">{i + 1}</td>
                          <td
                            className="py-2 text-right font-bold"
                            data-testid={`highscore-${i}`}
                          >
                            {hs.score}
                          </td>
                          <td className="py-2 text-right text-xs" style={{ color: '#555' }}>
                            {new Date(hs.date).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Settings panel */}
            {showSettings && (
              <div className="flex-1 p-5" data-testid="settings-panel">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-bold tracking-widest" style={{ color: '#00f5ff' }}>
                    SETTINGS
                  </h2>
                  <button
                    onClick={() => setShowSettings(false)}
                    data-testid="close-settings"
                    className="text-sm"
                    style={{ color: '#555' }}
                  >
                    ✕ Close
                  </button>
                </div>

                <div>
                  <p className="text-xs mb-3" style={{ color: '#888' }}>
                    GRAVITY STRENGTH
                  </p>
                  <div className="flex gap-2 mb-4">
                    {(['low', 'normal', 'high'] as GravityLevel[]).map(lvl => {
                      const active = settings.gravity === lvl
                      return (
                        <button
                          key={lvl}
                          onClick={() => handleGravity(lvl)}
                          data-testid={`gravity-${lvl}`}
                          className="flex-1 py-2 text-xs font-bold rounded capitalize transition-all"
                          style={{
                            background: active ? 'rgba(0,245,255,0.18)' : 'rgba(0,0,0,0.5)',
                            color:      active ? '#00f5ff' : '#555',
                            border:     active ? '1px solid #00f5ff' : '1px solid rgba(255,255,255,0.1)',
                            boxShadow:  active ? '0 0 10px rgba(0,245,255,0.3)' : 'none',
                          }}
                        >
                          {lvl}
                        </button>
                      )
                    })}
                  </div>

                  <div className="space-y-2 text-xs" style={{ color: '#555' }}>
                    <p><span style={{ color: '#39ff14' }}>Low:</span> Balls float gently — great for long rallies</p>
                    <p><span style={{ color: '#ff8c00' }}>Normal:</span> Classic bouncy ball physics</p>
                    <p><span style={{ color: '#ff2d78' }}>High:</span> Intense gravity, fast-paced action</p>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
