import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useOrganisationId } from '../hooks/useOrganisationId'
import ParametresSection from '../components/ParametresSection'
import { slugifyIdentifiant, type OrganisationAsset } from '../lib/organisationAssets'
import { DEFAULT_MODELE } from '../lib/modeleRecu'
import type { ModeleRecu } from '../types'

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

interface OrgSettings {
  nom: string
  code_pin_benevole: string
  modele_recu_pdf: ModeleRecu
}

export default function ParametresOrganisationPage() {
  const organisationId = useOrganisationId()

  const [settings, setSettings] = useState<OrgSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Nom
  const [nom, setNom] = useState('')
  const [nomSaving, setNomSaving] = useState(false)
  const [nomSuccess, setNomSuccess] = useState(false)
  const [nomError, setNomError] = useState<string | null>(null)

  // PIN
  const [pin, setPin] = useState('')
  const [pinVisible, setPinVisible] = useState(false)
  const [pinLoading, setPinLoading] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinSuccess, setPinSuccess] = useState(false)

  // Identité visuelle (président + assets) — modele_recu_pdf est partagé avec
  // Paramètres > Fiscal, toujours relire/réécrire l'objet complet (voir types/index.ts).
  const [modele, setModele] = useState<ModeleRecu>(DEFAULT_MODELE)
  const [modeleSaving, setModeleSaving] = useState(false)
  const [modeleSuccess, setModeleSuccess] = useState(false)
  const [modeleError, setModeleError] = useState<string | null>(null)

  const [assets, setAssets] = useState<OrganisationAsset[]>([])
  const [assetsLoading, setAssetsLoading] = useState(true)
  const [assetActionLoading, setAssetActionLoading] = useState<Record<string, boolean>>({})
  const [assetError, setAssetError] = useState<Record<string, string | null>>({})
  const [newAssetLibelle, setNewAssetLibelle] = useState('')

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!organisationId) return

    async function fetchSettings() {
      setLoading(true)
      setFetchError(null)

      const { data, error } = await supabase
        .from('organisations')
        .select('nom, code_pin_benevole, modele_recu_pdf')
        .eq('id', organisationId)
        .single()

      if (error || !data) {
        setFetchError(error?.message ?? 'Erreur de chargement')
        setLoading(false)
        return
      }

      const raw = data as OrgSettings
      const modeleRaw = (raw.modele_recu_pdf ?? {}) as Partial<ModeleRecu>

      setSettings(raw)
      setNom(raw.nom)
      setPin(raw.code_pin_benevole ?? '')
      setModele({ ...DEFAULT_MODELE, ...modeleRaw })
      setLoading(false)
    }

    fetchSettings()
  }, [organisationId])

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

  // ---------------------------------------------------------------------------
  // Save nom
  // ---------------------------------------------------------------------------

  async function handleSaveNom(e: FormEvent) {
    e.preventDefault()
    setNomSaving(true)
    setNomError(null)
    setNomSuccess(false)

    const { error } = await supabase
      .from('organisations')
      .update({ nom })
      .eq('id', organisationId)

    if (error) {
      setNomError(error.message)
    } else {
      setNomSuccess(true)
      setTimeout(() => setNomSuccess(false), 3000)
    }
    setNomSaving(false)
  }

  // ---------------------------------------------------------------------------
  // Regenerate PIN
  // ---------------------------------------------------------------------------

  async function handleRegeneratePin() {
    setPinLoading(true)
    setPinError(null)
    setPinSuccess(false)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setPinError('Session expirée')
      setPinLoading(false)
      return
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
    const res = await fetch(`${supabaseUrl}/functions/v1/update-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      },
      body: JSON.stringify({}),
    })

    const json = await res.json()
    if (!res.ok) {
      setPinError(json.error ?? 'Erreur inconnue')
      setPinLoading(false)
      return
    }

    setPin(json.new_pin)
    setPinVisible(true)
    setPinSuccess(true)
    setTimeout(() => setPinSuccess(false), 4000)
    setPinLoading(false)
  }

  // ---------------------------------------------------------------------------
  // Save identité visuelle (président — le reste de modele_recu_pdf est préservé tel quel)
  // ---------------------------------------------------------------------------

  async function handleSaveIdentite(e: FormEvent) {
    e.preventDefault()
    setModeleSaving(true)
    setModeleError(null)
    setModeleSuccess(false)

    const { error } = await supabase
      .from('organisations')
      .update({ modele_recu_pdf: modele })
      .eq('id', organisationId)

    if (error) {
      setModeleError(error.message)
    } else {
      setModeleSuccess(true)
      setTimeout(() => setModeleSuccess(false), 3000)
    }
    setModeleSaving(false)
  }

  // ---------------------------------------------------------------------------
  // Assets (identité visuelle) — liste ouverte, un identifiant par asset,
  // utilisable comme placeholder {{asset_<identifiant>}} dans les templates
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-slate-500">
        Chargement…
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{fetchError}</div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Paramètres</h1>
        <p className="mt-1 text-sm text-slate-600">Gérez les informations et la configuration de votre organisation.</p>
      </div>

      <ParametresSection title="Informations générales">
        <form onSubmit={handleSaveNom} className="space-y-4 max-w-md">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Nom de l'association <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex : Association Mothana"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={nomSaving || nom === settings?.nom}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {nomSaving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            {nomSuccess && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Enregistré
              </span>
            )}
            {nomError && <span className="text-sm text-red-600">{nomError}</span>}
          </div>
        </form>
      </ParametresSection>

      <ParametresSection
        title="Code PIN bénévole"
        description="Ce code permet aux bénévoles d'accéder à l'écran de saisie de dons. Il est partagé entre tous les bénévoles de votre organisation."
      >
        <div className="space-y-4 max-w-md">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Code PIN actuel</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-mono tracking-widest text-slate-900">
                {pinVisible ? pin : '••••••'}
              </div>
              <button
                type="button"
                onClick={() => setPinVisible((v) => !v)}
                className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                title={pinVisible ? 'Masquer' : 'Afficher'}
              >
                {pinVisible ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRegeneratePin}
              disabled={pinLoading}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {pinLoading ? (
                <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              )}
              Régénérer le PIN
            </button>
            {pinSuccess && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Nouveau PIN généré — pensez à le communiquer à vos bénévoles
              </span>
            )}
            {pinError && <span className="text-sm text-red-600">{pinError}</span>}
          </div>
        </div>
      </ParametresSection>

      <ParametresSection
        title="Identité visuelle"
        description="Utilisée à la fois par les reçus fiscaux et par la carte adhérent — pas spécifique à l'un ou l'autre."
      >
        <form onSubmit={handleSaveIdentite} className="max-w-lg space-y-2">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-slate-700">Nom du président</label>
              <input
                type="text"
                value={modele.president_nom}
                onChange={(e) => setModele((m) => ({ ...m, president_nom: e.target.value }))}
                placeholder="Ex : Jean Dupont"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-slate-700">Titre</label>
              <input
                type="text"
                value={modele.president_titre}
                onChange={(e) => setModele((m) => ({ ...m, president_titre: e.target.value }))}
                placeholder="Ex : Président"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Disponibles comme placeholders <code>{'{{president_nom}}'}</code> et <code>{'{{president_titre}}'}</code> dans vos templates.
          </p>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={modeleSaving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {modeleSaving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            {modeleSuccess && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Enregistré
              </span>
            )}
            {modeleError && <span className="text-sm text-red-600">{modeleError}</span>}
          </div>
        </form>

        <div className="mt-6 max-w-lg">
          <p className="mb-2 text-sm font-medium text-slate-700">Assets</p>
          <p className="mb-3 text-xs text-slate-500">
            Logo, tampon, signature ou tout autre visuel — chaque asset ajouté devient utilisable comme placeholder{' '}
            <code>{'{{asset_<identifiant>}}'}</code> dans vos templates. PNG ou JPEG, 2 Mo max. Enregistré immédiatement à l'upload.
          </p>
          {assetsLoading ? (
            <p className="text-xs text-slate-500">Chargement…</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {assets.map((asset) => (
                <div key={asset.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="mb-2 text-xs font-medium text-slate-600">{asset.libelle}</p>
                  <div className="mb-2 flex h-20 items-center justify-center overflow-hidden rounded-md bg-slate-50">
                    <img src={asset.url} alt={asset.libelle} className="max-h-full max-w-full object-contain" />
                  </div>
                  <p className="mb-2 truncate font-mono text-[11px] text-indigo-600">{`{{asset_${asset.identifiant}}}`}</p>
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
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
                    <button
                      type="button"
                      onClick={() => handleDeleteAsset(asset)}
                      disabled={assetActionLoading[asset.id]}
                      className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-60"
                    >
                      Supprimer
                    </button>
                  </div>
                  {assetError[asset.id] && <p className="mt-1.5 text-xs text-red-600">{assetError[asset.id]}</p>}
                </div>
              ))}

              <div className="rounded-lg border border-dashed border-slate-300 p-3">
                <label className="mb-1 block text-xs font-medium text-slate-600">Libellé</label>
                <input
                  type="text"
                  value={newAssetLibelle}
                  onChange={(e) => setNewAssetLibelle(e.target.value)}
                  placeholder="Ex : Logo, Tampon, Photo"
                  className="mb-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <label
                  className={`block rounded-lg border px-3 py-1.5 text-center text-xs font-medium ${
                    newAssetLibelle.trim()
                      ? 'cursor-pointer border-slate-300 text-slate-700 hover:bg-slate-50'
                      : 'cursor-not-allowed border-slate-200 text-slate-300'
                  }`}
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
                {assetError.new && <p className="mt-1.5 text-xs text-red-600">{assetError.new}</p>}
              </div>
            </div>
          )}
        </div>
      </ParametresSection>
    </div>
  )
}
