import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getMissingMandatoryCartePlaceholders } from '../lib/cartePreview'
import type { TemplateCarteAdherent } from '../types'
import Modal from './Modal'
import CarteAdherentPreviewModal from './CarteAdherentPreviewModal'
import CarteAdherentEditorModal, { type CarteAdherentDraft } from './CarteAdherentEditorModal'
import CarteAdherentImportModal from './CarteAdherentImportModal'

interface CarteAdherentSectionProps {
  organisationId: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function CarteAdherentSection({ organisationId }: CarteAdherentSectionProps) {
  const [templates, setTemplates] = useState<TemplateCarteAdherent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [actionError, setActionError] = useState<Record<string, string>>({})

  const [previewTemplate, setPreviewTemplate] = useState<TemplateCarteAdherent | null>(null)
  const [editorState, setEditorState] = useState<'new' | TemplateCarteAdherent | null>(null)
  const [wizardDraft, setWizardDraft] = useState<CarteAdherentDraft | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [archiveConfirm, setArchiveConfirm] = useState<TemplateCarteAdherent | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<TemplateCarteAdherent | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('templates_carte_adherent')
      .select('*')
      .eq('organisation_id', organisationId)
      .order('created_at', { ascending: false })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    setTemplates((data ?? []) as TemplateCarteAdherent[])
    setLoading(false)
  }, [organisationId])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  // ---------------------------------------------------------------------------
  // Activer — désactive l'ancien template actif, active celui-ci
  // ---------------------------------------------------------------------------

  async function handleActivate(template: TemplateCarteAdherent) {
    setActionError((prev) => ({ ...prev, [template.id]: '' }))

    const missing = getMissingMandatoryCartePlaceholders(template.html_template)
    if (missing.length > 0) {
      setActionError((prev) => ({
        ...prev,
        [template.id]: `Impossible d'activer : placeholders obligatoires manquants : ${missing.join(', ')}.`,
      }))
      return
    }

    setActionLoading((prev) => ({ ...prev, [template.id]: true }))

    const currentActive = templates.find((t) => t.is_active && !t.is_archived && t.id !== template.id)

    if (currentActive) {
      const { error: deactivateErr } = await supabase
        .from('templates_carte_adherent')
        .update({ is_active: false })
        .eq('id', currentActive.id)

      if (deactivateErr) {
        setActionError((prev) => ({ ...prev, [template.id]: deactivateErr.message }))
        setActionLoading((prev) => ({ ...prev, [template.id]: false }))
        return
      }
    }

    const { error: activateErr } = await supabase
      .from('templates_carte_adherent')
      .update({ is_active: true })
      .eq('id', template.id)

    if (activateErr) {
      setActionError((prev) => ({ ...prev, [template.id]: activateErr.message }))
      setActionLoading((prev) => ({ ...prev, [template.id]: false }))
      return
    }

    setActionLoading((prev) => ({ ...prev, [template.id]: false }))
    fetchTemplates()
  }

  // ---------------------------------------------------------------------------
  // Archiver
  // ---------------------------------------------------------------------------

  async function handleArchive(template: TemplateCarteAdherent) {
    setActionLoading((prev) => ({ ...prev, [template.id]: true }))
    setActionError((prev) => ({ ...prev, [template.id]: '' }))

    const { error: err } = await supabase
      .from('templates_carte_adherent')
      .update({ is_active: false, is_archived: true })
      .eq('id', template.id)

    if (err) {
      setActionError((prev) => ({ ...prev, [template.id]: err.message }))
      setActionLoading((prev) => ({ ...prev, [template.id]: false }))
      return
    }

    setActionLoading((prev) => ({ ...prev, [template.id]: false }))
    setArchiveConfirm(null)
    fetchTemplates()
  }

  // ---------------------------------------------------------------------------
  // Supprimer — pas de table de suivi référençant ce template (contrairement
  // à templates_recu/recus_fiscaux), suppression directe après confirmation.
  // ---------------------------------------------------------------------------

  async function handleDelete() {
    if (!deleteConfirm) return
    setDeleting(true)

    const { error: err } = await supabase.from('templates_carte_adherent').delete().eq('id', deleteConfirm.id)

    setDeleting(false)

    if (err) {
      setActionError((prev) => ({ ...prev, [deleteConfirm.id]: err.message }))
      setDeleteConfirm(null)
      return
    }

    setDeleteConfirm(null)
    fetchTemplates()
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Un seul gabarit actif à la fois. Celui-ci est utilisé pour l'impression des cartes adhérent.
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="rounded-lg border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
          >
            Importer un modèle
          </button>
          <button
            onClick={() => {
              setWizardDraft(null)
              setEditorState('new')
            }}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Nouveau gabarit
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="py-8 text-center text-sm text-slate-400">Chargement…</div>
      ) : templates.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-400">
          Aucun gabarit de carte.
        </p>
      ) : (
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {templates.map((template) => {
            const isLoading = actionLoading[template.id]
            const errMsg = actionError[template.id]

            return (
              <div key={template.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{template.nom}</span>
                    {template.is_archived ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Archivé</span>
                    ) : template.is_active ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Actif</span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Inactif</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">Mis à jour le {formatDate(template.updated_at)}</p>
                  {errMsg && <p className="mt-1 text-xs text-red-600">{errMsg}</p>}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewTemplate(template)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Prévisualiser
                  </button>
                  {!template.is_archived && (
                    <button
                      type="button"
                      onClick={() => setEditorState(template)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Modifier
                    </button>
                  )}
                  {!template.is_archived && !template.is_active && (
                    <button
                      type="button"
                      onClick={() => handleActivate(template)}
                      disabled={isLoading}
                      className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-60"
                    >
                      Activer
                    </button>
                  )}
                  {!template.is_archived && (
                    <button
                      type="button"
                      onClick={() => (template.is_active ? setArchiveConfirm(template) : handleArchive(template))}
                      disabled={isLoading}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Archiver
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(template)}
                    disabled={isLoading}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Aperçu */}
      {previewTemplate && (
        <CarteAdherentPreviewModal
          open
          onClose={() => setPreviewTemplate(null)}
          nom={previewTemplate.nom}
          htmlTemplate={previewTemplate.html_template}
          css={previewTemplate.css ?? ''}
          organisationId={organisationId}
        />
      )}

      {/* Import — brouillon puis éditeur */}
      <CarteAdherentImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDraftReady={(draft) => {
          setImportOpen(false)
          setWizardDraft(draft)
          setEditorState('new')
        }}
      />

      {/* Nouveau gabarit / édition */}
      <CarteAdherentEditorModal
        open={editorState !== null}
        onClose={() => {
          setEditorState(null)
          setWizardDraft(null)
        }}
        onSaved={fetchTemplates}
        organisationId={organisationId}
        template={editorState === 'new' || editorState === null ? undefined : editorState}
        draft={editorState === 'new' ? (wizardDraft ?? undefined) : undefined}
      />

      {/* Confirmation archivage du gabarit actif */}
      {archiveConfirm && (
        <Modal open onClose={() => setArchiveConfirm(null)} maxWidthClassName="max-w-sm" labelledBy="archive-carte-title">
          <div className="p-6">
            <h2 id="archive-carte-title" className="text-lg font-semibold text-slate-900">Archiver le gabarit actif</h2>
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-medium">« {archiveConfirm.nom} »</span> est le gabarit actif. L'archiver laissera
              l'impression de cartes <span className="font-medium">sans gabarit actif</span> tant qu'un autre n'est pas activé.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setArchiveConfirm(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={() => handleArchive(archiveConfirm)}
                disabled={actionLoading[archiveConfirm.id]}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                Archiver quand même
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation suppression */}
      {deleteConfirm && (
        <Modal open onClose={() => setDeleteConfirm(null)} maxWidthClassName="max-w-sm" labelledBy="delete-carte-title">
          <div className="p-6">
            <h2 id="delete-carte-title" className="text-lg font-semibold text-slate-900">Supprimer le gabarit</h2>
            <p className="mt-2 text-sm text-slate-600">
              Êtes-vous sûr de vouloir supprimer <span className="font-medium">« {deleteConfirm.nom} »</span> ? Cette action est irréversible.
            </p>
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
    </div>
  )
}
