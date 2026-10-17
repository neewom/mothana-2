import * as React from 'react'
import { cn } from '@/lib/utils'

// Tiroir mobile (panneau de détail, menu principal, recherche) — DESIGN.md › Mouvement : fond en
// fondu, panneau qui glisse depuis son bord, à l'entrée comme à la sortie. Le tiroir reste monté
// le temps de la sortie et garde le dernier contenu affiché pendant ce temps (la page a souvent
// déjà vidé sa sélection) ; avec « réduire les animations », fondu seul.
type SheetSide = 'left' | 'right' | 'top'

interface SheetProps {
  open: boolean
  onClose: () => void
  side: SheetSide
  /** Conteneur plein écran (z-index, visibilité par breakpoint). */
  className?: string
  /** Panneau lui-même (largeur, fond, ombre…), positionné contre son bord par `side`. */
  panelClassName?: string
  children: React.ReactNode
}

const SIDE_CLASSES: Record<SheetSide, { position: string; enter: string; exit: string }> = {
  right: {
    position: 'absolute inset-y-0 right-0',
    enter: 'motion-safe:slide-in-from-right',
    exit: 'motion-safe:slide-out-to-right',
  },
  left: {
    position: 'absolute inset-y-0 left-0',
    enter: 'motion-safe:slide-in-from-left',
    exit: 'motion-safe:slide-out-to-left',
  },
  top: {
    position: 'relative',
    enter: 'motion-safe:slide-in-from-top',
    exit: 'motion-safe:slide-out-to-top',
  },
}

// Filet si `animationend` ne vient pas (onglet en arrière-plan…) : un peu plus que la durée.
const EXIT_FALLBACK_MS = 300

export function Sheet({ open, onClose, side, className, panelClassName, children }: SheetProps) {
  const [closing, setClosing] = React.useState(false)
  const [retained, setRetained] = React.useState<React.ReactNode>(null)
  const [prevOpen, setPrevOpen] = React.useState(open)

  if (prevOpen !== open) {
    setPrevOpen(open)
    setClosing(!open)
  }

  React.useEffect(() => {
    if (open) setRetained(children)
  }, [open, children])

  React.useEffect(() => {
    if (!closing) return
    const timer = setTimeout(() => setClosing(false), EXIT_FALLBACK_MS)
    return () => clearTimeout(timer)
  }, [closing])

  if (!open && !closing) return null

  const motion = SIDE_CLASSES[side]

  return (
    <div className={cn('fixed inset-0', className)}>
      <div
        className={cn(
          'absolute inset-0 bg-ink/40 duration-200 ease-out',
          open ? 'animate-in fade-in-0' : 'animate-out fade-out-0 fill-mode-forwards',
        )}
        onClick={open ? onClose : undefined}
      />
      <div
        className={cn(
          motion.position,
          'duration-200 ease-out',
          open
            ? cn('animate-in motion-reduce:fade-in-0', motion.enter)
            : cn('pointer-events-none animate-out fill-mode-forwards motion-reduce:fade-out-0', motion.exit),
          panelClassName,
        )}
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget && !open) setClosing(false)
        }}
      >
        {open ? children : retained}
      </div>
    </div>
  )
}
