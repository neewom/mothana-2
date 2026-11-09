import type { ReactNode } from 'react'

interface ParametresGroupeProps {
  id: string
  title: string
  children: ReactNode
}

/**
 * Intertitre qui regroupe plusieurs cartes `ParametresSection` d'une page de paramètres de module
 * (ex. « Reçus fiscaux » dans Paramètres des dons). Les cartes du groupe passent leur titre en `<h3>`.
 */
export default function ParametresGroupe({ id, title, children }: ParametresGroupeProps) {
  return (
    <section aria-labelledby={id} className="space-y-6">
      <h2 id={id} className="border-b border-paper-border pb-2 text-xl font-semibold text-ink">{title}</h2>
      {children}
    </section>
  )
}
