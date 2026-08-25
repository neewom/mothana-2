import { useState, type KeyboardEvent } from 'react'

interface TagsInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  availableTags: string[]
  placeholder?: string
}

// Listes de diffusion (adherents.tags) : nuage de tags éditable, réutilisé
// par AdherentModal (édition individuelle) et AssignerListeModal
// (affectation en masse). Pas de "liste vide" créable en avance : un tag
// n'existe qu'une fois porté par au moins un adhérent, donc les suggestions
// viennent uniquement des tags déjà utilisés dans l'organisation.
export default function TagsInput({ tags, onChange, availableTags, placeholder }: TagsInputProps) {
  const [input, setInput] = useState('')

  function addTag(raw: string) {
    const tag = raw.trim()
    if (!tag || tags.includes(tag)) return
    onChange([...tags, tag])
    setInput('')
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag))
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
    }
  }

  const suggestions = availableTags.filter((t) => !tags.includes(t))

  return (
    <div>
      {tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Retirer la liste ${tag}`}
                className="text-indigo-400 hover:text-indigo-700"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(input)}
        placeholder={placeholder ?? 'Nouvelle liste, puis Entrée…'}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {suggestions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {suggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => addTag(tag)}
              className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              + {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
