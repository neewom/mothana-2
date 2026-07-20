import { useState, type ChangeEvent, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import Modal from './Modal'
import type { TemplateRecuDraft } from './TemplateRecuEditorModal'

interface TemplateRecuImportPdfModalProps {
  open: boolean
  onClose: () => void
  onDraftReady: (draft: TemplateRecuDraft) => void
}

const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4 Mo

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1] ?? '')
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export default function TemplateRecuImportPdfModal({ open, onClose, onDraftReady }: TemplateRecuImportPdfModalProps) {
  const [typeCerfa, setTypeCerfa] = useState<'11580' | '16216'>('11580')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null
    setError(null)
    if (selected && selected.size > MAX_FILE_SIZE) {
      setError('Le fichier dépasse la taille maximale autorisée (4 Mo).')
      setFile(null)
      return
    }
    setFile(selected)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!file) return

    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Session expirée')
        setLoading(false)
        return
      }

      const pdfBase64 = await fileToBase64(file)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

      const res = await fetch(`${supabaseUrl}/functions/v1/generate-template-from-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        },
        body: JSON.stringify({ pdf_base64: pdfBase64, type_cerfa: typeCerfa }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Erreur inconnue lors de l’analyse du PDF')
        setLoading(false)
        return
      }

      setLoading(false)
      setFile(null)
      onDraftReady({
        nom: json.nom_suggestion || 'Template importé (à vérifier)',
        type_cerfa: typeCerfa,
        html_template: json.html_template,
        css: json.css,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidthClassName="max-w-lg" labelledBy="import-pdf-title">
      <form onSubmit={handleSubmit} className="p-6">
        <h2 id="import-pdf-title" className="text-lg font-semibold text-slate-900">
          Importer un PDF
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Uploadez un modèle de reçu existant (PDF). Un brouillon de template sera généré à partir de sa mise en page
          — il faudra le relire et le compléter dans l'éditeur avant de pouvoir l'activer.
        </p>

        <div className="mt-4">
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

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Fichier PDF <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            accept="application/pdf"
            required
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
          />
          <p className="mt-1 text-xs text-slate-400">4 Mo maximum.</p>
        </div>

        {error && <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {loading && (
          <div className="mt-4 rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
            Analyse du PDF en cours… (peut prendre jusqu'à 30 secondes)
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading || !file}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? 'Analyse…' : 'Analyser le PDF'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
