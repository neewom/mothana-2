import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useOrganisationId } from '../hooks/useOrganisationId'
import type { Don, ProfilParticipant, Activite } from '../types'
import DonModal from '../components/DonModal'
import ParticipantAutocomplete from '../components/ParticipantAutocomplete'
import ActiviteAutocomplete from '../components/ActiviteAutocomplete'
import { fetchAllRows } from '../lib/fetchAllRows'
import ImportWizard from '../components/import/ImportWizard'
import { donsImportConfig } from '../lib/import/configs'
import { MODE_PAIEMENT_LABELS, MODE_PAIEMENT_OPTIONS } from '../lib/modePaiement'
import { downloadCsv } from '../lib/csvExport'
import { cn } from '../lib/utils'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { Badge } from '../components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table'

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

function formatDateShort(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

function participantName(don: Don): string {
  const p = don.profils_participant?.personnes
  if (!p) return '—'
  return p.prenom ? `${p.prenom} ${p.nom}` : p.nom
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
    <div className="rounded-sm border border-paper-border bg-white p-5">
      <p className="font-registre text-sm text-ink-muted">{label}</p>
      <p className="mt-1 font-registre-mono text-2xl font-bold text-ink">{value}</p>
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
          <p className="font-registre-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">Participant</p>
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
          <div className="flex gap-2">
            <Button onClick={onEdit} className="flex-1">Modifier</Button>
            <Button variant="danger" onClick={() => setConfirming(true)} className="flex-1">
              Supprimer
            </Button>
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
      if (filterMode && String(d.mode_paiement) !== filterMode) return false
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

  function handleExport() {
    const rows = filteredDons.map((don) => ({
      Date: formatDateShort(don.date),
      Participant: participantName(don),
      'Activité': don.activites?.nom ?? '',
      Montant: don.montant.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      'Mode de paiement': MODE_PAIEMENT_LABELS[don.mode_paiement],
    }))

    const rangeLabel = dateDebut && dateFin
      ? `${dateDebut}_au_${dateFin}`
      : dateDebut
        ? `depuis_${dateDebut}`
        : dateFin
          ? `jusqu_au_${dateFin}`
          : `complet_${today}`

    downloadCsv(`dons_${rangeLabel}.csv`, rows)
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
        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold text-ink md:text-3xl">Dons</h1>
          <p className="mt-1 text-sm text-ink-muted">Gestion et suivi des donations</p>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">
            Erreur : {error}
          </div>
        )}

        {/* Filters card */}
        <div className="space-y-4 rounded-sm border border-paper-border bg-white p-5">
          {/* Period shortcuts */}
          <div className="flex flex-wrap gap-2">
            {SHORTCUTS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => applyShortcut(key)}
                className={cn(
                  'rounded-full px-3 py-1.5 font-registre text-sm font-medium transition-colors',
                  shortcut === key
                    ? 'bg-stamp text-white'
                    : 'bg-paper-border/30 text-ink-muted hover:bg-paper-border/50'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Date range + dropdowns */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5">
              <label htmlFor="dons-date-debut" className="block font-registre-mono text-[11px] font-medium text-ink-faint">Début</label>
              <Input
                id="dons-date-debut"
                type="date"
                value={dateDebut}
                onChange={(e) => handleDateDebutChange(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="dons-date-fin" className="block font-registre-mono text-[11px] font-medium text-ink-faint">Fin</label>
              <Input
                id="dons-date-fin"
                type="date"
                value={dateFin}
                onChange={(e) => handleDateFinChange(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block font-registre-mono text-[11px] font-medium text-ink-faint">Participant</label>
              <ParticipantAutocomplete
                participants={participants}
                value={filterParticipant}
                onChange={(id) => { setFilterParticipant(id); setCurrentPage(1) }}
                placeholder="Tous les participants"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block font-registre-mono text-[11px] font-medium text-ink-faint">Activité</label>
              <ActiviteAutocomplete
                activites={activites}
                value={filterActivite}
                onChange={(id) => { setFilterActivite(id); setCurrentPage(1) }}
                placeholder="Toutes les activités"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="dons-mode-paiement" className="block font-registre-mono text-[11px] font-medium text-ink-faint">Mode de paiement</label>
              <Select
                id="dons-mode-paiement"
                value={filterMode}
                onChange={(e) => { setFilterMode(e.target.value); setCurrentPage(1) }}
                className="w-full"
              >
                <option value="">Tous les modes</option>
                {MODE_PAIEMENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
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
        <div className={cn('flex gap-6', selectedDon && 'items-start')}>
          {/* Table card */}
          <div className="min-w-0 flex-1 rounded-sm border border-paper-border border-l-[3px] border-l-stamp bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-paper-border px-4 py-4 md:px-6">
              <h2 className="text-lg font-semibold text-ink">Liste des dons</h2>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" onClick={handleExport} disabled={filteredDons.length === 0}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-6-3.75L12 17.25m0 0L7.5 12.75M12 17.25V3" />
                  </svg>
                  Exporter
                </Button>
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
            ) : filteredDons.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <p className="font-registre text-sm text-ink-faint">Aucun don trouvé</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Participant</TableHead>
                      <TableHead>Activité</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead>Mode</TableHead>
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
                          {participantName(don)}
                        </TableCell>
                        <TableCell className="text-ink-faint">
                          {don.activites?.nom ?? '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right font-registre-mono font-medium text-ink">
                          {formatEur(don.montant)}
                        </TableCell>
                        <TableCell>
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
              </div>
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
