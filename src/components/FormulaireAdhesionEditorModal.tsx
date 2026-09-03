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
import Tooltip from './Tooltip'
import { cn } from '../lib/utils'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'

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

function segmentButtonClasses(active: boolean) {
  return cn('rounded-sm px-2 py-1', active ? 'bg-white text-ink shadow-sm' : 'text-ink-faint')
}

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
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent
        className={fullScreen ? undefined : 'max-w-6xl h-[85vh] min-h-[560px]'}
        fullScreen={fullScreen}
        aria-describedby={undefined}
      >
        <div className="flex flex-col gap-3 border-b border-paper-border px-6 py-4 pr-14 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-registre text-lg font-semibold text-ink">En-tête et pied de page du formulaire d'adhésion</h2>
            <p className="mt-0.5 font-registre text-xs text-ink-muted">
              Le formulaire central (champs à remplir) n'est pas modifiable ici, seuls l'en-tête et le pied de page le sont.
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

            <div className="flex min-h-[300px] flex-1 flex-col gap-4 lg:flex-row">
              {/* Éditeur */}
              {panelMode !== 'preview' && (
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="mb-2 flex shrink-0 gap-1 rounded-sm bg-paper-border/40 p-1 font-registre text-sm font-medium">
                    <button type="button" onClick={() => setActiveTab('header')} className={cn('flex-1 rounded-sm py-1.5', activeTab === 'header' ? 'bg-white text-ink shadow-sm' : 'text-ink-faint')}>
                      En-tête
                    </button>
                    <button type="button" onClick={() => setActiveTab('footer')} className={cn('flex-1 rounded-sm py-1.5', activeTab === 'footer' ? 'bg-white text-ink shadow-sm' : 'text-ink-faint')}>
                      Pied de page
                    </button>
                    <button type="button" onClick={() => setActiveTab('css')} className={cn('flex-1 rounded-sm py-1.5', activeTab === 'css' ? 'bg-white text-ink shadow-sm' : 'text-ink-faint')}>
                      CSS
                    </button>
                  </div>
                  <div className="min-h-[160px] flex-1 overflow-hidden rounded-sm border border-paper-border">
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
                  <div className="mb-2 shrink-0 rounded-sm bg-paper-border/40 p-1">
                    <div className="rounded-sm px-3 py-1.5 font-registre text-sm font-medium text-ink-muted">
                      Aperçu (données d'exemple)
                    </div>
                  </div>
                  <iframe
                    title="Aperçu du formulaire d'adhésion"
                    srcDoc={previewHtml}
                    className="min-h-[160px] w-full flex-1 rounded-sm border border-paper-border"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-3 border-t border-paper-border bg-white px-6 py-4 shadow-[0_-4px_6px_-4px_rgba(0,0,0,0.1)] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div ref={placeholdersRef} className="relative">
                <button
                  type="button"
                  onClick={() => setPlaceholdersOpen((o) => !o)}
                  className="rounded-sm border border-paper-border px-3 py-2 font-registre text-xs font-medium text-ink-muted hover:bg-paper"
                >
                  Placeholders
                </button>

                {placeholdersOpen && (
                  <div className="absolute bottom-full left-0 z-30 mb-2 max-h-96 w-[28rem] max-w-[90vw] overflow-y-auto rounded-sm border border-paper-border bg-white p-4 shadow-xl">
                    <p className="mb-1.5 font-registre text-xs font-medium text-ink-faint">Placeholders disponibles</p>
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
              <Button type="button" variant="secondary" size="sm" onClick={handleReset}>
                Restaurer les valeurs par défaut
              </Button>
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
