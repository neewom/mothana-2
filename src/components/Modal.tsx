import { useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '../hooks/useFocusTrap'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  maxWidthClassName?: string
  labelledBy?: string
  fullScreen?: boolean
  /** Remplace le max-h-[90dvh] par défaut — utile quand le contenu doit occuper toute la hauteur disponible plutôt que s'ajuster à son contenu. */
  heightClassName?: string
  /**
   * Passe le z-index à z-[60] au lieu de z-50 — nécessaire quand ce Modal (non-Radix,
   * pas de portail) s'ouvre par-dessus un Dialog déjà migré (Radix Portal, toujours
   * ré-attaché en toute fin de <body>, donc toujours peint après ce Modal quel que soit
   * l'ordre JSX à z-index égal). Ex. : ParticipantModal ouvert depuis DonModal.
   */
  elevated?: boolean
}

export default function Modal({
  open,
  onClose,
  children,
  maxWidthClassName = 'max-w-md',
  labelledBy,
  fullScreen = false,
  heightClassName,
  elevated = false,
}: ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useFocusTrap(cardRef, open, { onEscape: onClose, initialFocusRef: closeButtonRef })

  if (!open) return null

  const modal = (
    <div
      // data-elevated-modal : marqueur DOM stable pour qu'un Dialog Radix parent (voir
      // DonModal.tsx) puisse reconnaître un clic/Escape dans CE modal comme "pas vraiment
      // à l'extérieur" via une vérification directe de la cible de l'événement — plus
      // fiable qu'un état React lu depuis la closure de l'event handler Radix, qui peut
      // déjà avoir changé (ex. fullModalOpen déjà repassé à false) au moment où l'event
      // Radix se déclenche (trouvé en testant : le clic sur "Fermer" fermait aussi le
      // Dialog parent malgré une garde basée sur l'état).
      {...(elevated ? { 'data-elevated-modal': true } : {})}
      className={`pointer-events-auto fixed inset-0 ${elevated ? 'z-[60]' : 'z-50'} flex items-center justify-center overflow-y-auto ${fullScreen ? '' : 'p-4'}`}
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
            ? 'relative z-10 flex h-dvh w-screen flex-col bg-white shadow-xl'
            : `relative z-10 flex w-full ${maxWidthClassName} flex-col rounded-2xl bg-white shadow-xl ${heightClassName ?? 'max-h-[90dvh]'}`
        }
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute right-4 top-4 z-20 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  )

  // `elevated` : porté explicitement en fin de <body>, comme le Portal Radix des Dialog
  // déjà migrés, plutôt que rendu en place dans l'arbre React — sinon ce Modal reste
  // imbriqué sous le Portal Radix du Dialog parent dans l'arbre DOM, ce qui n'affecte pas
  // son rendu visuel (position:fixed + z-[60] le peignent bien au-dessus) mais casse ses
  // clics : Radix pose `pointer-events: none` sur <body> tant qu'un Dialog est ouvert (et
  // ne réautorise que son propre Content via un style inline), et ce Modal, non-Radix,
  // hérite ce `none` sans jamais le lever — d'où le `pointer-events-auto` explicite
  // ci-dessus, nécessaire dans tous les cas (Dialog ouvert ou non).
  return elevated ? createPortal(modal, document.body) : modal
}
