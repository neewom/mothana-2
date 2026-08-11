import { useState, type ChangeEvent, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import Modal from './Modal'
import type { CarteAdherentDraft } from './CarteAdherentEditorModal'

interface CarteAdherentImportModalProps {
  open: boolean
  onClose: () => void
  onDraftReady: (draft: CarteAdherentDraft) => void
}

const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4 Mo
const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg']

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

export default function CarteAdherentImportModal({ open, onClose, onDraftReady }: CarteAdherentImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null
    setError(null)
    if (selected && !ALLOWED_TYPES.includes(selected.type)) {
      setError('Format non supporté (PDF, PNG ou JPEG uniquement)')
      setFile(null)
      return
    }
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

      const fileBase64 = await fileToBase64(file)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

      const res = await fetch(`${supabaseUrl}/functions/v1/generate-carte-adherent-template`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        },
        body: JSON.stringify({ file_base64: fileBase64, media_type: file.type }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Erreur inconnue lors de l’analyse du modèle')
        setLoading(false)
        return
      }

      setLoading(false)
      setFile(null)
      onDraftReady({
        nom: json.nom_suggestion || 'Gabarit importé (à vérifier)',
        html_template: json.html_template,
        css: json.css,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidthClassName="max-w-lg" labelledBy="import-carte-title">
      <form onSubmit={handleSubmit} className="p-6">
        <h2 id="import-carte-title" className="text-lg font-semibold text-slate-900">
          Importer un modèle
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Uploadez un modèle de carte adhérent existant (PDF, PNG ou JPEG). Un brouillon de gabarit sera généré à
          partir de sa mise en page — il faudra le relire et le compléter dans l'éditeur avant de pouvoir l'activer.
        </p>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Fichier <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            required
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
          />
          <p className="mt-1 text-xs text-slate-500">PDF, PNG ou JPEG — 4 Mo maximum.</p>
        </div>

        {error && <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {loading && (
          <div className="mt-4 rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
            Analyse du modèle en cours… (peut prendre jusqu'à 30 secondes)
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
            {loading ? 'Analyse…' : 'Analyser le modèle'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
