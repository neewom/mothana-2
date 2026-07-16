import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useOrganisationId } from '../hooks/useOrganisationId'
import type { ProfilParticipant, Don, Activite } from '../types'
import ParticipantModal from '../components/ParticipantModal'
import DonModal from '../components/DonModal'
import { CIVILITE_LABELS } from '../lib/civilite'
import { fetchAllRows } from '../lib/fetchAllRows'
import { participantFullName, filterParticipants } from '../lib/participantSearch'
import { useToast } from '../hooks/useToast'
import Toast from '../components/Toast'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEur(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

type SortField = 'civilite' | 'nom' | 'prenom' | 'total'

const MODE_LABELS: Record<Don['mode_paiement'], string> = {
  virement: 'Virement',
  cheque: 'Chèque',
  especes: 'Espèces',
}

const MODE_BADGE: Record<Don['mode_paiement'], string> = {
  virement: 'bg-blue-100 text-blue-800',
  cheque: 'bg-amber-100 text-amber-800',
  especes: 'bg-green-100 text-green-800',
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DonSimple {
  profil_participant_id: string
  montant: number
}

interface DonDetail {
  id: string
  profil_participant_id: string
  activite_id: string | null
  montant: number
  date: string
  mode_paiement: Don['mode_paiement']
  activites: Activite | null
}

// ---------------------------------------------------------------------------
// useParticipants hook
// ---------------------------------------------------------------------------

interface ParticipantsData {
  participants: ProfilParticipant[]
  dons: DonSimple[]
  allActivites: Activite[]
  loading: boolean
  error: string | null
  refetch: () => void
  upsertParticipant: (participant: ProfilParticipant) => void
}

function useParticipants(organisationId: string): ParticipantsData {
  const [participants, setParticipants] = useState<ProfilParticipant[]>([])
  const [dons, setDons] = useState<DonSimple[]>([])
  const [allActivites, setAllActivites] = useState<Activite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!organisationId) return
    let cancelled = false

    async function fetchAll() {
      setLoading(true)
      setError(null)

      const [participantsResult, donsResult, activitesResult] = await Promise.all([
        fetchAllRows<ProfilParticipant>((from, to) =>
          supabase
            .from('profils_participant')
            .select(`id, personne_id, organisation_id, notes, id_externe, created_at, personnes!inner(id, nom, prenom, email, telephone, civilite, nom2, prenom2, adresse, code_postal, ville, pays)`)
            .eq('organisation_id', organisationId)
            .order('id', { ascending: true })
            .range(from, to) as unknown as PromiseLike<{ data: ProfilParticipant[] | null; error: { message: string } | null }>
        ),
        fetchAllRows<DonSimple>((from, to) =>
          supabase
            .from('dons')
            .select('profil_participant_id, montant')
            .eq('organisation_id', organisationId)
            .order('id', { ascending: true })
            .range(from, to)
        ),
        supabase.from('activites').select('id, nom, organisation_id').eq('organisation_id', organisationId),
      ])

      if (cancelled) return

      if (participantsResult.error) {
        setError(participantsResult.error)
        setLoading(false)
        return
      }

      setParticipants(participantsResult.data)
      setDons(donsResult.data)
      setAllActivites((activitesResult.data as unknown as Activite[]) ?? [])
      setLoading(false)
    }

    fetchAll()
    return () => { cancelled = true }
  }, [organisationId, tick])

  function upsertParticipant(participant: ProfilParticipant) {
    setParticipants((prev) => {
      const exists = prev.some((p) => p.id === participant.id)
      return exists
        ? prev.map((p) => (p.id === participant.id ? participant : p))
        : [participant, ...prev]
    })
  }

  return {
    participants,
    dons,
    allActivites,
    loading,
    error,
    refetch: () => setTick((t) => t + 1),
    upsertParticipant,
  }
}

// ---------------------------------------------------------------------------
// DetailPanel
// ---------------------------------------------------------------------------

interface DetailPanelProps {
  participant: ProfilParticipant
  totalDons: number
  participantDons: DonDetail[]
  onClose: () => void
  onEdit: () => void
  onAddDon: () => void
}

function DetailPanel({
  participant,
  totalDons,
  participantDons,
  onClose,
  onEdit,
  onAddDon,
}: DetailPanelProps) {
  const p = participant.personnes

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Détail du participant</h2>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto space-y-5 px-6 py-5">
        {/* Identity */}
        <div>
          {p.civilite && (
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {CIVILITE_LABELS[p.civilite]}
            </p>
          )}
          <p className="text-xl font-bold text-slate-900">{participantFullName(participant)}</p>
          {p.email && <p className="mt-1 text-sm text-slate-500">{p.email}</p>}
          {p.telephone && <p className="text-sm text-slate-500">{p.telephone}</p>}
        </div>

        {/* Co-signataire */}
        {(p.nom2 || p.prenom2) && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Co-signataire</p>
            <p className="mt-1 text-sm text-slate-700">{[p.prenom2, p.nom2].filter(Boolean).join(' ')}</p>
          </div>
        )}

        {/* Adresse */}
        {(p.adresse || p.code_postal || p.ville || p.pays) && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Adresse</p>
            <div className="mt-1 text-sm text-slate-700">
              {p.adresse && <p>{p.adresse}</p>}
              {(p.code_postal || p.ville) && <p>{[p.code_postal, p.ville].filter(Boolean).join(' ')}</p>}
              {p.pays && <p>{p.pays}</p>}
            </div>
          </div>
        )}

        {/* Notes */}
        {participant.notes && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{participant.notes}</p>
          </div>
        )}

        {/* Identifiant externe */}
        {participant.id_externe && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Identifiant externe</p>
            <p className="mt-1 text-sm text-slate-700">{participant.id_externe}</p>
          </div>
        )}

        {/* Total */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total des dons</p>
          <p className="mt-1 text-xl font-bold text-indigo-600">{formatEur(totalDons)}</p>
        </div>

        {/* Donation history */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">Historique des dons</p>
          {participantDons.length === 0 ? (
            <p className="text-sm text-slate-400">Aucun don</p>
          ) : (
            <div className="space-y-2">
              {participantDons.map((don) => (
                <div key={don.id} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-900">{formatEur(don.montant)}</span>
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${MODE_BADGE[don.mode_paiement]}`}>
                      {MODE_LABELS[don.mode_paiement]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{formatDate(don.date)}</p>
                  {don.activites && (
                    <p className="mt-0.5 text-xs text-slate-400">{don.activites.nom}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-slate-200 px-6 py-4">
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Modifier
          </button>
          <button
            onClick={onAddDon}
            className="flex-1 rounded-lg border border-indigo-200 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
          >
            Ajouter un don
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ParticipantsPage
// ---------------------------------------------------------------------------

export default function ParticipantsPage() {
  const organisationId = useOrganisationId()

  const { participants, dons, allActivites, loading, error, refetch, upsertParticipant } = useParticipants(organisationId)
  const { toast, showToast, dismissToast } = useToast()

  // Search
  const [search, setSearch] = useState('')

  // Sort
  const [sortField, setSortField] = useState<SortField>('nom')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  function toggleSort(field: SortField) {
    if (field === sortField) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
    setCurrentPage(1)
  }

  // Selected participant for detail panel
  const [selectedParticipant, setSelectedParticipant] = useState<ProfilParticipant | null>(null)

  // Participant modal (add/edit)
  const [participantModalOpen, setParticipantModalOpen] = useState(false)
  const [editingParticipant, setEditingParticipant] = useState<ProfilParticipant | undefined>(undefined)

  // Don modal (add)
  const [donModalOpen, setDonModalOpen] = useState(false)
  const [defaultParticipantId, setDefaultParticipantId] = useState<string | undefined>(undefined)

  // Participant detail dons — fetch when a participant is selected
  const [participantDons, setParticipantDons] = useState<DonDetail[]>([])
  const [loadingDons, setLoadingDons] = useState(false)

  useEffect(() => {
    if (!selectedParticipant) {
      setParticipantDons([])
      return
    }

    let cancelled = false
    setLoadingDons(true)

    async function fetchDons() {
      const { data } = await supabase
        .from('dons')
        .select('id, profil_participant_id, activite_id, montant, date, mode_paiement, activites(id, nom, organisation_id)')
        .eq('profil_participant_id', selectedParticipant!.id)
        .order('date', { ascending: false })

      if (!cancelled) {
        setParticipantDons((data as unknown as DonDetail[]) ?? [])
        setLoadingDons(false)
      }
    }

    fetchDons()
    return () => { cancelled = true }
  }, [selectedParticipant])

  // Compute total dons per participant client-side
  const totalDonsByParticipant = useMemo(() => {
    const map = new Map<string, number>()
    for (const don of dons) {
      map.set(don.profil_participant_id, (map.get(don.profil_participant_id) ?? 0) + don.montant)
    }
    return map
  }, [dons])

  // Filtered participants
  const filteredParticipants = useMemo(
    () => filterParticipants(participants, search),
    [participants, search]
  )

  // Sorted participants
  const sortedParticipants = useMemo(() => {
    const dir = sortDirection === 'asc' ? 1 : -1
    return [...filteredParticipants].sort((a, b) => {
      switch (sortField) {
        case 'civilite':
          return dir * ((a.personnes.civilite ?? 0) - (b.personnes.civilite ?? 0))
        case 'prenom':
          return dir * (a.personnes.prenom ?? '').localeCompare(b.personnes.prenom ?? '')
        case 'total':
          return dir * ((totalDonsByParticipant.get(a.id) ?? 0) - (totalDonsByParticipant.get(b.id) ?? 0))
        case 'nom':
        default:
          return dir * a.personnes.nom.localeCompare(b.personnes.nom)
      }
    })
  }, [filteredParticipants, sortField, sortDirection, totalDonsByParticipant])

  // Pagination
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)

  const pageCount = Math.max(1, Math.ceil(sortedParticipants.length / pageSize))
  const safePage = Math.min(currentPage, pageCount)

  const paginatedParticipants = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return sortedParticipants.slice(start, start + pageSize)
  }, [sortedParticipants, safePage, pageSize])

  function openAdd() {
    setEditingParticipant(undefined)
    setParticipantModalOpen(true)
  }

  function openEdit(p: ProfilParticipant) {
    setEditingParticipant(p)
    setParticipantModalOpen(true)
  }

  function openAddDon(participantId: string) {
    setDefaultParticipantId(participantId)
    setDonModalOpen(true)
  }

  function handleParticipantSaved(saved: ProfilParticipant) {
    const wasEdit = !!editingParticipant
    upsertParticipant(saved)
    setSelectedParticipant(null)
    showToast(`${participantFullName(saved)} ${wasEdit ? 'modifié' : 'ajouté'}`)
  }

  function handleDonSaved() {
    refetch()
    // Re-trigger participant dons reload by toggling selected participant
    if (selectedParticipant) {
      const current = selectedParticipant
      setSelectedParticipant(null)
      setTimeout(() => setSelectedParticipant(current), 0)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Participants</h1>
        <p className="mt-1 text-sm text-slate-500">Gestion des participants et de leurs dons</p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          Erreur : {error}
        </div>
      )}

      {/* Table + Detail panel */}
      <div className={`flex gap-6 ${selectedParticipant ? 'items-start' : ''}`}>
        {/* Table card */}
        <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
            {/* Search */}
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
              placeholder="Rechercher par nom et prénom…"
              className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={openAdd}
              className="flex-shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              + Ajouter un participant
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            </div>
          ) : filteredParticipants.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-slate-400">Aucun participant trouvé</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="cursor-pointer select-none px-6 py-3 hover:text-slate-700" onClick={() => toggleSort('civilite')}>
                      Civilité{sortField === 'civilite' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                    </th>
                    <th className="cursor-pointer select-none px-6 py-3 hover:text-slate-700" onClick={() => toggleSort('nom')}>
                      Nom{sortField === 'nom' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                    </th>
                    <th className="cursor-pointer select-none px-6 py-3 hover:text-slate-700" onClick={() => toggleSort('prenom')}>
                      Prénom{sortField === 'prenom' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                    </th>
                    <th className="cursor-pointer select-none px-6 py-3 text-right hover:text-slate-700" onClick={() => toggleSort('total')}>
                      Total dons{sortField === 'total' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                    </th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedParticipants.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedParticipant(p.id === selectedParticipant?.id ? null : p)}
                      className={`cursor-pointer transition-colors hover:bg-slate-50 ${
                        p.id === selectedParticipant?.id ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <td className="px-6 py-3 text-slate-500">
                        {p.personnes.civilite ? CIVILITE_LABELS[p.personnes.civilite] : '—'}
                      </td>
                      <td className="px-6 py-3 font-medium text-indigo-600 hover:underline">
                        {p.personnes.nom}
                      </td>
                      <td className="px-6 py-3 text-slate-700">
                        {p.personnes.prenom ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 text-right font-medium text-slate-900">
                        {formatEur(totalDonsByParticipant.get(p.id) ?? 0)}
                      </td>
                      <td className="px-6 py-3 text-right text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && filteredParticipants.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-3">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>Lignes par page</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {[25, 50, 100, 250].map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
                <span>
                  {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sortedParticipants.length)} sur {sortedParticipants.length}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={safePage === 1}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  «
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ‹ Précédent
                </button>
                <span className="text-sm text-slate-500">Page {safePage} / {pageCount}</span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
                  disabled={safePage === pageCount}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Suivant ›
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(pageCount)}
                  disabled={safePage === pageCount}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  »
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail panel — desktop */}
        {selectedParticipant && (
          <div className="hidden w-80 flex-shrink-0 rounded-xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-6 lg:flex lg:max-h-[calc(100vh-3rem)] lg:flex-col" style={{ minHeight: '400px' }}>
            {loadingDons ? (
              <div className="flex flex-1 items-center justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
              </div>
            ) : (
              <DetailPanel
                participant={selectedParticipant}
                totalDons={totalDonsByParticipant.get(selectedParticipant.id) ?? 0}
                participantDons={participantDons}
                onClose={() => setSelectedParticipant(null)}
                onEdit={() => openEdit(selectedParticipant)}
                onAddDon={() => openAddDon(selectedParticipant.id)}
              />
            )}
          </div>
        )}
      </div>

      {/* Mobile detail panel */}
      {selectedParticipant && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSelectedParticipant(null)}
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-sm bg-white shadow-xl flex flex-col">
            {loadingDons ? (
              <div className="flex flex-1 items-center justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
              </div>
            ) : (
              <DetailPanel
                participant={selectedParticipant}
                totalDons={totalDonsByParticipant.get(selectedParticipant.id) ?? 0}
                participantDons={participantDons}
                onClose={() => setSelectedParticipant(null)}
                onEdit={() => openEdit(selectedParticipant)}
                onAddDon={() => openAddDon(selectedParticipant.id)}
              />
            )}
          </div>
        </div>
      )}

      {/* Participant add/edit modal */}
      <ParticipantModal
        open={participantModalOpen}
        onClose={() => setParticipantModalOpen(false)}
        onSaved={handleParticipantSaved}
        participant={editingParticipant}
        organisationId={organisationId}
      />

      {/* Don add modal */}
      <DonModal
        open={donModalOpen}
        onClose={() => { setDonModalOpen(false); setDefaultParticipantId(undefined) }}
        onSaved={handleDonSaved}
        participants={participants}
        activites={allActivites}
        organisationId={organisationId}
        defaultParticipantId={defaultParticipantId}
      />

      {/* Toast */}
      {toast && <Toast key={toast.id} message={toast.message} onDismiss={dismissToast} />}
    </div>
  )
}
