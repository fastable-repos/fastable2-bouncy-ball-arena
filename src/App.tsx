function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
      <style>{`
        @keyframes pulse-dot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        .dot { animation: pulse-dot 1.4s ease-in-out infinite; }
        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }
      `}</style>
      <div className="text-center space-y-6">
        <div className="flex items-center justify-center gap-2">
          <div className="dot w-2.5 h-2.5 rounded-full bg-indigo-400" />
          <div className="dot w-2.5 h-2.5 rounded-full bg-indigo-400" />
          <div className="dot w-2.5 h-2.5 rounded-full bg-indigo-400" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-slate-200 tracking-tight">
            Building your app...
          </h1>
          <p className="text-sm text-slate-500 max-w-xs mx-auto">
            This preview updates live as code is generated.
          </p>
        </div>
      </div>
    </div>
  )
}

export default App
