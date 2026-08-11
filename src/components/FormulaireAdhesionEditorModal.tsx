import { useState, useEffect, useMemo, useRef, type FormEvent } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { supabase } from '../lib/supabaseClient'
import {
  DEFAULT_FORMULAIRE_ADHESION_HEADER_HTML,
  DEFAULT_FORMULAIRE_ADHESION_FOOTER_HTML,
  DEFAULT_FORMULAIRE_ADHESION_CSS,
  FORMULAIRE_ADHESION_PREVIEW_PLACEHOLDERS,
  renderFormulaireAdhesionPreviewHtml,
} from '../lib/formulaireAdhesionPreview'
import { copyTextToClipboard } from '../lib/clipboard'
import { fetchOrganisationAssets, buildAssetPlaceholders, assetPlaceholderKey } from '../lib/organisationAssets'
import { fetchOrganisationPreviewOverrides } from '../lib/cerfaPreview'
import Modal from './Modal'
import SectionHeader from './SectionHeader'

interface FormulaireAdhesionEditorModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  organisationId: string
  headerHtml: string | null
  footerHtml: string | null
  css: string | null
}

type Tab = 'header' | 'footer' | 'css'

const OPTIONAL_TAGS = Object.keys(FORMULAIRE_ADHESION_PREVIEW_PLACEHOLDERS)

export default function FormulaireAdhesionEditorModal({
  open,
  onClose,
  onSaved,
  organisationId,
  headerHtml,
  footerHtml,
  css,
}: FormulaireAdhesionEditorModalProps) {
  const [header, setHeader] = useState('')
  const [footer, setFooter] = useState('')
  const [styles, setStyles] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('header')
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
      setHeader(headerHtml ?? DEFAULT_FORMULAIRE_ADHESION_HEADER_HTML)
      setFooter(footerHtml ?? DEFAULT_FORMULAIRE_ADHESION_FOOTER_HTML)
      setStyles(css ?? DEFAULT_FORMULAIRE_ADHESION_CSS)
      setActiveTab('header')
      setError(null)
      setFullScreen(false)
      setPanelMode('both')
      setPlaceholdersOpen(false)
    }
  }, [open, headerHtml, footerHtml, css])

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
    () => ({ ...FORMULAIRE_ADHESION_PREVIEW_PLACEHOLDERS, ...dynamicPlaceholders }),
    [dynamicPlaceholders],
  )
  const previewHtml = useMemo(
    () => renderFormulaireAdhesionPreviewHtml(header, footer, styles, dynamicPlaceholders),
    [header, footer, styles, dynamicPlaceholders],
  )

  function handleReset() {
    setHeader(DEFAULT_FORMULAIRE_ADHESION_HEADER_HTML)
    setFooter(DEFAULT_FORMULAIRE_ADHESION_FOOTER_HTML)
    setStyles(DEFAULT_FORMULAIRE_ADHESION_CSS)
  }

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

    const { error: err } = await supabase
      .from('organisations')
      .update({
        formulaire_adhesion_header_html: header,
        formulaire_adhesion_footer_html: footer,
        formulaire_adhesion_css: styles,
      })
      .eq('id', organisationId)

    if (err) {
      setError(err.message)
      setSaving(false)
      return
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  const editorValue = activeTab === 'header' ? header : activeTab === 'footer' ? footer : styles
  const editorLang = activeTab === 'css' ? 'css' : 'html'
  const setEditorValue = (v: string) => {
    if (activeTab === 'header') setHeader(v)
    else if (activeTab === 'footer') setFooter(v)
    else setStyles(v)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidthClassName="max-w-6xl"
      labelledBy="formulaire-adhesion-editor-title"
      fullScreen={fullScreen}
      heightClassName="h-[85vh] min-h-[560px]"
    >
      <SectionHeader
        titleId="formulaire-adhesion-editor-title"
        reserveCloseButton
        title="En-tête et pied de page du formulaire d'adhésion"
        description="Le formulaire central (champs à remplir) n'est pas modifiable ici, seuls l'en-tête et le pied de page le sont."
        actions={
          <>
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
              className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-600"
            >
              {fullScreen ? 'Réduire' : 'Plein écran'}
            </button>
          </>
        }
      />

      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col overflow-y-auto p-6">
          {error && (
            <div className="mb-4 shrink-0 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex min-h-[300px] flex-1 flex-col gap-4 lg:flex-row">
            {/* Éditeur */}
            {panelMode !== 'preview' && (
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="mb-2 flex shrink-0 gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium">
                  <button
                    type="button"
                    onClick={() => setActiveTab('header')}
                    className={`flex-1 rounded-md py-1.5 ${activeTab === 'header' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  >
                    En-tête
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('footer')}
                    className={`flex-1 rounded-md py-1.5 ${activeTab === 'footer' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  >
                    Pied de page
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
                  <Editor
                    height="100%"
                    language={editorLang}
                    value={editorValue}
                    onChange={(v) => setEditorValue(v ?? '')}
                    onMount={handleEditorMount}
                    options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: 'on' }}
                  />
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
                  title="Aperçu du formulaire d'adhésion"
                  srcDoc={previewHtml}
                  className="min-h-[160px] w-full flex-1 rounded-lg border border-slate-300"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 rounded-b-2xl border-t border-slate-200 bg-white px-6 py-4 shadow-[0_-4px_6px_-4px_rgba(0,0,0,0.1)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div ref={placeholdersRef} className="relative">
              <button
                type="button"
                onClick={() => setPlaceholdersOpen((o) => !o)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Placeholders
              </button>

              {placeholdersOpen && (
                <div className="absolute bottom-full left-0 z-30 mb-2 max-h-96 w-[28rem] max-w-[90vw] overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
                  <p className="mb-1.5 text-xs font-medium text-slate-500">Placeholders disponibles</p>
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
                    <p className="mt-1.5 text-xs text-slate-500">
                      Aucun asset configuré — ajoutez-en dans Paramètres › Identité visuelle pour obtenir des placeholders
                      <code className="mx-1 rounded bg-slate-100 px-1">{'{{asset_...}}'}</code>
                      ici.
                    </p>
                  )}
                  <p className={`mt-1 text-xs font-medium ${copiedKey ? 'text-indigo-600' : 'text-slate-500'}`}>
                    {copiedKey ? `✓ {{${copiedKey}}} copié dans le presse-papier` : 'Cliquer pour copier. Survoler pour voir un exemple de valeur.'}
                  </p>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
            >
              Restaurer les valeurs par défaut
            </button>
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
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
