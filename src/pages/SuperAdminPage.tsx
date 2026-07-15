import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { fetchAllRows } from '../lib/fetchAllRows'

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
  org?: OrgRow
}

function OrgModal({ open, onClose, onSaved, org }: OrgModalProps) {
  const isEdit = !!org
  const [nom, setNom] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setNom(org?.nom ?? '')
      setError(null)
    }
  }, [open, org])

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
      const { error: err } = await supabase
        .from('organisations')
        .insert({ nom, code_pin_benevole: generatePin() })
      if (err) { setError(err.message); setSaving(false); return }
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEdit ? "Modifier l'organisation" : 'Nouvelle organisation'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
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
              autoFocus
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex : Association Mothana"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {!isEdit && (
            <p className="text-xs text-slate-400">
              Un code PIN bénévole aléatoire sera généré automatiquement. Il pourra être modifié depuis les paramètres de l'organisation.
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AdminsModal — list + add + ban/unban admins for an org
// ---------------------------------------------------------------------------

interface AdminsModalProps {
  open: boolean
  org: OrgRow | null
  onClose: () => void
}

function AdminsModal({ open, org, onClose }: AdminsModalProps) {
  const [admins, setAdmins] = useState<AdminRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Add admin form
  const [showAddForm, setShowAddForm] = useState(false)
  const [newNom, setNewNom] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  // Ban/unban in progress
  const [banningId, setBanningId] = useState<string | null>(null)

  useEffect(() => {
    if (open && org) {
      setShowAddForm(false)
      setNewNom('')
      setNewEmail('')
      setNewPassword('')
      setAddError(null)
      setError(null)
      fetchAdmins()
    }
  }, [open, org])

  async function fetchAdmins() {
    if (!org) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase.rpc('get_org_admins', { org_id: org.id })
    if (err) {
      setError(err.message)
    } else {
      setAdmins((data ?? []) as AdminRow[])
    }
    setLoading(false)
  }

  async function handleAddAdmin(e: FormEvent) {
    e.preventDefault()
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
      body: JSON.stringify({ nom: newNom, email: newEmail, password: newPassword, organisation_id: org!.id }),
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
    setNewPassword('')
    fetchAdmins()
  }

  async function handleToggleBan(admin: AdminRow) {
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
      setError(json.error ?? 'Erreur lors de la mise à jour du compte')
      return
    }

    fetchAdmins()
  }

  if (!open || !org) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Comptes admin</h2>
            <p className="text-sm text-slate-500">{org.nom}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {/* Admin list */}
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-400">Chargement…</div>
          ) : admins.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">Aucun compte admin pour cette organisation.</div>
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

          {/* Add admin form */}
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
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Mot de passe <span className="text-red-500">*</span></label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="8 caractères minimum"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
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
                  {adding ? 'Création…' : 'Créer le compte'}
                </button>
              </div>
            </form>
          ) : (
            <button
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
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SuperAdminPage
// ---------------------------------------------------------------------------

export default function SuperAdminPage() {
  const { setViewingOrg } = useAuth()
  const navigate = useNavigate()

  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<OrgRow | undefined>(undefined)
  const [deleteConfirm, setDeleteConfirm] = useState<OrgRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [adminsModalOrg, setAdminsModalOrg] = useState<OrgRow | null>(null)

  function handleConsulter(org: OrgRow) {
    setViewingOrg(org.id)
    navigate('/admin/dons')
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

    const rows: OrgRow[] = orgsData.map((o) => ({
      id: o.id,
      nom: o.nom,
      code_pin_benevole: o.code_pin_benevole,
      created_at: o.created_at,
      nb_participants: participantsByOrg[o.id] ?? 0,
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
    setDeleteConfirm(null)
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tableau de bord</h1>
          <p className="mt-1 text-sm text-slate-500">Vue globale de toutes les organisations</p>
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
              <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
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
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">
            Chargement…
          </div>
        ) : orgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-slate-500">Aucune organisation</p>
            <p className="mt-1 text-xs text-slate-400">Créez la première organisation pour commencer.</p>
          </div>
        ) : (
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
                <tr key={org.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{org.nom}</div>
                    <div className="text-xs text-slate-400 font-mono">PIN : {org.code_pin_benevole ?? '—'}</div>
                  </td>
                  <td className="px-6 py-4 text-right text-slate-700">{org.nb_participants}</td>
                  <td className="px-6 py-4 text-right text-slate-700">{org.nb_dons}</td>
                  <td className="px-6 py-4 text-right font-medium text-slate-900">{formatMontant(org.total_dons)}</td>
                  <td className="px-6 py-4 text-slate-500">{formatDate(org.created_at)}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleConsulter(org)}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                      >
                        Consulter
                      </button>
                      <button
                        onClick={() => setAdminsModalOrg(org)}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                      >
                        Admins
                      </button>
                      <button
                        onClick={() => { setEditing(org); setModalOpen(true) }}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => { setDeleteConfirm(org); setDeleteError(null) }}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / edit modal */}
      <OrgModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={fetchAll}
        org={editing}
      />

      {/* Admins modal */}
      <AdminsModal
        open={adminsModalOrg !== null}
        org={adminsModalOrg}
        onClose={() => setAdminsModalOrg(null)}
      />

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteConfirm(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-slate-900">Supprimer l'organisation</h2>
              <p className="mt-2 text-sm text-slate-600">
                Êtes-vous sûr de vouloir supprimer{' '}
                <span className="font-medium">« {deleteConfirm.nom} »</span> ?
                Toutes les données associées (dons, participants, reçus) seront supprimées définitivement.
              </p>
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
                  disabled={deleting}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {deleting ? 'Suppression…' : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
