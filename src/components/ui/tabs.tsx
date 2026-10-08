import * as React from 'react'
import { cn } from '@/lib/utils'

// Onglets simples (pas de dépendance Radix) : barre de boutons soulignés, seul l'onglet
// actif porte le cachet. Le contenu est rendu par la page selon `value` — ce composant ne
// gère que la barre et la sémantique ARIA (tablist/tab, flèches gauche/droite).
export interface TabItem<T extends string> {
  value: T
  label: string
  count?: number
}

interface TabsProps<T extends string> {
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  idPrefix: string
  className?: string
  'aria-label'?: string
}

function Tabs<T extends string>({ items, value, onChange, idPrefix, className, ...props }: TabsProps<T>) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([])

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const delta = event.key === 'ArrowRight' ? 1 : -1
    const next = (index + delta + items.length) % items.length
    onChange(items[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={props['aria-label']}
      className={cn('flex gap-1 overflow-x-auto border-b border-paper-border', className)}
    >
      {items.map((item, index) => {
        const selected = item.value === value
        return (
          <button
            key={item.value}
            ref={(element) => { refs.current[index] = element }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${item.value}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${item.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              '-mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 font-registre text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70',
              selected ? 'border-stamp text-stamp' : 'border-transparent text-ink-muted hover:text-ink'
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span className="font-registre-mono text-[11px] tabular-nums text-ink-faint">{item.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export { Tabs }
