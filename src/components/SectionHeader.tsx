import type { ReactNode } from 'react'

interface SectionHeaderProps {
  titleId?: string
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  /** Réserve l'espace du bouton fermer absolu de Modal.tsx (top-4 right-4, 48px depuis le bord de la carte) pour éviter toute collision. */
  reserveCloseButton?: boolean
}

/**
 * En-tête de modale/carte : titre (+ description optionnelle) à gauche, actions à droite,
 * qui s'empile en colonne sous `sm`. Centralise un pattern dupliqué dans 5 fichiers (PR #57)
 * dont le débordement mobile a été corrigé au cas par cas.
 */
export default function SectionHeader({
  titleId,
  title,
  description,
  actions,
  reserveCloseButton = false,
}: SectionHeaderProps) {
  return (
    <div
      className={`flex flex-col gap-3 border-b border-slate-200 px-6 py-4 sm:flex-row sm:justify-between ${
        description ? 'sm:items-start' : 'sm:items-center'
      } ${reserveCloseButton ? 'pr-14' : ''}`}
    >
      <div className="min-w-0">
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
