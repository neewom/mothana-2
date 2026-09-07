import { useState, useCallback } from 'react'

interface ToastState {
  id: number
  message: string
  durationMs?: number
}

/**
 * Minimal toast queue: holds at most one message at a time. Showing a new
 * toast while one is visible replaces it (new `id` restarts the component's
 * enter animation).
 */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null)

  const showToast = useCallback((message: string, durationMs?: number) => {
    setToast({ id: Date.now(), message, durationMs })
  }, [])

  const dismissToast = useCallback(() => setToast(null), [])

  return { toast, showToast, dismissToast }
}
