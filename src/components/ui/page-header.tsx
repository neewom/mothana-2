import * as React from 'react'

// En-tête commun des pages de liste (gabarit, DESIGN.md › Page de liste) : titre, sous-titre
// en Inter (compteur utile, ex. « 54 dons · 5 156,00 € collectés »), actions de page à droite.
// L'action principale se place en dernier (`Button` par défaut), les autres en `secondary`.
interface PageHeaderProps {
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Pastille à côté du titre (ex. statut d'un événement). */
  badge?: React.ReactNode
  /** Actions de page, l'action principale en dernier. */
  actions?: React.ReactNode
  /** Au-dessus du titre (ex. lien retour). */
  before?: React.ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, badge, actions, before, className }: PageHeaderProps) {
  return (
    <header className={className}>
      {before}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-ink md:text-3xl">{title}</h1>
            {badge}
          </div>
          {subtitle && <div className="mt-1 text-sm text-ink-muted">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2 md:shrink-0 md:justify-end">{actions}</div>}
      </div>
    </header>
  )
}
