import { useState, useEffect, useCallback } from 'react'
import type { JournalModification } from '../types'
import { fetchJournalModifications } from '../lib/journalModifications'
import { getErrorMessage } from '../lib/errors'
import Modal from './Modal'
import JournalActionLabel from './JournalActionLabel'

interface HistoriqueModificationsModalProps {
  open: boolean
  onClose: () => void
  organisationId: string
}

const PAGE_SIZE = 25

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function HistoriqueModificationsModal({ open, onClose, organisationId }: HistoriqueModificationsModalProps) {
  const [entries, setEntries] = useState<JournalModification[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { entries: fetched, totalCount: count } = await fetchJournalModifications(
        organisationId,
        PAGE_SIZE,
        (currentPage - 1) * PAGE_SIZE,
      )
      setEntries(fetched)
      setTotalCount(count)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [organisationId, currentPage])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  useEffect(() => {
    if (open) setCurrentPage(1)
  }, [open])

  if (!open) return null

  return (
    <Modal open={open} onClose={onClose} maxWidthClassName="max-w-2xl" labelledBy="historique-modifications-title">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 id="historique-modifications-title" className="text-lg font-semibold text-slate-900">
          Historique des modifications
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Erreur : {error}</div>}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-slate-500">Aucune entrée</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {entries.map((entry) => (
              <li key={entry.id} className="py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <JournalActionLabel entry={entry} />
                  </div>
                  <span className="shrink-0 text-xs text-slate-500">{formatDateTime(entry.created_at)}</span>
                </div>
                {entry.action === 'refus' && typeof entry.details?.motif_refus === 'string' && entry.details.motif_refus && (
                  <p className="mt-1 text-xs text-slate-500">Motif : {entry.details.motif_refus}</p>
                )}
                <p className="mt-0.5 text-xs text-slate-500">Par {entry.auteur_nom ?? '—'}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {totalCount > PAGE_SIZE && (
        <div className="flex shrink-0 items-center justify-between gap-3 rounded-b-2xl border-t border-slate-200 bg-white px-6 py-3">
          <span className="text-sm text-slate-500">
            {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalCount)} sur {totalCount}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ‹ Précédent
            </button>
            <span className="text-sm text-slate-500">Page {currentPage} / {pageCount}</span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
              disabled={currentPage === pageCount}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Suivant ›
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
