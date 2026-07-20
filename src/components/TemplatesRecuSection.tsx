import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getMissingMandatoryPlaceholders } from '../lib/cerfaPreview'
import type { TemplateRecu } from '../types'
import Modal from './Modal'
import TemplateRecuPreviewModal from './TemplateRecuPreviewModal'
import TemplateRecuEditorModal, { type TemplateRecuDraft } from './TemplateRecuEditorModal'
import TemplateRecuImportPdfModal from './TemplateRecuImportPdfModal'

interface TemplatesRecuSectionProps {
  organisationId: string
}

const TYPE_LABELS: Record<'11580' | '16216', string> = {
  '11580': '11580 · Particuliers',
  '16216': '16216 · Entreprises',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function TemplatesRecuSection({ organisationId }: TemplatesRecuSectionProps) {
  const [templates, setTemplates] = useState<TemplateRecu[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [actionError, setActionError] = useState<Record<string, string>>({})

  const [previewTemplate, setPreviewTemplate] = useState<TemplateRecu | null>(null)
  const [editorState, setEditorState] = useState<'new' | TemplateRecu | null>(null)
  const [wizardDraft, setWizardDraft] = useState<TemplateRecuDraft | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [archiveConfirm, setArchiveConfirm] = useState<TemplateRecu | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<TemplateRecu | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('templates_recu')
      .select('*')
      .eq('organisation_id', organisationId)
      .order('type_cerfa', { ascending: true })
      .order('created_at', { ascending: false })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    setTemplates((data ?? []) as TemplateRecu[])
    setLoading(false)
  }, [organisationId])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  // ---------------------------------------------------------------------------
  // Activer — désactive l'ancien template actif du même type, active celui-ci
  // ---------------------------------------------------------------------------

  async function handleActivate(template: TemplateRecu) {
    setActionError((prev) => ({ ...prev, [template.id]: '' }))

    const missing = getMissingMandatoryPlaceholders(template.html_template)
    if (missing.length > 0) {
      setActionError((prev) => ({
        ...prev,
        [template.id]: `Impossible d'activer : placeholders obligatoires manquants : ${missing.join(', ')}. Modifiez le template avant de l'activer.`,
      }))
      return
    }

    setActionLoading((prev) => ({ ...prev, [template.id]: true }))

    const currentActive = templates.find(
      (t) => t.type_cerfa === template.type_cerfa && t.is_active && !t.is_archived && t.id !== template.id
    )

    if (currentActive) {
      const { error: deactivateErr } = await supabase
        .from('templates_recu')
        .update({ is_active: false })
        .eq('id', currentActive.id)

      if (deactivateErr) {
        setActionError((prev) => ({ ...prev, [template.id]: deactivateErr.message }))
        setActionLoading((prev) => ({ ...prev, [template.id]: false }))
        return
      }
    }

    const { error: activateErr } = await supabase
      .from('templates_recu')
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

  async function handleArchive(template: TemplateRecu) {
    setActionLoading((prev) => ({ ...prev, [template.id]: true }))
    setActionError((prev) => ({ ...prev, [template.id]: '' }))

    const { error: err } = await supabase
      .from('templates_recu')
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
  // Supprimer — uniquement si jamais utilisé pour générer un reçu
  // ---------------------------------------------------------------------------

  async function openDeleteConfirm(template: TemplateRecu) {
    setActionError((prev) => ({ ...prev, [template.id]: '' }))
    setActionLoading((prev) => ({ ...prev, [template.id]: true }))

    const { count, error: countErr } = await supabase
      .from('recus_fiscaux')
      .select('id', { count: 'exact', head: true })
      .eq('template_id', template.id)

    setActionLoading((prev) => ({ ...prev, [template.id]: false }))

    if (countErr) {
      setActionError((prev) => ({ ...prev, [template.id]: countErr.message }))
      return
    }

    if (count && count > 0) {
      setActionError((prev) => ({
        ...prev,
        [template.id]: `Ce template a déjà servi à générer ${count} reçu${count > 1 ? 's' : ''}, il ne peut pas être supprimé.`,
      }))
      return
    }

    setDeleteConfirm(template)
    setDeleteError(null)
  }

  async function handleDelete() {
    if (!deleteConfirm) return
    setDeleting(true)
    setDeleteError(null)

    const { error: err } = await supabase.from('templates_recu').delete().eq('id', deleteConfirm.id)

    if (err) {
      setDeleteError(err.message)
      setDeleting(false)
      return
    }

    setDeleting(false)
    setDeleteConfirm(null)
    fetchTemplates()
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const grouped: Record<'11580' | '16216', TemplateRecu[]> = {
    '11580': templates.filter((t) => t.type_cerfa === '11580'),
    '16216': templates.filter((t) => t.type_cerfa === '16216'),
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Un seul template actif par type à la fois. Le template actif est celui utilisé pour générer les reçus.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="rounded-lg border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
          >
            Importer un PDF
          </button>
          <button
            onClick={() => {
              setWizardDraft(null)
              setEditorState('new')
            }}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Nouveau template
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="py-8 text-center text-sm text-slate-400">Chargement…</div>
      ) : (
        <div className="space-y-6">
          {(['11580', '16216'] as const).map((type) => (
            <div key={type}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{TYPE_LABELS[type]}</h3>
              {grouped[type].length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-400">
                  Aucun template pour ce type.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {grouped[type].map((template) => {
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

                        <div className="flex items-center gap-2">
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
                            onClick={() => openDeleteConfirm(template)}
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
            </div>
          ))}
        </div>
      )}

      {/* Aperçu */}
      {previewTemplate && (
        <TemplateRecuPreviewModal
          open
          onClose={() => setPreviewTemplate(null)}
          nom={previewTemplate.nom}
          htmlTemplate={previewTemplate.html_template}
          css={previewTemplate.css ?? ''}
        />
      )}

      {/* Import PDF — brouillon puis éditeur */}
      <TemplateRecuImportPdfModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDraftReady={(draft) => {
          setImportOpen(false)
          setWizardDraft(draft)
          setEditorState('new')
        }}
      />

      {/* Nouveau template / édition */}
      <TemplateRecuEditorModal
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

      {/* Confirmation archivage du template actif */}
      {archiveConfirm && (
        <Modal open onClose={() => setArchiveConfirm(null)} maxWidthClassName="max-w-sm" labelledBy="archive-template-title">
          <div className="p-6">
            <h2 id="archive-template-title" className="text-lg font-semibold text-slate-900">Archiver le template actif</h2>
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-medium">« {archiveConfirm.nom} »</span> est le template actif pour les reçus{' '}
              {TYPE_LABELS[archiveConfirm.type_cerfa]}. L'archiver laissera ce type de reçu <span className="font-medium">sans template actif</span> tant
              qu'un autre n'est pas activé — la génération de reçus sera bloquée pour ce type entre-temps.
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
        <Modal open onClose={() => setDeleteConfirm(null)} maxWidthClassName="max-w-sm" labelledBy="delete-template-title">
          <div className="p-6">
            <h2 id="delete-template-title" className="text-lg font-semibold text-slate-900">Supprimer le template</h2>
            <p className="mt-2 text-sm text-slate-600">
              Êtes-vous sûr de vouloir supprimer <span className="font-medium">« {deleteConfirm.nom} »</span> ? Cette action est irréversible.
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
    </div>
  )
}
