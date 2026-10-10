import { useState, useEffect, useCallback } from 'react'
import type { JournalModification } from '../types'
import { fetchJournalModifications, JOURNAL_RECHERCHE_MIN } from '../lib/journalModifications'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { ListToolbar } from './ui/list-toolbar'
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
  const [recherche, setRecherche] = useState('')
  // Recherche côté serveur (journal paginé) : appel espacé, ignorée sous 2 caractères.
  const rechercheServeur = useDebouncedValue(recherche.trim().length >= JOURNAL_RECHERCHE_MIN ? recherche : '', 300)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { entries: fetched, totalCount: count } = await fetchJournalModifications(organisationId, APERCU_SIZE, 0, rechercheServeur)
      setEntries(fetched)
      setTotalCount(count)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [organisationId, rechercheServeur])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="font-registre">
      <ListToolbar
        className="mb-2 border-b-0 px-0 py-0 md:px-0"
        search={{ value: recherche, onChange: setRecherche, placeholder: 'Nom de la personne ou de l’auteur…', label: 'Rechercher dans le journal' }}
      />

      {error && <div className="mb-4 rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">Erreur : {error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-stamp border-t-transparent" />
        </div>
      ) : entries.length === 0 ? (
        <p className="py-4 text-sm text-ink-faint">
          {rechercheServeur ? 'Aucune entrée ne correspond à cette recherche.' : "Aucune modification enregistrée pour l'instant."}
        </p>
      ) : (
        <ul className="divide-y divide-paper-border-muted">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div>
                <JournalActionLabel entry={entry} />
                <span className="text-ink-faint"> · par {entry.auteur_nom ?? '—'}</span>
              </div>
              <span className="shrink-0 text-xs text-ink-faint">{formatDateTime(entry.created_at)}</span>
            </li>
          ))}
        </ul>
      )}

      {totalCount > APERCU_SIZE && (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="mt-3 text-sm font-medium text-stamp hover:text-stamp/80"
        >
          Voir plus →
        </button>
      )}

      <HistoriqueModificationsModal open={modalOpen} onClose={() => setModalOpen(false)} organisationId={organisationId} rechercheInitiale={recherche} />
    </div>
  )
}
