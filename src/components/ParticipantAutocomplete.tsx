import { useState } from 'react'
import type { ProfilParticipant } from '../types'
import { participantFullName, filterParticipants } from '../lib/participantSearch'

interface ParticipantAutocompleteProps {
  participants: ProfilParticipant[]
  value: string
  onChange: (id: string) => void
  disabled?: boolean
  placeholder?: string
}

const MAX_RESULTS = 20

export default function ParticipantAutocomplete({
  participants,
  value,
  onChange,
  disabled,
  placeholder = 'Rechercher un participant…',
}: ParticipantAutocompleteProps) {
  // null = not actively editing: the displayed text is derived from `value`.
  // A string once the user starts typing, until a pick or blur resolves it.
  const [draft, setDraft] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const selected = participants.find((p) => p.id === value)
  const displayValue = draft !== null ? draft : (selected ? participantFullName(selected) : '')

  function handleSelect(p: ProfilParticipant) {
    onChange(p.id)
    setDraft(null)
    setOpen(false)
  }

  function handleBlur() {
    setOpen(false)
    if (draft !== null) {
      const stillMatches = selected && participantFullName(selected) === draft
      if (!stillMatches) onChange('')
      setDraft(null)
    }
  }

  const results = open ? filterParticipants(participants, displayValue).slice(0, MAX_RESULTS) : []

  return (
    <div className="relative">
      <input
        type="text"
        value={displayValue}
        disabled={disabled}
        onChange={(e) => { setDraft(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-400">Aucun participant trouvé</p>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(p) }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-indigo-50"
              >
                {participantFullName(p)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
