import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from './button'

// Bouton qui ouvre une courte liste d'actions (ex. « Listes » → Nouvelle liste, Gérer les listes).
// Même comportement clavier que le menu compte (AccountMenu) : flèches, Début/Fin, Échap.
export interface ActionMenuItem {
  label: string
  onSelect: () => void
  disabled?: boolean
  /** Raison affichée sous le libellé d'un élément désactivé (lisible aussi au toucher, sans survol). */
  disabledReason?: string
  /** `danger` : action à conséquence négative (ex. Supprimer), en encre cachet comme le bouton `danger`. */
  tone?: 'default' | 'danger'
}

interface ActionMenuProps {
  label: string
  icon?: React.ReactNode
  items: ActionMenuItem[]
  /** Côté préféré ; si le menu y sortirait de la fenêtre (bouton passé à gauche en mobile…),
   * il s'ouvre de l'autre côté. */
  align?: 'left' | 'right'
  /** Bouton carré « ⋯ » sans libellé visible (`label` devient son `aria-label`) : menu mobile
   * Importer / Exporter des pages de liste (2026-11-09). Avec `icon`, l'icône remplace les trois
   * points (deux menus icône voisins restent distincts). */
  iconOnly?: boolean
  className?: string
  /** `sidebar` : déclencheur pleine largeur sur le fond encre du menu latéral (« + Nouveau »),
   * liste de la même largeur juste dessous. */
  tone?: 'default' | 'sidebar'
}

// Marge minimale entre le menu et le bord de la fenêtre.
const VIEWPORT_MARGIN = 8

export function ActionMenu({ label, icon, items, align = 'right', iconOnly = false, className, tone = 'default' }: ActionMenuProps) {
  const sidebar = tone === 'sidebar'
  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)
  const menuId = React.useId()
  const [side, setSide] = React.useState(align)

  function entries(): HTMLElement[] {
    return Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])
  }

  React.useEffect(() => {
    if (!open) return
    entries()[0]?.focus()
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  // Côté choisi avant l'affichage (useLayoutEffect), recalculé si la fenêtre change de taille.
  React.useLayoutEffect(() => {
    if (!open) return
    function place() {
      const button = buttonRef.current?.getBoundingClientRect()
      const width = menuRef.current?.offsetWidth
      if (!button || width === undefined) return
      const fits = {
        right: button.right - width >= VIEWPORT_MARGIN,
        left: button.left + width <= document.documentElement.clientWidth - VIEWPORT_MARGIN,
      }
      const other = align === 'right' ? 'left' : 'right'
      setSide(fits[align] || !fits[other] ? align : other)
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open, align])

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const list = entries()
    const index = list.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      buttonRef.current?.focus()
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

  return (
    <div ref={rootRef} className={cn('relative', sidebar && 'w-full', className)}>
      <Button
        ref={buttonRef}
        type="button"
        variant="secondary"
        size={iconOnly ? 'icon' : 'default'}
        className={cn(
          sidebar &&
            'h-10 w-full justify-start border-white/15 bg-white/[0.06] text-paper hover:bg-white/10 focus-visible:ring-paper/70 focus-visible:ring-offset-ink',
        )}
        aria-label={iconOnly ? label : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        {iconOnly && icon ? (
          icon
        ) : iconOnly ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
            <circle cx="5" cy="12" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="19" cy="12" r="1.6" />
          </svg>
        ) : (
          <>
            {icon}
            {label}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className={cn('h-4 w-4', sidebar ? 'ml-auto text-paper/60' : 'text-ink-faint')} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 8l4 4 4-4" />
            </svg>
          </>
        )}
      </Button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={handleKeyDown}
          className={cn(
            'absolute top-full z-40 mt-1 min-w-[12rem] overflow-hidden rounded-sm border border-paper-border bg-white py-1 shadow-lg',
            sidebar ? 'inset-x-0' : side === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item) => {
            const reason = item.disabled ? item.disabledReason : undefined
            const danger = item.tone === 'danger'
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                tabIndex={-1}
                // Avec une raison, l'élément reste atteignable au clavier (aria-disabled) pour qu'elle soit lue.
                disabled={item.disabled && !reason}
                aria-disabled={item.disabled || undefined}
                onClick={() => {
                  if (item.disabled) return
                  setOpen(false)
                  // Le focus revient au déclencheur (comme après Échap) ; une modale ouverte par
                  // l'élément le reprend, puis le rend à ce bouton à sa fermeture.
                  buttonRef.current?.focus()
                  item.onSelect()
                }}
                className={cn(
                  // Libellé sur une seule ligne : le menu prend la largeur de son plus long élément.
                  'block w-full whitespace-nowrap px-4 py-2 text-left font-registre text-sm focus-visible:outline-none aria-disabled:cursor-not-allowed',
                  danger
                    ? 'text-stamp hover:bg-stamp/[0.04] focus-visible:bg-stamp/[0.04]'
                    : 'text-ink-muted hover:bg-paper focus-visible:bg-paper focus-visible:text-ink',
                  // Sans raison, l'élément désactivé est simplement estompé ; avec raison, seul le
                  // libellé l'est, l'explication reste lisible.
                  item.disabled && !reason && 'opacity-50',
                  reason && 'hover:bg-transparent focus-visible:bg-paper',
                )}
              >
                <span className={cn(reason && 'opacity-50')}>{item.label}</span>
                {reason && (
                  <span className="mt-0.5 block max-w-[16rem] whitespace-normal font-registre text-xs text-ink-faint">{reason}</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
