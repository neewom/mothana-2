import { useState, useEffect, useMemo, useCallback, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useOrganisationId } from '../hooks/useOrganisationId'
import type { Activite } from '../types'
import ImportWizard from '../components/import/ImportWizard'
import { activitesImportConfig } from '../lib/import/configs'
import { fetchAllRows } from '../lib/fetchAllRows'
import { filterActivites } from '../lib/activiteSearch'
import { cn } from '../lib/utils'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'

// ---------------------------------------------------------------------------
// Statut d'une activité — dérivé des dates réelles, jamais saisi manuellement.
// Le cachet du carnet marque le temps qui passe, pas une validation admin.
// ---------------------------------------------------------------------------

type ActiviteStatut = 'a_venir' | 'en_cours' | 'terminee' | 'sans_date'

function getStatut(a: Activite, todayIso: string): ActiviteStatut {
  if (!a.date_debut && !a.date_fin) return 'sans_date'
  if (a.date_fin && a.date_fin < todayIso) return 'terminee'
  if (a.date_debut && a.date_debut > todayIso) return 'a_venir'
  return 'en_cours'
}

function formatShort(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function postmarkParts(iso: string): { day: string; month: string } {
  const d = new Date(iso)
  return {
    day: d.toLocaleDateString('fr-FR', { day: '2-digit' }),
    month: d.toLocaleDateString('fr-FR', { month: 'short' }),
  }
}

// ---------------------------------------------------------------------------
// Cachet — marque automatiquement le temps qui passe sur une activité.
// ---------------------------------------------------------------------------

function Postmark({ statut, dateIso }: { statut: ActiviteStatut; dateIso: string | null }) {
  if (statut === 'a_venir' || statut === 'sans_date' || !dateIso) {
    return (
      <div
        className="h-[52px] w-[52px] shrink-0 animate-in zoom-in-75 fade-in duration-300 rounded-full border-[1.5px] border-dashed border-paper-border"
        aria-hidden
      />
    )
  }

  const { day, month } = postmarkParts(dateIso)
  const isLive = statut === 'en_cours'
  // Le cachet rétrécit une fois l'activité classée — hiérarchie active > terminée,
  // pas seulement une histoire d'opacité (repris du comp validé par l'utilisateur).
  const size = isLive ? 'h-[52px] w-[52px]' : 'h-10 w-10'

  return (
    <div
      className={cn(
        'flex shrink-0 -rotate-3 flex-col items-center justify-center animate-in zoom-in-75 fade-in duration-300 rounded-full border-stamp font-registre-mono text-stamp',
        size,
        isLive ? 'border-[2.5px] shadow-[0_0_0_3px_rgba(168,40,31,0.06)]' : 'border-[1.5px] opacity-50'
      )}
      aria-hidden
    >
      <span className={cn('font-bold leading-none', isLive ? 'text-[13px]' : 'text-[11px]')}>{day}</span>
      <span className="text-[8px] uppercase leading-tight tracking-wide">{month}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ActiviteModal
// ---------------------------------------------------------------------------

interface ActiviteModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  activite?: Activite
  organisationId: string
}

function ActiviteModal({ open, onClose, onSaved, activite, organisationId }: ActiviteModalProps) {
  const isEdit = !!activite
  const [nom, setNom] = useState('')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setNom(activite?.nom ?? '')
      setDateDebut(activite?.date_debut ?? '')
      setDateFin(activite?.date_fin ?? '')
      setError(null)
    }
  }, [open, activite])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const payload = {
      nom,
      date_debut: dateDebut || null,
      date_fin: dateFin || null,
    }

    if (isEdit && activite) {
      const { error: err } = await supabase
        .from('activites')
        .update(payload)
        .eq('id', activite.id)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const { error: err } = await supabase
        .from('activites')
        .insert({ ...payload, organisation_id: organisationId })
      if (err) { setError(err.message); setSaving(false); return }
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier l'activité" : 'Nouvelle activité'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {error && (
            <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 font-registre text-sm text-stamp">
              {error}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="activite-nom">
              Nom <span className="text-stamp">*</span>
            </Label>
            <Input
              id="activite-nom"
              type="text"
              required
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex : Nouvel An Lao 2026"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="activite-debut">Date de début</Label>
              <Input
                id="activite-debut"
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="activite-fin">Date de fin</Label>
              <Input
                id="activite-fin"
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
// Ligne d'activité (carnet)
// ---------------------------------------------------------------------------

interface ActiviteCounts {
  dons: number
  participants: number
}

function ActiviteRow({
  activite,
  statut,
  counts,
  onEdit,
  onDelete,
}: {
  activite: Activite
  statut: ActiviteStatut
  counts: ActiviteCounts | undefined
  onEdit: () => void
  onDelete: () => void
}) {
  const postmarkDate = statut === 'terminee' ? activite.date_fin ?? activite.date_debut : activite.date_debut
  const isTerminee = statut === 'terminee'

  const statutText =
    statut === 'en_cours'
      ? activite.date_fin
        ? `En cours · jusqu'au ${formatShort(activite.date_fin)}`
        : 'En cours'
      : statut === 'a_venir'
        ? activite.date_debut
          ? `À venir · ${formatShort(activite.date_debut)}`
          : 'À venir'
        : statut === 'sans_date'
          ? 'Sans date'
          : null

  const countsText = counts && counts.dons > 0
    ? `${counts.dons} don${counts.dons > 1 ? 's' : ''} · ${counts.participants} participant${counts.participants > 1 ? 's' : ''}`
    : 'Aucun don pour l\'instant'

  return (
    <li
      className={cn(
        'flex flex-col gap-3 border-t border-paper-border-muted px-4 py-4 first:border-t-0 sm:flex-row sm:items-center md:px-6',
        isTerminee && 'py-3'
      )}
    >
      <div className="flex flex-1 items-center gap-4 min-w-0">
        <Postmark statut={statut} dateIso={postmarkDate} />
        <div className="min-w-0 flex-1">
          <p className={cn('truncate font-registre font-semibold', isTerminee ? 'text-sm text-ink-muted' : 'text-base text-ink md:text-lg')}>
            {activite.nom}
          </p>
          {statutText && <p className="mt-0.5 font-registre text-sm text-ink-muted">{statutText}</p>}
          <p className={cn('mt-1 font-registre-mono text-xs', isTerminee ? 'text-ink-faint' : counts && counts.dons > 0 ? 'font-medium text-stamp' : 'text-ink-faint')}>
            {countsText}
          </p>
          {activite.id_externe && (
            <p className="mt-0.5 font-registre-mono text-[11px] text-ink-faint">Réf. import : {activite.id_externe}</p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 pl-[68px] sm:pl-0">
        <Button variant="ghost" size="sm" onClick={onEdit}>Modifier</Button>
        <Button variant="ghost" size="sm" className="hover:text-stamp" onClick={onDelete}>Supprimer</Button>
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// ActivitesPage
// ---------------------------------------------------------------------------

export default function ActivitesPage() {
  const organisationId = useOrganisationId()

  const [activites, setActivites] = useState<Activite[]>([])
  const [donsByActivite, setDonsByActivite] = useState<Map<string, ActiviteCounts>>(new Map())
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Activite | undefined>(undefined)
  const [deleteConfirm, setDeleteConfirm] = useState<Activite | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [pageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)

  const fetchActivites = useCallback(async () => {
    setLoading(true)
    const { data } = await fetchAllRows<Activite>((from, to) =>
      supabase
        .from('activites')
        .select('*')
        .eq('organisation_id', organisationId)
        .order('created_at', { ascending: false })
        .range(from, to)
    )
    setActivites(data)
    setLoading(false)
  }, [organisationId])

  const fetchCounts = useCallback(async () => {
    const { data } = await fetchAllRows<{ id: string; activite_id: string | null; profil_participant_id: string }>(
      (from, to) =>
        supabase
          .from('dons')
          .select('id, activite_id, profil_participant_id')
          .eq('organisation_id', organisationId)
          .not('activite_id', 'is', null)
          .range(from, to)
    )
    const map = new Map<string, { dons: number; participants: Set<string> }>()
    for (const don of data) {
      if (!don.activite_id) continue
      const entry = map.get(don.activite_id) ?? { dons: 0, participants: new Set<string>() }
      entry.dons += 1
      entry.participants.add(don.profil_participant_id)
      map.set(don.activite_id, entry)
    }
    const counts = new Map<string, ActiviteCounts>()
    for (const [activiteId, entry] of map) {
      counts.set(activiteId, { dons: entry.dons, participants: entry.participants.size })
    }
    setDonsByActivite(counts)
  }, [organisationId])

  useEffect(() => {
    if (organisationId) {
      fetchActivites()
      fetchCounts()
    }
  }, [organisationId, fetchActivites, fetchCounts])

  const filteredActivites = useMemo(
    () => filterActivites(activites, search),
    [activites, search]
  )

  const pageCount = Math.max(1, Math.ceil(filteredActivites.length / pageSize))
  const safePage = Math.min(currentPage, pageCount)

  const paginatedActivites = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filteredActivites.slice(start, start + pageSize)
  }, [filteredActivites, safePage, pageSize])

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const { actives, terminees } = useMemo(() => {
    const actives: { activite: Activite; statut: ActiviteStatut }[] = []
    const terminees: { activite: Activite; statut: ActiviteStatut }[] = []
    for (const activite of paginatedActivites) {
      const statut = getStatut(activite, todayIso)
      if (statut === 'terminee') terminees.push({ activite, statut })
      else actives.push({ activite, statut })
    }
    actives.sort((a, b) => (a.activite.date_debut ?? '9999').localeCompare(b.activite.date_debut ?? '9999'))
    terminees.sort((a, b) =>
      (b.activite.date_fin ?? b.activite.date_debut ?? '').localeCompare(a.activite.date_fin ?? a.activite.date_debut ?? '')
    )
    return { actives, terminees }
  }, [paginatedActivites, todayIso])

  function openAdd() {
    setEditing(undefined)
    setModalOpen(true)
  }

  function openEdit(a: Activite) {
    setEditing(a)
    setModalOpen(true)
  }

  function openDelete(a: Activite) {
    setDeleteConfirm(a)
    setDeleteError(null)
  }

  async function handleDelete() {
    if (!deleteConfirm) return
    setDeleting(true)
    setDeleteError(null)

    // Check if any don is linked to this activity
    const { count } = await supabase
      .from('dons')
      .select('id', { count: 'exact', head: true })
      .eq('activite_id', deleteConfirm.id)

    if (count && count > 0) {
      setDeleteError(
        `Impossible de supprimer : ${count} don${count > 1 ? 's' : ''} ${count > 1 ? 'sont rattachés' : 'est rattaché'} à cette activité.`
      )
      setDeleting(false)
      return
    }

    const { error } = await supabase
      .from('activites')
      .delete()
      .eq('id', deleteConfirm.id)

    if (error) {
      setDeleteError(error.message)
      setDeleting(false)
      return
    }

    setDeleting(false)
    setDeleteConfirm(null)
    fetchActivites()
    fetchCounts()
  }

  return (
    <>
      {/*
        THESIS: une activité est un objet du registre marqué par le temps qui passe (cachet
        automatique dérivé des dates), jamais un statut validé manuellement — refuse le
        tableau SaaS générique et la fausse promesse d'un workflow d'approbation inexistant.
        OWN-WORLD: papier clair (paper #fdfcfa/#e8e4dc), encre vermillon unique (stamp #a8281f,
        contour = action de marque, plein = danger), Inter (texte) + IBM Plex Mono (dates/
        compteurs), radius plat (rounded-sm), pas de card flottante ni d'ombre décorative.
        STORY: l'admin distingue en un coup d'œil ce qui est actif/à venir de ce qui est clos.
        FIRST VIEWPORT: deux blocs de registre côte à côte en desktop (actives | terminées),
        empilés en mobile ; cachet à gauche de chaque ligne, actions à droite.
        FORM: direction "carnet tamponné x registre" (fusion E), choisie via AskUserQuestion
        (concept-seed/serve-question non exécutable ici — pas de génération d'image dans cette
        session), validée par l'utilisateur après 2 itérations (compteurs réels dons/
        participants au lieu d'un statut inventé, séparation actives/terminées).
        FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
        review, the verdict, and DESIGN.md.
      */}
      {/*
        Canvas papier en pleine page : AdminLayout.tsx (partagé par les 23 autres pages,
        hors scope de ce pilote) impose bg-slate-100 + main.p-6 — on déborde de cette marge
        (-m-6/p-6) pour que le ton papier de la direction couvre tout le viewport, pas
        seulement l'intérieur des cartes (trouvé en revue de finition).
      */}
      <div className="-m-6 min-h-[calc(100%+3rem)] space-y-6 bg-paper p-6 font-registre">
        {/* Page title */}
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink md:text-3xl">Activités</h1>
            <p className="mt-1 font-registre-mono text-sm text-ink-faint">
              {activites.length} activité{activites.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Search + actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
            placeholder="Rechercher par nom…"
            className="w-full min-w-[12rem] max-w-xs"
          />
          <div className="flex shrink-0 items-center gap-2">
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
              Nouvelle
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-sm border border-paper-border bg-white py-16 font-registre text-sm text-ink-faint">
            Chargement…
          </div>
        ) : filteredActivites.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-sm border border-paper-border bg-white py-16 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="mb-3 h-10 w-10 text-paper-border" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
            </svg>
            <p className="font-registre text-sm font-medium text-ink-muted">
              {activites.length === 0 ? 'Aucune activité' : 'Aucune activité trouvée'}
            </p>
            <p className="mt-1 font-registre text-xs text-ink-faint">
              {activites.length === 0 ? 'Créez votre première activité pour commencer.' : 'Essayez une autre recherche.'}
            </p>
          </div>
        ) : (
          <>
            <div className="lg:flex lg:items-start lg:gap-6">
              {/* Actives / à venir */}
              <div className="mb-6 min-w-0 lg:mb-0 lg:flex-1">
                {actives.length > 0 ? (
                  <ul className="rounded-sm border border-paper-border border-l-[3px] border-l-stamp bg-white">
                    {actives.map(({ activite, statut }) => (
                      <ActiviteRow
                        key={activite.id}
                        activite={activite}
                        statut={statut}
                        counts={donsByActivite.get(activite.id)}
                        onEdit={() => openEdit(activite)}
                        onDelete={() => openDelete(activite)}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-sm border border-paper-border bg-white px-6 py-8 text-center font-registre text-sm text-ink-faint">
                    Aucune activité active ou à venir.
                  </p>
                )}
              </div>

              {/* Terminées */}
              {terminees.length > 0 && (
                <div className="min-w-0 lg:flex-1">
                  <p className="mb-2 px-1 font-registre-mono text-[11px] uppercase tracking-wide text-ink-faint">
                    Terminées
                  </p>
                  {/* Le statut "terminée" se lit déjà via la taille/le poids du cachet et
                      ink-faint sur le texte — un opacity-90 supplémentaire ici cassait le
                      contraste AA du texte, sans rien ajouter à la hiérarchie (revue de
                      finition, 2e passe). */}
                  <ul className="rounded-sm border border-paper-border border-l-[3px] border-l-stamp bg-white">
                    {terminees.map(({ activite, statut }) => (
                      <ActiviteRow
                        key={activite.id}
                        activite={activite}
                        statut={statut}
                        counts={donsByActivite.get(activite.id)}
                        onEdit={() => openEdit(activite)}
                        onDelete={() => openDelete(activite)}
                      />
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {pageCount > 1 && (
              <div className="flex items-center justify-between rounded-sm border border-paper-border bg-white px-4 py-3 md:px-6">
                <span className="font-registre-mono text-xs text-ink-faint">
                  {filteredActivites.length} activité{filteredActivites.length !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                  >
                    ‹ Précédent
                  </Button>
                  <span className="font-registre-mono text-xs text-ink-faint">Page {safePage} / {pageCount}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
                    disabled={safePage === pageCount}
                  >
                    Suivant ›
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add / Edit modal */}
      <ActiviteModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => { fetchActivites(); fetchCounts() }}
        activite={editing}
        organisationId={organisationId}
      />

      {/* Import CSV/Excel */}
      {importOpen && (
        <ImportWizard
          open
          onClose={() => setImportOpen(false)}
          config={activitesImportConfig}
          organisationId={organisationId}
          onImported={() => { fetchActivites(); fetchCounts() }}
        />
      )}

      {/* Delete confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(next) => { if (!next) setDeleteConfirm(null) }}>
        <DialogContent aria-describedby={undefined}>
          {deleteConfirm && (
            <div className="p-6">
              <h2 className="font-registre text-lg font-semibold text-ink">Supprimer l'activité</h2>
              <p className="mt-2 font-registre text-sm text-ink-muted">
                Êtes-vous sûr de vouloir supprimer{' '}
                <span className="font-medium text-ink">« {deleteConfirm.nom} »</span> ?
                Cette action est irréversible.
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
