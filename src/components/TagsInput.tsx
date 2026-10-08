import { useState, type KeyboardEvent } from 'react'
import { Input } from './ui/input'

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
              className="inline-flex items-center gap-1 rounded-full bg-stamp/10 px-2.5 py-0.5 font-registre-mono text-[11px] font-medium text-stamp"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Retirer la liste ${tag}`}
                className="rounded-full text-stamp/60 hover:text-stamp focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <Input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(input)}
        placeholder={placeholder ?? 'Nouvelle liste, puis Entrée…'}
      />

      {suggestions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {suggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => addTag(tag)}
              className="rounded-full border border-paper-border bg-white px-2.5 py-0.5 font-registre-mono text-[11px] font-medium text-ink-muted hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70"
            >
              + {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
