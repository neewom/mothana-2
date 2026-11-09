import type { ReactNode } from 'react'

interface ParametresSectionProps {
  /** Ancre facultative (ex. `email-recus` pour /admin/dons/parametres#email-recus). */
  id?: string
  title: string
  description?: string
  /** Titre en `<h3>` quand la carte est dans un `ParametresGroupe` (qui porte le `<h2>`). */
  level?: 2 | 3
  children: ReactNode
}

/** Carte titre + description + contenu, partagée par les 4 sous-pages de Paramètres. */
export default function ParametresSection({ id, title, description, level = 2, children }: ParametresSectionProps) {
  const Heading = level === 3 ? 'h3' : 'h2'
  return (
    <div id={id} className="scroll-mt-6 rounded-sm border border-paper-border bg-white">
      <div className="border-b border-paper-border px-6 py-4">
        <Heading className="text-lg font-semibold text-ink">{title}</Heading>
        {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}
