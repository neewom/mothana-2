import { useState, useEffect, useCallback } from 'react'
import type { JournalModification } from '../types'
import { fetchJournalModificationsForLigne } from '../lib/journalModifications'
import { getErrorMessage } from '../lib/errors'
import JournalActionLabel from './JournalActionLabel'

interface AdherentHistoriqueSectionProps {
  organisationId: string
  adherentId: string
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdherentHistoriqueSection({ organisationId, adherentId }: AdherentHistoriqueSectionProps) {
  const [entries, setEntries] = useState<JournalModification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const fetched = await fetchJournalModificationsForLigne(organisationId, 'adherents', adherentId)
      setEntries(fetched)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [organisationId, adherentId])

  useEffect(() => {
    load()
  }, [load])

  return (
    <details className="rounded-sm border border-paper-border bg-white">
      <summary className="cursor-pointer select-none rounded-sm px-3 py-2 font-registre text-sm font-medium text-ink-muted hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70">
        Historique{entries.length > 0 ? ` (${entries.length})` : ''}
      </summary>
      <div className="border-t border-paper-border px-3 py-2">
        {error && <p role="alert" className="text-sm text-stamp">Erreur : {error}</p>}

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-4 border-stamp border-t-transparent" />
          </div>
        ) : entries.length === 0 ? (
          <p className="py-2 text-sm text-ink-faint">Aucun historique pour l'instant.</p>
        ) : (
          <ul className="divide-y divide-paper-border-muted">
            {entries.map((entry) => (
              <li key={entry.id} className="py-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <JournalActionLabel entry={entry} showTable={false} showName={false} />
                  <span className="shrink-0 font-registre-mono text-xs text-ink-faint">{formatDateTime(entry.created_at)}</span>
                </div>
                <p className="mt-0.5 text-xs text-ink-faint">Par {entry.auteur_nom ?? '—'}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  )
}
