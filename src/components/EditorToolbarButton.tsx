import type { ReactNode } from 'react'

/** Bouton de la barre d'outils de l'éditeur riche (Tiptap) : emailing et email des reçus fiscaux. */
export default function EditorToolbarButton({
  active,
  onClick,
  children,
  label,
  disabled = false,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      className={`rounded-sm px-2.5 py-1.5 font-registre text-sm font-medium transition-colors disabled:opacity-50 ${
        active ? 'bg-stamp text-white' : 'text-ink-muted hover:bg-paper-border/40'
      }`}
    >
      {children}
    </button>
  )
}
