import * as React from 'react'
import { Sheet } from './sheet'

// Panneau de détail d'une page de liste (gabarit, DESIGN.md › Page de liste) : colonne à droite
// du tableau en desktop (lg), panneau glissant plein écran par-dessus en mobile — même
// comportement que le panneau historique de Dons (PR #111). La page place `SidePanel` à côté
// de la carte du tableau, dans un conteneur `flex gap-6`.
interface SidePanelProps {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  /** Actions de l'élément, en pied de panneau. */
  footer?: React.ReactNode
  children: React.ReactNode
}

function PanelContent({ title, onClose, footer, children }: Omit<SidePanelProps, 'open'>) {
  return (
    <div className="flex h-full flex-col font-registre">
      <div className="flex items-center justify-between gap-3 border-b border-paper-border px-6 py-4">
        <h2 className="min-w-0 text-lg font-semibold text-ink">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le détail"
          className="shrink-0 rounded-sm p-1.5 text-ink-faint transition-colors hover:text-stamp focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">{children}</div>
      {footer && <div className="space-y-2 border-t border-paper-border px-6 py-4">{footer}</div>}
    </div>
  )
}

export function SidePanel({ open, onClose, title, footer, children }: SidePanelProps) {
  const content = open ? <PanelContent title={title} onClose={onClose} footer={footer}>{children}</PanelContent> : null

  return (
    <>
      {open && (
        <aside className="hidden min-h-[400px] w-80 flex-shrink-0 rounded-sm border border-paper-border bg-white lg:flex lg:flex-col">
          {content}
        </aside>
      )}
      <SidePanelMobile open={open} onClose={onClose}>
        {content}
      </SidePanelMobile>
    </>
  )
}

/** Tiroir mobile seul (sous lg) — pour une page dont le panneau desktop a sa propre mise en page. */
export function SidePanelMobile({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      side="right"
      className="z-30 lg:hidden"
      panelClassName="flex w-full max-w-sm flex-col bg-white shadow-xl"
    >
      {children}
    </Sheet>
  )
}

/** Couple libellé (mono, petites capitales) / valeur d'un panneau de détail. */
export function DetailField({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <div className="mt-1 text-sm text-ink">{children}</div>
    </div>
  )
}
