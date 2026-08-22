import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { fetchAllRows } from '../lib/fetchAllRows'
import { DEFAULT_CERFA_TEMPLATES } from '../lib/defaultCerfaTemplates'
import { CARTE_ADHERENT_HTML, CARTE_ADHERENT_CSS, DEFAULT_CARTE_ADHERENT_NOM } from '../lib/defaultCarteAdherentTemplate'
import { slugifyUrl } from '../lib/organisationAssets'
import Modal from '../components/Modal'
import ScrollShadowX from '../components/ScrollShadowX'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'

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

  if (!open) return null

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
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} maxWidthClassName="max-w-lg" labelledBy="org-modal-title">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 id="org-modal-title" className="text-lg font-semibold text-slate-900">
            {isEdit ? "Modifier l'organisation" : 'Nouvelle organisation'}
          </h2>
        </div>

        <div className="max-h-[70dvh] overflow-y-auto">
          <form id="org-form" onSubmit={handleSubmit} className="space-y-4 p-6">
            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Nom de l'association <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex : Les Amis du Quartier"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {!isEdit && (
              <p className="text-xs text-slate-500">
                Un code PIN bénévole aléatoire sera généré automatiquement. Il pourra être modifié depuis les paramètres de l'organisation.
              </p>
            )}
          </form>

          {isEdit && org && (
            <div className="space-y-4 border-t border-slate-200 px-6 py-5">
              <h3 className="text-sm font-semibold text-slate-900">Comptes admin</h3>

              {adminsError && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{adminsError}</div>
              )}

              {adminsLoading ? (
                <div className="py-6 text-center text-sm text-slate-500">Chargement…</div>
              ) : admins.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-500">Aucun compte admin pour cette organisation.</div>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {admins.map((admin) => (
                    <li key={admin.utilisateur_id} className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {admin.nom_affiche ?? '—'}
                        </p>
                        <p className="truncate text-xs text-slate-500">{admin.email}</p>
                      </div>
                      <div className="ml-4 flex items-center gap-3 flex-shrink-0">
                        {admin.is_banned && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            Désactivé
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggleBan(admin)}
                          disabled={banningId === admin.utilisateur_id}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60 ${
                            admin.is_banned
                              ? 'text-green-700 hover:bg-green-50'
                              : 'text-red-600 hover:bg-red-50'
                          }`}
                        >
                          {banningId === admin.utilisateur_id
                            ? '…'
                            : admin.is_banned
                            ? 'Réactiver'
                            : 'Désactiver'}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {showAddForm ? (
                <form onSubmit={handleAddAdmin} className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Nouveau compte admin</p>
                  {addError && (
                    <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{addError}</div>
                  )}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Nom affiché <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={newNom}
                      onChange={(e) => setNewNom(e.target.value)}
                      placeholder="Prénom Nom"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Email <span className="text-red-500">*</span></label>
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="admin@exemple.fr"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className="mt-1 text-xs text-slate-500">Un email d'invitation sera envoyé pour définir le mot de passe.</p>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => { setShowAddForm(false); setAddError(null) }}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={adding}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {adding ? 'Envoi…' : "Envoyer l'invitation"}
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-300 py-3 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
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

        <div className={`flex items-center border-t border-slate-200 px-6 py-4 ${isEdit ? 'justify-between' : 'justify-end'}`}>
          {isEdit && org && (
            <button
              type="button"
              onClick={() => onDeleteRequest(org)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Supprimer
            </button>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              form="org-form"
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
    </Modal>
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
    <>
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tableau de bord</h1>
          <p className="mt-1 text-sm text-slate-600">Vue globale de toutes les organisations</p>
        </div>
        <button
          onClick={() => { setEditing(undefined); setModalOpen(true) }}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouvelle organisation
        </button>
      </div>

      {/* Stats cards */}
      {!loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: 'Organisations', value: totalOrgs, sub: 'associations actives' },
            { label: 'Total collecté', value: formatMontant(totalDons), sub: 'toutes associations' },
            { label: 'Participants', value: totalParticipants, sub: 'tous profils confondus' },
          ].map(({ label, value, sub }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
              <p className="mt-0.5 text-xs text-slate-500">{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Organisations table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Organisations</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-500">
            Chargement…
          </div>
        ) : orgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-slate-500">Aucune organisation</p>
            <p className="mt-1 text-xs text-slate-500">Créez la première organisation pour commencer.</p>
          </div>
        ) : (
          <ScrollShadowX>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Organisation</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Participants</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Dons</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Total collecté</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Créée le</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orgs.map((org) => (
                <tr
                  key={org.id}
                  onClick={() => { setEditing(org); setModalOpen(true) }}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{org.nom}</div>
                    <div className="text-xs text-slate-500 font-mono">PIN : {org.code_pin_benevole ?? '—'}</div>
                  </td>
                  <td className="px-6 py-4 text-right text-slate-700">{org.nb_participants}</td>
                  <td className="px-6 py-4 text-right text-slate-700">{org.nb_dons}</td>
                  <td className="px-6 py-4 text-right font-medium text-slate-900">{formatMontant(org.total_dons)}</td>
                  <td className="px-6 py-4 text-slate-500">{formatDate(org.created_at)}</td>
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleConsulter(org)}
                        aria-label={`Consulter ${org.nom}`}
                        title="Consulter"
                        className="rounded-lg p-1.5 text-indigo-600 hover:bg-indigo-50"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </ScrollShadowX>
        )}
      </div>
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
      {deleteConfirm && (
        <Modal open onClose={() => setDeleteConfirm(null)} maxWidthClassName="max-w-sm" labelledBy="delete-org-title">
            <div className="p-6">
              <h2 id="delete-org-title" className="text-lg font-semibold text-slate-900">Supprimer l'organisation</h2>
              <p className="mt-2 text-sm text-slate-600">
                Vous êtes sur le point de supprimer définitivement{' '}
                <span className="font-medium">« {deleteConfirm.nom} »</span> et toutes ses données :
              </p>
              <ul className="mt-3 space-y-1 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <li>{deleteConfirm.nb_adherents} adhérent{deleteConfirm.nb_adherents !== 1 ? 's' : ''}</li>
                <li>{deleteConfirm.nb_participants} donateur{deleteConfirm.nb_participants !== 1 ? 's' : ''}</li>
                <li>{deleteConfirm.nb_dons} don{deleteConfirm.nb_dons !== 1 ? 's' : ''}</li>
              </ul>
              <label htmlFor="delete-org-confirm" className="mt-4 block text-sm text-slate-600">
                Pour confirmer, saisissez le nom de l'organisation : <span className="font-medium">{deleteConfirm.nom}</span>
              </label>
              <input
                id="delete-org-confirm"
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                autoFocus
              />
              {deleteError && (
                <div className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{deleteError}</div>
              )}
              <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting || deleteConfirmText !== deleteConfirm.nom}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {deleting ? 'Suppression…' : 'Supprimer'}
                </button>
              </div>
            </div>
        </Modal>
      )}

      {toast && <Toast key={toast.id} message={toast.message} onDismiss={dismissToast} />}
    </>
  )
}
