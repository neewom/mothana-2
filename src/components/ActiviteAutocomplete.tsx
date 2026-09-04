import { useState } from 'react'
import type { Activite } from '../types'
import { filterActivites } from '../lib/activiteSearch'
import { Input } from './ui/input'

interface ActiviteAutocompleteProps {
  activites: Activite[]
  value: string
  onChange: (id: string) => void
  disabled?: boolean
  placeholder?: string
}

const MAX_RESULTS = 20

export default function ActiviteAutocomplete({
  activites,
  value,
  onChange,
  disabled,
  placeholder = 'Rechercher une activité…',
}: ActiviteAutocompleteProps) {
  // null = not actively editing: the displayed text is derived from `value`.
  // A string once the user starts typing, until a pick or blur resolves it.
  const [draft, setDraft] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const selected = activites.find((a) => a.id === value)
  const displayValue = draft !== null ? draft : (selected ? selected.nom : '')

  function handleSelect(a: Activite) {
    onChange(a.id)
    setDraft(null)
    setOpen(false)
  }

  function handleBlur() {
    setOpen(false)
    if (draft !== null) {
      const stillMatches = selected && selected.nom === draft
      if (!stillMatches) onChange('')
      setDraft(null)
    }
  }

  const results = open ? filterActivites(activites, displayValue).slice(0, MAX_RESULTS) : []

  return (
    <div className="relative">
      <Input
        type="text"
        value={displayValue}
        disabled={disabled}
        onChange={(e) => { setDraft(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-sm border border-paper-border bg-white shadow-lg">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-ink-faint">Aucune activité trouvée</p>
          ) : (
            results.map((a) => (
              <button
                key={a.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(a) }}
                className="block w-full px-3 py-2 text-left text-sm text-ink-muted hover:bg-paper"
              >
                {a.nom}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
