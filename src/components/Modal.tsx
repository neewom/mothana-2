import { useRef, type ReactNode } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  maxWidthClassName?: string
  labelledBy?: string
  fullScreen?: boolean
  /** Remplace le max-h-[90vh] par défaut — utile quand le contenu doit occuper toute la hauteur disponible plutôt que s'ajuster à son contenu. */
  heightClassName?: string
}

export default function Modal({
  open,
  onClose,
  children,
  maxWidthClassName = 'max-w-md',
  labelledBy,
  fullScreen = false,
  heightClassName,
}: ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useFocusTrap(cardRef, open, { onEscape: onClose, initialFocusRef: closeButtonRef })

  if (!open) return null

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center overflow-y-auto ${fullScreen ? '' : 'p-4'}`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal card */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={
          fullScreen
            ? 'relative z-10 flex h-screen w-screen flex-col bg-white shadow-xl'
            : `relative z-10 flex w-full ${maxWidthClassName} flex-col rounded-2xl bg-white shadow-xl ${heightClassName ?? 'max-h-[90vh]'}`
        }
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute right-4 top-4 z-20 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  )
}
