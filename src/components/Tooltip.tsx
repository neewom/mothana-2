import { useState, type ReactNode } from 'react'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  triggerClassName?: string
}

// Hover (desktop) + tap pour rouvrir/fermer (mobile/tactile) — pas de dépendance
// à mouseenter côté tactile, qui n'est pas fiable sur tous les navigateurs.
export default function Tooltip({ content, children, triggerClassName }: TooltipProps) {
  const [open, setOpen] = useState(false)

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        className={`cursor-help underline decoration-dotted decoration-slate-400 underline-offset-2 ${triggerClassName ?? ''}`}
      >
        {children}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-30 mb-1.5 w-max max-w-xs whitespace-pre-line rounded-lg bg-slate-900 px-3 py-2 text-xs leading-relaxed text-white shadow-lg">
          {content}
        </div>
      )}
    </span>
  )
}
