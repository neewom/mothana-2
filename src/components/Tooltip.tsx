import { useState, type ReactNode } from 'react'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  triggerClassName?: string
  /** Le déclencheur est déjà un élément interactif stylisé (ex. un <button>) — rend un <span>
   * non focusable plutôt que le <button> par défaut, pour éviter un <button> imbriqué invalide.
   * Le hover/focus/blur de l'enfant remonte naturellement (React fait bubbler focus/blur). */
  bare?: boolean
  /** Classes du conteneur (ex. `min-w-0 max-w-full` pour un déclencheur tronqué par une ellipse). */
  className?: string
  /** Au-dessus par défaut ; `bottom` pour un déclencheur collé en haut de l'écran (barre du haut). */
  placement?: 'top' | 'bottom'
}

// Hover (desktop) + tap pour rouvrir/fermer (mobile/tactile) — pas de dépendance
// à mouseenter côté tactile, qui n'est pas fiable sur tous les navigateurs.
export default function Tooltip({ content, children, triggerClassName, bare = false, className, placement = 'top' }: TooltipProps) {
  const [open, setOpen] = useState(false)

  const handlers = {
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
    onClick: () => setOpen((o) => !o),
    onBlur: () => setOpen(false),
  }

  return (
    <span className={`relative inline-block ${className ?? ''}`}>
      {bare ? (
        <span {...handlers} className={triggerClassName}>
          {children}
        </span>
      ) : (
        <button
          type="button"
          {...handlers}
          className={`cursor-help rounded-sm underline decoration-dotted decoration-ink-faint underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70 ${triggerClassName ?? ''}`}
        >
          {children}
        </button>
      )}
      {open && (
        <div className={`absolute left-0 z-30 w-max max-w-xs whitespace-pre-line rounded-sm bg-ink px-3 py-2 font-registre text-xs leading-relaxed text-paper shadow-lg ${placement === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'}`}>
          {content}
        </div>
      )}
    </span>
  )
}
