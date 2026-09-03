import { useState, useEffect, useMemo, useRef, type FormEvent } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { supabase } from '../lib/supabaseClient'
import {
  renderCerfaPreviewHtml,
  CERFA_PREVIEW_PLACEHOLDERS,
  CERFA_MANDATORY_KEYS,
  CERFA_RNA_SIREN_GROUP,
  getMissingMandatoryPlaceholders,
  fetchOrganisationPreviewOverrides,
} from '../lib/cerfaPreview'
import { copyTextToClipboard } from '../lib/clipboard'
import { fetchOrganisationAssets, buildAssetPlaceholders, assetPlaceholderKey } from '../lib/organisationAssets'
import type { TemplateRecu } from '../types'
import Tooltip from './Tooltip'
import { cn } from '../lib/utils'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select } from './ui/select'
import { Dialog, DialogContent } from './ui/dialog'

export interface TemplateRecuDraft {
  nom: string
  type_cerfa: '11580' | '16216'
  html_template: string
  css: string
}

interface TemplateRecuEditorModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  organisationId: string
  template?: TemplateRecu
  draft?: TemplateRecuDraft
}

const MANDATORY_TAGS: string[] = [...CERFA_MANDATORY_KEYS, ...CERFA_RNA_SIREN_GROUP]
const OPTIONAL_TAGS = Object.keys(CERFA_PREVIEW_PLACEHOLDERS).filter((key) => !MANDATORY_TAGS.includes(key))

function isTagMissing(key: string, html: string): boolean {
  if ((CERFA_RNA_SIREN_GROUP as readonly string[]).includes(key)) {
    return !CERFA_RNA_SIREN_GROUP.some((k) => html.includes(`{{${k}}}`))
  }
  return !html.includes(`{{${key}}}`)
}

const DEFAULT_HTML = `<div class="recu">
  <h1>{{organisation_nom}}</h1>
  <p>{{donateur_nom_complet}}</p>
  <p>{{don_montant_chiffres}} — {{recu_numero_ordre}}</p>
</div>`

const DEFAULT_CSS = `.recu { font-family: sans-serif; padding: 24px; }`

function segmentButtonClasses(active: boolean) {
  return cn('rounded-sm px-2 py-1', active ? 'bg-white text-ink shadow-sm' : 'text-ink-faint')
}

export default function TemplateRecuEditorModal({
  open,
  onClose,
  onSaved,
  organisationId,
  template,
  draft,
}: TemplateRecuEditorModalProps) {
  const isEdit = !!template

  const [nom, setNom] = useState('')
  const [typeCerfa, setTypeCerfa] = useState<'11580' | '16216'>('11580')
  const [htmlTemplate, setHtmlTemplate] = useState(DEFAULT_HTML)
  const [css, setCss] = useState(DEFAULT_CSS)
  const [activeTab, setActiveTab] = useState<'html' | 'css'>('html')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fullScreen, setFullScreen] = useState(false)
  const [panelMode, setPanelMode] = useState<'both' | 'editor' | 'preview'>('both')
  const [placeholdersOpen, setPlaceholdersOpen] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [assetTags, setAssetTags] = useState<string[]>([])
  const [dynamicPlaceholders, setDynamicPlaceholders] = useState<Record<string, string>>({})
  const formRef = useRef<HTMLFormElement>(null)
  const placeholdersRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (placeholdersRef.current && !placeholdersRef.current.contains(e.target as Node)) {
        setPlaceholdersOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    if (open) {
      if (template) {
        setNom(template.nom)
        setTypeCerfa(template.type_cerfa)
        setHtmlTemplate(template.html_template)
        setCss(template.css ?? '')
      } else if (draft) {
        setNom(draft.nom)
        setTypeCerfa(draft.type_cerfa)
        setHtmlTemplate(draft.html_template)
        setCss(draft.css)
      } else {
        setNom('')
        setTypeCerfa('11580')
        setHtmlTemplate(DEFAULT_HTML)
        setCss(DEFAULT_CSS)
      }
      setActiveTab('html')
      setError(null)
      setFullScreen(false)
      setPanelMode('both')
      setPlaceholdersOpen(false)
    }
  }, [open, template, draft])

  useEffect(() => {
    if (!open) return
    fetchOrganisationAssets(organisationId)
      .then((assets) => {
        setAssetTags(assets.map((a) => assetPlaceholderKey(a.identifiant)))
        setDynamicPlaceholders((prev) => ({ ...prev, ...buildAssetPlaceholders(assets) }))
      })
      .catch(() => setAssetTags([]))
    fetchOrganisationPreviewOverrides(organisationId, typeCerfa)
      .then((overrides) => setDynamicPlaceholders((prev) => ({ ...prev, ...overrides })))
      .catch(() => {})
  }, [open, organisationId, typeCerfa])

  const previewValues = useMemo(
    () => ({ ...CERFA_PREVIEW_PLACEHOLDERS, ...dynamicPlaceholders }),
    [dynamicPlaceholders],
  )
  const previewHtml = useMemo(
    () => renderCerfaPreviewHtml(htmlTemplate, css, dynamicPlaceholders),
    [htmlTemplate, css, dynamicPlaceholders],
  )
  const missingMandatory = useMemo(() => getMissingMandatoryPlaceholders(htmlTemplate), [htmlTemplate])
  const mandatoryPresentCount = MANDATORY_TAGS.length - missingMandatory.length

  const handleEditorMount: OnMount = (editor, monacoInstance) => {
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
      formRef.current?.requestSubmit()
    })
  }

  function copyPlaceholder(key: string) {
    copyTextToClipboard(`{{${key}}}`)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1500)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const { error: err } = isEdit
      ? await supabase
          .from('templates_recu')
          .update({ nom, type_cerfa: typeCerfa, html_template: htmlTemplate, css })
          .eq('id', template.id)
      : await supabase.from('templates_recu').insert({
          organisation_id: organisationId,
          nom,
          type_cerfa: typeCerfa,
          html_template: htmlTemplate,
          css,
          is_active: false,
          is_archived: false,
        })

    if (err) {
      setError(err.message)
      setSaving(false)
      return
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent
        className={fullScreen ? undefined : 'max-w-6xl h-[85vh] min-h-[560px]'}
        fullScreen={fullScreen}
        aria-describedby={undefined}
      >
        <div className="flex flex-col gap-3 border-b border-paper-border px-6 py-4 pr-14 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-registre text-lg font-semibold text-ink">
              {isEdit ? `Modifier — ${template.nom}` : 'Nouveau template de reçu'}
            </h2>
            <p className="mt-0.5 font-registre text-xs text-ink-muted">
              {isEdit
                ? template.is_active
                  ? 'Ce template est actif : les modifications seront utilisées dès la prochaine génération de reçu.'
                  : 'Les modifications seront utilisées dès que ce template sera activé.'
                : 'Créé désactivé — activez-le depuis la liste une fois vérifié.'}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-sm bg-paper-border/40 p-1 font-registre text-xs font-medium">
              <button type="button" onClick={() => setPanelMode('both')} className={segmentButtonClasses(panelMode === 'both')}>
                Les deux
              </button>
              <button type="button" onClick={() => setPanelMode('editor')} className={segmentButtonClasses(panelMode === 'editor')}>
                Éditeur
              </button>
              <button type="button" onClick={() => setPanelMode('preview')} className={segmentButtonClasses(panelMode === 'preview')}>
                Aperçu
              </button>
            </div>
            <button
              type="button"
              onClick={() => setFullScreen((f) => !f)}
              className="rounded-sm px-2 py-1.5 font-registre text-xs font-medium text-ink-faint hover:bg-paper-border/40 hover:text-ink-muted"
            >
              {fullScreen ? 'Réduire' : 'Plein écran'}
            </button>
          </div>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 flex-col overflow-y-auto p-6">
            {error && (
              <div className="mb-4 shrink-0 rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 font-registre text-sm text-stamp">
                {error}
              </div>
            )}

            <div className="mb-4 grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="template-nom">
                  Nom du template <span className="text-stamp">*</span>
                </Label>
                <Input
                  id="template-nom"
                  type="text"
                  required
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Ex : Cerfa 11580 — révision 2026"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="template-type-cerfa">Type Cerfa</Label>
                <Select
                  id="template-type-cerfa"
                  value={typeCerfa}
                  onChange={(e) => setTypeCerfa(e.target.value as '11580' | '16216')}
                  className="mt-1 w-full"
                >
                  <option value="11580">11580 · Particuliers</option>
                  <option value="16216">16216 · Entreprises</option>
                </Select>
              </div>
            </div>

            <div className="flex min-h-[300px] flex-1 flex-col gap-4 lg:flex-row">
              {/* Éditeur */}
              {panelMode !== 'preview' && (
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="mb-2 flex shrink-0 gap-1 rounded-sm bg-paper-border/40 p-1 font-registre text-sm font-medium">
                    <button type="button" onClick={() => setActiveTab('html')} className={cn('flex-1 rounded-sm py-1.5', activeTab === 'html' ? 'bg-white text-ink shadow-sm' : 'text-ink-faint')}>
                      HTML
                    </button>
                    <button type="button" onClick={() => setActiveTab('css')} className={cn('flex-1 rounded-sm py-1.5', activeTab === 'css' ? 'bg-white text-ink shadow-sm' : 'text-ink-faint')}>
                      CSS
                    </button>
                  </div>
                  <div className="min-h-[160px] flex-1 overflow-hidden rounded-sm border border-paper-border">
                    {activeTab === 'html' ? (
                      <Editor
                        height="100%"
                        language="html"
                        value={htmlTemplate}
                        onChange={(v) => setHtmlTemplate(v ?? '')}
                        onMount={handleEditorMount}
                        options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: 'on' }}
                      />
                    ) : (
                      <Editor
                        height="100%"
                        language="css"
                        value={css}
                        onChange={(v) => setCss(v ?? '')}
                        onMount={handleEditorMount}
                        options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: 'on' }}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Prévisualisation */}
              {panelMode !== 'editor' && (
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="mb-2 shrink-0 rounded-sm bg-paper-border/40 p-1">
                    <div className="rounded-sm px-3 py-1.5 font-registre text-sm font-medium text-ink-muted">
                      Aperçu (données d'exemple)
                    </div>
                  </div>
                  <iframe
                    title="Aperçu du template"
                    srcDoc={previewHtml}
                    className="min-h-[160px] w-full flex-1 rounded-sm border border-paper-border"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-paper-border bg-white px-6 py-4 shadow-[0_-4px_6px_-4px_rgba(0,0,0,0.1)]">
            <div ref={placeholdersRef} className="relative">
              <button
                type="button"
                onClick={() => setPlaceholdersOpen((o) => !o)}
                className={cn(
                  'rounded-sm border px-3 py-2 font-registre text-xs font-medium',
                  missingMandatory.length > 0
                    ? 'border-warning-border text-warning hover:bg-warning-tint'
                    : 'border-success-border text-success hover:bg-success-tint'
                )}
              >
                Placeholders — {mandatoryPresentCount}/{MANDATORY_TAGS.length} obligatoires
              </button>

              {placeholdersOpen && (
                <div className="absolute bottom-full left-0 z-30 mb-2 max-h-96 w-[32rem] max-w-[90vw] overflow-y-auto rounded-sm border border-paper-border bg-white p-4 shadow-xl">
                  <p className={cn('mb-1.5 font-registre text-xs font-medium', missingMandatory.length > 0 ? 'text-warning' : 'text-success')}>
                    {mandatoryPresentCount}/{MANDATORY_TAGS.length} placeholders obligatoires présents
                    {missingMandatory.length > 0 && ` — manquants : ${missingMandatory.join(', ')}`}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {MANDATORY_TAGS.map((key) => {
                      const missing = isTagMissing(key, htmlTemplate)
                      const copied = copiedKey === key
                      return (
                        <Tooltip key={key} bare content={`Exemple : ${previewValues[key]}`}>
                          <button
                            type="button"
                            onClick={() => copyPlaceholder(key)}
                            className={cn(
                              'rounded-sm px-1.5 py-0.5 font-registre-mono text-[11px]',
                              missing
                                ? 'bg-warning-tint text-warning ring-1 ring-inset ring-warning-border hover:bg-warning-tint/70'
                                : 'bg-success-tint text-success ring-1 ring-inset ring-success-border hover:bg-success-tint/70',
                              copied && 'ring-2 ring-offset-1 ring-stamp/70'
                            )}
                          >
                            {missing ? '⚠️ ' : '✓ '}
                            {`{{${key}}}`}
                          </button>
                        </Tooltip>
                      )
                    })}
                  </div>

                  <p className="mb-1.5 mt-3 font-registre text-xs font-medium text-ink-faint">Placeholders optionnels</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[...OPTIONAL_TAGS, ...assetTags].map((key) => {
                      const copied = copiedKey === key
                      return (
                        <Tooltip key={key} bare content={`Exemple : ${previewValues[key]}`}>
                          <button
                            type="button"
                            onClick={() => copyPlaceholder(key)}
                            className={cn(
                              'rounded-sm bg-paper-border/40 px-1.5 py-0.5 font-registre-mono text-[11px] text-ink-muted hover:bg-paper-border/60',
                              copied && 'ring-2 ring-offset-1 ring-stamp/70'
                            )}
                          >
                            {`{{${key}}}`}
                          </button>
                        </Tooltip>
                      )
                    })}
                  </div>
                  {assetTags.length === 0 && (
                    <p className="mt-1.5 font-registre text-xs text-ink-faint">
                      Aucun asset configuré — ajoutez-en dans Paramètres › Identité visuelle pour obtenir des placeholders
                      <code className="mx-1 rounded-sm bg-paper-border/40 px-1">{'{{asset_...}}'}</code>
                      ici.
                    </p>
                  )}
                  <p className={cn('mt-1 font-registre text-xs font-medium', copiedKey ? 'text-stamp' : 'text-ink-faint')}>
                    {copiedKey ? `✓ {{${copiedKey}}} copié dans le presse-papier` : 'Cliquer pour copier. Survoler pour voir un exemple de valeur.'}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer le template'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
