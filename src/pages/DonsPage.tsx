import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useOrganisationId } from '../hooks/useOrganisationId'
import type { Don, ProfilParticipant, Activite } from '../types'
import DonModal from '../components/DonModal'
import ParticipantAutocomplete from '../components/ParticipantAutocomplete'
import ActiviteAutocomplete from '../components/ActiviteAutocomplete'
import DonFichiers from '../components/DonFichiers'
import ScrollShadowX from '../components/ScrollShadowX'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { fetchAllRows } from '../lib/fetchAllRows'
import ImportWizard from '../components/import/ImportWizard'
import { donsImportConfig } from '../lib/import/configs'
import { MODE_PAIEMENT_LABELS, MODE_PAIEMENT_OPTIONS } from '../lib/modePaiement'
import { downloadCsv } from '../lib/csvExport'
import { cn } from '../lib/utils'
import { DONS_FILTRES_VIDES, PERIODES_DONS, bornesPeriode, filtrerDons, nombreFiltresDons, type DonsFiltres, type PeriodeDons } from '../lib/donsFilters'
import { PageHeader } from '../components/ui/page-header'
import { StatTiles } from '../components/ui/stat-tiles'
import { ListToolbar, FilterChips, type FilterChip } from '../components/ui/list-toolbar'
import { FilterSheet } from '../components/ui/filter-sheet'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select } from '../components/ui/select'
import { Badge } from '../components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table'
import SortableTableHead from '../components/SortableTableHead'
import { DON_SORT_DEFAUT, directionInitialeDon, nomDonateur, trierDons, type DonSortField, type SortDirection } from '../lib/donsSort'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
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

function formatDateShort(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

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
// DetailPanel
// ---------------------------------------------------------------------------

interface DetailPanelProps {
  don: Don
  organisationId: string
  onClose: () => void
  onEdit: () => void
  onDeleted: () => void
}

function DetailPanel({ don, organisationId, onClose, onEdit, onDeleted }: DetailPanelProps) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    await supabase.from('dons').delete().eq('id', don.id)
    setDeleting(false)
    onDeleted()
  }

  const p = don.profils_participant?.personnes
  // Les reçus sont annuels, par donateur : on ouvre celui de l'année du don.
  const recuHref = `/admin/recus?annee=${don.date.slice(0, 4)}&q=${encodeURIComponent(nomDonateur(don))}`

  return (
    <div className="flex h-full flex-col font-registre">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-paper-border px-6 py-4">
        <h2 className="text-lg font-semibold text-ink">Détail du don</h2>
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
        <div>
          <p className="font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">Donateur</p>
          <p className="mt-1 font-semibold text-ink">
            {p ? (p.prenom ? `${p.prenom} ${p.nom}` : p.nom) : '—'}
          </p>
          {p?.email && <p className="text-sm text-ink-muted">{p.email}</p>}
          {p?.telephone && <p className="font-registre-mono text-sm text-ink-muted">{p.telephone}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">Montant</p>
            <p className="mt-1 font-registre-mono text-xl font-bold text-ink">{formatEur(don.montant)}</p>
          </div>
          <div>
            <p className="font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">Date</p>
            <p className="mt-1 text-sm text-ink">{formatDate(don.date)}</p>
          </div>
        </div>

        <div>
          <p className="font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">Mode de paiement</p>
          <Badge variant="neutral" className="mt-1">{MODE_PAIEMENT_LABELS[don.mode_paiement]}</Badge>
        </div>

        <div>
          <p className="font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">Activité</p>
          <p className="mt-1 text-sm text-ink">{don.activites?.nom ?? '—'}</p>
        </div>

        <div>
          <p className="font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">Saisi par</p>
          <p className="mt-1 text-sm capitalize text-ink">{don.created_by_role}</p>
        </div>

        <DonFichiers donId={don.id} organisationId={organisationId} canDelete canAdd={false} />
      </div>

      {/* Actions */}
      <div className="space-y-2 border-t border-paper-border px-6 py-4">
        {confirming ? (
          <div className="space-y-2">
            <p className="font-registre text-sm font-medium text-stamp">Confirmer la suppression ?</p>
            <div className="flex gap-2">
              <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="flex-1">
                {deleting ? 'Suppression…' : 'Supprimer'}
              </Button>
              <Button variant="secondary" onClick={() => setConfirming(false)} className="flex-1">
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <Button onClick={onEdit} className="flex-1">Modifier</Button>
              <Button asChild variant="secondary" className="flex-1">
                <Link to={recuHref}>Reçu</Link>
              </Button>
            </div>
            <Button variant="danger" onClick={() => setConfirming(true)} className="w-full">
              Supprimer
            </Button>
          </>
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
  const { toast, showToast, dismissToast } = useToast()

  const { dons, participants, activites, loading, error, refetch } = useDons(organisationId)

  // Filtres appliqués (tiroir) + brouillon en cours d'édition dans le tiroir
  const today = todayISO()
  const [filtres, setFiltres] = useState<DonsFiltres>(DONS_FILTRES_VIDES)
  const [brouillon, setBrouillon] = useState<DonsFiltres>(DONS_FILTRES_VIDES)
  const [filtresOpen, setFiltresOpen] = useState(false)
  const [recherche, setRecherche] = useState('')

  // Detail & modal
  const [selectedDon, setSelectedDon] = useState<Don | null>(null)
  const [mobilePanelVisible, setMobilePanelVisible] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingDon, setEditingDon] = useState<Don | undefined>(undefined)
  const [importOpen, setImportOpen] = useState(false)

  useEffect(() => {
    if (selectedDon) {
      const timer = setTimeout(() => setMobilePanelVisible(true), 10)
      return () => clearTimeout(timer)
    }
    setMobilePanelVisible(false)
  }, [selectedDon])

  function openFiltres() {
    setBrouillon(filtres)
    setFiltresOpen(true)
  }

  function appliquerFiltres(next: DonsFiltres) {
    setFiltres(next)
    setCurrentPage(1)
  }

  function choisirPeriode(periode: PeriodeDons) {
    setBrouillon((b) => ({ ...b, periode, ...bornesPeriode(periode, today) }))
  }

  const filteredDons = useMemo(() => filtrerDons(dons, filtres, recherche), [dons, filtres, recherche])
  const nombreFiltres = nombreFiltresDons(filtres)

  const chips: FilterChip[] = []
  if (filtres.dateDebut || filtres.dateFin) {
    const periodeLabel = filtres.periode !== 'tout'
      ? PERIODES_DONS.find((p) => p.key === filtres.periode)?.label ?? ''
      : filtres.dateDebut && filtres.dateFin
        ? `${formatDateShort(filtres.dateDebut)} → ${formatDateShort(filtres.dateFin)}`
        : filtres.dateDebut
          ? `depuis le ${formatDateShort(filtres.dateDebut)}`
          : `jusqu'au ${formatDateShort(filtres.dateFin)}`
    chips.push({ key: 'periode', label: 'Période', value: periodeLabel, onRemove: () => appliquerFiltres({ ...filtres, periode: 'tout', dateDebut: '', dateFin: '' }) })
  }
  if (filtres.participantId) {
    const participant = participants.find((p) => p.id === filtres.participantId)
    const nom = participant ? (participant.personnes.prenom ? `${participant.personnes.prenom} ${participant.personnes.nom}` : participant.personnes.nom) : '—'
    chips.push({ key: 'donateur', label: 'Donateur', value: nom, onRemove: () => appliquerFiltres({ ...filtres, participantId: '' }) })
  }
  if (filtres.activiteId) {
    const activite = activites.find((a) => a.id === filtres.activiteId)
    chips.push({ key: 'activite', label: 'Activité', value: activite?.nom ?? '—', onRemove: () => appliquerFiltres({ ...filtres, activiteId: '' }) })
  }
  if (filtres.mode) {
    const mode = MODE_PAIEMENT_OPTIONS.find((o) => String(o.value) === filtres.mode)
    chips.push({ key: 'mode', label: 'Mode', value: mode?.label ?? filtres.mode, onRemove: () => appliquerFiltres({ ...filtres, mode: '' }) })
  }

  const totalCollecte = useMemo(() => dons.reduce((sum, d) => sum + d.montant, 0), [dons])

  // Tri appliqué après les filtres et avant la pagination (le chargement suit l'ordre des id).
  const [sortField, setSortField] = useState<DonSortField>(DON_SORT_DEFAUT.field)
  const [sortDirection, setSortDirection] = useState<SortDirection>(DON_SORT_DEFAUT.direction)

  function toggleSort(field: DonSortField) {
    if (field === sortField) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection(directionInitialeDon(field))
    }
    setCurrentPage(1)
  }

  const sortedDons = useMemo(
    () => trierDons(filteredDons, sortField, sortDirection),
    [filteredDons, sortField, sortDirection],
  )

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
    return sortedDons.slice(start, start + pageSize)
  }, [sortedDons, safePage, pageSize])

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

  function handleExport() {
    // L'export suit l'ordre affiché.
    const rows = sortedDons.map((don) => ({
      Date: formatDateShort(don.date),
      Donateur: nomDonateur(don),
      'Activité': don.activites?.nom ?? '',
      Montant: don.montant.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      'Mode de paiement': MODE_PAIEMENT_LABELS[don.mode_paiement],
    }))

    const { dateDebut, dateFin } = filtres
    const rangeLabel = dateDebut && dateFin
      ? `${dateDebut}_au_${dateFin}`
      : dateDebut
        ? `depuis_${dateDebut}`
        : dateFin
          ? `jusqu_au_${dateFin}`
          : `complet_${today}`

    downloadCsv(`dons_${rangeLabel}.csv`, rows)
  }

  return (
    <>
      {/*
        THESIS: le registre des dons reste lisible même dense — les 4 modes de paiement ne
        méritent pas 4 couleurs (catégorisation décorative, pas un signal d'état), une seule
        pastille neutre suffit ; l'encre reste réservée à la marque et aux vrais signaux.
        OWN-WORLD: papier clair (paper), stamp (marque/danger), warning/success réservés
        (non utilisés ici, aucun état à signaler sur cette page). La marge stamp (spine)
        reste sur le tableau uniquement — pas sur les cartes filtres/stats, qui ne sont pas
        le registre lui-même.
        STORY: l'admin filtre par période/participant/activité/mode, scanne les stats,
        clique une ligne pour le détail (panneau latéral desktop, plein écran glissant sur
        mobile — animation existante préservée à l'identique, PR #111).
        FIRST VIEWPORT: filtres + stats + tableau, panneau de détail à droite en desktop.
        FORM: 6e page du rollout "carnet tamponné x registre".
        FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
        review, the verdict, and DESIGN.md.
      */}
      <div className="-m-6 min-h-[calc(100%+3rem)] space-y-6 bg-paper p-6 font-registre">
        <PageHeader
          title="Dons"
          subtitle={loading ? 'Chargement…' : `${dons.length} don${dons.length > 1 ? 's' : ''} · ${formatEur(totalCollecte)} collectés`}
          actions={
            <>
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Importer
              </Button>
              <Button variant="secondary" onClick={handleExport} disabled={filteredDons.length === 0}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-6-3.75L12 17.25m0 0L7.5 12.75M12 17.25V3" />
                </svg>
                Exporter
              </Button>
              <Button onClick={openAdd}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Ajouter un don
              </Button>
            </>
          }
        />

        {/* Error */}
        {error && (
          <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">
            Erreur : {error}
          </div>
        )}

        {/* Chiffres de la sélection (filtres et recherche appliqués) */}
        <StatTiles
          items={[
            { label: 'Total collecté', value: formatEur(stats.total) },
            { label: 'Nombre de dons', value: String(stats.count) },
            { label: 'Don moyen', value: stats.count > 0 ? formatEur(stats.avg) : '—' },
            { label: 'Donateurs', value: String(stats.distinctParticipants) },
          ]}
        />

        {/* Table + Detail panel */}
        <div className={cn('flex gap-6', selectedDon && 'items-start')}>
          {/* Table card */}
          <div className="min-w-0 flex-1 rounded-sm border border-paper-border border-l-[3px] border-l-stamp bg-white">
            <ListToolbar
              search={{ value: recherche, onChange: (v) => { setRecherche(v); setCurrentPage(1) }, placeholder: 'Donateur, activité…', label: 'Rechercher un don' }}
              filterCount={nombreFiltres}
              onOpenFilters={openFiltres}
            />
            <FilterChips chips={chips} onClearAll={() => appliquerFiltres(DONS_FILTRES_VIDES)} />

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-stamp border-t-transparent" />
              </div>
            ) : filteredDons.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <p className="font-registre text-sm text-ink-faint">Aucun don trouvé</p>
              </div>
            ) : (
              <ScrollShadowX>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead field="date" label="Date" sortField={sortField} sortDirection={sortDirection} onSort={toggleSort} />
                      <SortableTableHead field="donateur" label="Donateur" sortField={sortField} sortDirection={sortDirection} onSort={toggleSort} />
                      <TableHead className="hidden md:table-cell">Activité</TableHead>
                      <SortableTableHead field="montant" label="Montant" sortField={sortField} sortDirection={sortDirection} onSort={toggleSort} align="right" />
                      <TableHead className="hidden md:table-cell">Mode</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedDons.map((don) => (
                      <TableRow
                        key={don.id}
                        onClick={() => setSelectedDon(don.id === selectedDon?.id ? null : don)}
                        className={cn(
                          'cursor-pointer hover:bg-paper-border/20',
                          don.id === selectedDon?.id && 'bg-stamp/[0.05] hover:bg-stamp/[0.05]'
                        )}
                      >
                        <TableCell className="whitespace-nowrap text-ink-muted">
                          {formatDate(don.date)}
                        </TableCell>
                        <TableCell className="font-medium text-ink">
                          {nomDonateur(don)}
                        </TableCell>
                        <TableCell className="hidden text-ink-faint md:table-cell">
                          {don.activites?.nom ?? '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right font-registre-mono font-medium text-ink">
                          {formatEur(don.montant)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="neutral">{MODE_PAIEMENT_LABELS[don.mode_paiement]}</Badge>
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
            {!loading && filteredDons.length > 0 && (
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
                    {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredDons.length)} sur {filteredDons.length}
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
          {selectedDon && (
            <div className="hidden w-80 flex-shrink-0 rounded-sm border border-paper-border bg-white lg:flex lg:flex-col" style={{ minHeight: '400px' }}>
              <DetailPanel
                don={selectedDon}
                organisationId={organisationId}
                onClose={() => setSelectedDon(null)}
                onEdit={() => openEdit(selectedDon)}
                onDeleted={handleDeleted}
              />
            </div>
          )}
        </div>
      </div>

      {/* Mobile detail panel (slides over) — animation inchangée (PR #111) */}
      {selectedDon && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setSelectedDon(null)}
          />
          <div
            className={cn(
              'absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-white shadow-xl transition-transform duration-200',
              mobilePanelVisible ? 'translate-x-0' : 'translate-x-full'
            )}
          >
            <DetailPanel
              don={selectedDon}
              organisationId={organisationId}
              onClose={() => setSelectedDon(null)}
              onEdit={() => openEdit(selectedDon)}
              onDeleted={handleDeleted}
            />
          </div>
        </div>
      )}

      <FilterSheet
        open={filtresOpen}
        onOpenChange={setFiltresOpen}
        description="Les chiffres et la liste suivent les filtres appliqués."
        onReset={() => setBrouillon(DONS_FILTRES_VIDES)}
        onApply={() => { appliquerFiltres(brouillon); setFiltresOpen(false) }}
      >
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">Période</legend>
          <div className="flex flex-wrap gap-2">
            {PERIODES_DONS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => choisirPeriode(key)}
                aria-pressed={brouillon.periode === key && (key !== 'tout' || (!brouillon.dateDebut && !brouillon.dateFin))}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70',
                  brouillon.periode === key && (key !== 'tout' || (!brouillon.dateDebut && !brouillon.dateFin))
                    ? 'border-stamp bg-stamp/[0.06] text-stamp'
                    : 'border-paper-border bg-white text-ink-muted hover:bg-paper'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="dons-date-debut">Du</Label>
              <Input
                id="dons-date-debut"
                type="date"
                value={brouillon.dateDebut}
                onChange={(e) => setBrouillon((b) => ({ ...b, periode: 'tout', dateDebut: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dons-date-fin">Au</Label>
              <Input
                id="dons-date-fin"
                type="date"
                value={brouillon.dateFin}
                onChange={(e) => setBrouillon((b) => ({ ...b, periode: 'tout', dateFin: e.target.value }))}
              />
            </div>
          </div>
        </fieldset>
        <div className="space-y-1.5">
          <Label>Donateur</Label>
          <ParticipantAutocomplete
            participants={participants}
            value={brouillon.participantId}
            onChange={(id) => setBrouillon((b) => ({ ...b, participantId: id }))}
            placeholder="Tous les donateurs"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Activité</Label>
          <ActiviteAutocomplete
            activites={activites}
            value={brouillon.activiteId}
            onChange={(id) => setBrouillon((b) => ({ ...b, activiteId: id }))}
            placeholder="Toutes les activités"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dons-mode-paiement">Mode de paiement</Label>
          <Select
            id="dons-mode-paiement"
            value={brouillon.mode}
            onChange={(e) => setBrouillon((b) => ({ ...b, mode: e.target.value }))}
            className="w-full"
          >
            <option value="">Tous les modes</option>
            {MODE_PAIEMENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </div>
      </FilterSheet>

      {/* Add/Edit modal */}
      <DonModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        onDonSaved={showToast}
        don={editingDon}
        participants={participants}
        activites={activites}
        organisationId={organisationId}
      />

      {toast && (
        <Toast key={toast.id} message={toast.message} durationMs={toast.durationMs} onDismiss={dismissToast} />
      )}

      {/* Import CSV/Excel */}
      {importOpen && (
        <ImportWizard
          open
          onClose={() => setImportOpen(false)}
          config={donsImportConfig}
          organisationId={organisationId}
          onImported={refetch}
        />
      )}
    </>
  )
}
