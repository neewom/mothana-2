import { useState, type ChangeEvent, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { CarteAdherentDraft } from './CarteAdherentEditorModal'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { Dialog, DialogContent } from './ui/dialog'

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
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <form onSubmit={handleSubmit} className="p-6">
          <h2 className="font-registre text-lg font-semibold text-ink">Importer un modèle</h2>
          <p className="mt-1 font-registre text-sm text-ink-muted">
            Uploadez un modèle de carte adhérent existant (PDF, PNG ou JPEG). Un brouillon de gabarit sera généré à
            partir de sa mise en page — il faudra le relire et le compléter dans l'éditeur avant de pouvoir l'activer.
          </p>

          <div className="mt-4">
            <Label>
              Fichier <span className="text-stamp">*</span>
            </Label>
            <div className="mt-1">
              <label className="inline-flex h-9 cursor-pointer items-center rounded-sm border border-paper-border bg-white px-3 font-registre text-sm font-medium text-ink-muted hover:bg-paper">
                Choisir un fichier
                <input type="file" accept="application/pdf,image/png,image/jpeg" onChange={handleFileChange} className="hidden" />
              </label>
              {file && <p className="mt-1.5 text-xs text-ink-muted">{file.name}</p>}
            </div>
            <p className="mt-1 text-xs text-ink-faint">PDF, PNG ou JPEG — 4 Mo maximum.</p>
          </div>

          {error && (
            <div className="mt-4 rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 font-registre text-sm text-stamp">{error}</div>
          )}
          {loading && (
            <div className="mt-4 rounded-sm border border-paper-border bg-paper px-4 py-3 font-registre text-sm text-ink-muted">
              Analyse du modèle en cours… (peut prendre jusqu'à 30 secondes)
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading || !file}>
              {loading ? 'Analyse…' : 'Analyser le modèle'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
