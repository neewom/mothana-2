import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  onDismiss: () => void
  durationMs?: number
}

export default function Toast({ message, onDismiss, durationMs = 3000 }: ToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const enter = setTimeout(() => setVisible(true), 10)
    const exit = setTimeout(() => setVisible(false), durationMs - 300)
    const remove = setTimeout(onDismiss, durationMs)
    return () => {
      clearTimeout(enter)
      clearTimeout(exit)
      clearTimeout(remove)
    }
  }, [durationMs, onDismiss])

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg transition-all duration-300 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
      {message}
    </div>
  )
}
