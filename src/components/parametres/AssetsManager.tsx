import { useEffect, useState } from 'react'
import { slugifyIdentifiant, type OrganisationAsset } from '../../lib/organisationAssets'
import { supabase } from '../../lib/supabaseClient'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

const MAX_ASSET_SIZE = 2 * 1024 * 1024
const ALLOWED_ASSET_TYPES = ['image/png', 'image/jpeg']

async function uploadAssetFile(organisationId: string, identifiant: string, file: File): Promise<string | null> {
  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const path = `${organisationId}/${identifiant}-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('organisation-assets')
    .upload(path, file, { contentType: file.type })

  if (uploadError) return null

  const { data } = supabase.storage.from('organisation-assets').getPublicUrl(path)
  return data.publicUrl
}

/**
 * Visuels de l'organisation (logo, tampon, signature…) : chaque asset devient un placeholder
 * {{asset_<identifiant>}} des modèles. Actions immédiates (pas de bouton Enregistrer).
 */
export default function AssetsManager({ organisationId }: { organisationId: string }) {
  const [assets, setAssets] = useState<OrganisationAsset[]>([])
  const [assetsLoading, setAssetsLoading] = useState(true)
  const [assetActionLoading, setAssetActionLoading] = useState<Record<string, boolean>>({})
  const [assetError, setAssetError] = useState<Record<string, string | null>>({})
  const [newAssetLibelle, setNewAssetLibelle] = useState('')

  useEffect(() => {
    if (!organisationId) return

    async function fetchAssets() {
      setAssetsLoading(true)
      const { data, error } = await supabase
        .from('organisation_assets')
        .select('id, identifiant, libelle, url')
        .eq('organisation_id', organisationId)
        .order('created_at', { ascending: true })

      if (!error) setAssets((data ?? []) as OrganisationAsset[])
      setAssetsLoading(false)
    }

    fetchAssets()
  }, [organisationId])

  function validateAssetFile(file: File, key: string): boolean {
    if (!ALLOWED_ASSET_TYPES.includes(file.type)) {
      setAssetError((prev) => ({ ...prev, [key]: 'Format non supporté (PNG ou JPEG uniquement)' }))
      return false
    }
    if (file.size > MAX_ASSET_SIZE) {
      setAssetError((prev) => ({ ...prev, [key]: 'Fichier trop volumineux (2 Mo max)' }))
      return false
    }
    return true
  }

  async function handleAddAsset(file: File | null) {
    if (!file || !newAssetLibelle.trim()) return
    if (!validateAssetFile(file, 'new')) return

    const identifiant = slugifyIdentifiant(newAssetLibelle)
    if (!identifiant) {
      setAssetError((prev) => ({ ...prev, new: 'Libellé invalide' }))
      return
    }
    if (assets.some((a) => a.identifiant === identifiant)) {
      setAssetError((prev) => ({ ...prev, new: 'Un asset avec un identifiant équivalent existe déjà' }))
      return
    }

    setAssetError((prev) => ({ ...prev, new: null }))
    setAssetActionLoading((prev) => ({ ...prev, new: true }))

    const url = await uploadAssetFile(organisationId, identifiant, file)
    if (!url) {
      setAssetError((prev) => ({ ...prev, new: "Erreur lors de l'envoi du fichier" }))
      setAssetActionLoading((prev) => ({ ...prev, new: false }))
      return
    }

    const { data: inserted, error: insertError } = await supabase
      .from('organisation_assets')
      .insert({ organisation_id: organisationId, identifiant, libelle: newAssetLibelle.trim(), url })
      .select('id, identifiant, libelle, url')
      .single()

    if (insertError || !inserted) {
      setAssetError((prev) => ({ ...prev, new: insertError?.message ?? 'Erreur inconnue' }))
      setAssetActionLoading((prev) => ({ ...prev, new: false }))
      return
    }

    setAssets((prev) => [...prev, inserted as OrganisationAsset])
    setNewAssetLibelle('')
    setAssetActionLoading((prev) => ({ ...prev, new: false }))
  }

  async function handleReplaceAsset(asset: OrganisationAsset, file: File | null) {
    if (!file) return
    if (!validateAssetFile(file, asset.id)) return

    setAssetError((prev) => ({ ...prev, [asset.id]: null }))
    setAssetActionLoading((prev) => ({ ...prev, [asset.id]: true }))

    const url = await uploadAssetFile(organisationId, asset.identifiant, file)
    if (!url) {
      setAssetError((prev) => ({ ...prev, [asset.id]: "Erreur lors de l'envoi du fichier" }))
      setAssetActionLoading((prev) => ({ ...prev, [asset.id]: false }))
      return
    }

    const { error: updateError } = await supabase
      .from('organisation_assets')
      .update({ url })
      .eq('id', asset.id)

    if (updateError) {
      setAssetError((prev) => ({ ...prev, [asset.id]: updateError.message }))
    } else {
      setAssets((prev) => prev.map((a) => (a.id === asset.id ? { ...a, url } : a)))
    }
    setAssetActionLoading((prev) => ({ ...prev, [asset.id]: false }))
  }

  async function handleDeleteAsset(asset: OrganisationAsset) {
    setAssetError((prev) => ({ ...prev, [asset.id]: null }))
    setAssetActionLoading((prev) => ({ ...prev, [asset.id]: true }))

    const { error } = await supabase.from('organisation_assets').delete().eq('id', asset.id)

    if (error) {
      setAssetError((prev) => ({ ...prev, [asset.id]: error.message }))
      setAssetActionLoading((prev) => ({ ...prev, [asset.id]: false }))
      return
    }

    setAssets((prev) => prev.filter((a) => a.id !== asset.id))
    setAssetActionLoading((prev) => ({ ...prev, [asset.id]: false }))
  }

  return (
    <div className="max-w-lg">
      <p className="mb-3 text-xs text-ink-faint">
        Logo, tampon, signature ou tout autre visuel — chaque asset ajouté devient utilisable comme placeholder{' '}
        <code>{'{{asset_<identifiant>}}'}</code> dans vos templates. PNG ou JPEG, 2 Mo max. Enregistré immédiatement à l'upload.
      </p>
      {assetsLoading ? (
        <p className="text-xs text-ink-faint">Chargement…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {assets.map((asset) => (
            <div key={asset.id} className="rounded-sm border border-paper-border p-3">
              <p className="mb-2 text-xs font-medium text-ink-muted">{asset.libelle}</p>
              <div className="mb-2 flex h-20 items-center justify-center overflow-hidden rounded-sm bg-paper-border/20">
                <img src={asset.url} alt={asset.libelle} className="max-h-full max-w-full object-contain" />
              </div>
              <p className="mb-2 truncate font-registre-mono text-[11px] text-stamp">{`{{asset_${asset.identifiant}}}`}</p>
              <div className="flex flex-row items-center gap-2 sm:flex-col sm:items-start">
                <label className="cursor-pointer rounded-sm border border-paper-border px-3 py-1.5 font-registre text-xs font-medium text-ink-muted hover:bg-paper">
                  {assetActionLoading[asset.id] ? 'Envoi…' : 'Remplacer'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    disabled={assetActionLoading[asset.id]}
                    onChange={(e) => {
                      handleReplaceAsset(asset, e.target.files?.[0] ?? null)
                      e.target.value = ''
                    }}
                  />
                </label>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => handleDeleteAsset(asset)}
                  disabled={assetActionLoading[asset.id]}
                >
                  Supprimer
                </Button>
              </div>
              {assetError[asset.id] && <p className="mt-1.5 text-xs text-stamp">{assetError[asset.id]}</p>}
            </div>
          ))}

          <div className="rounded-sm border border-dashed border-paper-border p-3">
            <Label htmlFor="new-asset-libelle" className="mb-1 block text-xs">
              Libellé
            </Label>
            <Input
              id="new-asset-libelle"
              type="text"
              value={newAssetLibelle}
              onChange={(e) => setNewAssetLibelle(e.target.value)}
              // Composant placé dans le formulaire de la page : Entrée ne doit pas l'enregistrer.
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
              placeholder="Ex : Logo, Tampon, Photo"
              className="mb-2 h-8 text-xs"
            />
            <label
              className={cn(
                'block rounded-sm border px-3 py-1.5 text-center font-registre text-xs font-medium',
                newAssetLibelle.trim()
                  ? 'cursor-pointer border-paper-border text-ink-muted hover:bg-paper'
                  : 'cursor-not-allowed border-paper-border/60 text-ink-faint/60'
              )}
            >
              {assetActionLoading.new ? 'Envoi…' : 'Choisir un fichier'}
              <input
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                disabled={!newAssetLibelle.trim() || assetActionLoading.new}
                onChange={(e) => {
                  handleAddAsset(e.target.files?.[0] ?? null)
                  e.target.value = ''
                }}
              />
            </label>
            {assetError.new && <p className="mt-1.5 text-xs text-stamp">{assetError.new}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
