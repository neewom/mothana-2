import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'

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
  /** Aligné sur le bord gauche du déclencheur par défaut ; `end` (bord droit) près du bord droit de l'écran. */
  align?: 'start' | 'end'
  /** Largeur max de la bulle (`max-w-xs` par défaut) : plus étroite pour un déclencheur loin du bord gauche, en mobile. */
  maxWidthClassName?: string
  /** Bulle en position fixe, calculée à l'ouverture : pour un déclencheur dans un conteneur qui
   * coupe ce qui dépasse (tableau défilant). Refermée au défilement et au redimensionnement. */
  fixed?: boolean
}

// Survol à la souris (desktop) + tap pour ouvrir/fermer (mobile/tactile). Le survol ne réagit qu'à
// la souris : un tap émule aussi un mouseenter, qui ouvrait l'infobulle juste avant que le clic la
// referme.
export default function Tooltip({ content, children, triggerClassName, bare = false, className, placement = 'top', align = 'start', maxWidthClassName = 'max-w-xs', fixed = false }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const [fixedStyle, setFixedStyle] = useState<CSSProperties | undefined>(undefined)
  const ref = useRef<HTMLSpanElement>(null)

  function ouvrir() {
    if (fixed && ref.current) {
      const r = ref.current.getBoundingClientRect()
      setFixedStyle({
        position: 'fixed',
        ...(placement === 'bottom' ? { top: r.bottom + 6 } : { bottom: window.innerHeight - r.top + 6 }),
        ...(align === 'end' ? { right: window.innerWidth - r.right } : { left: r.left }),
      })
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open || !fixed) return
    const fermer = () => setOpen(false)
    window.addEventListener('scroll', fermer, true)
    window.addEventListener('resize', fermer)
    return () => {
      window.removeEventListener('scroll', fermer, true)
      window.removeEventListener('resize', fermer)
    }
  }, [open, fixed])

  const handlers = {
    onPointerEnter: (e: PointerEvent) => { if (e.pointerType === 'mouse') ouvrir() },
    onPointerLeave: (e: PointerEvent) => { if (e.pointerType === 'mouse') setOpen(false) },
    onClick: () => { if (open) setOpen(false); else ouvrir() },
    onBlur: () => setOpen(false),
  }

  return (
    <span ref={ref} className={`relative inline-block ${className ?? ''}`}>
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
        <div
          style={fixed ? fixedStyle : undefined}
          className={`${fixed ? '' : `absolute ${align === 'end' ? 'right-0' : 'left-0'} ${placement === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'}`} z-30 w-max ${maxWidthClassName} whitespace-pre-line rounded-sm bg-ink px-3 py-2 font-registre text-xs leading-relaxed text-paper shadow-lg`}
        >
          {content}
        </div>
      )}
    </span>
  )
}
