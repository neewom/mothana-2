import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { DonFichier } from '../types'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'

const MAX_TAILLE = 10 * 1024 * 1024 // 10 Mo, même limite que le bucket
const TYPES_ACCEPTES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']

function isImage(mime: string): boolean {
  return mime.startsWith('image/')
}

function formatTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`
}

function sanitizeNomFichier(nom: string): string {
  return nom.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
}

async function uploadUnFichier(file: File, donId: string, organisationId: string): Promise<string | null> {
  const path = `${organisationId}/${donId}/${Date.now()}-${sanitizeNomFichier(file.name)}`

  const { error: uploadErr } = await supabase.storage
    .from('dons-fichiers')
    .upload(path, file, { contentType: file.type })

  if (uploadErr) return uploadErr.message

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

  return insertErr ? insertErr.message : null
}

function PdfIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-ink-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}

interface DonFichiersProps {
  // null = pas encore de don en base (saisie en cours) : les fichiers choisis
  // sont mis en attente côté client, uploadés d'un coup via uploadStaged() une
  // fois le don créé. Une fois un id fourni (édition, ou juste après création),
  // comportement classique : upload immédiat à la sélection.
  donId: string | null
  organisationId: string
  canDelete: boolean
  // false pour une vue lecture seule (ex. side panel de détail) : n'affiche
  // que les fichiers déjà ajoutés, l'ajout se fait depuis la modale d'édition.
  canAdd?: boolean
}

export interface DonFichiersHandle {
  // Upload tous les fichiers mis en attente pour le don donId — appelé par le
  // parent juste après la création du don. Retourne les messages d'erreur
  // éventuels (le don lui-même est déjà enregistré à ce stade, un échec
  // d'upload ne doit pas être traité comme un échec de l'enregistrement).
  uploadStaged: (donId: string) => Promise<string[]>
}

const DonFichiers = forwardRef<DonFichiersHandle, DonFichiersProps>(function DonFichiers(
  { donId, organisationId, canDelete, canAdd = true },
  ref
) {
  const [fichiers, setFichiers] = useState<DonFichier[]>([])
  const [stagedFiles, setStagedFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({})
  const [lightbox, setLightbox] = useState<{ url: string; nom: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const stagedThumbUrls = useRef<Map<File, string>>(new Map())

  const loadFichiers = useCallback(async () => {
    if (!donId) return
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
    if (donId) loadFichiers()
  }, [donId, loadFichiers])

  // Miniatures : une URL signée par image persistée, chargée dès l'affichage
  // de la liste (pas seulement au clic) pour pouvoir afficher un aperçu réel.
  useEffect(() => {
    const manquantes = fichiers.filter((f) => isImage(f.type_mime) && !thumbnails[f.id])
    if (manquantes.length === 0) return
    let annule = false
    ;(async () => {
      const entrees = await Promise.all(
        manquantes.map(async (f) => {
          const { data } = await supabase.storage.from('dons-fichiers').createSignedUrl(f.chemin_storage, 3600)
          return [f.id, data?.signedUrl] as const
        })
      )
      if (annule) return
      setThumbnails((prev) => {
        const next = { ...prev }
        for (const [id, url] of entrees) if (url) next[id] = url
        return next
      })
    })()
    return () => { annule = true }
    // thumbnails volontairement absent des deps : ne réagit qu'aux changements
    // de la liste de fichiers, pas à chaque miniature déjà résolue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fichiers])

  // Miniatures des fichiers en attente (pas encore uploadés) : aperçu local
  // via URL.createObjectURL, révoquées au démontage pour éviter les fuites.
  useEffect(() => {
    return () => {
      stagedThumbUrls.current.forEach((url) => URL.revokeObjectURL(url))
      stagedThumbUrls.current.clear()
    }
  }, [])

  function getStagedThumbUrl(file: File): string | null {
    if (!isImage(file.type)) return null
    let url = stagedThumbUrls.current.get(file)
    if (!url) {
      url = URL.createObjectURL(file)
      stagedThumbUrls.current.set(file, url)
    }
    return url
  }

  useImperativeHandle(ref, () => ({
    async uploadStaged(newDonId: string) {
      const errors: string[] = []
      for (const file of stagedFiles) {
        const err = await uploadUnFichier(file, newDonId, organisationId)
        if (err) errors.push(`${file.name} : ${err}`)
      }
      setStagedFiles([])
      return errors
    },
  }))

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return

    setError(null)

    const valid: File[] = []
    for (const file of files) {
      if (!TYPES_ACCEPTES.includes(file.type)) {
        setError(`${file.name} : type de fichier non accepté (images ou PDF uniquement).`)
        continue
      }
      if (file.size > MAX_TAILLE) {
        setError(`${file.name} : dépasse la taille maximale de 10 Mo.`)
        continue
      }
      valid.push(file)
    }

    if (donId) {
      void (async () => {
        setUploading(true)
        for (const file of valid) {
          const err = await uploadUnFichier(file, donId, organisationId)
          if (err) setError(err)
        }
        setUploading(false)
        await loadFichiers()
      })()
    } else {
      setStagedFiles((prev) => [...prev, ...valid])
    }
  }

  function handleRemoveStaged(index: number) {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleOpenNewTab(fichier: DonFichier) {
    const { data, error: urlErr } = await supabase.storage
      .from('dons-fichiers')
      .createSignedUrl(fichier.chemin_storage, 3600)

    if (urlErr || !data?.signedUrl) {
      setError('Impossible de générer le lien pour ce fichier.')
      return
    }

    window.open(data.signedUrl, '_blank')
  }

  async function handleConsulter(fichier: DonFichier) {
    if (!isImage(fichier.type_mime)) {
      await handleOpenNewTab(fichier)
      return
    }
    const url = thumbnails[fichier.id]
    if (url) {
      setLightbox({ url, nom: fichier.nom_original })
    } else {
      await handleOpenNewTab(fichier)
    }
  }

  function handleConsulterStaged(file: File) {
    const url = getStagedThumbUrl(file)
    if (url) setLightbox({ url, nom: file.name })
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

  const displayedStaged = donId ? [] : stagedFiles

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Pièces jointes</Label>
        {canAdd && (
          <>
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
          </>
        )}
      </div>

      {error && (
        <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-3 py-2 font-registre-mono text-[11px] text-stamp">
          {error}
        </div>
      )}

      {!donId && displayedStaged.length === 0 && fichiers.length === 0 && (
        <p className="font-registre-mono text-[11px] text-ink-faint">Aucun fichier joint.</p>
      )}

      {displayedStaged.length > 0 && (
        <ul className="divide-y divide-paper-border rounded-sm border border-paper-border">
          {displayedStaged.map((f, i) => {
            const thumbUrl = getStagedThumbUrl(f)
            return (
              <li key={i} className="flex items-center gap-3 px-3 py-2">
                <button
                  type="button"
                  onClick={() => handleConsulterStaged(f)}
                  disabled={!thumbUrl}
                  title={thumbUrl ? 'Voir en grand' : undefined}
                  className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-paper-border bg-paper disabled:cursor-default"
                >
                  {thumbUrl ? (
                    <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <PdfIcon />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-ink">{f.name}</p>
                  <p className="font-registre-mono text-[10px] text-ink-faint">{formatTaille(f.size)}</p>
                </div>
                <Button type="button" variant="danger" size="sm" onClick={() => handleRemoveStaged(i)}>
                  Retirer
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      {donId && (
        loading ? (
          <p className="font-registre-mono text-[11px] text-ink-faint">Chargement…</p>
        ) : fichiers.length === 0 ? (
          <p className="font-registre-mono text-[11px] text-ink-faint">Aucun fichier joint.</p>
        ) : (
          <ul className="divide-y divide-paper-border rounded-sm border border-paper-border">
            {fichiers.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-3 py-2">
                <button
                  type="button"
                  onClick={() => handleConsulter(f)}
                  title="Voir en grand"
                  className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-paper-border bg-paper"
                >
                  {isImage(f.type_mime) && thumbnails[f.id] ? (
                    <img src={thumbnails[f.id]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <PdfIcon />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-ink">{f.nom_original}</p>
                  <p className="font-registre-mono text-[10px] text-ink-faint">{formatTaille(f.taille)}</p>
                </div>
                {canDelete && (
                  <Button type="button" variant="danger" size="sm" onClick={() => handleDelete(f)}>
                    Supprimer
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )
      )}

      <Dialog open={!!lightbox} onOpenChange={(next) => { if (!next) setLightbox(null) }}>
        <DialogContent className="max-w-3xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="truncate pr-8">{lightbox?.nom}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center bg-paper p-4">
            {lightbox && (
              // eslint-disable-next-line jsx-a11y/img-redundant-alt
              <img src={lightbox.url} alt={lightbox.nom} className="max-h-[70vh] w-auto max-w-full object-contain" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
})

export default DonFichiers
