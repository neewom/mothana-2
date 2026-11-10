import { useState, useEffect, useCallback } from 'react'
import type { JournalModification } from '../types'
import { fetchJournalModifications, JOURNAL_RECHERCHE_MIN, libelleAuteurJournal } from '../lib/journalModifications'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { ListToolbar } from './ui/list-toolbar'
import { getErrorMessage } from '../lib/errors'
import JournalActionLabel from './JournalActionLabel'
import { TablePagination } from './ui/table-pagination'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'

interface HistoriqueModificationsModalProps {
  open: boolean
  onClose: () => void
  organisationId: string
  /** Recherche saisie dans l'aperçu, reprise à l'ouverture. */
  rechercheInitiale?: string
}

const DEFAULT_PAGE_SIZE = 25

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function HistoriqueModificationsModal({ open, onClose, organisationId, rechercheInitiale = '' }: HistoriqueModificationsModalProps) {
  const [entries, setEntries] = useState<JournalModification[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [recherche, setRecherche] = useState(rechercheInitiale)
  const rechercheServeur = useDebouncedValue(recherche.trim().length >= JOURNAL_RECHERCHE_MIN ? recherche : '', 300)

  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize))

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { entries: fetched, totalCount: count } = await fetchJournalModifications(
        organisationId,
        pageSize,
        (currentPage - 1) * pageSize,
        rechercheServeur,
      )
      setEntries(fetched)
      setTotalCount(count)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [organisationId, currentPage, pageSize, rechercheServeur])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  useEffect(() => {
    if (open) {
      setCurrentPage(1)
      setRecherche(rechercheInitiale)
    }
  }, [open, rechercheInitiale])

  // Nouvelle recherche : retour en première page.
  useEffect(() => {
    setCurrentPage(1)
  }, [rechercheServeur])

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="max-w-2xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Historique des modifications</DialogTitle>
        </DialogHeader>

        <ListToolbar
          className="shrink-0"
          search={{ value: recherche, onChange: setRecherche, placeholder: 'Personne, auteur…', label: 'Rechercher dans le journal' }}
        />

        <div className="flex-1 overflow-y-auto p-6">
          {error && <div className="mb-4 rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 font-registre text-sm text-stamp">Erreur : {error}</div>}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-stamp border-t-transparent" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <p className="font-registre text-ink-faint">{rechercheServeur ? 'Aucune entrée ne correspond à cette recherche' : 'Aucune entrée'}</p>
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
                  {libelleAuteurJournal(entry) && <p className="mt-0.5 text-xs text-ink-faint">Par {libelleAuteurJournal(entry)}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pagination serveur : la page demandée (`range`) et le total viennent de la requête. */}
        {totalCount > 0 && (
          <TablePagination
            className="shrink-0 bg-white"
            page={Math.min(currentPage, pageCount)}
            pageCount={pageCount}
            totalCount={totalCount}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[25, 50, 100]}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
