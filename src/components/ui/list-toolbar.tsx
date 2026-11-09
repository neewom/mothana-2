import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { Input } from './input'
import type { ModeListe } from '@/lib/listeDonnees'

// Barre d'outils de la carte d'une page de liste (gabarit, DESIGN.md › Page de liste) :
// recherche, bouton « Filtres · n » qui ouvre le tiroir de filtres, contrôles de la carte à
// droite. Les filtres actifs s'affichent dessous en pastilles retirables (`FilterChips`).
// `mode` (fourni par `useModeListe` sous 768 px seulement) ajoute le sélecteur tableau / cartes.
interface ListToolbarProps {
  search?: {
    value: string
    onChange: (value: string) => void
    placeholder: string
    label?: string
  }
  /** Nombre de filtres actifs ; le bouton n'apparaît que si `onOpenFilters` est fourni. */
  filterCount?: number
  onOpenFilters?: () => void
  /** Contrôles placés après le bouton Filtres (ex. statut, colonnes). */
  children?: React.ReactNode
  /** Contrôles alignés à droite de la barre (ex. Colonnes, Listes). */
  end?: React.ReactNode
  /** Sélecteur tableau / cartes (`useModeListe().selecteur`, absent à partir de 768 px). */
  mode?: { value: ModeListe; onChange: (mode: ModeListe) => void }
  className?: string
}

const MODES: { value: ModeListe; label: string; path: string }[] = [
  { value: 'cartes', label: 'Afficher en cartes', path: 'M4 5.5h16v5H4zM4 13.5h16v5H4z' },
  { value: 'tableau', label: 'Afficher en tableau', path: 'M4 5h16v14H4zM4 10h16M4 14.5h16M10 10v9' },
]

function SelecteurMode({ value, onChange }: NonNullable<ListToolbarProps['mode']>) {
  return (
    <div role="group" aria-label="Affichage de la liste" className="inline-flex h-9 shrink-0 items-center gap-0.5 rounded-sm border border-paper-border bg-white p-0.5 md:hidden">
      {MODES.map((m) => {
        const actif = m.value === value
        return (
          <button
            key={m.value}
            type="button"
            aria-pressed={actif}
            aria-label={m.label}
            onClick={() => onChange(m.value)}
            className={cn(
              'inline-flex h-full w-9 items-center justify-center rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70',
              actif ? 'bg-stamp/[0.06] text-stamp' : 'text-ink-faint hover:text-ink',
            )}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d={m.path} />
            </svg>
          </button>
        )
      })}
    </div>
  )
}

export function ListToolbar({ search, filterCount = 0, onOpenFilters, children, end, mode, className }: ListToolbarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2 border-b border-paper-border px-4 py-3 md:px-6', className)}>
      {search && (
        <div className="relative w-full sm:w-72">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
          </svg>
          <Input
            type="search"
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder}
            aria-label={search.label ?? search.placeholder}
            className="pl-9"
          />
        </div>
      )}
      {onOpenFilters && (
        <Button type="button" variant={filterCount > 0 ? 'default' : 'secondary'} onClick={onOpenFilters} aria-haspopup="dialog">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18M6 12h12M10 19h4" />
          </svg>
          {filterCount > 0 ? `Filtres · ${filterCount}` : 'Filtres'}
        </Button>
      )}
      {children}
      {(end || mode) && (
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {mode && <SelecteurMode {...mode} />}
          {end}
        </div>
      )}
    </div>
  )
}

export interface FilterChip {
  key: string
  label: string
  value: string
  onRemove: () => void
}

export function FilterChips({ chips, onClearAll, className }: { chips: FilterChip[]; onClearAll?: () => void; className?: string }) {
  if (chips.length === 0) return null
  return (
    <div className={cn('flex flex-wrap items-center gap-2 border-b border-paper-border px-4 py-2.5 md:px-6', className)}>
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1 rounded-full border border-paper-border bg-paper py-0.5 pl-2.5 pr-1 text-xs text-ink-muted"
        >
          {chip.label} : <span className="font-medium text-ink">{chip.value}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            className="ml-0.5 rounded-full p-0.5 text-ink-faint transition-colors hover:text-stamp focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70"
            aria-label={`Retirer le filtre ${chip.label} : ${chip.value}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}
      {onClearAll && chips.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="rounded-sm text-xs font-medium text-stamp hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70"
        >
          Tout effacer
        </button>
      )}
    </div>
  )
}
