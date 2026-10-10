import * as React from 'react'
import { cn } from '@/lib/utils'

// Tuiles chiffrées communes (accueil, Dons, Statistiques, détail événement) : un seul bandeau
// bordé, libellé mono en petites capitales, valeur mono. Les séparateurs viennent du fond
// `paper-border` visible entre les cellules (gap-px), ce qui tient aussi quand la grille passe
// à la ligne (4 tuiles sur 2 colonnes en mobile).
export interface StatTile {
  label: string
  value: React.ReactNode
  /** Précision sous la valeur (masquée en mobile quand trois tuiles tiennent sur une ligne). */
  hint?: React.ReactNode
  hintTone?: 'neutral' | 'success' | 'warning'
}

const HINT_TONES: Record<NonNullable<StatTile['hintTone']>, string> = {
  neutral: 'text-ink-faint',
  success: 'text-success',
  warning: 'text-warning',
}

const COLUMNS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-4',
}

export function StatTiles({ items, className }: { items: StatTile[]; className?: string }) {
  const compact = items.length === 3
  return (
    <dl
      className={cn(
        'grid gap-px overflow-hidden rounded-sm border border-paper-border bg-paper-border',
        COLUMNS[items.length] ?? 'grid-cols-2 md:grid-cols-4',
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0 bg-white p-3 sm:p-5">
          <dt className="font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">{item.label}</dt>
          <dd
            className={cn(
              'mt-1 font-registre-mono font-semibold tabular-nums text-ink sm:mt-2 sm:text-2xl',
              compact ? 'text-base' : 'text-lg',
            )}
          >
            {item.value}
          </dd>
          {item.hint && (
            <p className={cn('mt-1 text-xs', HINT_TONES[item.hintTone ?? 'neutral'], compact && 'hidden sm:block')}>
              {item.hint}
            </p>
          )}
        </div>
      ))}
    </dl>
  )
}
