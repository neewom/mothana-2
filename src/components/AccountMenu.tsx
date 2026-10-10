import { Badge } from './ui/badge'
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { accountInitials } from '../lib/accountInitials'
import { cn } from '../lib/utils'

interface AccountMenuProps {
  nomAffiche: string | null
  email: string | null
  /** Rôle affiché sous l'identité (« Administrateur », « Contributeur »). */
  roleLabel?: string | null
  /** Absent en mode « Consulter » super-admin : ni compte d'organisation ni déconnexion depuis cette vue. */
  onLogout?: () => void
  showAccountLink: boolean
}

const ITEM_CLASS =
  'flex w-full items-center px-4 py-2.5 text-left font-registre text-sm text-ink-muted hover:bg-paper focus-visible:bg-paper focus-visible:outline-none'

/**
 * Menu compte de la barre du haut : avatar à initiales, identité, Mon compte, Centre d'aide,
 * Se déconnecter. Ouverture au clic ou au clavier (Entrée, Espace, flèche bas), navigation aux
 * flèches, fermeture par Échap (focus rendu au bouton) ou clic extérieur.
 */
export default function AccountMenu({ nomAffiche, email, roleLabel, onLogout, showAccountLink }: AccountMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  function items(): HTMLElement[] {
    return Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
  }

  function close(returnFocus: boolean) {
    setOpen(false)
    if (returnFocus) buttonRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    items()[0]?.focus()

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const list = items()
    const index = list.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'Escape') {
      event.preventDefault()
      close(true)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      list[(index + 1) % list.length]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      list[(index - 1 + list.length) % list.length]?.focus()
    } else if (event.key === 'Home') {
      event.preventDefault()
      list[0]?.focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      list[list.length - 1]?.focus()
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  const label = nomAffiche?.trim() || email || 'Mon compte'

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Menu du compte (${label})`}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault()
            setOpen(true)
          }
        }}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-ink font-registre text-xs font-semibold text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70 focus-visible:ring-offset-1"
      >
        {accountInitials(nomAffiche, email)}
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Compte"
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-sm border border-paper-border bg-white py-1 shadow-lg"
        >
          <div className="border-b border-paper-border-muted px-4 py-3">
            <p className="truncate font-registre text-sm font-medium text-ink">{nomAffiche?.trim() || 'Compte'}</p>
            {email && <p className="truncate font-registre-mono text-[11px] text-ink-faint">{email}</p>}
            {roleLabel && <Badge variant="neutral" className="mt-1.5">{roleLabel}</Badge>}
          </div>
          {showAccountLink && (
            <Link to="/admin/parametres/compte" role="menuitem" tabIndex={-1} className={ITEM_CLASS} onClick={() => close(false)}>
              Mon compte
            </Link>
          )}
          <a href="/aide" target="_blank" rel="noopener noreferrer" role="menuitem" tabIndex={-1} className={ITEM_CLASS} onClick={() => close(false)}>
            Centre d’aide
            <span aria-hidden className="ml-1 text-ink-faint">↗</span>
          </a>
          {onLogout && (
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={cn(ITEM_CLASS, 'border-t border-paper-border-muted text-stamp')}
              onClick={() => {
                setOpen(false)
                onLogout()
              }}
            >
              Se déconnecter
            </button>
          )}
        </div>
      )}
    </div>
  )
}
