import { useState, useEffect, useCallback } from 'react'
import type { JournalModification } from '../types'
import { fetchJournalModifications } from '../lib/journalModifications'
import { getErrorMessage } from '../lib/errors'
import JournalActionLabel from './JournalActionLabel'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'

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

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="max-w-2xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Historique des modifications</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {error && <div className="mb-4 rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 font-registre text-sm text-stamp">Erreur : {error}</div>}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-stamp border-t-transparent" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <p className="font-registre text-ink-faint">Aucune entrée</p>
            </div>
          ) : (
            <ul className="divide-y divide-paper-border-muted">
              {entries.map((entry) => (
                <li key={entry.id} className="py-3 font-registre text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <JournalActionLabel entry={entry} />
                    </div>
                    <span className="shrink-0 text-xs text-ink-faint">{formatDateTime(entry.created_at)}</span>
                  </div>
                  {entry.action === 'refus' && typeof entry.details?.motif_refus === 'string' && entry.details.motif_refus && (
                    <p className="mt-1 text-xs text-ink-faint">Motif : {entry.details.motif_refus}</p>
                  )}
                  <p className="mt-0.5 text-xs text-ink-faint">Par {entry.auteur_nom ?? '—'}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {totalCount > PAGE_SIZE && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-paper-border bg-white px-6 py-3 font-registre">
            <span className="text-sm text-ink-faint">
              {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalCount)} sur {totalCount}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                ‹ Précédent
              </Button>
              <span className="text-sm text-ink-faint">Page {currentPage} / {pageCount}</span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
                disabled={currentPage === pageCount}
              >
                Suivant ›
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
