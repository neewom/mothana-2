import { useEffect, useRef, useState } from 'react'
import { copyTextToClipboard } from '../../lib/clipboard'
import { slugifyIdentifiant, type OrganisationAsset } from '../../lib/organisationAssets'
import { isLogoEligibleUrl, ORGANISATION_LOGO_CHANGE_EVENT, setOrganisationLogo } from '../../lib/organisationLogo'
import { storageUploadErrorMessage, type StorageUploadResult } from '../../lib/storageUpload'
import { supabase } from '../../lib/supabaseClient'
import { cn } from '../../lib/utils'
import { ActionMenu, type ActionMenuItem } from '../ui/action-menu'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

const MAX_ASSET_SIZE = 2 * 1024 * 1024
const COPY_ERROR = 'Copie impossible : sélectionnez le code pour le copier.'
// Durée d'affichage de « Copié » sur le bouton « Copier le code ».
const COPY_FEEDBACK_MS = 2000
const ALLOWED_ASSET_TYPES = ['image/png', 'image/jpeg']

async function uploadAssetFile(organisationId: string, identifiant: string, file: File): Promise<StorageUploadResult> {
  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const path = `${organisationId}/${identifiant}-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('organisation-assets')
    .upload(path, file, { contentType: file.type })

  if (uploadError) return { url: null, error: storageUploadErrorMessage(uploadError, 'PNG ou JPEG') }

  const { data } = supabase.storage.from('organisation-assets').getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

/**
 * Visuels de l'organisation (logo, tampon, signature…) : chaque asset devient un placeholder
 * {{asset_<identifiant>}} des modèles. Actions immédiates (pas de bouton Enregistrer).
 * Le logo (organisations.logo_asset_id) a son bloc en tête ; il reste aussi listé parmi les visuels.
 */
// lectureSeule : membre (rôle contributeur), visuels consultables sans remplacement, suppression ni ajout.
export default function AssetsManager({ organisationId, lectureSeule = false }: { organisationId: string; lectureSeule?: boolean }) {
  const [assets, setAssets] = useState<OrganisationAsset[]>([])
  const [assetsLoading, setAssetsLoading] = useState(true)
  const [assetActionLoading, setAssetActionLoading] = useState<Record<string, boolean>>({})
  const [assetError, setAssetError] = useState<Record<string, string | null>>({})
  const [newAssetLibelle, setNewAssetLibelle] = useState('')
  // Visuel désigné comme logo de l'en-tête (organisations.logo_asset_id) ; un seul à la fois.
  const [logoAssetId, setLogoAssetId] = useState<string | null>(null)
  // Visuel dont le code vient d'être copié (confirmation temporaire sur son bouton).
  const [copiedAssetId, setCopiedAssetId] = useState<string | null>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Champs fichier masqués de « Remplacer », ouverts depuis le menu ⋯ de chaque vignette.
  const replaceInputs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current)
  }, [])

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
      const { data: org } = await supabase
        .from('organisations')
        .select('logo_asset_id')
        .eq('id', organisationId)
        .maybeSingle()
      setLogoAssetId((org as { logo_asset_id: string | null } | null)?.logo_asset_id ?? null)
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

  // Ajout d'un visuel : `key` porte l'état (chargement, erreur) du bloc qui l'a déclenché
  // ('new' pour la tuile d'ajout, 'logo' pour le bloc Logo de l'association).
  async function addAsset(file: File, libelle: string, identifiant: string, key: string): Promise<OrganisationAsset | null> {
    setAssetError((prev) => ({ ...prev, [key]: null }))
    setAssetActionLoading((prev) => ({ ...prev, [key]: true }))

    const { url, error: uploadError } = await uploadAssetFile(organisationId, identifiant, file)
    if (!url) {
      setAssetError((prev) => ({ ...prev, [key]: uploadError }))
      setAssetActionLoading((prev) => ({ ...prev, [key]: false }))
      return null
    }

    const { data: inserted, error: insertError } = await supabase
      .from('organisation_assets')
      .insert({ organisation_id: organisationId, identifiant, libelle, url })
      .select('id, identifiant, libelle, url')
      .single()

    if (insertError || !inserted) {
      setAssetError((prev) => ({ ...prev, [key]: insertError?.message ?? 'Erreur inconnue' }))
      setAssetActionLoading((prev) => ({ ...prev, [key]: false }))
      return null
    }

    setAssets((prev) => [...prev, inserted as OrganisationAsset])
    setAssetActionLoading((prev) => ({ ...prev, [key]: false }))
    return inserted as OrganisationAsset
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

    if (await addAsset(file, newAssetLibelle.trim(), identifiant, 'new')) setNewAssetLibelle('')
  }

  // Bloc « Logo de l'association » sans logo défini : le fichier devient un visuel « Logo »
  // (identifiant libre : logo, logo-2…) puis est désigné comme logo, comme « Définir comme logo ».
  async function handleAddLogo(file: File | null) {
    if (!file) return
    if (!validateAssetFile(file, 'logo')) return

    let identifiant = 'logo'
    for (let n = 2; assets.some((a) => a.identifiant === identifiant); n++) identifiant = `logo-${n}`

    const inserted = await addAsset(file, 'Logo', identifiant, 'logo')
    if (!inserted) return

    setAssetActionLoading((prev) => ({ ...prev, logo: true }))
    try {
      await setOrganisationLogo(organisationId, inserted.id)
      setLogoAssetId(inserted.id)
    } catch (e) {
      setAssetError((prev) => ({ ...prev, logo: e instanceof Error ? e.message : 'Erreur inconnue' }))
    }
    setAssetActionLoading((prev) => ({ ...prev, logo: false }))
  }

  async function handleReplaceAsset(asset: OrganisationAsset, file: File | null) {
    if (!file) return
    if (!validateAssetFile(file, asset.id)) return

    setAssetError((prev) => ({ ...prev, [asset.id]: null }))
    setAssetActionLoading((prev) => ({ ...prev, [asset.id]: true }))

    const { url, error: uploadError } = await uploadAssetFile(organisationId, asset.identifiant, file)
    if (!url) {
      setAssetError((prev) => ({ ...prev, [asset.id]: uploadError }))
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
      if (asset.id === logoAssetId) window.dispatchEvent(new Event(ORGANISATION_LOGO_CHANGE_EVENT))
    }
    setAssetActionLoading((prev) => ({ ...prev, [asset.id]: false }))
  }

  async function handleSetLogo(asset: OrganisationAsset, definir: boolean) {
    setAssetError((prev) => ({ ...prev, [asset.id]: null }))
    setAssetActionLoading((prev) => ({ ...prev, [asset.id]: true }))
    try {
      await setOrganisationLogo(organisationId, definir ? asset.id : null)
      setLogoAssetId(definir ? asset.id : null)
    } catch (e) {
      setAssetError((prev) => ({ ...prev, [asset.id]: e instanceof Error ? e.message : 'Erreur inconnue' }))
    }
    setAssetActionLoading((prev) => ({ ...prev, [asset.id]: false }))
  }

  // Copie du placeholder {{asset_…}} ; repli execCommand dans copyTextToClipboard (HTTP des serveurs de test).
  async function handleCopyCode(asset: OrganisationAsset) {
    const copied = await copyTextToClipboard(`{{asset_${asset.identifiant}}}`)
    if (copyTimer.current) clearTimeout(copyTimer.current)
    if (!copied) {
      setCopiedAssetId(null)
      setAssetError((prev) => ({ ...prev, [asset.id]: COPY_ERROR }))
      return
    }
    // N'efface que l'échec de copie précédent, pas une erreur d'action (ex. Remplacer raté).
    setAssetError((prev) => (prev[asset.id] === COPY_ERROR ? { ...prev, [asset.id]: null } : prev))
    setCopiedAssetId(asset.id)
    copyTimer.current = setTimeout(() => setCopiedAssetId(null), COPY_FEEDBACK_MS)
  }

  async function handleDeleteAsset(asset: OrganisationAsset) {
    const message = `Supprimer le visuel « ${asset.libelle} » ? Les modèles qui utilisent {{asset_${asset.identifiant}}} ne l’afficheront plus.`
    if (!window.confirm(message)) return
    setAssetError((prev) => ({ ...prev, [asset.id]: null }))
    setAssetActionLoading((prev) => ({ ...prev, [asset.id]: true }))

    const { error } = await supabase.from('organisation_assets').delete().eq('id', asset.id)

    if (error) {
      setAssetError((prev) => ({ ...prev, [asset.id]: error.message }))
      setAssetActionLoading((prev) => ({ ...prev, [asset.id]: false }))
      return
    }

    setAssets((prev) => prev.filter((a) => a.id !== asset.id))
    // La clé étrangère retire le logo en base (on delete set null) : on prévient l'en-tête.
    if (asset.id === logoAssetId) {
      setLogoAssetId(null)
      window.dispatchEvent(new Event(ORGANISATION_LOGO_CHANGE_EVENT))
    }
    setAssetActionLoading((prev) => ({ ...prev, [asset.id]: false }))
  }

  const logoAsset = assets.find((a) => a.id === logoAssetId) ?? null

  function assetMenuItems(asset: OrganisationAsset): ActionMenuItem[] {
    const busy = Boolean(assetActionLoading[asset.id])
    const items: ActionMenuItem[] = [
      { label: 'Remplacer', onSelect: () => replaceInputs.current[asset.id]?.click(), disabled: busy },
    ]
    if (asset.id === logoAssetId) {
      items.push({ label: 'Retirer comme logo', onSelect: () => handleSetLogo(asset, false), disabled: busy })
    } else if (isLogoEligibleUrl(asset.url)) {
      items.push({ label: 'Définir comme logo', onSelect: () => handleSetLogo(asset, true), disabled: busy })
    }
    items.push({ label: 'Supprimer', onSelect: () => handleDeleteAsset(asset), disabled: busy })
    return items
  }

  return (
    <div className="max-w-lg">
      {assetsLoading ? (
        <p className="text-xs text-ink-faint">Chargement…</p>
      ) : (
        <>
        {/* Logo de l'association : en tête, repérable sans connaître la mécanique des visuels. */}
        <div className="mb-6 rounded-sm border border-paper-border p-4">
          <p className="text-sm font-semibold text-ink">Logo de l’association</p>
          <p className="mt-0.5 text-xs text-ink-faint">Affiché dans l’en-tête de l’espace admin et de l’espace bénévole. PNG ou JPEG, 2 Mo max.</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex h-20 w-full shrink-0 items-center justify-center overflow-hidden rounded-sm bg-paper-border/20 sm:w-40">
              {logoAsset ? (
                <img src={logoAsset.url} alt="Logo de l’association" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-xs text-ink-faint">Aucun logo</span>
              )}
            </div>
            {!lectureSeule && (
              <div className="flex flex-wrap items-center gap-2">
                <label
                  className={cn(
                    'rounded-sm border border-stamp px-3 py-1.5 font-registre text-xs font-medium text-stamp hover:bg-stamp/[0.06]',
                    assetActionLoading[logoAsset ? logoAsset.id : 'logo'] ? 'cursor-wait opacity-60' : 'cursor-pointer'
                  )}
                >
                  {assetActionLoading[logoAsset ? logoAsset.id : 'logo'] ? 'Envoi…' : logoAsset ? 'Remplacer' : 'Ajouter un logo'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    disabled={assetActionLoading[logoAsset ? logoAsset.id : 'logo']}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null
                      if (logoAsset) handleReplaceAsset(logoAsset, file)
                      else handleAddLogo(file)
                      e.target.value = ''
                    }}
                  />
                </label>
                {logoAsset && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => handleSetLogo(logoAsset, false)} disabled={assetActionLoading[logoAsset.id]}>
                    Retirer comme logo
                  </Button>
                )}
              </div>
            )}
          </div>
          {!logoAsset && !lectureSeule && assets.some((a) => isLogoEligibleUrl(a.url)) && (
            <p className="mt-2 text-xs text-ink-faint">Ou choisissez un visuel existant ci-dessous avec « Définir comme logo ».</p>
          )}
          {(logoAsset ? assetError[logoAsset.id] : assetError.logo) && (
            <p className="mt-1.5 text-xs text-stamp">{logoAsset ? assetError[logoAsset.id] : assetError.logo}</p>
          )}
        </div>

        <p className="text-sm font-semibold text-ink">Tous les visuels</p>
        <p className="mt-0.5 text-xs text-ink-faint">
          Logo, tampon, signature ou tout autre visuel de vos reçus et cartes adhérent. PNG ou JPEG, 2 Mo max, enregistré dès l’envoi du fichier.
        </p>
        <details className="mb-3 mt-1">
          <summary className="cursor-pointer select-none rounded-sm text-xs font-medium text-stamp hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70">
            En savoir plus
          </summary>
          <p className="mt-1 text-xs text-ink-faint">
            Chaque visuel ajouté devient utilisable dans vos modèles (reçus, carte adhérent) avec la variable{' '}
            <code>{'{{asset_<identifiant>}}'}</code>, affichée sous son aperçu. L’identifiant est tiré du libellé saisi à l’ajout.
          </p>
        </details>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {assets.map((asset) => (
            <div key={asset.id} className="flex flex-col rounded-sm border border-paper-border p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5 pt-0.5">
                  <p className="min-w-0 break-words text-xs font-medium text-ink-muted">{asset.libelle}</p>
                  {asset.id === logoAssetId && <Badge variant="stamp" className="shrink-0">Logo</Badge>}
                </div>
                {!lectureSeule && (
                  <>
                    <ActionMenu
                      label={`Actions sur le visuel ${asset.libelle}`}
                      iconOnly
                      className="-mt-1 shrink-0"
                      items={assetMenuItems(asset)}
                    />
                    <input
                      ref={(el) => { replaceInputs.current[asset.id] = el }}
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      tabIndex={-1}
                      aria-hidden
                      disabled={assetActionLoading[asset.id]}
                      onChange={(e) => {
                        handleReplaceAsset(asset, e.target.files?.[0] ?? null)
                        e.target.value = ''
                      }}
                    />
                  </>
                )}
              </div>
              <div className="mb-2 flex h-20 items-center justify-center overflow-hidden rounded-sm bg-paper-border/20">
                <img src={asset.url} alt={asset.libelle} className="max-h-full max-w-full object-contain" />
              </div>
              {/* Code entier, sans troncature : coupure de préférence après un « _ », sélectionnable à la main si la copie échoue. */}
              <p className="mb-2 mt-auto select-all break-words font-registre-mono text-[11px] text-stamp">
                {`{{asset_${asset.identifiant}}}`.split('_').map((part, i, parts) => (
                  <span key={i}>{part}{i < parts.length - 1 && <>_<wbr /></>}</span>
                ))}
              </p>
              {/* Lecture seule : le fieldset de la page désactive le bouton ; le code reste sélectionnable. */}
              {!lectureSeule && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => handleCopyCode(asset)}
                  aria-label={`Copier le code du visuel ${asset.libelle}`}
                >
                  {copiedAssetId === asset.id ? 'Code copié' : 'Copier le code'}
                </Button>
              )}
              <span className="sr-only" aria-live="polite">{copiedAssetId === asset.id ? 'Code copié' : ''}</span>
              {assetActionLoading[asset.id] && <p className="mt-1.5 text-xs text-ink-faint" role="status">En cours…</p>}
              {assetError[asset.id] && <p className="mt-1.5 text-xs text-stamp">{assetError[asset.id]}</p>}
            </div>
          ))}

          {!lectureSeule && <div className="rounded-sm border border-dashed border-paper-border p-3">
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
          </div>}
        </div>
        </>
      )}
    </div>
  )
}
