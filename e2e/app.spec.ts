import { test, expect } from '@playwright/test'
import { captureScreenshot } from './helpers'

// Helper to clear localStorage before tests that need a clean state
async function clearStorage(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    localStorage.removeItem('bouncyball_highscores')
    localStorage.removeItem('bouncyball_settings')
  })
}

// Click the center of the canvas element
async function clickCanvas(
  page: import('@playwright/test').Page,
  offsetX = 380,
  offsetY = 250
) {
  const canvas = page.locator('[data-testid="game-canvas"]')
  await canvas.click({ position: { x: offsetX, y: offsetY } })
}

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Bouncy Ball Arena', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await clearStorage(page)
    await page.reload()
  })

  // ── Test 1: Happy path – launch a single ball ────────────────────────────
  test('1. Launch a ball and verify it appears, ball count shows 1, score increments', async ({ page }) => {
    const ballCount    = page.locator('[data-testid="ball-count"]')
    const scoreDisplay = page.locator('[data-testid="score-display"]')

    // Initial state: no balls, score 0
    await expect(ballCount).toHaveText('0')
    await expect(scoreDisplay).toHaveText('0')

    // Instruction overlay should be visible before first launch
    await expect(page.locator('[data-testid="instruction-overlay"]')).toBeVisible()

    // Click canvas to launch a ball
    await clickCanvas(page)

    // Ball count should be 1
    await expect(ballCount).toHaveText('1')

    // Instruction overlay disappears after launch
    await expect(page.locator('[data-testid="instruction-overlay"]')).not.toBeVisible()

    // Wait for score to increase (ball bounces off floor/walls)
    await expect(scoreDisplay).not.toHaveText('0', { timeout: 12000 })

    await captureScreenshot(page, '01-single-ball-launched')
  })

  // ── Test 2: Launch 3 balls, reset clears everything ─────────────────────
  test('2. Launch 3 balls, verify count, score increases, then reset clears all', async ({ page }) => {
    const ballCount    = page.locator('[data-testid="ball-count"]')
    const scoreDisplay = page.locator('[data-testid="score-display"]')
    const resetBtn     = page.locator('[data-testid="reset-button"]')

    // Launch 3 balls at different positions
    await clickCanvas(page, 150, 200)
    await clickCanvas(page, 380, 250)
    await clickCanvas(page, 600, 180)

    await expect(ballCount).toHaveText('3')

    // Wait for score to increase from bounces
    await expect(scoreDisplay).not.toHaveText('0', { timeout: 12000 })

    await captureScreenshot(page, '02-three-balls')

    // Reset the game
    await resetBtn.click()

    // Ball count should go back to 0, score to 0
    await expect(ballCount).toHaveText('0')
    await expect(scoreDisplay).toHaveText('0')

    await captureScreenshot(page, '02-after-reset')
  })

  // ── Test 3: High score persistence ──────────────────────────────────────
  test('3. Score appears in high scores after reset and persists after page reload', async ({ page }) => {
    const resetBtn    = page.locator('[data-testid="reset-button"]')
    const scoreDisplay = page.locator('[data-testid="score-display"]')
    const hsBtn       = page.locator('[data-testid="btn-highscores"]')

    // Launch a ball and wait for a score > 0
    await clickCanvas(page)
    await expect(scoreDisplay).not.toHaveText('0', { timeout: 12000 })

    // Reset to save the high score
    await resetBtn.click()
    await expect(scoreDisplay).toHaveText('0')

    // Open high scores panel and verify entry appears
    await hsBtn.click()
    await expect(page.locator('[data-testid="highscores-panel"]')).toBeVisible()
    await expect(page.locator('[data-testid="highscore-0"]')).toBeVisible()
    const savedScore = await page.locator('[data-testid="highscore-0"]').textContent()
    expect(Number(savedScore)).toBeGreaterThan(0)

    await captureScreenshot(page, '03-highscores-panel')

    // Reload the page and confirm high score is still there
    await page.reload()
    await hsBtn.click()
    await expect(page.locator('[data-testid="highscores-panel"]')).toBeVisible()
    await expect(page.locator('[data-testid="highscore-0"]')).toHaveText(savedScore!)

    await captureScreenshot(page, '03-highscores-after-reload')
  })

  // ── Test 4: Edge case – many balls don't crash the app ──────────────────
  test('4. Launch 12 balls rapidly, app does not crash and ball count is accurate', async ({ page }) => {
    const ballCount = page.locator('[data-testid="ball-count"]')

    const positions = [
      [100, 100], [200, 150], [300, 200], [400, 100],
      [500, 150], [600, 200], [150, 300], [250, 350],
      [350, 280], [450, 320], [550, 260], [650, 310],
    ] as const

    for (const [x, y] of positions) {
      await clickCanvas(page, x, y)
    }

    // Ball count should accurately reflect all 12 balls
    await expect(ballCount).toHaveText('12')

    // App should still be functional (can still see HUD)
    await expect(page.locator('[data-testid="score-display"]')).toBeVisible()
    await expect(page.locator('[data-testid="combo-display"]')).toBeVisible()

    await captureScreenshot(page, '04-many-balls')
  })

  // ── Test 5: Settings persist across page reloads ─────────────────────────
  test('5. Gravity setting "high" persists after page reload', async ({ page }) => {
    const settingsBtn = page.locator('[data-testid="btn-settings"]')
    const gravityHigh = page.locator('[data-testid="gravity-high"]')

    // Open settings and select High gravity
    await settingsBtn.click()
    await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible()
    await gravityHigh.click()

    await captureScreenshot(page, '05-settings-panel')

    // Reload page
    await page.reload()

    // Re-open settings panel and verify gravity is still High
    await settingsBtn.click()
    await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible()

    // The "high" button should be styled as active (check it has the cyan color indicator)
    const highBtn = page.locator('[data-testid="gravity-high"]')
    await expect(highBtn).toBeVisible()

    // Verify the setting persisted in localStorage
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('bouncyball_settings')
      if (!raw) return null
      return JSON.parse(raw) as { gravity: string }
    })
    expect(stored?.gravity).toBe('high')

    await captureScreenshot(page, '05-settings-after-reload')
  })

  // ── Test 6: Edge case – empty high scores shows message ─────────────────
  test('6. High scores panel shows empty state message when no games played', async ({ page }) => {
    const hsBtn = page.locator('[data-testid="btn-highscores"]')

    // Open high scores without playing any games
    await hsBtn.click()
    await expect(page.locator('[data-testid="highscores-panel"]')).toBeVisible()

    // Should show the empty state message
    await expect(page.locator('[data-testid="no-scores-message"]')).toBeVisible()

    await captureScreenshot(page, '06-empty-highscores')
  })

  // ── Test 7: Combo multiplier increases above 1x ──────────────────────────
  test('7. Combo multiplier increases above 1x after rapid bounces', async ({ page }) => {
    const comboDisplay = page.locator('[data-testid="combo-display"]')

    // Initial combo is 1x
    await expect(comboDisplay).toHaveText('1x')

    // Launch multiple balls to cause many rapid bounces
    await clickCanvas(page, 200, 150)
    await clickCanvas(page, 380, 100)
    await clickCanvas(page, 560, 150)
    await clickCanvas(page, 300, 200)

    // Wait for combo to increase above 1x (bounces happen in rapid succession)
    await expect(async () => {
      const text = await comboDisplay.textContent()
      const val  = parseInt(text?.replace('x', '') ?? '1', 10)
      expect(val).toBeGreaterThan(1)
    }).toPass({ timeout: 15000, intervals: [500] })

    await captureScreenshot(page, '07-combo-multiplier')
  })

  // ── Screenshot: Main canvas screen ───────────────────────────────────────
  test('screenshot: main canvas with multiple neon balls', async ({ page }) => {
    // Launch 4-5 balls
    await clickCanvas(page, 150, 150)
    await clickCanvas(page, 300, 200)
    await clickCanvas(page, 450, 120)
    await clickCanvas(page, 580, 220)
    await clickCanvas(page, 220, 300)

    // Wait a moment for balls to be in-flight
    await page.waitForTimeout(1500)

    await captureScreenshot(page, 'screen-01-main-canvas')
  })

  // ── Screenshot: Settings panel ────────────────────────────────────────────
  test('screenshot: settings panel', async ({ page }) => {
    await page.locator('[data-testid="btn-settings"]').click()
    await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible()
    await captureScreenshot(page, 'screen-03-settings')
  })

  // ── Screenshot: Empty initial canvas ─────────────────────────────────────
  test('screenshot: empty initial canvas with instruction overlay', async ({ page }) => {
    await expect(page.locator('[data-testid="instruction-overlay"]')).toBeVisible()
    await captureScreenshot(page, 'screen-04-empty-canvas')
  })

})
