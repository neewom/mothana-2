import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getMissingMandatoryCartePlaceholders } from '../lib/cartePreview'
import type { TemplateCarteAdherent } from '../types'
import CarteAdherentPreviewModal from './CarteAdherentPreviewModal'
import CarteAdherentEditorModal, { type CarteAdherentDraft } from './CarteAdherentEditorModal'
import CarteAdherentImportModal from './CarteAdherentImportModal'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Dialog, DialogContent } from './ui/dialog'

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
        <p className="text-sm text-ink-muted">
          Un seul gabarit actif à la fois. Celui-ci est utilisé pour l'impression des cartes adhérent.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            Importer un modèle
          </Button>
          <Button
            onClick={() => {
              setWizardDraft(null)
              setEditorState('new')
            }}
          >
            Nouveau gabarit
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">{error}</div>
      )}

      {loading ? (
        <div className="py-8 text-center text-sm text-ink-faint">Chargement…</div>
      ) : templates.length === 0 ? (
        <p className="rounded-sm border border-dashed border-paper-border px-4 py-3 text-sm text-ink-faint">
          Aucun gabarit de carte.
        </p>
      ) : (
        <div className="divide-y divide-paper-border-muted rounded-sm border border-paper-border">
          {templates.map((template) => {
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
                  <Button type="button" variant="danger" size="sm" onClick={() => setDeleteConfirm(template)} disabled={isLoading}>
                    Supprimer
                  </Button>
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
      <Dialog open={!!archiveConfirm} onOpenChange={(next) => { if (!next) setArchiveConfirm(null) }}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          {archiveConfirm && (
            <div className="p-6">
              <h2 className="font-registre text-lg font-semibold text-ink">Archiver le gabarit actif</h2>
              <p className="mt-2 font-registre text-sm text-ink-muted">
                <span className="font-medium text-ink">« {archiveConfirm.nom} »</span> est le gabarit actif. L'archiver laissera
                l'impression de cartes <span className="font-medium text-ink">sans gabarit actif</span> tant qu'un autre n'est pas activé.
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
              <h2 className="font-registre text-lg font-semibold text-ink">Supprimer le gabarit</h2>
              <p className="mt-2 font-registre text-sm text-ink-muted">
                Êtes-vous sûr de vouloir supprimer <span className="font-medium text-ink">« {deleteConfirm.nom} »</span> ? Cette action est irréversible.
              </p>
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
