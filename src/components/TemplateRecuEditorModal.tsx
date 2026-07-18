import { useState, useEffect, useMemo, type FormEvent } from 'react'
import Editor from '@monaco-editor/react'
import { supabase } from '../lib/supabaseClient'
import { renderCerfaPreviewHtml } from '../lib/cerfaPreview'
import Modal from './Modal'

interface TemplateRecuEditorModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  organisationId: string
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
}: TemplateRecuEditorModalProps) {
  const [nom, setNom] = useState('')
  const [typeCerfa, setTypeCerfa] = useState<'11580' | '16216'>('11580')
  const [htmlTemplate, setHtmlTemplate] = useState(DEFAULT_HTML)
  const [css, setCss] = useState(DEFAULT_CSS)
  const [activeTab, setActiveTab] = useState<'html' | 'css'>('html')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setNom('')
      setTypeCerfa('11580')
      setHtmlTemplate(DEFAULT_HTML)
      setCss(DEFAULT_CSS)
      setActiveTab('html')
      setError(null)
    }
  }, [open])

  const previewHtml = useMemo(() => renderCerfaPreviewHtml(htmlTemplate, css), [htmlTemplate, css])

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const { error: err } = await supabase.from('templates_recu').insert({
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
    <Modal open={open} onClose={onClose} maxWidthClassName="max-w-6xl" labelledBy="template-editor-title">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 id="template-editor-title" className="text-lg font-semibold text-slate-900">Nouveau template de reçu</h2>
        <p className="mt-0.5 text-xs text-slate-400">Créé désactivé — activez-le depuis la liste une fois vérifié.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
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

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Éditeur */}
            <div>
              <div className="mb-2 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium">
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
              <div className="overflow-hidden rounded-lg border border-slate-300">
                {activeTab === 'html' ? (
                  <Editor
                    height="420px"
                    language="html"
                    value={htmlTemplate}
                    onChange={(v) => setHtmlTemplate(v ?? '')}
                    options={{ minimap: { enabled: false }, fontSize: 13 }}
                  />
                ) : (
                  <Editor
                    height="420px"
                    language="css"
                    value={css}
                    onChange={(v) => setCss(v ?? '')}
                    options={{ minimap: { enabled: false }, fontSize: 13 }}
                  />
                )}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Placeholders disponibles : {'{{organisation_nom}}'}, {'{{donateur_nom_complet}}'}, {'{{don_montant_chiffres}}'}, {'{{recu_numero_ordre}}'}, etc.
              </p>
            </div>

            {/* Prévisualisation */}
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Aperçu (données d'exemple)</p>
              <iframe
                title="Aperçu du template"
                srcDoc={previewHtml}
                className="h-[420px] w-full rounded-lg border border-slate-300"
              />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-3 rounded-b-2xl border-t border-slate-200 bg-white px-6 py-4 shadow-[0_-4px_6px_-4px_rgba(0,0,0,0.1)]">
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
            {saving ? 'Création…' : 'Créer le template'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
