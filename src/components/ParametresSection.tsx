import type { ReactNode } from 'react'

interface ParametresSectionProps {
  title: string
  description?: string
  children: ReactNode
}

/** Carte titre + description + contenu, partagée par les 4 sous-pages de Paramètres. */
export default function ParametresSection({ title, description, children }: ParametresSectionProps) {
  return (
    <div className="rounded-sm border border-paper-border bg-white">
      <div className="border-b border-paper-border px-6 py-4">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}
