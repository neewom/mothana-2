import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useOrganisationId } from '../hooks/useOrganisationId'
import type { Activite } from '../types'
import Modal from '../components/Modal'
import ImportWizard from '../components/import/ImportWizard'
import { activitesImportConfig } from '../lib/import/configs'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
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

  if (!open) return null

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
    <Modal open={open} onClose={onClose} maxWidthClassName="max-w-sm" labelledBy="activite-modal-title">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 id="activite-modal-title" className="text-lg font-semibold text-slate-900">
            {isEdit ? "Modifier l'activité" : 'Nouvelle activité'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex : Nouvel An Lao 2026"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Date de début
              </label>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Date de fin
              </label>
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
// ActivitesPage
// ---------------------------------------------------------------------------

export default function ActivitesPage() {
  const organisationId = useOrganisationId()

  const [activites, setActivites] = useState<Activite[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Activite | undefined>(undefined)
  const [deleteConfirm, setDeleteConfirm] = useState<Activite | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  async function fetchActivites() {
    setLoading(true)
    const { data } = await supabase
      .from('activites')
      .select('*')
      .eq('organisation_id', organisationId)
      .order('created_at', { ascending: false })
    setActivites((data as Activite[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (organisationId) fetchActivites()
  }, [organisationId])

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
  }

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Activités</h1>
          <p className="mt-1 text-sm text-slate-500">
            {activites.length} activité{activites.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Importer
          </button>
          <button
            onClick={openAdd}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + Ajouter une activité
          </button>
        </div>
      </div>

      {/* List */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">
            Chargement…
          </div>
        ) : activites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="mb-3 h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
            </svg>
            <p className="text-sm font-medium text-slate-500">Aucune activité</p>
            <p className="mt-1 text-xs text-slate-400">Créez votre première activité pour commencer.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {activites.map((a) => (
              <li key={a.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-slate-900">{a.nom}</span>
                    {(a.date_debut || a.date_fin) && (
                      <p className="text-xs text-slate-500">
                        {a.date_debut ? formatDate(a.date_debut) : '?'}
                        {' → '}
                        {a.date_fin ? formatDate(a.date_fin) : '?'}
                      </p>
                    )}
                    {a.id_externe && (
                      <p className="text-xs text-slate-400">Réf. import : {a.id_externe}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEdit(a)}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => openDelete(a)}
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

      {/* Add / Edit modal */}
      <ActiviteModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={fetchActivites}
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
          onImported={fetchActivites}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <Modal open onClose={() => setDeleteConfirm(null)} maxWidthClassName="max-w-sm" labelledBy="delete-activite-title">
            <div className="p-6">
              <h2 id="delete-activite-title" className="text-lg font-semibold text-slate-900">Supprimer l'activité</h2>
              <p className="mt-2 text-sm text-slate-600">
                Êtes-vous sûr de vouloir supprimer{' '}
                <span className="font-medium">« {deleteConfirm.nom} »</span> ?
                Cette action est irréversible.
              </p>
              {deleteError && (
                <div className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  {deleteError}
                </div>
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
