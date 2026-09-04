import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { fetchAllRows } from '../lib/fetchAllRows'
import { DEFAULT_CERFA_TEMPLATES } from '../lib/defaultCerfaTemplates'
import { CARTE_ADHERENT_HTML, CARTE_ADHERENT_CSS, DEFAULT_CARTE_ADHERENT_NOM } from '../lib/defaultCarteAdherentTemplate'
import { slugifyUrl } from '../lib/organisationAssets'
import { isRecette, isStagingSupabaseProject } from '../lib/environment'
import { seedDemoOrganisationData } from '../lib/demoOrgSeed'
import ScrollShadowX from '../components/ScrollShadowX'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Badge } from '../components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table'
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
  nb_participants: number
  nb_adherents: number
  nb_dons: number
  total_dons: number
}

interface AdminRow {
  utilisateur_id: string
  nom_affiche: string | null
  email: string
  role: string
  created_at: string
  is_banned: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMontant(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

function StatCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="rounded-sm border border-paper-border bg-white p-5">
      <p className="font-registre text-sm text-ink-muted">{label}</p>
      <p className="mt-1 font-registre-mono text-2xl font-bold text-ink">{value}</p>
      <p className="mt-0.5 font-registre text-xs text-ink-faint">{sub}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// OrgModal — create / edit
// ---------------------------------------------------------------------------

interface OrgModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  onDeleteRequest: (org: OrgRow) => void
  onAdminAdded: (email: string) => void
  org?: OrgRow
}

function OrgModal({ open, onClose, onSaved, onDeleteRequest, onAdminAdded, org }: OrgModalProps) {
  const isEdit = !!org
  const [nom, setNom] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Admins section (fusionnée depuis l'ex-AdminsModal)
  const [admins, setAdmins] = useState<AdminRow[]>([])
  const [adminsLoading, setAdminsLoading] = useState(false)
  const [adminsError, setAdminsError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newNom, setNewNom] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [banningId, setBanningId] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setNom(org?.nom ?? '')
      setError(null)
      setShowAddForm(false)
      setNewNom('')
      setNewEmail('')
      setAddError(null)
      setAdminsError(null)
      if (org) fetchAdmins(org.id)
    }
  }, [open, org])

  async function fetchAdmins(orgId: string) {
    setAdminsLoading(true)
    setAdminsError(null)
    const { data, error: err } = await supabase.rpc('get_org_admins', { org_id: orgId })
    if (err) {
      setAdminsError(err.message)
    } else {
      setAdmins((data ?? []) as AdminRow[])
    }
    setAdminsLoading(false)
  }

  async function handleAddAdmin(e: FormEvent) {
    e.preventDefault()
    if (!org) return
    setAddError(null)
    setAdding(true)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token ?? ''

    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ nom: newNom, email: newEmail, organisation_id: org.id, site_url: window.location.origin }),
    })
    const json = await res.json()
    setAdding(false)

    if (!res.ok) {
      setAddError(json.error ?? 'Erreur lors de la création du compte')
      return
    }

    setShowAddForm(false)
    setNewNom('')
    setNewEmail('')
    onAdminAdded(newEmail)
    fetchAdmins(org.id)
  }

  async function handleToggleBan(admin: AdminRow) {
    if (!org) return
    setBanningId(admin.utilisateur_id)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token ?? ''

    const res = await fetch(`${SUPABASE_URL}/functions/v1/disable-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ utilisateur_id: admin.utilisateur_id, ban: !admin.is_banned }),
    })
    setBanningId(null)

    if (!res.ok) {
      const json = await res.json()
      setAdminsError(json.error ?? 'Erreur lors de la mise à jour du compte')
      return
    }

    fetchAdmins(org.id)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    if (isEdit && org) {
      const { error: err } = await supabase
        .from('organisations')
        .update({ nom })
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
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier l'organisation" : 'Nouvelle organisation'}</DialogTitle>
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
          </form>

          {isEdit && org && (
            <div className="space-y-4 border-t border-paper-border px-6 py-5">
              <h3 className="font-registre text-sm font-semibold text-ink">Comptes admin</h3>

              {adminsError && (
                <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 font-registre text-sm text-stamp">{adminsError}</div>
              )}

              {adminsLoading ? (
                <div className="py-6 text-center font-registre text-sm text-ink-faint">Chargement…</div>
              ) : admins.length === 0 ? (
                <div className="py-6 text-center font-registre text-sm text-ink-faint">Aucun compte admin pour cette organisation.</div>
              ) : (
                <ul className="divide-y divide-paper-border-muted rounded-sm border border-paper-border">
                  {admins.map((admin) => (
                    <li key={admin.utilisateur_id} className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-registre text-sm font-medium text-ink">
                          {admin.nom_affiche ?? '—'}
                        </p>
                        <p className="truncate font-registre text-xs text-ink-faint">{admin.email}</p>
                      </div>
                      <div className="ml-4 flex flex-shrink-0 items-center gap-3">
                        {admin.is_banned && <Badge variant="stamp">Désactivé</Badge>}
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => handleToggleBan(admin)}
                          disabled={banningId === admin.utilisateur_id}
                        >
                          {banningId === admin.utilisateur_id
                            ? '…'
                            : admin.is_banned
                            ? 'Réactiver'
                            : 'Désactiver'}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {showAddForm ? (
                <form onSubmit={handleAddAdmin} className="space-y-3 rounded-sm border border-paper-border bg-paper p-4">
                  <p className="font-registre-mono text-xs font-semibold uppercase tracking-wide text-ink-faint">Nouveau compte admin</p>
                  {addError && (
                    <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-3 py-2 font-registre text-xs text-stamp">{addError}</div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-nom">
                      Nom affiché <span className="text-stamp">*</span>
                    </Label>
                    <Input
                      id="admin-nom"
                      type="text"
                      required
                      value={newNom}
                      onChange={(e) => setNewNom(e.target.value)}
                      placeholder="Prénom Nom"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-email">
                      Email <span className="text-stamp">*</span>
                    </Label>
                    <Input
                      id="admin-email"
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="admin@exemple.fr"
                    />
                    <p className="text-xs text-ink-faint">Un email d'invitation sera envoyé pour définir le mot de passe.</p>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => { setShowAddForm(false); setAddError(null) }}
                    >
                      Annuler
                    </Button>
                    <Button type="submit" size="sm" disabled={adding}>
                      {adding ? 'Envoi…' : "Envoyer l'invitation"}
                    </Button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-sm border border-dashed border-paper-border py-3 font-registre text-sm font-medium text-stamp hover:bg-stamp/[0.04]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Ajouter un admin
                </button>
              )}
            </div>
          )}
        </div>

        <div className={`flex shrink-0 items-center border-t border-paper-border bg-white px-6 py-4 ${isEdit ? 'justify-between' : 'justify-end'}`}>
          {isEdit && org && (
            <Button type="button" variant="danger" onClick={() => onDeleteRequest(org)}>
              Supprimer
            </Button>
          )}
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" form="org-form" disabled={saving}>
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
      .select('id, nom, code_pin_benevole, created_at')
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

    const rows: OrgRow[] = orgsData.map((o) => ({
      id: o.id,
      nom: o.nom,
      code_pin_benevole: o.code_pin_benevole,
      created_at: o.created_at,
      nb_participants: participantsByOrg[o.id] ?? 0,
      nb_adherents: adherentsByOrg[o.id] ?? 0,
      nb_dons: donsByOrg[o.id]?.count ?? 0,
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
    showToast(`« ${deleteConfirm.nom} » supprimée`)
    setDeleteConfirm(null)
    setDeleteConfirmText('')
    fetchAll()
  }

  // ---------------------------------------------------------------------------
  // Global stats
  // ---------------------------------------------------------------------------

  const totalOrgs = orgs.length
  const totalDons = orgs.reduce((s, o) => s + o.total_dons, 0)
  const totalParticipants = orgs.reduce((s, o) => s + o.nb_participants, 0)

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

      {/* Stats cards */}
      {!loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Organisations" value={totalOrgs} sub="associations actives" />
          <StatCard label="Total collecté" value={formatMontant(totalDons)} sub="toutes associations" />
          <StatCard label="Participants" value={totalParticipants} sub="tous profils confondus" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">{error}</div>
      )}

      {/* Organisations table */}
      <div className="rounded-sm border border-paper-border bg-white">
        <div className="border-b border-paper-border px-6 py-4">
          <h2 className="text-lg font-semibold text-ink">Organisations</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 font-registre text-sm text-ink-faint">
            Chargement…
          </div>
        ) : orgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="font-registre text-sm font-medium text-ink-faint">Aucune organisation</p>
            <p className="mt-1 font-registre text-xs text-ink-faint">Créez la première organisation pour commencer.</p>
          </div>
        ) : (
          <ScrollShadowX>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organisation</TableHead>
                  <TableHead className="text-right">Participants</TableHead>
                  <TableHead className="text-right">Dons</TableHead>
                  <TableHead className="text-right">Total collecté</TableHead>
                  <TableHead>Créée le</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgs.map((org) => (
                  <TableRow
                    key={org.id}
                    onClick={() => { setEditing(org); setModalOpen(true) }}
                    className="cursor-pointer hover:bg-paper-border/20"
                  >
                    <TableCell>
                      <div className="font-medium text-ink">{org.nom}</div>
                      <div className="font-registre-mono text-xs text-ink-faint">PIN : {org.code_pin_benevole ?? '—'}</div>
                    </TableCell>
                    <TableCell className="text-right text-ink-muted">{org.nb_participants}</TableCell>
                    <TableCell className="text-right text-ink-muted">{org.nb_dons}</TableCell>
                    <TableCell className="text-right font-medium text-ink">{formatMontant(org.total_dons)}</TableCell>
                    <TableCell className="text-ink-faint">{formatDate(org.created_at)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleConsulter(org)}
                          aria-label={`Consulter ${org.nom}`}
                          title="Consulter"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
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
        onSaved={fetchAll}
        onDeleteRequest={(org) => {
          setModalOpen(false)
          setDeleteConfirm(org)
          setDeleteError(null)
          setDeleteConfirmText('')
        }}
        onAdminAdded={(email) => showToast(`Invitation envoyée à ${email}`)}
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
