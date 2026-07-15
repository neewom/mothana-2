import { useEffect, useRef, type RefObject } from 'react'
import { pushModal, popModal, isTopModal } from '../lib/modalStack'

interface UseFocusTrapOptions {
  onEscape?: () => void
  initialFocusRef?: RefObject<HTMLElement | null>
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Traps Tab/Shift+Tab focus cycling within `containerRef` while `active` is
 * true: focuses `initialFocusRef` (or the first focusable element) on
 * activation, restores focus to whatever was previously focused on
 * deactivation, and calls `onEscape` on the Escape key if provided.
 * Only the topmost active trap (see modalStack) reacts to a given keydown,
 * so nested modals don't both respond to the same key press.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  { onEscape, initialFocusRef }: UseFocusTrapOptions = {}
) {
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active) return

    const stackId = pushModal()
    previouslyFocused.current = document.activeElement as HTMLElement | null

    const container = containerRef.current
    const focusTarget = initialFocusRef?.current ?? container?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    focusTarget?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (!isTopModal(stackId)) return

      if (e.key === 'Escape' && onEscape) {
        onEscape()
        return
      }
      if (e.key !== 'Tab') return

      const focusables = container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (!focusables || focusables.length === 0) return

      const first = focusables[0]
      const last = focusables[focusables.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      popModal(stackId)
      previouslyFocused.current?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])
}
