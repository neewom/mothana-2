import { lazy, Suspense } from 'react'
import type { EditorProps } from '@monaco-editor/react'
import { chargerMonaco } from '../lib/monacoLoader'
import { LoadErrorBoundary } from './LoadErrorBoundary'

// Éditeur Monaco chargé à la demande : monaco-editor n'entre jamais dans le chunk principal,
// il est configuré (instance locale + workers) avant le premier rendu de l'éditeur.
// Un échec de chargement reste confiné à la zone de l'éditeur (LoadErrorBoundary).
const MonacoEditor = lazy(async () => {
  await chargerMonaco()
  return import('@monaco-editor/react')
})

export default function CodeEditor(props: EditorProps) {
  return (
    <LoadErrorBoundary message="Impossible de charger l'éditeur.">
      <Suspense
        fallback={<div className="py-8 text-center text-sm text-ink-faint">Chargement de l'éditeur…</div>}
      >
        <MonacoEditor {...props} />
      </Suspense>
    </LoadErrorBoundary>
  )
}
