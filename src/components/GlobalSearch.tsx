import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { buildSearchItems, SEARCH_MIN_LENGTH, type GlobalSearchResponse, type SearchItem } from '../lib/globalSearch'
import { supabase } from '../lib/supabaseClient'
import { cn } from '../lib/utils'

const DEBOUNCE_MS = 250

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
    </svg>
  )
}

/**
 * Recherche globale de la barre du haut (RPC rechercher_global) : personnes, portefeuilles,
 * activités et raccourcis. Combobox ARIA : ↑ ↓ pour parcourir, Entrée pour ouvrir, Échap pour
 * fermer ; Ctrl/Cmd + K pour y accéder. Champ sur desktop, icône + panneau sur mobile.
 */
export default function GlobalSearch({ organisationId }: { organisationId: string }) {
  const navigate = useNavigate()
  const listboxId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const requestRef = useRef(0)
  const [terme, setTerme] = useState('')
  const [results, setResults] = useState<SearchItem[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [active, setActive] = useState(0)
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

  // Recherche espacée à la frappe ; une réponse arrivée après une frappe plus récente est ignorée.
  useEffect(() => {
    const value = terme.trim()
    if (value.length < SEARCH_MIN_LENGTH || !organisationId) {
      setResults(null)
      setLoading(false)
      setError(false)
      return
    }
    const request = ++requestRef.current
    setLoading(true)
    const timer = setTimeout(async () => {
      const { data, error: rpcError } = await supabase.rpc('rechercher_global', {
        p_terme: value,
        p_organisation_id: organisationId,
      })
      if (request !== requestRef.current) return
      setLoading(false)
      if (rpcError || !data) {
        setError(true)
        setResults([])
        return
      }
      setError(false)
      setResults(buildSearchItems(data as GlobalSearchResponse))
      setActive(0)
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [terme, organisationId])

  // Ctrl/Cmd + K : champ sur desktop, panneau sur mobile.
  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (window.matchMedia('(min-width: 640px)').matches) {
          inputRef.current?.focus()
          setOpen(true)
        } else {
          setMobileOpen(true)
        }
      }
    }
    document.addEventListener('keydown', handleShortcut)
    return () => document.removeEventListener('keydown', handleShortcut)
  }, [])

  useEffect(() => {
    if (mobileOpen) inputRef.current?.focus()
  }, [mobileOpen])

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  function close() {
    setOpen(false)
    setMobileOpen(false)
  }

  function go(item: SearchItem) {
    close()
    setTerme('')
    setResults(null)
    inputRef.current?.blur()
    navigate(item.to)
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    const count = results?.length ?? 0
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      // Liste fermée : la flèche la rouvre sur le premier résultat, sans avancer.
      if (!open) {
        setOpen(true)
        setActive(0)
      } else if (count) {
        setActive((index) => (index + 1) % count)
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (count) setActive((index) => (index - 1 + count) % count)
    } else if (event.key === 'Enter') {
      const item = results?.[active]
      if (item) {
        event.preventDefault()
        go(item)
      }
    } else if (event.key === 'Escape') {
      event.preventDefault()
      if (terme && open) setOpen(false)
      else close()
    }
  }

  const showPanel = (open || mobileOpen) && terme.trim().length >= SEARCH_MIN_LENGTH
  const groups = useMemo(() => {
    const ordered: { group: string; items: { item: SearchItem; index: number }[] }[] = []
    results?.forEach((item, index) => {
      const last = ordered[ordered.length - 1]
      if (last?.group === item.group) last.items.push({ item, index })
      else ordered.push({ group: item.group, items: [{ item, index }] })
    })
    return ordered
  }, [results])

  const panel = showPanel && (
    <div
      id={listboxId}
      role="listbox"
      aria-label="Résultats de recherche"
      className={cn(
        'z-40 max-h-[70vh] overflow-y-auto rounded-sm border border-paper-border bg-white py-1 shadow-lg',
        mobileOpen ? 'mt-2' : 'absolute left-0 right-0 top-full mt-1'
      )}
    >
      {loading && !results && <p className="px-4 py-3 text-sm text-ink-faint">Recherche…</p>}
      {error && <p className="px-4 py-3 text-sm text-stamp">La recherche est indisponible pour le moment.</p>}
      {!error && results && results.length === 0 && <p className="px-4 py-3 text-sm text-ink-faint">Aucun résultat pour « {terme.trim()} ».</p>}
      {groups.map(({ group, items }) => (
        <div key={group} role="presentation">
          <p role="presentation" className="px-4 pb-1 pt-2 font-registre-mono text-[11px] uppercase tracking-wide text-ink-faint">{group}</p>
          {items.map(({ item, index }) => (
            <div
              key={item.key}
              id={`${listboxId}-${index}`}
              role="option"
              aria-selected={index === active}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => go(item)}
              onMouseEnter={() => setActive(index)}
              className={cn('cursor-pointer px-4 py-2', index === active && 'bg-stamp/[0.05]')}
            >
              <span className={cn('block truncate text-sm font-medium', item.label === 'Acheteur anonymisé' ? 'italic text-ink-faint' : 'text-ink')}>{item.label}</span>
              <span className="block truncate font-registre-mono text-[11px] text-ink-faint">{item.sublabel}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )

  const input = (
    <div className="relative flex items-center">
      <SearchIcon className="pointer-events-none absolute left-3 h-4 w-4 text-ink-faint" />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label="Rechercher une personne, un portefeuille, une activité"
        aria-expanded={showPanel}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={showPanel && results?.length ? `${listboxId}-${active}` : undefined}
        autoComplete="off"
        value={terme}
        onChange={(event) => {
          setTerme(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Rechercher…"
        className="h-9 w-full rounded-sm border border-paper-border bg-paper pl-9 pr-14 font-registre text-sm text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70"
      />
      <kbd className="pointer-events-none absolute right-2 hidden rounded-sm border border-paper-border px-1.5 py-0.5 font-registre-mono text-[11px] text-ink-faint sm:inline">
        {isMac ? '⌘K' : 'Ctrl K'}
      </kbd>
    </div>
  )

  return (
    <>
      {/* Desktop : champ dans la barre */}
      <div ref={mobileOpen ? undefined : rootRef} className="relative hidden w-full max-w-md sm:block">
        {!mobileOpen && input}
        {!mobileOpen && panel}
      </div>

      {/* Mobile : icône, puis panneau en haut de l'écran */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Rechercher"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-ink-muted hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70 sm:hidden"
      >
        <SearchIcon className="h-5 w-5" />
      </button>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={close} />
          <div ref={rootRef} className="relative border-b border-paper-border bg-white p-3">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">{input}</div>
              <button type="button" onClick={close} className="shrink-0 rounded-sm px-2 py-1 text-sm text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70">
                Fermer
              </button>
            </div>
            {panel}
          </div>
        </div>
      )}
    </>
  )
}
