import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getMissingMandatoryPlaceholders } from '../lib/cerfaPreview'
import type { TemplateRecu } from '../types'
import TemplateRecuPreviewModal from './TemplateRecuPreviewModal'
import TemplateRecuEditorModal, { type TemplateRecuDraft } from './TemplateRecuEditorModal'
import TemplateRecuImportPdfModal from './TemplateRecuImportPdfModal'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Dialog, DialogContent } from './ui/dialog'

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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          Un seul template actif par type à la fois. Le template actif est celui utilisé pour générer les reçus.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            Importer un PDF
          </Button>
          <Button
            onClick={() => {
              setWizardDraft(null)
              setEditorState('new')
            }}
          >
            Nouveau template
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">{error}</div>
      )}

      {loading ? (
        <div className="py-8 text-center text-sm text-ink-faint">Chargement…</div>
      ) : (
        <div className="space-y-6">
          {(['11580', '16216'] as const).map((type) => (
            <div key={type}>
              <h3 className="mb-2 font-registre-mono text-xs font-semibold uppercase tracking-wide text-ink-faint">{TYPE_LABELS[type]}</h3>
              {grouped[type].length === 0 ? (
                <p className="rounded-sm border border-dashed border-paper-border px-4 py-3 text-sm text-ink-faint">
                  Aucun template pour ce type.
                </p>
              ) : (
                <div className="divide-y divide-paper-border-muted rounded-sm border border-paper-border">
                  {grouped[type].map((template) => {
                    const isLoading = actionLoading[template.id]
                    const errMsg = actionError[template.id]

                    return (
                      <div key={template.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-ink">{template.nom}</span>
                            {template.is_archived ? (
                              <Badge variant="neutral">Archivé</Badge>
                            ) : template.is_active ? (
                              <Badge variant="success">Actif</Badge>
                            ) : (
                              <Badge variant="warning">Inactif</Badge>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-ink-faint">Mis à jour le {formatDate(template.updated_at)}</p>
                          {errMsg && <p className="mt-1 text-xs text-stamp">{errMsg}</p>}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button type="button" variant="secondary" size="sm" onClick={() => setPreviewTemplate(template)}>
                            Prévisualiser
                          </Button>
                          {!template.is_archived && (
                            <Button type="button" variant="secondary" size="sm" onClick={() => setEditorState(template)}>
                              Modifier
                            </Button>
                          )}
                          {!template.is_archived && !template.is_active && (
                            <Button type="button" size="sm" onClick={() => handleActivate(template)} disabled={isLoading}>
                              Activer
                            </Button>
                          )}
                          {!template.is_archived && (
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
                              onClick={() => (template.is_active ? setArchiveConfirm(template) : handleArchive(template))}
                              disabled={isLoading}
                            >
                              Archiver
                            </Button>
                          )}
                          <Button type="button" variant="danger" size="sm" onClick={() => openDeleteConfirm(template)} disabled={isLoading}>
                            Supprimer
                          </Button>
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
          organisationId={organisationId}
          typeCerfa={previewTemplate.type_cerfa}
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
      <Dialog open={!!archiveConfirm} onOpenChange={(next) => { if (!next) setArchiveConfirm(null) }}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          {archiveConfirm && (
            <div className="p-6">
              <h2 className="font-registre text-lg font-semibold text-ink">Archiver le template actif</h2>
              <p className="mt-2 font-registre text-sm text-ink-muted">
                <span className="font-medium text-ink">« {archiveConfirm.nom} »</span> est le template actif pour les reçus{' '}
                {TYPE_LABELS[archiveConfirm.type_cerfa]}. L'archiver laissera ce type de reçu <span className="font-medium text-ink">sans template actif</span> tant
                qu'un autre n'est pas activé — la génération de reçus sera bloquée pour ce type entre-temps.
              </p>
              <div className="mt-5 flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={() => setArchiveConfirm(null)}>
                  Annuler
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => handleArchive(archiveConfirm)}
                  disabled={actionLoading[archiveConfirm.id]}
                >
                  Archiver quand même
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation suppression */}
      <Dialog open={!!deleteConfirm} onOpenChange={(next) => { if (!next) setDeleteConfirm(null) }}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          {deleteConfirm && (
            <div className="p-6">
              <h2 className="font-registre text-lg font-semibold text-ink">Supprimer le template</h2>
              <p className="mt-2 font-registre text-sm text-ink-muted">
                Êtes-vous sûr de vouloir supprimer <span className="font-medium text-ink">« {deleteConfirm.nom} »</span> ? Cette action est irréversible.
              </p>
              {deleteError && (
                <div className="mt-3 rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 font-registre text-sm text-stamp">{deleteError}</div>
              )}
              <div className="mt-5 flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={() => setDeleteConfirm(null)}>
                  Annuler
                </Button>
                <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Suppression…' : 'Supprimer'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
