import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { DonFichier } from '../types'
import { Button } from './ui/button'
import { Label } from './ui/label'

const MAX_TAILLE = 10 * 1024 * 1024 // 10 Mo, même limite que le bucket
const TYPES_ACCEPTES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']

function formatTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`
}

function sanitizeNomFichier(nom: string): string {
  return nom.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
}

interface DonFichiersProps {
  donId: string
  organisationId: string
  canDelete: boolean
}

export default function DonFichiers({ donId, organisationId, canDelete }: DonFichiersProps) {
  const [fichiers, setFichiers] = useState<DonFichier[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadFichiers = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('dons_fichiers')
      .select('*')
      .eq('don_id', donId)
      .order('created_at', { ascending: false })

    if (err) {
      setError(err.message)
    } else {
      setFichiers((data ?? []) as DonFichier[])
    }
    setLoading(false)
  }, [donId])

  useEffect(() => {
    loadFichiers()
  }, [loadFichiers])

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return

    setError(null)

    for (const file of files) {
      if (!TYPES_ACCEPTES.includes(file.type)) {
        setError(`${file.name} : type de fichier non accepté (images ou PDF uniquement).`)
        continue
      }
      if (file.size > MAX_TAILLE) {
        setError(`${file.name} : dépasse la taille maximale de 10 Mo.`)
        continue
      }

      setUploading(true)

      const path = `${organisationId}/${donId}/${Date.now()}-${sanitizeNomFichier(file.name)}`

      const { error: uploadErr } = await supabase.storage
        .from('dons-fichiers')
        .upload(path, file, { contentType: file.type })

      if (uploadErr) {
        setError(uploadErr.message)
        setUploading(false)
        continue
      }

      const { data: userData } = await supabase.auth.getUser()

      const { error: insertErr } = await supabase.from('dons_fichiers').insert({
        don_id: donId,
        organisation_id: organisationId,
        chemin_storage: path,
        nom_original: file.name,
        type_mime: file.type,
        taille: file.size,
        uploaded_by: userData.user?.id ?? null,
      })

      if (insertErr) {
        setError(insertErr.message)
      }

      setUploading(false)
    }

    await loadFichiers()
  }

  async function handleOpen(fichier: DonFichier) {
    setOpeningId(fichier.id)
    const { data, error: urlErr } = await supabase.storage
      .from('dons-fichiers')
      .createSignedUrl(fichier.chemin_storage, 3600)

    setOpeningId(null)

    if (urlErr || !data?.signedUrl) {
      setError('Impossible de générer le lien pour ce fichier.')
      return
    }

    window.open(data.signedUrl, '_blank')
  }

  async function handleDelete(fichier: DonFichier) {
    if (!window.confirm(`Supprimer "${fichier.nom_original}" ?`)) return

    const { error: removeErr } = await supabase.storage
      .from('dons-fichiers')
      .remove([fichier.chemin_storage])

    if (removeErr) {
      setError(removeErr.message)
      return
    }

    const { error: deleteErr } = await supabase.from('dons_fichiers').delete().eq('id', fichier.id)

    if (deleteErr) {
      setError(deleteErr.message)
      return
    }

    await loadFichiers()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Pièces jointes</Label>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1 font-registre-mono text-[11px] font-medium text-stamp hover:text-stamp/80 disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {uploading ? 'Envoi…' : 'Ajouter un fichier'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={TYPES_ACCEPTES.join(',')}
          multiple
          className="hidden"
          onChange={handleFilesSelected}
        />
      </div>

      {error && (
        <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-3 py-2 font-registre-mono text-[11px] text-stamp">
          {error}
        </div>
      )}

      {loading ? (
        <p className="font-registre-mono text-[11px] text-ink-faint">Chargement…</p>
      ) : fichiers.length === 0 ? (
        <p className="font-registre-mono text-[11px] text-ink-faint">Aucun fichier joint.</p>
      ) : (
        <ul className="divide-y divide-paper-border rounded-sm border border-paper-border">
          {fichiers.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-ink">{f.nom_original}</p>
                <p className="font-registre-mono text-[10px] text-ink-faint">{formatTaille(f.taille)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={openingId === f.id}
                  onClick={() => handleOpen(f)}
                >
                  {openingId === f.id ? '…' : 'Ouvrir'}
                </Button>
                {canDelete && (
                  <Button type="button" variant="danger" size="sm" onClick={() => handleDelete(f)}>
                    Supprimer
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
