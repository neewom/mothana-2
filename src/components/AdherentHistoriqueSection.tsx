import { useState, useEffect, useCallback } from 'react'
import type { JournalModification } from '../types'
import { fetchJournalModificationsForLigne } from '../lib/journalModifications'
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
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [organisationId, adherentId])

  useEffect(() => {
    load()
  }, [load])

  return (
    <details className="rounded-lg border border-slate-200">
      <summary className="cursor-pointer select-none rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
        Historique{entries.length > 0 ? ` (${entries.length})` : ''}
      </summary>
      <div className="border-t border-slate-200 px-3 py-2">
        {error && <p className="text-sm text-red-700">Erreur : {error}</p>}

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
        ) : entries.length === 0 ? (
          <p className="py-2 text-sm text-slate-400">Aucun historique pour l'instant.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {entries.map((entry) => (
              <li key={entry.id} className="py-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <JournalActionLabel entry={entry} showTable={false} showName={false} />
                  <span className="shrink-0 text-xs text-slate-400">{formatDateTime(entry.created_at)}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">Par {entry.auteur_nom ?? '—'}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  )
}
