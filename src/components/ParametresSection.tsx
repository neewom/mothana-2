import type { ReactNode } from 'react'

interface ParametresSectionProps {
  title: string
  description?: string
  children: ReactNode
}

/** Carte titre + description + contenu, partagée par les 4 sous-pages de Paramètres. */
export default function ParametresSection({ title, description, children }: ParametresSectionProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}
