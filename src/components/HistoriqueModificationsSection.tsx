import { useState, useEffect, useCallback } from 'react'
import type { JournalModification } from '../types'
import { fetchJournalModifications } from '../lib/journalModifications'
import { getErrorMessage } from '../lib/errors'
import HistoriqueModificationsModal from './HistoriqueModificationsModal'
import JournalActionLabel from './JournalActionLabel'

interface HistoriqueModificationsSectionProps {
  organisationId: string
}

const APERCU_SIZE = 10

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function HistoriqueModificationsSection({ organisationId }: HistoriqueModificationsSectionProps) {
  const [entries, setEntries] = useState<JournalModification[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { entries: fetched, totalCount: count } = await fetchJournalModifications(organisationId, APERCU_SIZE, 0)
      setEntries(fetched)
      setTotalCount(count)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [organisationId])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div>
      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Erreur : {error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      ) : entries.length === 0 ? (
        <p className="py-4 text-sm text-slate-400">Aucune modification enregistrée pour l'instant.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div>
                <JournalActionLabel entry={entry} />
                <span className="text-slate-400"> · par {entry.auteur_nom ?? '—'}</span>
              </div>
              <span className="shrink-0 text-xs text-slate-400">{formatDateTime(entry.created_at)}</span>
            </li>
          ))}
        </ul>
      )}

      {totalCount > APERCU_SIZE && (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          Voir plus →
        </button>
      )}

      <HistoriqueModificationsModal open={modalOpen} onClose={() => setModalOpen(false)} organisationId={organisationId} />
    </div>
  )
}
