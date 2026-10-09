import { useState, useEffect, useMemo, useCallback, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useOrganisationId } from '../hooks/useOrganisationId'
import type { DonRegulier, ProfilParticipant, Activite } from '../types'
import { fetchAllRows } from '../lib/fetchAllRows'
import { moisManquants, anneeMoisDeDate, periodeEngagement } from '../lib/donsReguliers'
import { participantFullName } from '../lib/participantSearch'
import ParticipantAutocomplete from '../components/ParticipantAutocomplete'
import ActiviteAutocomplete from '../components/ActiviteAutocomplete'
import { cn } from '../lib/utils'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Badge } from '../components/ui/badge'
import { PageHeader } from '../components/ui/page-header'
import { SidePanel, DetailField } from '../components/ui/side-panel'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table'
import ScrollShadowX from '../components/ScrollShadowX'
import { useNavCountersContext } from '../hooks/useNavCounters'

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

function formatEur(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

// ---------------------------------------------------------------------------
// DonRegulierModal — create / edit
// ---------------------------------------------------------------------------

interface DonRegulierModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  engagement?: DonRegulier
  participants: ProfilParticipant[]
  activites: Activite[]
  organisationId: string
}

function DonRegulierModal({ open, onClose, onSaved, engagement, participants, activites, organisationId }: DonRegulierModalProps) {
  const isEdit = !!engagement
  const [profilParticipantId, setProfilParticipantId] = useState('')
  const [activiteId, setActiviteId] = useState('')
  const [montant, setMontant] = useState('')
  const [jourPrelevement, setJourPrelevement] = useState('1')
  const [dateDebut, setDateDebut] = useState(todayISO())
  const [dateFin, setDateFin] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setProfilParticipantId(engagement?.profil_participant_id ?? '')
      setActiviteId(engagement?.activite_id ?? '')
      setMontant(engagement ? String(engagement.montant) : '')
      setJourPrelevement(engagement ? String(engagement.jour_prelevement) : '1')
      setDateDebut(engagement?.date_debut ?? todayISO())
      setDateFin(engagement?.date_fin ?? '')
      setError(null)
    }
  }, [open, engagement])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!profilParticipantId) {
      setError('Veuillez sélectionner un donateur.')
      return
    }

    const jour = Number(jourPrelevement)
    if (!Number.isInteger(jour) || jour < 1 || jour > 28) {
      setError('Le jour de prélèvement doit être compris entre 1 et 28 (pour éviter les mois plus courts).')
      return
    }

    setSaving(true)

    const payload = {
      profil_participant_id: profilParticipantId,
      activite_id: activiteId || null,
      montant: parseFloat(montant),
      jour_prelevement: jour,
      date_debut: dateDebut,
      date_fin: dateFin || null,
    }

    if (isEdit && engagement) {
      const { error: err } = await supabase.from('dons_reguliers').update(payload).eq('id', engagement.id)
      if (err) { setSaving(false); setError(err.message); return }

      // L'activité est propagée aux dons déjà générés (simple catégorisation, sans
      // impact fiscal). Le montant reste volontairement futurs-uniquement : le
      // modifier rétroactivement désynchroniserait le total d'un reçu déjà émis
      // pour l'année concernée (même risque que la réaffectation de participant
      // sur un don, cf. DonModal.tsx).
      const { error: syncErr } = await supabase
        .from('dons')
        .update({ activite_id: activiteId || null })
        .eq('don_regulier_id', engagement.id)
      if (syncErr) { setSaving(false); setError(syncErr.message); return }
    } else {
      const { error: err } = await supabase
        .from('dons_reguliers')
        .insert({ ...payload, organisation_id: organisationId, statut: 'actif' })
      if (err) { setSaving(false); setError(err.message); return }
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier l'engagement" : 'Nouvel engagement'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto p-6">
          {error && (
            <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 font-registre text-sm text-stamp">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>
              Donateur <span className="text-stamp">*</span>
            </Label>
            <ParticipantAutocomplete
              participants={participants}
              value={profilParticipantId}
              onChange={setProfilParticipantId}
              placeholder="Rechercher par nom et prénom…"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Activité</Label>
            <ActiviteAutocomplete
              activites={activites}
              value={activiteId}
              onChange={setActiviteId}
              placeholder="Aucune activité"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dr-montant">
                Montant (€) <span className="text-stamp">*</span>
              </Label>
              <Input
                id="dr-montant"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dr-jour">
                Jour du mois <span className="text-stamp">*</span>
              </Label>
              <Input
                id="dr-jour"
                type="number"
                min="1"
                max="28"
                required
                value={jourPrelevement}
                onChange={(e) => setJourPrelevement(e.target.value)}
              />
              <p className="font-registre-mono text-[11px] text-ink-faint">Entre le 1 et le 28.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dr-debut">
                Date de début <span className="text-stamp">*</span>
              </Label>
              <Input
                id="dr-debut"
                type="date"
                required
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dr-fin">Date de fin</Label>
              <Input
                id="dr-fin"
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Statut d'engagement — pastille `success` (actif) ou `neutral` (arrêté), jamais le
// cachet, réservé à l'actionnable (One Accent Rule).
// ---------------------------------------------------------------------------

function StatutBadge({ statut }: { statut: DonRegulier['statut'] }) {
  return statut === 'actif'
    ? <Badge variant="success">Actif</Badge>
    : <Badge variant="neutral">Arrêté</Badge>
}

// ---------------------------------------------------------------------------
// DonsReguliersPage
// ---------------------------------------------------------------------------

interface LigneAConfirmer {
  key: string
  engagement: DonRegulier
  anneeMois: string
  label: string
  date: string
}

export default function DonsReguliersPage() {
  const organisationId = useOrganisationId()

  const [engagements, setEngagements] = useState<DonRegulier[]>([])
  const [participants, setParticipants] = useState<ProfilParticipant[]>([])
  const [activites, setActivites] = useState<Activite[]>([])
  const [donsGeneres, setDonsGeneres] = useState<{ don_regulier_id: string; date: string }[]>([])
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<DonRegulier | undefined>(undefined)
  const [deleteConfirm, setDeleteConfirm] = useState<DonRegulier | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [montants, setMontants] = useState<Record<string, string>>({})
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)

    const [engagementsResult, participantsResult, activitesResult, donsResult] = await Promise.all([
      fetchAllRows<DonRegulier>((from, to) =>
        supabase
          .from('dons_reguliers')
          .select(`
            *,
            profils_participant!inner(
              id, personne_id, organisation_id,
              personnes!inner(id, nom, prenom, email, telephone)
            ),
            activites(id, nom, organisation_id)
          `)
          .eq('organisation_id', organisationId)
          .order('created_at', { ascending: false })
          .range(from, to) as unknown as PromiseLike<{ data: DonRegulier[] | null; error: { message: string } | null }>
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
      supabase.from('dons').select('don_regulier_id, date').eq('organisation_id', organisationId).not('don_regulier_id', 'is', null),
    ])

    setEngagements(engagementsResult.data)
    setParticipants(participantsResult.data)
    setActivites((activitesResult.data as unknown as Activite[]) ?? [])
    setDonsGeneres((donsResult.data as unknown as { don_regulier_id: string; date: string }[]) ?? [])
    setLoading(false)
  }, [organisationId])

  useEffect(() => {
    if (organisationId) fetchAll()
  }, [organisationId, fetchAll])

  // Rechargement après une action : la liste et la pastille « Dons réguliers » du menu.
  const { refreshNavCounters } = useNavCountersContext()
  function reload() {
    void fetchAll()
    refreshNavCounters()
  }

  const moisDejaGeneresParEngagement = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const d of donsGeneres) {
      if (!d.don_regulier_id) continue
      if (!map.has(d.don_regulier_id)) map.set(d.don_regulier_id, new Set())
      map.get(d.don_regulier_id)!.add(anneeMoisDeDate(d.date))
    }
    return map
  }, [donsGeneres])

  const lignesAConfirmer = useMemo<LigneAConfirmer[]>(() => {
    const rows: LigneAConfirmer[] = []
    for (const engagement of engagements) {
      if (engagement.statut !== 'actif') continue
      const dejaGeneres = moisDejaGeneresParEngagement.get(engagement.id) ?? new Set<string>()
      for (const mois of moisManquants(engagement, dejaGeneres)) {
        rows.push({
          key: `${engagement.id}__${mois.anneeMois}`,
          engagement,
          anneeMois: mois.anneeMois,
          label: mois.label,
          date: mois.date,
        })
      }
    }
    return rows
  }, [engagements, moisDejaGeneresParEngagement])

  useEffect(() => {
    setChecked((prev) => {
      const next: Record<string, boolean> = {}
      for (const r of lignesAConfirmer) next[r.key] = prev[r.key] ?? true
      return next
    })
    setMontants((prev) => {
      const next: Record<string, string> = {}
      for (const r of lignesAConfirmer) next[r.key] = prev[r.key] ?? String(r.engagement.montant)
      return next
    })
  }, [lignesAConfirmer])

  function openAdd() {
    setEditing(undefined)
    setModalOpen(true)
  }

  function openEdit(e: DonRegulier) {
    setEditing(e)
    setModalOpen(true)
  }

  const selected = engagements.find((e) => e.id === selectedId) ?? null
  const actifs = engagements.filter((e) => e.statut === 'actif')
  const totalMensuel = actifs.reduce((sum, e) => sum + e.montant, 0)

  async function handleToggleStatut(e: DonRegulier) {
    const payload = e.statut === 'actif'
      ? { statut: 'arrete' as const, date_fin: e.date_fin ?? todayISO() }
      : { statut: 'actif' as const }
    await supabase.from('dons_reguliers').update(payload).eq('id', e.id)
    reload()
  }

  async function handleDelete() {
    if (!deleteConfirm) return
    setDeleting(true)
    setDeleteError(null)

    const { error } = await supabase.from('dons_reguliers').delete().eq('id', deleteConfirm.id)

    if (error) {
      setDeleteError(error.message)
      setDeleting(false)
      return
    }

    setDeleting(false)
    setDeleteConfirm(null)
    setSelectedId(null)
    reload()
  }

  const nombreCoches = lignesAConfirmer.filter((r) => checked[r.key]).length

  async function handleConfirmer() {
    setConfirmError(null)

    const aInserer = lignesAConfirmer.filter((r) => checked[r.key])
    if (aInserer.length === 0) return

    for (const r of aInserer) {
      const montant = parseFloat(montants[r.key])
      if (!montant || montant <= 0) {
        setConfirmError(`Montant invalide pour ${participantFullName(r.engagement.profils_participant)} — ${r.label}.`)
        return
      }
    }

    setConfirming(true)

    const payload = aInserer.map((r) => ({
      organisation_id: organisationId,
      profil_participant_id: r.engagement.profil_participant_id,
      activite_id: r.engagement.activite_id,
      montant: parseFloat(montants[r.key]),
      date: r.date,
      mode_paiement: 3 as const,
      created_by_role: 'admin' as const,
      don_regulier_id: r.engagement.id,
    }))

    const { error } = await supabase.from('dons').insert(payload)

    setConfirming(false)

    if (error) {
      setConfirmError(error.message)
      return
    }

    reload()
  }

  return (
    <>
      {/*
        THESIS: un engagement récurrent est un registre de prélèvements attendus, pas un
        automate silencieux — la confirmation reste toujours un geste explicite de l'admin,
        jamais une insertion automatique (contrainte fiscale Cerfa, inchangée du legacy).
        OWN-WORLD: papier clair (paper #fdfcfa/#e8e4dc), encre vermillon unique (stamp
        #a8281f, contour = action de marque, plein = danger), Inter (texte) + IBM Plex Mono
        (montants/dates/statuts), radius plat (rounded-sm). Contrairement au cachet
        d'ActivitesPage (fait dérivé des dates), le statut actif/arrêté est ici un badge
        texte sobre : c'est une vraie action manuelle de l'admin, pas un fait automatique —
        réserver le cachet aux faits temporels évite de le vider de son sens.
        STORY: l'admin voit d'un coup d'œil ce qui attend une confirmation, coche/ajuste,
        confirme en un geste ; gère ses engagements récurrents dans un second registre.
        FIRST VIEWPORT: deux blocs empilés (Dons à confirmer, Engagements), mêmes primitives
        que le pilote ActivitesPage (Button/Dialog/Input/Label, tokens paper/ink/stamp).
        FORM: 2e page du rollout "carnet tamponné x registre" (direction déjà validée sur
        ActivitesPage, PR #112) — pas de nouveau tirage de direction, réutilisation directe.
        FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
        review, the verdict, and DESIGN.md.
      */}
      <div className="-m-6 min-h-[calc(100%+3rem)] space-y-6 bg-paper p-6 font-registre">
        <PageHeader
          title="Dons réguliers"
          subtitle={
            loading
              ? 'Chargement…'
              : `${actifs.length} engagement${actifs.length > 1 ? 's' : ''} actif${actifs.length > 1 ? 's' : ''} · ${formatEur(totalMensuel)} par mois`
          }
          actions={
            <Button onClick={openAdd}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nouvel engagement
            </Button>
          }
        />

        {/* Dons à confirmer */}
        <div className="rounded-sm border border-paper-border border-l-[3px] border-l-stamp bg-white">
          <div className="flex flex-col gap-3 border-b border-paper-border-muted px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-ink">Dons à confirmer</h2>
              <p className="mt-0.5 text-xs text-ink-faint">
                {lignesAConfirmer.length > 0 ? `${lignesAConfirmer.length} mois en attente · ` : ''}
                Chaque prélèvement reste soumis à votre confirmation avant d'être enregistré comme don.
              </p>
            </div>
            {lignesAConfirmer.length > 0 && (
              <Button onClick={handleConfirmer} disabled={confirming || nombreCoches === 0}>
                {confirming ? 'Confirmation…' : `Confirmer (${nombreCoches})`}
              </Button>
            )}
          </div>
          {confirmError && (
            <div className="mx-4 mt-4 rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 font-registre text-sm text-stamp md:mx-6">
              {confirmError}
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-16 font-registre text-sm text-ink-faint">Chargement…</div>
          ) : lignesAConfirmer.length === 0 ? (
            <div className="px-4 py-10 text-center font-registre text-sm text-ink-faint md:px-6">
              Aucun don en attente de confirmation.
            </div>
          ) : (
            <ul>
              {lignesAConfirmer.map((r) => (
                <li key={r.key} className="flex flex-col gap-3 border-t border-paper-border-muted px-4 py-4 first:border-t-0 sm:flex-row sm:items-center sm:justify-between md:px-6">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checked[r.key] ?? true}
                      onChange={(e) => setChecked((prev) => ({ ...prev, [r.key]: e.target.checked }))}
                      className="h-4 w-4 rounded-sm border-paper-border accent-stamp focus-visible:ring-2 focus-visible:ring-stamp/70"
                    />
                    <div>
                      <span className="font-registre text-sm font-medium text-ink">
                        {participantFullName(r.engagement.profils_participant)}
                      </span>
                      <p className="font-registre-mono text-xs text-ink-faint">
                        {r.label}
                        {r.engagement.activites && ` · ${r.engagement.activites.nom}`}
                      </p>
                    </div>
                  </label>
                  <div className="flex items-center gap-2 sm:ml-4">
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={montants[r.key] ?? ''}
                      onChange={(e) => setMontants((prev) => ({ ...prev, [r.key]: e.target.value }))}
                      className="w-28 font-registre-mono"
                    />
                    <span className="font-registre-mono text-sm text-ink-faint">€</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Engagements : liste + panneau de détail */}
        <div className={cn('flex gap-6', selected && 'items-start')}>
          <div className="min-w-0 flex-1 rounded-sm border border-paper-border border-l-[3px] border-l-stamp bg-white">
            <div className="border-b border-paper-border-muted px-4 py-4 md:px-6">
              <h2 className="text-lg font-semibold text-ink">Engagements</h2>
              <p className="mt-0.5 text-xs text-ink-faint">
                {engagements.length} engagement{engagements.length !== 1 ? 's' : ''}
              </p>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-16 font-registre text-sm text-ink-faint">Chargement…</div>
            ) : engagements.length === 0 ? (
              <div className="px-4 py-10 text-center font-registre text-sm text-ink-faint md:px-6">
                Aucun engagement de don régulier pour l'instant.
              </div>
            ) : (
              <ScrollShadowX>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Donateur</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="hidden md:table-cell">Période</TableHead>
                      <TableHead className="hidden md:table-cell">Activité</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {engagements.map((e) => (
                      <TableRow
                        key={e.id}
                        onClick={() => setSelectedId(e.id === selectedId ? null : e.id)}
                        className={cn(
                          'cursor-pointer hover:bg-paper-border/20',
                          e.id === selectedId && 'bg-stamp/[0.05] hover:bg-stamp/[0.05]'
                        )}
                      >
                        <TableCell className="whitespace-nowrap font-medium text-ink">{participantFullName(e.profils_participant)}</TableCell>
                        <TableCell className="whitespace-nowrap text-right font-registre-mono font-medium text-ink">
                          {formatEur(e.montant)}
                          <span className="ml-1 font-registre text-xs font-normal text-ink-faint">/ mois</span>
                        </TableCell>
                        <TableCell><StatutBadge statut={e.statut} /></TableCell>
                        <TableCell className="hidden whitespace-nowrap text-ink-muted md:table-cell">{periodeEngagement(e.date_debut, e.date_fin)}</TableCell>
                        <TableCell className="hidden whitespace-nowrap text-ink-faint md:table-cell">{e.activites?.nom ?? '—'}</TableCell>
                        <TableCell className="text-right text-ink-faint">
                          <svg xmlns="http://www.w3.org/2000/svg" className="inline h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollShadowX>
            )}
          </div>

          <SidePanel
            open={!!selected}
            onClose={() => setSelectedId(null)}
            title="Engagement"
            footer={selected && (
              <>
                <div className="flex gap-2">
                  <Button onClick={() => openEdit(selected)} className="flex-1">Modifier</Button>
                  <Button variant="secondary" onClick={() => handleToggleStatut(selected)} className="flex-1">
                    {selected.statut === 'actif' ? 'Arrêter' : 'Réactiver'}
                  </Button>
                </div>
                <Button variant="danger" onClick={() => { setDeleteConfirm(selected); setDeleteError(null) }} className="w-full">
                  Supprimer
                </Button>
              </>
            )}
          >
            {selected && (
              <>
                <DetailField label="Donateur">
                  <p className="font-semibold">{participantFullName(selected.profils_participant)}</p>
                  {selected.profils_participant.personnes.email && (
                    <p className="text-ink-muted">{selected.profils_participant.personnes.email}</p>
                  )}
                </DetailField>
                <div className="grid grid-cols-2 gap-4">
                  <DetailField label="Montant">
                    <p className="font-registre-mono text-xl font-bold">{formatEur(selected.montant)}</p>
                  </DetailField>
                  <DetailField label="Statut"><StatutBadge statut={selected.statut} /></DetailField>
                </div>
                <DetailField label="Prélèvement">Le {selected.jour_prelevement} de chaque mois</DetailField>
                <DetailField label="Période">{periodeEngagement(selected.date_debut, selected.date_fin)}</DetailField>
                <DetailField label="Activité">{selected.activites?.nom ?? '—'}</DetailField>
              </>
            )}
          </SidePanel>
        </div>
      </div>

      <DonRegulierModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={reload}
        engagement={editing}
        participants={participants}
        activites={activites}
        organisationId={organisationId}
      />

      <Dialog open={!!deleteConfirm} onOpenChange={(next) => { if (!next) setDeleteConfirm(null) }}>
        <DialogContent aria-describedby={undefined}>
          {deleteConfirm && (
            <div className="overflow-y-auto p-6">
              <h2 className="font-registre text-lg font-semibold text-ink">Supprimer l'engagement</h2>
              <p className="mt-2 font-registre text-sm text-ink-muted">
                Êtes-vous sûr de vouloir supprimer cet engagement pour{' '}
                <span className="font-medium text-ink">« {participantFullName(deleteConfirm.profils_participant)} »</span> ?
                Les dons déjà générés ne seront pas supprimés.
              </p>
              {deleteError && (
                <div className="mt-3 rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 font-registre text-sm text-stamp">
                  {deleteError}
                </div>
              )}
              <div className="mt-5 flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
                  Annuler
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Suppression…' : 'Supprimer'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
