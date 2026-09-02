import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
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
import ImportWizard from '../components/import/ImportWizard'
import { participantsImportConfig } from '../lib/import/configs'
import { MODE_PAIEMENT_LABELS } from '../lib/modePaiement'
import { cn } from '../lib/utils'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { Badge } from '../components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table'
import { Dialog, DialogContent } from '../components/ui/dialog'
import ScrollShadowX from '../components/ScrollShadowX'

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
  removeParticipant: (id: string) => void
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

  function removeParticipant(id: string) {
    setParticipants((prev) => prev.filter((p) => p.id !== id))
  }

  return {
    participants,
    dons,
    allActivites,
    loading,
    error,
    refetch: () => setTick((t) => t + 1),
    upsertParticipant,
    removeParticipant,
  }
}

// ---------------------------------------------------------------------------
// SortableHead
// ---------------------------------------------------------------------------

interface SortableHeadProps {
  field: SortField
  label: string
  sortField: SortField
  sortDirection: 'asc' | 'desc'
  onSort: (field: SortField) => void
  align?: 'left' | 'right'
}

function SortableHead({ field, label, sortField, sortDirection, onSort, align = 'left' }: SortableHeadProps) {
  return (
    <TableHead
      onClick={() => onSort(field)}
      className={cn('cursor-pointer select-none hover:text-ink', align === 'right' && 'text-right')}
    >
      {label}
      {sortField === field && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
    </TableHead>
  )
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
  onDelete: () => void
}

function DetailPanel({
  participant,
  totalDons,
  participantDons,
  onClose,
  onEdit,
  onAddDon,
  onDelete,
}: DetailPanelProps) {
  const p = participant.personnes

  return (
    <div className="flex h-full flex-col font-registre">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-paper-border px-6 py-4">
        <h2 className="text-lg font-semibold text-ink">Détail du participant</h2>
        <button
          onClick={onClose}
          className="rounded-sm p-1.5 text-ink-faint transition-colors hover:text-stamp focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {/* Identity */}
        <div>
          {p.civilite && (
            <p className="font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">
              {CIVILITE_LABELS[p.civilite]}
            </p>
          )}
          <p className="mt-1 font-semibold text-ink">{participantFullName(participant)}</p>
          {p.email && <p className="text-sm text-ink-muted">{p.email}</p>}
          {p.telephone && <p className="font-registre-mono text-sm text-ink-muted">{p.telephone}</p>}
        </div>

        {/* Co-signataire */}
        {(p.nom2 || p.prenom2) && (
          <div>
            <p className="font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">Co-signataire</p>
            <p className="mt-1 text-sm text-ink">{[p.prenom2, p.nom2].filter(Boolean).join(' ')}</p>
          </div>
        )}

        {/* Adresse */}
        {(p.adresse || p.code_postal || p.ville || p.pays) && (
          <div>
            <p className="font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">Adresse</p>
            <div className="mt-1 text-sm text-ink">
              {p.adresse && <p>{p.adresse}</p>}
              {(p.code_postal || p.ville) && <p>{[p.code_postal, p.ville].filter(Boolean).join(' ')}</p>}
              {p.pays && <p>{p.pays}</p>}
            </div>
          </div>
        )}

        {/* Notes */}
        {participant.notes && (
          <div>
            <p className="font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{participant.notes}</p>
          </div>
        )}

        {/* Identifiant externe */}
        {participant.id_externe && (
          <div>
            <p className="font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">Identifiant externe</p>
            <p className="mt-1 text-sm text-ink">{participant.id_externe}</p>
          </div>
        )}

        {/* Total */}
        <div>
          <p className="font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">Total des dons</p>
          <p className="mt-1 font-registre-mono text-xl font-bold text-ink">{formatEur(totalDons)}</p>
        </div>

        {/* Donation history */}
        <div>
          <p className="mb-2 font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">Historique des dons</p>
          {participantDons.length === 0 ? (
            <p className="font-registre text-sm text-ink-faint">Aucun don</p>
          ) : (
            <div className="space-y-2">
              {participantDons.map((don) => (
                <div key={don.id} className="rounded-sm border border-paper-border bg-paper px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-registre-mono text-sm font-medium text-ink">{formatEur(don.montant)}</span>
                    <Badge variant="neutral">{MODE_PAIEMENT_LABELS[don.mode_paiement]}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-faint">{formatDate(don.date)}</p>
                  {don.activites && (
                    <p className="mt-0.5 text-xs text-ink-faint">{don.activites.nom}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2 border-t border-paper-border px-6 py-4">
        <div className="flex gap-2">
          <Button onClick={onEdit} className="flex-1">Modifier</Button>
          <Button variant="secondary" onClick={onAddDon} className="flex-1">Ajouter un don</Button>
        </div>
        <Button variant="danger" onClick={onDelete} className="w-full">
          Supprimer le participant
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ParticipantsPage
// ---------------------------------------------------------------------------

export default function ParticipantsPage() {
  const organisationId = useOrganisationId()

  const { participants, dons, allActivites, loading, error, refetch, upsertParticipant, removeParticipant } = useParticipants(organisationId)
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
  const [mobilePanelVisible, setMobilePanelVisible] = useState(false)

  useEffect(() => {
    if (selectedParticipant) {
      const timer = setTimeout(() => setMobilePanelVisible(true), 10)
      return () => clearTimeout(timer)
    }
    setMobilePanelVisible(false)
  }, [selectedParticipant])

  // Participant modal (add/edit)
  const [participantModalOpen, setParticipantModalOpen] = useState(false)
  const [editingParticipant, setEditingParticipant] = useState<ProfilParticipant | undefined>(undefined)

  // Don modal (add)
  const [donModalOpen, setDonModalOpen] = useState(false)
  const [defaultParticipantId, setDefaultParticipantId] = useState<string | undefined>(undefined)

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<ProfilParticipant | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  // Participant detail dons — fetch when a participant is selected
  const [participantDons, setParticipantDons] = useState<DonDetail[]>([])
  const [loadingDons, setLoadingDons] = useState(false)

  // Desktop detail panel — cap its height to whatever space is actually available below
  // it (header + page title + any banner all vary), so it never overflows past the
  // viewport and requires scrolling the page to reach the footer actions.
  const desktopPanelRef = useRef<HTMLDivElement>(null)
  const [desktopPanelMaxHeight, setDesktopPanelMaxHeight] = useState<number | undefined>(undefined)

  useLayoutEffect(() => {
    if (!selectedParticipant) return

    function recompute() {
      const el = desktopPanelRef.current
      if (!el) return
      const top = el.getBoundingClientRect().top
      if (top <= 0) return // hidden (mobile breakpoint) — nothing to measure
      setDesktopPanelMaxHeight(Math.max(300, window.innerHeight - top - 24))
    }

    recompute()
    window.addEventListener('resize', recompute)
    return () => window.removeEventListener('resize', recompute)
  }, [selectedParticipant])

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

  function openDelete(p: ProfilParticipant) {
    setDeleteConfirm(p)
    setDeleteError(null)
  }

  async function handleDelete() {
    if (!deleteConfirm) return

    const linkedDons = dons.filter((d) => d.profil_participant_id === deleteConfirm.id).length
    if (linkedDons > 0) {
      setDeleteError(
        `Impossible de supprimer : ${linkedDons} don${linkedDons > 1 ? 's' : ''} ${linkedDons > 1 ? 'sont rattachés' : 'est rattaché'} à ce participant.`
      )
      return
    }

    setDeleting(true)
    const { error: err } = await supabase.from('profils_participant').delete().eq('id', deleteConfirm.id)
    setDeleting(false)

    if (err) {
      setDeleteError(err.message)
      return
    }

    const fullName = participantFullName(deleteConfirm)
    removeParticipant(deleteConfirm.id)
    setSelectedParticipant(null)
    setDeleteConfirm(null)
    showToast(`${fullName} supprimé`)
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
    <>
      {/*
        THESIS: le registre des participants reste lisible même dense — même famille que
        DonsPage (panneau de détail latéral desktop, plein écran glissant sur mobile), avec
        une variation assumée : le panneau plafonne sa hauteur dynamiquement (historique de
        dons de longueur variable, contrairement au détail d'un don qui est de taille fixe).
        OWN-WORLD: papier clair (paper), stamp (marque/danger), badge neutre unique pour le
        mode de paiement dans l'historique — même réserve sémantique que DonsPage, un mode
        de paiement n'est pas un signal d'état.
        STORY: l'admin recherche/trie la liste, clique une ligne pour voir l'identité, le
        total des dons et l'historique complet, peut modifier, ajouter un don ou supprimer
        directement depuis le panneau.
        FIRST VIEWPORT: recherche + tableau trié, panneau de détail à droite en desktop.
        FORM: 7e page du rollout "carnet tamponné x registre".
        FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
        review, the verdict, and DESIGN.md.
      */}
      <div className="-m-6 min-h-[calc(100%+3rem)] space-y-6 bg-paper p-6 font-registre">
        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold text-ink md:text-3xl">Participants</h1>
          <p className="mt-1 text-sm text-ink-muted">Gestion des participants et de leurs dons</p>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">
            Erreur : {error}
          </div>
        )}

        {/* Table + Detail panel */}
        <div className={cn('flex gap-6', selectedParticipant && 'items-start')}>
          {/* Table card */}
          <div className="min-w-0 flex-1 rounded-sm border border-paper-border border-l-[3px] border-l-stamp bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-paper-border px-4 py-4 md:px-6">
              <Input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
                placeholder="Rechercher par nom et prénom…"
                className="w-full max-w-xs"
              />
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <Button variant="secondary" onClick={() => setImportOpen(true)}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  Importer
                </Button>
                <Button onClick={openAdd}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Ajouter
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-stamp border-t-transparent" />
              </div>
            ) : filteredParticipants.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <p className="font-registre text-sm text-ink-faint">Aucun participant trouvé</p>
              </div>
            ) : (
              <ScrollShadowX>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHead field="civilite" label="Civilité" sortField={sortField} sortDirection={sortDirection} onSort={toggleSort} />
                      <SortableHead field="nom" label="Nom" sortField={sortField} sortDirection={sortDirection} onSort={toggleSort} />
                      <SortableHead field="prenom" label="Prénom" sortField={sortField} sortDirection={sortDirection} onSort={toggleSort} />
                      <SortableHead field="total" label="Total dons" sortField={sortField} sortDirection={sortDirection} onSort={toggleSort} align="right" />
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedParticipants.map((p) => (
                      <TableRow
                        key={p.id}
                        onClick={() => setSelectedParticipant(p.id === selectedParticipant?.id ? null : p)}
                        className={cn(
                          'cursor-pointer hover:bg-paper-border/20',
                          p.id === selectedParticipant?.id && 'bg-stamp/[0.05] hover:bg-stamp/[0.05]'
                        )}
                      >
                        <TableCell className="text-ink-faint">
                          {p.personnes.civilite ? CIVILITE_LABELS[p.personnes.civilite] : '—'}
                        </TableCell>
                        <TableCell className="font-medium text-ink">
                          {p.personnes.nom}
                        </TableCell>
                        <TableCell className="text-ink-muted">
                          {p.personnes.prenom ?? '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right font-registre-mono font-medium text-ink">
                          {formatEur(totalDonsByParticipant.get(p.id) ?? 0)}
                        </TableCell>
                        <TableCell className="text-right text-ink-faint">
                          <svg xmlns="http://www.w3.org/2000/svg" className="inline h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollShadowX>
            )}

            {/* Pagination */}
            {!loading && filteredParticipants.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-paper-border px-4 py-3 md:px-6">
                <div className="flex items-center gap-2 font-registre-mono text-xs text-ink-faint">
                  <span>Lignes par page</span>
                  <Select
                    aria-label="Lignes par page"
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
                    className="py-1 pl-2 pr-7 text-xs"
                  >
                    {[25, 50, 100, 250].map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </Select>
                  <span>
                    {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sortedParticipants.length)} sur {sortedParticipants.length}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setCurrentPage(1)} disabled={safePage === 1}>«</Button>
                  <Button variant="secondary" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>
                    ‹ Précédent
                  </Button>
                  <span className="font-registre-mono text-xs text-ink-faint">Page {safePage} / {pageCount}</span>
                  <Button variant="secondary" size="sm" onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))} disabled={safePage === pageCount}>
                    Suivant ›
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setCurrentPage(pageCount)} disabled={safePage === pageCount}>»</Button>
                </div>
              </div>
            )}
          </div>

          {/* Detail panel (desktop) */}
          {selectedParticipant && (
            <div
              ref={desktopPanelRef}
              className="hidden w-80 flex-shrink-0 rounded-sm border border-paper-border bg-white lg:sticky lg:top-6 lg:flex lg:max-h-[calc(100vh-3rem)] lg:flex-col"
              style={{ minHeight: '400px', ...(desktopPanelMaxHeight ? { maxHeight: desktopPanelMaxHeight } : {}) }}
            >
              {loadingDons ? (
                <div className="flex flex-1 items-center justify-center py-16">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 border-stamp border-t-transparent" />
                </div>
              ) : (
                <DetailPanel
                  participant={selectedParticipant}
                  totalDons={totalDonsByParticipant.get(selectedParticipant.id) ?? 0}
                  participantDons={participantDons}
                  onClose={() => setSelectedParticipant(null)}
                  onEdit={() => openEdit(selectedParticipant)}
                  onAddDon={() => openAddDon(selectedParticipant.id)}
                  onDelete={() => openDelete(selectedParticipant)}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile detail panel (slides over) — même animation que DonsPage (PR #111) */}
      {selectedParticipant && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setSelectedParticipant(null)}
          />
          <div
            className={cn(
              'absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-white shadow-xl transition-transform duration-200',
              mobilePanelVisible ? 'translate-x-0' : 'translate-x-full'
            )}
          >
            {loadingDons ? (
              <div className="flex flex-1 items-center justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-stamp border-t-transparent" />
              </div>
            ) : (
              <DetailPanel
                participant={selectedParticipant}
                totalDons={totalDonsByParticipant.get(selectedParticipant.id) ?? 0}
                participantDons={participantDons}
                onClose={() => setSelectedParticipant(null)}
                onEdit={() => openEdit(selectedParticipant)}
                onAddDon={() => openAddDon(selectedParticipant.id)}
                onDelete={() => openDelete(selectedParticipant)}
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

      {/* Import CSV/Excel */}
      {importOpen && (
        <ImportWizard
          open
          onClose={() => setImportOpen(false)}
          config={participantsImportConfig}
          organisationId={organisationId}
          onImported={refetch}
        />
      )}

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

      {/* Delete confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(next) => { if (!next) setDeleteConfirm(null) }}>
        <DialogContent aria-describedby={undefined}>
          {deleteConfirm && (
            <div className="overflow-y-auto p-6">
              <h2 className="font-registre text-lg font-semibold text-ink">Supprimer le participant</h2>
              <p className="mt-2 font-registre text-sm text-ink-muted">
                Êtes-vous sûr de vouloir supprimer{' '}
                <span className="font-medium text-ink">« {participantFullName(deleteConfirm)} »</span> ?
                Cette action est irréversible.
              </p>
              {deleteError && (
                <div className="mt-3 rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">
                  {deleteError}
                </div>
              )}
              <div className="mt-5 flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Annuler</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Suppression…' : 'Supprimer'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {toast && <Toast key={toast.id} message={toast.message} onDismiss={dismissToast} />}
    </>
  )
}
