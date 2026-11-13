import { useEffect, useId, useRef, useState } from 'react'
import type { InputHTMLAttributes, KeyboardEvent } from 'react'
import { getEmailDomainSuggestions } from '../lib/emailDomainSuggestions'
import { cn } from '../lib/utils'
import { Input } from './ui/input'

type ChampEmailProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: string
  onValueChange: (value: string) => void
}

/**
 * Champ email avec suggestions de domaines courants dès le `@` (combobox ARIA, liste filtrée
 * pendant la frappe, choix au toucher ou au clavier). Simple aide à la saisie : la valeur reste
 * une chaîne libre, aucun domaine n'est imposé ni corrigé après coup. Les autres attributs
 * (`id`, `autoComplete`, `aria-invalid`, `className`…) sont transmis tels quels à l'`Input`,
 * pour que la validation et l'accessibilité propres à chaque écran restent inchangées.
 *
 * La liste s'insère dans le flux, sous le champ, plutôt que par-dessus : elle ne masque pas le
 * message d'erreur du champ et n'est pas rognée par le scroll interne d'une modale.
 */
export default function ChampEmail({
  value,
  onValueChange,
  className,
  onKeyDown,
  onFocus,
  onBlur,
  inputMode = 'email',
  ...props
}: ChampEmailProps) {
  const listId = useId()
  const optionIdPrefix = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [focused, setFocused] = useState(false)
  // Échap ou un choix ferment la liste jusqu'à la prochaine frappe.
  const [dismissed, setDismissed] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const suggestions = getEmailDomainSuggestions(value)
  const open = focused && !dismissed && suggestions.length > 0 && !props.disabled
  const active = open && activeIndex >= 0 && activeIndex < suggestions.length ? activeIndex : -1
  const optionId = (index: number) => `${optionIdPrefix}-${index}`

  // Échap dans une modale : Radix écoute la touche sur `document` en phase de capture et
  // fermerait la modale entière. Écouter plus haut (window, capture) permet de ne fermer que
  // la liste quand elle est ouverte ; liste fermée, Échap garde son comportement habituel.
  useEffect(() => {
    if (!open) return
    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape' || event.target !== inputRef.current) return
      event.stopPropagation()
      event.preventDefault()
      setDismissed(true)
      setActiveIndex(-1)
    }
    window.addEventListener('keydown', handleEscape, true)
    return () => window.removeEventListener('keydown', handleEscape, true)
  }, [open])

  useEffect(() => {
    if (active < 0) return
    const option = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)
    option?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function choose(suggestion: string) {
    onValueChange(suggestion)
    setDismissed(true)
    setActiveIndex(-1)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(event)
    if (event.defaultPrevented || !open) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex(active < suggestions.length - 1 ? active + 1 : 0)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(active > 0 ? active - 1 : suggestions.length - 1)
    } else if (event.key === 'Enter' && active >= 0) {
      // Valide la suggestion sans soumettre le formulaire.
      event.preventDefault()
      choose(suggestions[active])
    }
  }

  return (
    <div>
      <Input
        {...props}
        ref={inputRef}
        type="email"
        inputMode={inputMode}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? optionId(active) : undefined}
        value={value}
        className={className}
        onChange={(event) => {
          onValueChange(event.target.value)
          setDismissed(false)
          setActiveIndex(-1)
        }}
        onKeyDown={handleKeyDown}
        onFocus={(event) => {
          setFocused(true)
          onFocus?.(event)
        }}
        onBlur={(event) => {
          setFocused(false)
          setActiveIndex(-1)
          onBlur?.(event)
        }}
      />
      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label="Suggestions d’adresse"
        hidden={!open}
        className="mt-1 max-h-52 overflow-y-auto rounded-sm border border-paper-border bg-white py-1"
      >
        {open &&
          suggestions.map((suggestion, index) => {
            const at = suggestion.indexOf('@')
            return (
              <li
                key={suggestion}
                id={optionId(index)}
                data-index={index}
                role="option"
                aria-selected={index === active}
                // mousedown (souris et toucher) : garder le focus dans le champ pour que le
                // blur ne ferme pas la liste avant le clic.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(suggestion)}
                onMouseMove={() => {
                  if (index !== active) setActiveIndex(index)
                }}
                className={cn(
                  'cursor-pointer break-all px-3 py-2 font-registre text-sm text-ink-muted',
                  index === active && 'bg-paper'
                )}
              >
                <span className="text-ink-faint">{suggestion.slice(0, at + 1)}</span>
                <span className="text-ink">{suggestion.slice(at + 1)}</span>
              </li>
            )
          })}
      </ul>
    </div>
  )
}
