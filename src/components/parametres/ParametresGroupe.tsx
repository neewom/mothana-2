import type { ReactNode } from 'react'

interface ParametresGroupeProps {
  id: string
  title: string
  description?: string
  children: ReactNode
}

/**
 * Intertitre qui regroupe plusieurs cartes `ParametresSection` d'une page de paramètres de module
 * (ex. « Reçus fiscaux » dans Paramètres des dons). Les cartes du groupe passent leur titre en `<h3>`.
 * `id` sert d'ancre (ex. `/admin/parametres/equipe#codes-pin`).
 */
export default function ParametresGroupe({ id, title, description, children }: ParametresGroupeProps) {
  return (
    <section id={id} aria-labelledby={`${id}-titre`} className="scroll-mt-6 space-y-6">
      <div className="border-b border-paper-border pb-2">
        <h2 id={`${id}-titre`} className="text-xl font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      </div>
      {children}
    </section>
  )
}
