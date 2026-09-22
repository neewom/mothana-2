import { useState } from 'react'
import type { Activite } from '../types'
import { filterActivites, findExactActivite } from '../lib/activiteSearch'
import { Input } from './ui/input'

interface ActiviteAutocompleteProps {
  activites: Activite[]
  value: string
  onChange: (id: string) => void
  disabled?: boolean
  placeholder?: string
  inputId?: string
  allowCreate?: boolean
  customValue?: string
  onCustomValueChange?: (value: string) => void
}

const MAX_RESULTS = 20

export default function ActiviteAutocomplete({
  activites,
  value,
  onChange,
  disabled,
  placeholder = 'Rechercher une activité…',
  inputId,
  allowCreate = false,
  customValue = '',
  onCustomValueChange,
}: ActiviteAutocompleteProps) {
  // null = not actively editing: the displayed text is derived from `value`.
  // A string once the user starts typing, until a pick or blur resolves it.
  const [draft, setDraft] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const selected = activites.find((a) => a.id === value)
  const displayValue = draft !== null ? draft : (selected ? selected.nom : allowCreate ? customValue : '')

  function handleCustomValue(raw: string) {
    const nextValue = raw.trim()
    onChange('')
    onCustomValueChange?.(nextValue)
    setDraft(null)
    setOpen(false)
  }

  function handleSelect(a: Activite) {
    onChange(a.id)
    onCustomValueChange?.('')
    setDraft(null)
    setOpen(false)
  }

  function handleBlur() {
    setOpen(false)
    if (draft !== null) {
      if (allowCreate) {
        const exactMatch = findExactActivite(activites, draft)
        if (exactMatch) handleSelect(exactMatch)
        else handleCustomValue(draft)
        return
      }
      const stillMatches = selected && selected.nom === draft
      if (!stillMatches) onChange('')
      setDraft(null)
    }
  }

  const results = open ? filterActivites(activites, displayValue).slice(0, MAX_RESULTS) : []
  const exactMatch = allowCreate ? findExactActivite(activites, displayValue) : undefined
  const canCreate = allowCreate && displayValue.trim().length > 0 && !exactMatch

  return (
    <div className="relative">
      <Input
        id={inputId}
        type="text"
        value={displayValue}
        disabled={disabled}
        onChange={(e) => {
          setDraft(e.target.value)
          setOpen(true)
          if (allowCreate) {
            onChange('')
            onCustomValueChange?.(e.target.value)
          }
        }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-sm border border-paper-border bg-white shadow-lg">
          {results.length === 0 && !canCreate ? (
            <p className="px-3 py-2 text-sm text-ink-faint">Aucune activité trouvée</p>
          ) : (
            <>
              {results.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(a) }}
                  className="block w-full px-3 py-2 text-left text-sm text-ink-muted hover:bg-paper"
                >
                  {a.nom}
                </button>
              ))}
              {canCreate && (
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleCustomValue(displayValue) }}
                  className="block w-full border-t border-paper-border px-3 py-2 text-left text-sm font-medium text-stamp hover:bg-paper"
                >
                  Créer « {displayValue.trim()} » à l’enregistrement
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
