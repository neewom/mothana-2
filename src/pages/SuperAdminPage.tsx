import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import type { FonctionnalitesActivees } from '../hooks/useFonctionnalitesActivees'
import { fetchAllRows } from '../lib/fetchAllRows'
import { DEFAULT_CERFA_TEMPLATES } from '../lib/defaultCerfaTemplates'
import { CARTE_ADHERENT_HTML, CARTE_ADHERENT_CSS, DEFAULT_CARTE_ADHERENT_NOM } from '../lib/defaultCarteAdherentTemplate'
import { slugifyUrl } from '../lib/organisationAssets'
import { isRecette, isStagingSupabaseProject } from '../lib/environment'
import { seedDemoOrganisationData } from '../lib/demoOrgSeed'
import { downloadCsv } from '../lib/csvExport'
import { cn } from '../lib/utils'
import ScrollShadowX from '../components/ScrollShadowX'
import AdminAccountsManager from '../components/AdminAccountsManager'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Table, TableBody, TableRow, TableCell } from '../components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrgRow {
  id: string
  nom: string
  code_pin_benevole: string | null
  created_at: string
  fonctionnalites_activees: FonctionnalitesActivees
  archived_at: string | null
  nb_participants: number
  nb_adherents: number
  nb_dons: number
  nb_admins: number
  total_dons: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function sanitizeForCsv(rows: Record<string, unknown>[]): Record<string, string | number>[] {
  return rows.map((row) => {
    const out: Record<string, string | number> = {}
    for (const [key, value] of Object.entries(row)) {
      if (value === null || value === undefined) out[key] = ''
      else if (typeof value === 'number') out[key] = value
      else if (typeof value === 'string') out[key] = value
      else if (typeof value === 'boolean') out[key] = value ? 'oui' : 'non'
      else out[key] = JSON.stringify(value)
    }
    return out
  })
}

// ---------------------------------------------------------------------------
// OrgModal — create / edit
// ---------------------------------------------------------------------------

interface OrgModalProps {
  open: boolean
  onClose: () => void
  onSaved: (message: string) => void
  onArchiveRequest: (org: OrgRow) => void
  onAdminAdded: (email: string) => void
  onConsult: (org: OrgRow) => void
  org?: OrgRow
}

function OrgModal({ open, onClose, onSaved, onArchiveRequest, onAdminAdded, onConsult, org }: OrgModalProps) {
  const isEdit = !!org
  const [nom, setNom] = useState('')
  const [donsActifs, setDonsActifs] = useState(true)
  const [adherentsActifs, setAdherentsActifs] = useState(true)
  const [evenementsActifs, setEvenementsActifs] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Valeurs initiales — comparées à l'état courant pour n'activer "Enregistrer"
  // que si le formulaire a réellement changé (édition uniquement).
  const [initialNom, setInitialNom] = useState('')
  const [initialDonsActifs, setInitialDonsActifs] = useState(true)
  const [initialAdherentsActifs, setInitialAdherentsActifs] = useState(true)
  const [initialEvenementsActifs, setInitialEvenementsActifs] = useState(false)
  const isDirty = nom !== initialNom || donsActifs !== initialDonsActifs || adherentsActifs !== initialAdherentsActifs || evenementsActifs !== initialEvenementsActifs

  useEffect(() => {
    if (open) {
      setNom(org?.nom ?? '')
      setInitialNom(org?.nom ?? '')
      setDonsActifs(org?.fonctionnalites_activees.dons ?? true)
      setInitialDonsActifs(org?.fonctionnalites_activees.dons ?? true)
      setAdherentsActifs(org?.fonctionnalites_activees.adherents ?? true)
      setInitialAdherentsActifs(org?.fonctionnalites_activees.adherents ?? true)
      setEvenementsActifs(org?.fonctionnalites_activees.evenements ?? false)
      setInitialEvenementsActifs(org?.fonctionnalites_activees.evenements ?? false)
      setError(null)
    }
  }, [open, org])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    if (isEdit && org) {
      const { error: err } = await supabase
        .from('organisations')
        .update({ nom, fonctionnalites_activees: { ...org.fonctionnalites_activees, dons: donsActifs, adherents: adherentsActifs, evenements: evenementsActifs } })
        .eq('id', org.id)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const slug = slugifyUrl(nom)
      if (!slug) { setError('Nom invalide pour générer un identifiant'); setSaving(false); return }

      const { data: newOrg, error: err } = await supabase
        .from('organisations')
        .insert({ nom, code_pin_benevole: generatePin(), slug })
        .select('id')
        .single()
      if (err) {
        setError(err.code === '23505' ? 'Une organisation avec un nom équivalent existe déjà' : err.message)
        setSaving(false)
        return
      }

      const { error: templatesErr } = await supabase
        .from('templates_recu')
        .insert(
          DEFAULT_CERFA_TEMPLATES.map((t) => ({
            organisation_id: newOrg.id,
            nom: t.nom,
            type_cerfa: t.type_cerfa,
            html_template: t.html_template,
            css: t.css,
            is_active: true,
          }))
        )
      if (templatesErr) { setError(templatesErr.message); setSaving(false); return }

      const { error: carteErr } = await supabase.from('templates_carte_adherent').insert({
        organisation_id: newOrg.id,
        nom: DEFAULT_CARTE_ADHERENT_NOM,
        html_template: CARTE_ADHERENT_HTML,
        css: CARTE_ADHERENT_CSS,
        is_active: true,
      })
      if (carteErr) { setError(carteErr.message); setSaving(false); return }

      if (isRecette() && isStagingSupabaseProject()) {
        try {
          await seedDemoOrganisationData(newOrg.id)
        } catch (seedErr) {
          console.error('Échec du peuplement factice (organisation créée quand même) :', seedErr)
        }
      }
    }

    setSaving(false)
    onSaved(isEdit ? `« ${nom} » mise à jour` : `« ${nom} » créée`)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-8">
            <div>
              <DialogTitle>{isEdit ? "Modifier l'organisation" : 'Nouvelle organisation'}</DialogTitle>
              {isEdit && org && (
                <p className="mt-0.5 font-registre text-xs text-ink-faint">Créée le {formatDate(org.created_at)}</p>
              )}
            </div>
            {isEdit && org && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="-mt-2"
                onClick={() => onConsult(org)}
                aria-label={`Consulter ${org.nom}`}
                title="Consulter"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <form id="org-form" onSubmit={handleSubmit} className="space-y-4 p-6">
            {error && (
              <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 font-registre text-sm text-stamp">{error}</div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="org-nom">
                Nom de l'association <span className="text-stamp">*</span>
              </Label>
              <Input
                id="org-nom"
                type="text"
                required
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex : Les Amis du Quartier"
              />
            </div>
            {!isEdit && (
              <p className="text-xs text-ink-faint">
                Un code PIN bénévole aléatoire sera généré automatiquement. Il pourra être modifié depuis les paramètres de l'organisation.
              </p>
            )}
            {isEdit && (
              <div className="space-y-1.5">
                <Label>Fonctionnalités activées</Label>
                <div className="space-y-2 rounded-sm border border-paper-border bg-paper px-4 py-3">
                  <label className="flex items-center gap-2 font-registre text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={donsActifs}
                      onChange={(e) => setDonsActifs(e.target.checked)}
                      className="h-4 w-4 rounded-sm border-paper-border accent-stamp focus-visible:ring-2 focus-visible:ring-stamp/70"
                    />
                    Dons
                  </label>
                  <label className="flex items-center gap-2 font-registre text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={adherentsActifs}
                      onChange={(e) => setAdherentsActifs(e.target.checked)}
                      className="h-4 w-4 rounded-sm border-paper-border accent-stamp focus-visible:ring-2 focus-visible:ring-stamp/70"
                    />
                    Adhérents
                  </label>
                  <label className="flex items-center gap-2 font-registre text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={evenementsActifs}
                      onChange={(e) => setEvenementsActifs(e.target.checked)}
                      className="h-4 w-4 rounded-sm border-paper-border accent-stamp focus-visible:ring-2 focus-visible:ring-stamp/70"
                    />
                    Porte-monnaie événementiel
                  </label>
                </div>
              </div>
            )}
          </form>

          {isEdit && org && (
            <div className="border-t border-paper-border px-6 py-5">
              <AdminAccountsManager
                organisationId={org.id}
                showRoleBadge
                emptyLabel="Aucun compte pour cette organisation."
                onAccountAdded={onAdminAdded}
              />
            </div>
          )}
        </div>

        <div className={`flex shrink-0 items-center border-t border-paper-border bg-white px-6 py-4 ${isEdit ? 'justify-between' : 'justify-end'}`}>
          {isEdit && org && (
            <Button type="button" variant="secondary" onClick={() => onArchiveRequest(org)}>
              Archiver
            </Button>
          )}
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" form="org-form" disabled={saving || (isEdit && !isDirty)}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// SuperAdminPage
// ---------------------------------------------------------------------------

export default function SuperAdminPage() {
  const { setViewingOrg } = useAuth()
  const navigate = useNavigate()
  const { toast, showToast, dismissToast } = useToast()

  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<OrgRow | undefined>(undefined)
  const [deleteConfirm, setDeleteConfirm] = useState<OrgRow | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [tab, setTab] = useState<'actives' | 'archivees'>('actives')
  const [extractingId, setExtractingId] = useState<string | null>(null)

  const activeOrgs = orgs.filter((o) => !o.archived_at)
  const archivedOrgs = orgs.filter((o) => o.archived_at)

  function handleConsulter(org: OrgRow) {
    setViewingOrg(org.id)
    navigate('/admin')
  }

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------

  async function fetchAll() {
    setLoading(true)
    setError(null)

    // 1. All organisations
    const { data: orgsData, error: orgsErr } = await supabase
      .from('organisations')
      .select('id, nom, code_pin_benevole, created_at, fonctionnalites_activees, archived_at')
      .order('created_at', { ascending: false })

    if (orgsErr || !orgsData) {
      setError(orgsErr?.message ?? 'Erreur de chargement')
      setLoading(false)
      return
    }

    // 2. All dons (for stats per org)
    const { data: donsData } = await fetchAllRows<{ organisation_id: string; montant: number }>((from, to) =>
      supabase
        .from('dons')
        .select('organisation_id, montant')
        .order('id', { ascending: true })
        .range(from, to)
    )

    // 3. All profils_participant (for count per org)
    const { data: profilsData } = await fetchAllRows<{ organisation_id: string }>((from, to) =>
      supabase
        .from('profils_participant')
        .select('organisation_id')
        .order('id', { ascending: true })
        .range(from, to)
    )

    // 4. All adherents (for count per org)
    const { data: adherentsData } = await fetchAllRows<{ organisation_id: string }>((from, to) =>
      supabase
        .from('adherents')
        .select('organisation_id')
        .order('id', { ascending: true })
        .range(from, to)
    )

    // 5. All admin accounts (for count per org)
    const { data: adminsData } = await fetchAllRows<{ organisation_id: string }>((from, to) =>
      supabase
        .from('profils_organisation')
        .select('organisation_id')
        .order('id', { ascending: true })
        .range(from, to)
    )

    // Aggregate
    const donsByOrg: Record<string, { count: number; total: number }> = {}
    for (const d of donsData) {
      if (!donsByOrg[d.organisation_id]) donsByOrg[d.organisation_id] = { count: 0, total: 0 }
      donsByOrg[d.organisation_id].count++
      donsByOrg[d.organisation_id].total += Number(d.montant)
    }

    const participantsByOrg: Record<string, number> = {}
    for (const p of profilsData) {
      participantsByOrg[p.organisation_id] = (participantsByOrg[p.organisation_id] ?? 0) + 1
    }

    const adherentsByOrg: Record<string, number> = {}
    for (const a of adherentsData) {
      adherentsByOrg[a.organisation_id] = (adherentsByOrg[a.organisation_id] ?? 0) + 1
    }

    const adminsByOrg: Record<string, number> = {}
    for (const a of adminsData) {
      adminsByOrg[a.organisation_id] = (adminsByOrg[a.organisation_id] ?? 0) + 1
    }

    const rows: OrgRow[] = orgsData.map((o) => ({
      id: o.id,
      nom: o.nom,
      code_pin_benevole: o.code_pin_benevole,
      created_at: o.created_at,
      archived_at: o.archived_at,
      fonctionnalites_activees: {
        ...(o.fonctionnalites_activees as Partial<FonctionnalitesActivees> | null),
        dons: (o.fonctionnalites_activees as Partial<FonctionnalitesActivees> | null)?.dons ?? true,
        adherents: (o.fonctionnalites_activees as Partial<FonctionnalitesActivees> | null)?.adherents ?? true,
        evenements: (o.fonctionnalites_activees as Partial<FonctionnalitesActivees> | null)?.evenements ?? false,
      },
      nb_participants: participantsByOrg[o.id] ?? 0,
      nb_adherents: adherentsByOrg[o.id] ?? 0,
      nb_dons: donsByOrg[o.id]?.count ?? 0,
      nb_admins: adminsByOrg[o.id] ?? 0,
      total_dons: donsByOrg[o.id]?.total ?? 0,
    }))

    setOrgs(rows)
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async function handleDelete() {
    if (!deleteConfirm) return
    setDeleting(true)
    setDeleteError(null)

    // Supprimer d'abord les comptes admin de l'organisation : la suppression
    // de l'organisation cascade profils_organisation, mais pas les comptes
    // auth.users eux-mêmes (cascade FK uniquement users -> profils_organisation,
    // pas l'inverse) — sans ça ils restent orphelins, incapables de se
    // connecter mais aussi impossibles à gérer/rattacher depuis l'UI.
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token ?? ''

    const adminsRes = await fetch(`${SUPABASE_URL}/functions/v1/delete-org-admins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ organisation_id: deleteConfirm.id }),
    })
    if (!adminsRes.ok) {
      const json = await adminsRes.json().catch(() => ({}))
      setDeleteError(json.error ?? 'Erreur lors de la suppression des comptes admin')
      setDeleting(false)
      return
    }

    const { error: err } = await supabase
      .from('organisations')
      .delete()
      .eq('id', deleteConfirm.id)

    if (err) {
      setDeleteError(err.message)
      setDeleting(false)
      return
    }

    setDeleting(false)
    showToast(`« ${deleteConfirm.nom} » supprimée (comptes admin inclus)`)
    setDeleteConfirm(null)
    setDeleteConfirmText('')
    fetchAll()
  }

  // ---------------------------------------------------------------------------
  // Archivage
  // ---------------------------------------------------------------------------

  async function handleArchive(org: OrgRow) {
    if (!window.confirm(`Archiver « ${org.nom} » ? Ses admins et bénévoles ne pourront plus se connecter. Réversible depuis l'onglet "Archivées".`)) return

    const { error: err } = await supabase
      .from('organisations')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', org.id)

    if (err) { showToast(`Erreur : ${err.message}`); return }

    setModalOpen(false)
    showToast(`« ${org.nom} » archivée`)
    fetchAll()
  }

  async function handleReactivate(org: OrgRow) {
    if (!window.confirm(`Réactiver « ${org.nom} » ? Ses admins et bénévoles pourront à nouveau se connecter.`)) return

    const { error: err } = await supabase
      .from('organisations')
      .update({ archived_at: null })
      .eq('id', org.id)

    if (err) { showToast(`Erreur : ${err.message}`); return }

    showToast(`« ${org.nom} » réactivée`)
    fetchAll()
  }

  async function handleExtract(org: OrgRow) {
    setExtractingId(org.id)
    const slug = slugifyUrl(org.nom) || org.id

    const [adherentsRes, donsRes, participantsRes, activitesRes] = await Promise.all([
      supabase.from('adherents').select('*').eq('organisation_id', org.id),
      supabase.from('dons').select('*').eq('organisation_id', org.id),
      supabase.from('profils_participant').select('*, personnes(*)').eq('organisation_id', org.id),
      supabase.from('activites').select('*').eq('organisation_id', org.id),
    ])

    if (adherentsRes.data?.length) downloadCsv(`${slug}-adherents.csv`, sanitizeForCsv(adherentsRes.data))
    if (donsRes.data?.length) downloadCsv(`${slug}-dons.csv`, sanitizeForCsv(donsRes.data))
    if (participantsRes.data?.length) downloadCsv(`${slug}-participants.csv`, sanitizeForCsv(participantsRes.data))
    if (activitesRes.data?.length) downloadCsv(`${slug}-activites.csv`, sanitizeForCsv(activitesRes.data))

    setExtractingId(null)
    showToast(`Données de « ${org.nom} » extraites (CSV par table)`)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="-m-6 min-h-[calc(100%+3rem)] space-y-6 bg-paper p-6 font-registre">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink md:text-3xl">Tableau de bord</h1>
          <p className="mt-1 text-sm text-ink-muted">Vue globale de toutes les organisations</p>
        </div>
        <Button onClick={() => { setEditing(undefined); setModalOpen(true) }}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouvelle organisation
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">{error}</div>
      )}

      {/* Organisations table */}
      <div className="rounded-sm border border-paper-border border-l-[3px] border-l-stamp bg-white">
        <div className="flex flex-col gap-3 border-b border-paper-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-ink">Organisations</h2>
          <div className="flex gap-2 rounded-sm bg-paper-border/40 p-1">
            <button
              type="button"
              onClick={() => setTab('actives')}
              className={cn(
                'flex-1 rounded-sm px-3 py-1.5 font-registre text-sm font-medium transition-colors sm:flex-initial',
                tab === 'actives' ? 'bg-white text-ink shadow-sm' : 'text-ink-faint hover:text-ink-muted'
              )}
            >
              Actives{activeOrgs.length > 0 ? ` (${activeOrgs.length})` : ''}
            </button>
            <button
              type="button"
              onClick={() => setTab('archivees')}
              className={cn(
                'flex-1 rounded-sm px-3 py-1.5 font-registre text-sm font-medium transition-colors sm:flex-initial',
                tab === 'archivees' ? 'bg-white text-ink shadow-sm' : 'text-ink-faint hover:text-ink-muted'
              )}
            >
              Archivées{archivedOrgs.length > 0 ? ` (${archivedOrgs.length})` : ''}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 font-registre text-sm text-ink-faint">
            Chargement…
          </div>
        ) : tab === 'actives' ? (
          activeOrgs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="font-registre text-sm font-medium text-ink-faint">Aucune organisation active</p>
              <p className="mt-1 font-registre text-xs text-ink-faint">Créez la première organisation pour commencer.</p>
            </div>
          ) : (
            <Table>
              <TableBody>
                {activeOrgs.map((org) => (
                  <TableRow
                    key={org.id}
                    onClick={() => { setEditing(org); setModalOpen(true) }}
                    className="cursor-pointer hover:bg-paper-border/20"
                  >
                    <TableCell>
                      <div className="font-medium text-ink">{org.nom}</div>
                      <div className="font-registre-mono text-xs text-ink-faint">PIN : {org.code_pin_benevole ?? '—'}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        ) : archivedOrgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="font-registre text-sm font-medium text-ink-faint">Aucune organisation archivée</p>
          </div>
        ) : (
          <ScrollShadowX>
            <Table>
              <TableBody>
                {archivedOrgs.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell>
                      <div className="font-medium text-ink">{org.nom}</div>
                      <div className="font-registre-mono text-xs text-ink-faint">
                        Archivée le {org.archived_at ? formatDate(org.archived_at) : '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-nowrap justify-end gap-2">
                        <Button type="button" variant="secondary" size="sm" onClick={() => handleExtract(org)} disabled={extractingId === org.id}>
                          {extractingId === org.id ? 'Extraction…' : 'Extraire les données'}
                        </Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => handleReactivate(org)}>
                          Réactiver
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          onClick={() => { setDeleteConfirm(org); setDeleteError(null); setDeleteConfirmText('') }}
                        >
                          Supprimer
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollShadowX>
        )}
      </div>

      {/* Create / edit modal */}
      <OrgModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={(message) => { fetchAll(); showToast(message) }}
        onArchiveRequest={handleArchive}
        onAdminAdded={(email) => showToast(`Invitation envoyée à ${email}`)}
        onConsult={handleConsulter}
        org={editing}
      />

      {/* Delete confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(next) => { if (!next) setDeleteConfirm(null) }}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          {deleteConfirm && (
            <div className="p-6">
              <h2 className="font-registre text-lg font-semibold text-ink">Supprimer l'organisation</h2>
              <p className="mt-2 font-registre text-sm text-ink-muted">
                Vous êtes sur le point de supprimer définitivement{' '}
                <span className="font-medium text-ink">« {deleteConfirm.nom} »</span> et toutes ses données :
              </p>
              <ul className="mt-3 space-y-1 rounded-sm bg-paper px-4 py-3 font-registre text-sm text-ink-muted">
                <li>{deleteConfirm.nb_adherents} adhérent{deleteConfirm.nb_adherents !== 1 ? 's' : ''}</li>
                <li>{deleteConfirm.nb_participants} donateur{deleteConfirm.nb_participants !== 1 ? 's' : ''}</li>
                <li>{deleteConfirm.nb_dons} don{deleteConfirm.nb_dons !== 1 ? 's' : ''}</li>
                <li>{deleteConfirm.nb_admins} compte{deleteConfirm.nb_admins !== 1 ? 's' : ''} admin{deleteConfirm.nb_admins !== 1 ? 's' : ''}</li>
              </ul>
              <Label htmlFor="delete-org-confirm" className="mt-4 block">
                Pour confirmer, saisissez le nom de l'organisation : <span className="font-medium text-ink">{deleteConfirm.nom}</span>
              </Label>
              <Input
                id="delete-org-confirm"
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="mt-2"
              />
              {deleteError && (
                <div className="mt-3 rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 font-registre text-sm text-stamp">{deleteError}</div>
              )}
              <div className="mt-5 flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={() => setDeleteConfirm(null)}>
                  Annuler
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting || deleteConfirmText !== deleteConfirm.nom}
                >
                  {deleting ? 'Suppression…' : 'Supprimer'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {toast && <Toast key={toast.id} message={toast.message} onDismiss={dismissToast} />}
    </div>
  )
}
