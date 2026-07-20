import { useState, useEffect, useMemo, useRef, type FormEvent } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { supabase } from '../lib/supabaseClient'
import {
  renderCerfaPreviewHtml,
  CERFA_PREVIEW_PLACEHOLDERS,
  CERFA_MANDATORY_KEYS,
  CERFA_RNA_SIREN_GROUP,
  getMissingMandatoryPlaceholders,
} from '../lib/cerfaPreview'
import type { TemplateRecu } from '../types'
import Modal from './Modal'

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

// navigator.clipboard n'est disponible qu'en contexte sécurisé (HTTPS/localhost) —
// indisponible sur l'URL réseau HTTP utilisée pour piloter l'instance de dev à
// distance. Repli sur execCommand('copy'), qui fonctionne aussi en HTTP.
function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => legacyCopyToClipboard(text))
  } else {
    legacyCopyToClipboard(text)
  }
}

function legacyCopyToClipboard(text: string) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  try {
    document.execCommand('copy')
  } catch {
    // pas de solution de repli supplémentaire — l'utilisateur devra copier manuellement
  }
  document.body.removeChild(textarea)
}

const DEFAULT_HTML = `<div class="recu">
  <h1>{{organisation_nom}}</h1>
  <p>{{donateur_nom_complet}}</p>
  <p>{{don_montant_chiffres}} — {{recu_numero_ordre}}</p>
</div>`

const DEFAULT_CSS = `.recu { font-family: sans-serif; padding: 24px; }`

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

  const previewHtml = useMemo(() => renderCerfaPreviewHtml(htmlTemplate, css), [htmlTemplate, css])
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

  if (!open) return null

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
    <Modal
      open={open}
      onClose={onClose}
      maxWidthClassName="max-w-6xl"
      labelledBy="template-editor-title"
      fullScreen={fullScreen}
      heightClassName="h-[85vh] min-h-[560px]"
    >
      <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
        <div>
          <h2 id="template-editor-title" className="text-lg font-semibold text-slate-900">
            {isEdit ? `Modifier — ${template.nom}` : 'Nouveau template de reçu'}
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {isEdit
              ? template.is_active
                ? 'Ce template est actif : les modifications seront utilisées dès la prochaine génération de reçu.'
                : 'Les modifications seront utilisées dès que ce template sera activé.'
              : 'Créé désactivé — activez-le depuis la liste une fois vérifié.'}
          </p>
        </div>
        <div className="mr-10 flex shrink-0 items-center gap-2">
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

          <div className="mb-4 grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Nom du template <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex : Cerfa 11580 — révision 2026"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Type Cerfa</label>
              <select
                value={typeCerfa}
                onChange={(e) => setTypeCerfa(e.target.value as '11580' | '16216')}
                className="select-field w-full rounded-lg border border-slate-300 py-2 pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="11580">11580 · Particuliers</option>
                <option value="16216">16216 · Entreprises</option>
              </select>
            </div>
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
                  title="Aperçu du template"
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
                        title={`Exemple : ${CERFA_PREVIEW_PLACEHOLDERS[key]}`}
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
                  {OPTIONAL_TAGS.map((key) => {
                    const copied = copiedKey === key
                    return (
                      <button
                        key={key}
                        type="button"
                        title={`Exemple : ${CERFA_PREVIEW_PLACEHOLDERS[key]}`}
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
              {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer le template'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
