import { useState, useEffect, useMemo, useRef, type FormEvent } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { supabase } from '../lib/supabaseClient'
import {
  renderCartePreviewHtml,
  CARTE_PREVIEW_PLACEHOLDERS,
  CARTE_MANDATORY_KEYS,
  getMissingMandatoryCartePlaceholders,
} from '../lib/cartePreview'
import { fetchOrganisationPreviewOverrides } from '../lib/cerfaPreview'
import { copyTextToClipboard } from '../lib/clipboard'
import { fetchOrganisationAssets, buildAssetPlaceholders, assetPlaceholderKey } from '../lib/organisationAssets'
import type { TemplateCarteAdherent } from '../types'
import { CARTE_ADHERENT_HTML, CARTE_ADHERENT_CSS } from '../lib/defaultCarteAdherentTemplate'
import Modal from './Modal'

export interface CarteAdherentDraft {
  nom: string
  html_template: string
  css: string
}

interface CarteAdherentEditorModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  organisationId: string
  template?: TemplateCarteAdherent
  draft?: CarteAdherentDraft
}

const MANDATORY_TAGS: string[] = [...CARTE_MANDATORY_KEYS]
const OPTIONAL_TAGS = Object.keys(CARTE_PREVIEW_PLACEHOLDERS).filter((key) => !MANDATORY_TAGS.includes(key))

function isTagMissing(key: string, html: string): boolean {
  return !html.includes(`{{${key}}}`)
}

export default function CarteAdherentEditorModal({
  open,
  onClose,
  onSaved,
  organisationId,
  template,
  draft,
}: CarteAdherentEditorModalProps) {
  const isEdit = !!template

  const [nom, setNom] = useState('')
  const [htmlTemplate, setHtmlTemplate] = useState(CARTE_ADHERENT_HTML)
  const [css, setCss] = useState(CARTE_ADHERENT_CSS)
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
        setHtmlTemplate(template.html_template)
        setCss(template.css ?? '')
      } else if (draft) {
        setNom(draft.nom)
        setHtmlTemplate(draft.html_template)
        setCss(draft.css)
      } else {
        setNom('')
        setHtmlTemplate(CARTE_ADHERENT_HTML)
        setCss(CARTE_ADHERENT_CSS)
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
    fetchOrganisationPreviewOverrides(organisationId)
      .then((overrides) => setDynamicPlaceholders((prev) => ({ ...prev, ...overrides })))
      .catch(() => {})
  }, [open, organisationId])

  const previewValues = useMemo(
    () => ({ ...CARTE_PREVIEW_PLACEHOLDERS, ...dynamicPlaceholders }),
    [dynamicPlaceholders],
  )
  const previewHtml = useMemo(
    () => renderCartePreviewHtml(htmlTemplate, css, dynamicPlaceholders),
    [htmlTemplate, css, dynamicPlaceholders],
  )
  const missingMandatory = useMemo(() => getMissingMandatoryCartePlaceholders(htmlTemplate), [htmlTemplate])
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

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const { error: err } = isEdit
      ? await supabase
          .from('templates_carte_adherent')
          .update({ nom, html_template: htmlTemplate, css })
          .eq('id', template.id)
      : await supabase.from('templates_carte_adherent').insert({
          organisation_id: organisationId,
          nom,
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
    <Modal
      open={open}
      onClose={onClose}
      maxWidthClassName="max-w-6xl"
      labelledBy="carte-editor-title"
      fullScreen={fullScreen}
      heightClassName="h-[85vh] min-h-[560px]"
    >
      <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-4 pr-14 sm:flex-row sm:items-start sm:justify-between sm:pr-10">
        <div className="min-w-0">
          <h2 id="carte-editor-title" className="text-lg font-semibold text-slate-900">
            {isEdit ? `Modifier — ${template.nom}` : 'Nouveau gabarit de carte'}
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {isEdit
              ? template.is_active
                ? 'Ce gabarit est actif : les modifications seront utilisées dès la prochaine impression de cartes.'
                : 'Les modifications seront utilisées dès que ce gabarit sera activé.'
              : 'Créé désactivé — activez-le depuis la liste une fois vérifié.'}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => setPanelMode('both')}
              className={`rounded-md px-2 py-1 ${panelMode === 'both' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              Les deux
            </button>
            <button
              type="button"
              onClick={() => setPanelMode('editor')}
              className={`rounded-md px-2 py-1 ${panelMode === 'editor' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              Éditeur
            </button>
            <button
              type="button"
              onClick={() => setPanelMode('preview')}
              className={`rounded-md px-2 py-1 ${panelMode === 'preview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              Aperçu
            </button>
          </div>
          <button
            type="button"
            onClick={() => setFullScreen((f) => !f)}
            className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            {fullScreen ? 'Réduire' : 'Plein écran'}
          </button>
        </div>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col overflow-y-auto p-6">
          {error && (
            <div className="mb-4 shrink-0 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="mb-4 shrink-0">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Nom du gabarit <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex : Carte adhérent — révision 2026"
              className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex min-h-[300px] flex-1 flex-col gap-4 lg:flex-row">
            {/* Éditeur */}
            {panelMode !== 'preview' && (
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="mb-2 flex shrink-0 gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium">
                  <button
                    type="button"
                    onClick={() => setActiveTab('html')}
                    className={`flex-1 rounded-md py-1.5 ${activeTab === 'html' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  >
                    HTML
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('css')}
                    className={`flex-1 rounded-md py-1.5 ${activeTab === 'css' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  >
                    CSS
                  </button>
                </div>
                <div className="min-h-[160px] flex-1 overflow-hidden rounded-lg border border-slate-300">
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
                <div className="mb-2 shrink-0 rounded-lg bg-slate-100 p-1">
                  <div className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-700">
                    Aperçu (données d'exemple)
                  </div>
                </div>
                <iframe
                  title="Aperçu de la carte"
                  srcDoc={previewHtml}
                  className="min-h-[160px] w-full flex-1 rounded-lg border border-slate-300"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 rounded-b-2xl border-t border-slate-200 bg-white px-6 py-4 shadow-[0_-4px_6px_-4px_rgba(0,0,0,0.1)]">
          <div ref={placeholdersRef} className="relative">
            <button
              type="button"
              onClick={() => setPlaceholdersOpen((o) => !o)}
              className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                missingMandatory.length > 0
                  ? 'border-red-200 text-red-600 hover:bg-red-50'
                  : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
              }`}
            >
              Placeholders — {mandatoryPresentCount}/{MANDATORY_TAGS.length} obligatoires
            </button>

            {placeholdersOpen && (
              <div className="absolute bottom-full left-0 z-30 mb-2 max-h-96 w-[32rem] max-w-[90vw] overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
                <p
                  className={`mb-1.5 text-xs font-medium ${
                    missingMandatory.length > 0 ? 'text-red-600' : 'text-emerald-600'
                  }`}
                >
                  {mandatoryPresentCount}/{MANDATORY_TAGS.length} placeholders obligatoires présents
                  {missingMandatory.length > 0 && ` — manquants : ${missingMandatory.join(', ')}`}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {MANDATORY_TAGS.map((key) => {
                    const missing = isTagMissing(key, htmlTemplate)
                    const copied = copiedKey === key
                    return (
                      <button
                        key={key}
                        type="button"
                        title={`Exemple : ${previewValues[key]}`}
                        onClick={() => copyPlaceholder(key)}
                        className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] ${
                          missing
                            ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-100'
                            : 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100'
                        } ${copied ? 'ring-2 ring-offset-1 ring-indigo-500' : ''}`}
                      >
                        {missing ? '⚠️ ' : '✓ '}
                        {`{{${key}}}`}
                      </button>
                    )
                  })}
                </div>

                <p className="mb-1.5 mt-3 text-xs font-medium text-slate-500">Placeholders optionnels</p>
                <div className="flex flex-wrap gap-1.5">
                  {[...OPTIONAL_TAGS, ...assetTags].map((key) => {
                    const copied = copiedKey === key
                    return (
                      <button
                        key={key}
                        type="button"
                        title={`Exemple : ${previewValues[key]}`}
                        onClick={() => copyPlaceholder(key)}
                        className={`rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 hover:bg-slate-200 ${
                          copied ? 'ring-2 ring-offset-1 ring-indigo-500' : ''
                        }`}
                      >
                        {`{{${key}}}`}
                      </button>
                    )
                  })}
                </div>
                {assetTags.length === 0 && (
                  <p className="mt-1.5 text-xs text-slate-400">
                    Aucun asset configuré — ajoutez-en dans Paramètres › Identité visuelle pour obtenir des placeholders
                    <code className="mx-1 rounded bg-slate-100 px-1">{'{{asset_...}}'}</code>
                    ici.
                  </p>
                )}
                <p className={`mt-1 text-xs font-medium ${copiedKey ? 'text-indigo-600' : 'text-slate-400'}`}>
                  {copiedKey ? `✓ {{${copiedKey}}} copié dans le presse-papier` : 'Cliquer pour copier. Survoler pour voir un exemple de valeur.'}
                </p>
              </div>
            )}
          </div>

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
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer le gabarit'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
