import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useOrganisationId } from '../hooks/useOrganisationId'
import type { Don, ProfilParticipant, Activite } from '../types'
import DonModal from '../components/DonModal'
import { fetchAllRows } from '../lib/fetchAllRows'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function startOfMonth(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function startOfYear(iso: string): string {
  return `${new Date(iso).getFullYear()}-01-01`
}

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

function participantName(don: Don): string {
  const p = don.profils_participant?.personnes
  if (!p) return '—'
  return p.prenom ? `${p.prenom} ${p.nom}` : p.nom
}

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

type Shortcut = '30j' | '90j' | 'mois' | 'annee' | 'tout'

// ---------------------------------------------------------------------------
// useDons hook
// ---------------------------------------------------------------------------

interface DonsData {
  dons: Don[]
  participants: ProfilParticipant[]
  activites: Activite[]
  loading: boolean
  error: string | null
  refetch: () => void
}

function useDons(organisationId: string): DonsData {
  const [dons, setDons] = useState<Don[]>([])
  const [participants, setParticipants] = useState<ProfilParticipant[]>([])
  const [activites, setActivites] = useState<Activite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!organisationId) return
    let cancelled = false

    async function fetchAll() {
      setLoading(true)
      setError(null)

      const [donsResult, participantsResult, activitesResult] = await Promise.all([
        fetchAllRows<Don>((from, to) =>
          supabase
            .from('dons')
            .select(`
              *,
              profils_participant!inner(
                id, personne_id, organisation_id,
                personnes!inner(id, nom, prenom, email, telephone)
              ),
              activites(id, nom, organisation_id)
            `)
            .eq('organisation_id', organisationId)
            .order('id', { ascending: true })
            .range(from, to) as unknown as PromiseLike<{ data: Don[] | null; error: { message: string } | null }>
        ),
        fetchAllRows<ProfilParticipant>((from, to) =>
          supabase
            .from('profils_participant')
            .select(`id, personne_id, organisation_id, personnes!inner(id, nom, prenom, email, telephone)`)
            .eq('organisation_id', organisationId)
            .order('id', { ascending: true })
            .range(from, to) as unknown as PromiseLike<{ data: ProfilParticipant[] | null; error: { message: string } | null }>
        ),
        supabase.from('activites').select('id, nom, organisation_id').eq('organisation_id', organisationId),
      ])

      if (cancelled) return

      if (donsResult.error) {
        setError(donsResult.error)
        setLoading(false)
        return
      }

      setDons(donsResult.data)
      setParticipants(participantsResult.data)
      setActivites((activitesResult.data as unknown as Activite[]) ?? [])
      setLoading(false)
    }

    fetchAll()
    return () => { cancelled = true }
  }, [organisationId, tick])

  return {
    dons,
    participants,
    activites,
    loading,
    error,
    refetch: () => setTick((t) => t + 1),
  }
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DetailPanel
// ---------------------------------------------------------------------------

interface DetailPanelProps {
  don: Don
  onClose: () => void
  onEdit: () => void
  onDeleted: () => void
}

function DetailPanel({ don, onClose, onEdit, onDeleted }: DetailPanelProps) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    await supabase.from('dons').delete().eq('id', don.id)
    setDeleting(false)
    onDeleted()
  }

  const p = don.profils_participant?.personnes

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Détail du don</h2>
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
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Participant</p>
          <p className="mt-1 font-semibold text-slate-900">
            {p ? (p.prenom ? `${p.prenom} ${p.nom}` : p.nom) : '—'}
          </p>
          {p?.email && <p className="text-sm text-slate-500">{p.email}</p>}
          {p?.telephone && <p className="text-sm text-slate-500">{p.telephone}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Montant</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{formatEur(don.montant)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Date</p>
            <p className="mt-1 text-sm text-slate-900">{formatDate(don.date)}</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Mode de paiement</p>
          <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${MODE_BADGE[don.mode_paiement]}`}>
            {MODE_LABELS[don.mode_paiement]}
          </span>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Activité</p>
          <p className="mt-1 text-sm text-slate-900">{don.activites?.nom ?? '—'}</p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Saisi par</p>
          <p className="mt-1 text-sm capitalize text-slate-900">{don.created_by_role}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-slate-200 px-6 py-4 space-y-2">
        {confirming ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-red-700">Confirmer la suppression ?</p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={onEdit}
              className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Modifier
            </button>
            <button
              onClick={() => setConfirming(true)}
              className="flex-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Supprimer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DonsPage
// ---------------------------------------------------------------------------

export default function DonsPage() {
  const organisationId = useOrganisationId()

  const { dons, participants, activites, loading, error, refetch } = useDons(organisationId)

  // Filters
  const today = todayISO()
  const [shortcut, setShortcut] = useState<Shortcut>('tout')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [filterParticipant, setFilterParticipant] = useState('')
  const [filterActivite, setFilterActivite] = useState('')
  const [filterMode, setFilterMode] = useState('')

  // Detail & modal
  const [selectedDon, setSelectedDon] = useState<Don | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingDon, setEditingDon] = useState<Don | undefined>(undefined)

  function applyShortcut(s: Shortcut) {
    setShortcut(s)
    if (s === 'tout') {
      setDateDebut('')
      setDateFin('')
    } else if (s === '30j') {
      setDateDebut(addDays(today, -30))
      setDateFin(today)
    } else if (s === '90j') {
      setDateDebut(addDays(today, -90))
      setDateFin(today)
    } else if (s === 'mois') {
      setDateDebut(startOfMonth(today))
      setDateFin(today)
    } else if (s === 'annee') {
      setDateDebut(startOfYear(today))
      setDateFin(today)
    }
    setCurrentPage(1)
  }

  function handleDateDebutChange(val: string) {
    setDateDebut(val)
    setShortcut('tout') // deselect shortcut
    setCurrentPage(1)
  }

  function handleDateFinChange(val: string) {
    setDateFin(val)
    setShortcut('tout') // deselect shortcut
    setCurrentPage(1)
  }

  const filteredDons = useMemo(() => {
    return dons.filter((d) => {
      if (dateDebut && d.date < dateDebut) return false
      if (dateFin && d.date > dateFin) return false
      if (filterParticipant && d.profil_participant_id !== filterParticipant) return false
      if (filterActivite && d.activite_id !== filterActivite) return false
      if (filterMode && d.mode_paiement !== filterMode) return false
      return true
    })
  }, [dons, dateDebut, dateFin, filterParticipant, filterActivite, filterMode])

  // Stats computed from filtered dons
  const stats = useMemo(() => {
    const total = filteredDons.reduce((sum, d) => sum + d.montant, 0)
    const count = filteredDons.length
    const avg = count > 0 ? total / count : 0
    const distinctParticipants = new Set(filteredDons.map((d) => d.profil_participant_id)).size
    return { total, count, avg, distinctParticipants }
  }, [filteredDons])

  // Pagination
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)

  const pageCount = Math.max(1, Math.ceil(filteredDons.length / pageSize))
  const safePage = Math.min(currentPage, pageCount)

  const paginatedDons = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filteredDons.slice(start, start + pageSize)
  }, [filteredDons, safePage, pageSize])

  function openAdd() {
    setEditingDon(undefined)
    setModalOpen(true)
  }

  function openEdit(don: Don) {
    setEditingDon(don)
    setModalOpen(true)
  }

  function handleSaved() {
    refetch()
    setSelectedDon(null)
  }

  function handleDeleted() {
    refetch()
    setSelectedDon(null)
  }

  const SHORTCUTS: { key: Shortcut; label: string }[] = [
    { key: '30j', label: '30 jours' },
    { key: '90j', label: '90 jours' },
    { key: 'mois', label: 'Ce mois' },
    { key: 'annee', label: 'Cette année' },
    { key: 'tout', label: 'Tout' },
  ]

  return (
    <>
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dons</h1>
        <p className="mt-1 text-sm text-slate-500">Gestion et suivi des donations</p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          Erreur : {error}
        </div>
      )}

      {/* Filters card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        {/* Period shortcuts */}
        <div className="flex flex-wrap gap-2">
          {SHORTCUTS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => applyShortcut(key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                shortcut === key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Date range + dropdowns */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Début</label>
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => handleDateDebutChange(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Fin</label>
            <input
              type="date"
              value={dateFin}
              onChange={(e) => handleDateFinChange(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Participant</label>
            <select
              value={filterParticipant}
              onChange={(e) => { setFilterParticipant(e.target.value); setCurrentPage(1) }}
              className="select-field w-full rounded-lg border border-slate-300 py-2 pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Tous les participants</option>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.personnes.prenom ? `${p.personnes.prenom} ${p.personnes.nom}` : p.personnes.nom}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Activité</label>
            <select
              value={filterActivite}
              onChange={(e) => { setFilterActivite(e.target.value); setCurrentPage(1) }}
              className="select-field w-full rounded-lg border border-slate-300 py-2 pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Toutes les activités</option>
              {activites.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nom}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Mode de paiement</label>
            <select
              value={filterMode}
              onChange={(e) => { setFilterMode(e.target.value); setCurrentPage(1) }}
              className="select-field w-full rounded-lg border border-slate-300 py-2 pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Tous les modes</option>
              <option value="virement">Virement</option>
              <option value="cheque">Chèque</option>
              <option value="especes">Espèces</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total collecté" value={formatEur(stats.total)} />
        <StatCard label="Nombre de dons" value={String(stats.count)} />
        <StatCard label="Don moyen" value={stats.count > 0 ? formatEur(stats.avg) : '—'} />
        <StatCard label="Participants distincts" value={String(stats.distinctParticipants)} />
      </div>

      {/* Table + Detail panel */}
      <div className={`flex gap-6 ${selectedDon ? 'items-start' : ''}`}>
        {/* Table card */}
        <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h2 className="font-semibold text-slate-900">Liste des dons</h2>
            <button
              onClick={openAdd}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              + Ajouter un don
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            </div>
          ) : filteredDons.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-slate-400">Aucun don trouvé</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Participant</th>
                    <th className="px-6 py-3">Activité</th>
                    <th className="px-6 py-3 text-right">Montant</th>
                    <th className="px-6 py-3">Mode</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedDons.map((don) => (
                    <tr
                      key={don.id}
                      onClick={() => setSelectedDon(don.id === selectedDon?.id ? null : don)}
                      className={`cursor-pointer transition-colors hover:bg-slate-50 ${
                        don.id === selectedDon?.id ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <td className="whitespace-nowrap px-6 py-3 text-slate-700">
                        {formatDate(don.date)}
                      </td>
                      <td className="px-6 py-3 font-medium text-slate-900">
                        {participantName(don)}
                      </td>
                      <td className="px-6 py-3 text-slate-500">
                        {don.activites?.nom ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 text-right font-medium text-slate-900">
                        {formatEur(don.montant)}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${MODE_BADGE[don.mode_paiement]}`}>
                          {MODE_LABELS[don.mode_paiement]}
                        </span>
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
          {!loading && filteredDons.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-3">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>Lignes par page</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
                  className="select-field rounded-lg border border-slate-300 py-1 pl-2 pr-7 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {[25, 50, 100, 250].map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
                <span>
                  {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredDons.length)} sur {filteredDons.length}
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

        {/* Detail panel */}
        {selectedDon && (
          <div className="hidden w-80 flex-shrink-0 rounded-xl border border-slate-200 bg-white shadow-sm lg:flex lg:flex-col" style={{ minHeight: '400px' }}>
            <DetailPanel
              don={selectedDon}
              onClose={() => setSelectedDon(null)}
              onEdit={() => openEdit(selectedDon)}
              onDeleted={handleDeleted}
            />
          </div>
        )}
      </div>
    </div>

      {/* Mobile detail panel (slides over) */}
      {selectedDon && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSelectedDon(null)}
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-sm bg-white shadow-xl flex flex-col">
            <DetailPanel
              don={selectedDon}
              onClose={() => setSelectedDon(null)}
              onEdit={() => openEdit(selectedDon)}
              onDeleted={handleDeleted}
            />
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      <DonModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        don={editingDon}
        participants={participants}
        activites={activites}
        organisationId={organisationId}
      />
    </>
  )
}
