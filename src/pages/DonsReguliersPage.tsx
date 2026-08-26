import { useState, useEffect, useMemo, useCallback, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useOrganisationId } from '../hooks/useOrganisationId'
import type { DonRegulier, ProfilParticipant, Activite } from '../types'
import { fetchAllRows } from '../lib/fetchAllRows'
import { moisManquants, anneeMoisDeDate } from '../lib/donsReguliers'
import { participantFullName } from '../lib/participantSearch'
import Modal from '../components/Modal'
import SectionHeader from '../components/SectionHeader'
import ParticipantAutocomplete from '../components/ParticipantAutocomplete'
import ActiviteAutocomplete from '../components/ActiviteAutocomplete'

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
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

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!profilParticipantId) {
      setError('Veuillez sélectionner un participant.')
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

    const { error: err } = isEdit && engagement
      ? await supabase.from('dons_reguliers').update(payload).eq('id', engagement.id)
      : await supabase.from('dons_reguliers').insert({ ...payload, organisation_id: organisationId, statut: 'actif' })

    setSaving(false)

    if (err) {
      setError(err.message)
      return
    }

    onSaved()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="don-regulier-modal-title">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 id="don-regulier-modal-title" className="text-lg font-semibold text-slate-900">
          {isEdit ? "Modifier l'engagement" : 'Nouvel engagement'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 p-6">
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Participant <span className="text-red-500">*</span>
          </label>
          <ParticipantAutocomplete
            participants={participants}
            value={profilParticipantId}
            onChange={setProfilParticipantId}
            placeholder="Rechercher par nom et prénom…"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Activité</label>
          <ActiviteAutocomplete
            activites={activites}
            value={activiteId}
            onChange={setActiviteId}
            placeholder="Aucune activité"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Montant (€) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Jour du mois <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              max="28"
              required
              value={jourPrelevement}
              onChange={(e) => setJourPrelevement(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-slate-500">Entre le 1 et le 28.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Date de début <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Date de fin</label>
            <input
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

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
    </Modal>
  )
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

  async function handleToggleStatut(e: DonRegulier) {
    const payload = e.statut === 'actif'
      ? { statut: 'arrete' as const, date_fin: e.date_fin ?? todayISO() }
      : { statut: 'actif' as const }
    await supabase.from('dons_reguliers').update(payload).eq('id', e.id)
    fetchAll()
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
    fetchAll()
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

    fetchAll()
  }

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dons réguliers</h1>
          <p className="mt-1 text-sm text-slate-600">
            Automatise la saisie des dons récurrents (prélèvements mensuels) — chaque don reste soumis à ta confirmation avant d'être enregistré.
          </p>
        </div>

        {/* Dons à confirmer */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <SectionHeader
            title="Dons à confirmer"
            description={lignesAConfirmer.length > 0 ? `${lignesAConfirmer.length} mois en attente` : undefined}
            actions={
              lignesAConfirmer.length > 0 ? (
                <button
                  onClick={handleConfirmer}
                  disabled={confirming || nombreCoches === 0}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {confirming ? 'Confirmation…' : `Confirmer (${nombreCoches})`}
                </button>
              ) : undefined
            }
          />
          {confirmError && (
            <div className="mx-6 mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{confirmError}</div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-500">Chargement…</div>
          ) : lignesAConfirmer.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-slate-500">
              Aucun don en attente de confirmation.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {lignesAConfirmer.map((r) => (
                <li key={r.key} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checked[r.key] ?? true}
                      onChange={(e) => setChecked((prev) => ({ ...prev, [r.key]: e.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-slate-900">
                        {participantFullName(r.engagement.profils_participant)}
                      </span>
                      <p className="text-xs text-slate-500">
                        {r.label}
                        {r.engagement.activites && ` · ${r.engagement.activites.nom}`}
                      </p>
                    </div>
                  </label>
                  <div className="flex items-center gap-2 sm:ml-4">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={montants[r.key] ?? ''}
                      onChange={(e) => setMontants((prev) => ({ ...prev, [r.key]: e.target.value }))}
                      className="w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-500">€</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Engagements */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <SectionHeader
            title="Engagements"
            description={`${engagements.length} engagement${engagements.length !== 1 ? 's' : ''}`}
            actions={
              <button
                onClick={openAdd}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Nouvel engagement
              </button>
            }
          />
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-500">Chargement…</div>
          ) : engagements.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-slate-500">
              Aucun engagement de don régulier pour l'instant.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {engagements.map((e) => (
                <li key={e.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="text-sm font-medium text-slate-900">
                      {participantFullName(e.profils_participant)}
                    </span>
                    <span
                      className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        e.statut === 'actif' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {e.statut === 'actif' ? 'Actif' : 'Arrêté'}
                    </span>
                    <p className="text-xs text-slate-500">
                      {formatEur(e.montant)} · le {e.jour_prelevement} de chaque mois
                      {e.activites && ` · ${e.activites.nom}`}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(e.date_debut)} → {e.date_fin ? formatDate(e.date_fin) : '?'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(e)}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => handleToggleStatut(e)}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                    >
                      {e.statut === 'actif' ? 'Arrêter' : 'Réactiver'}
                    </button>
                    <button
                      onClick={() => { setDeleteConfirm(e); setDeleteError(null) }}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Supprimer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <DonRegulierModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={fetchAll}
        engagement={editing}
        participants={participants}
        activites={activites}
        organisationId={organisationId}
      />

      {deleteConfirm && (
        <Modal open onClose={() => setDeleteConfirm(null)} maxWidthClassName="max-w-sm" labelledBy="delete-don-regulier-title">
          <div className="p-6">
            <h2 id="delete-don-regulier-title" className="text-lg font-semibold text-slate-900">Supprimer l'engagement</h2>
            <p className="mt-2 text-sm text-slate-600">
              Êtes-vous sûr de vouloir supprimer cet engagement pour{' '}
              <span className="font-medium">« {participantFullName(deleteConfirm.profils_participant)} »</span> ?
              Les dons déjà générés ne seront pas supprimés.
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
        </Modal>
      )}
    </>
  )
}
