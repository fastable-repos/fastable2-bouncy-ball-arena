import { useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0)

  return (
    <div className="flex flex-col items-center gap-6 p-10 bg-white rounded-2xl shadow-lg">
      <h2 className="text-2xl font-semibold text-gray-700 tracking-wide">Counter</h2>

      <span
        data-testid="counter-value"
        className="text-7xl font-bold tabular-nums text-indigo-600 w-36 text-center"
      >
        {count}
      </span>

      <div className="flex gap-4">
        <button
          data-testid="decrement-btn"
          onClick={() => setCount((c) => c - 1)}
          className="w-14 h-14 rounded-full text-3xl font-bold bg-red-100 text-red-600 hover:bg-red-200 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-red-400"
          aria-label="Decrement"
        >
          −
        </button>

        <button
          data-testid="increment-btn"
          onClick={() => setCount((c) => c + 1)}
          className="w-14 h-14 rounded-full text-3xl font-bold bg-green-100 text-green-600 hover:bg-green-200 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-green-400"
          aria-label="Increment"
        >
          +
        </button>
      </div>

      <button
        data-testid="reset-btn"
        onClick={() => setCount(0)}
        className="text-sm text-gray-400 hover:text-gray-600 underline transition-colors"
        aria-label="Reset"
      >
        Reset
      </button>
    </div>
  )
}
