import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useOrganisationId } from '../hooks/useOrganisationId'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModeleRecu {
  adresse: string
  siret: string
  objet_association: string
  mentions_complementaires: string
}

interface OrgSettings {
  nom: string
  code_pin_benevole: string
  modele_recu_pdf: ModeleRecu
}

const DEFAULT_MODELE: ModeleRecu = {
  adresse: '',
  siret: '',
  objet_association: '',
  mentions_complementaires: '',
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({ title, description, children }: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ParametresPage
// ---------------------------------------------------------------------------

export default function ParametresPage() {
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

  // Modèle reçu
  const [modele, setModele] = useState<ModeleRecu>(DEFAULT_MODELE)
  const [modeleSaving, setModeleSaving] = useState(false)
  const [modeleSuccess, setModeleSuccess] = useState(false)
  const [modeleError, setModeleError] = useState<string | null>(null)

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
      setModele({
        adresse: modeleRaw.adresse ?? '',
        siret: modeleRaw.siret ?? '',
        objet_association: modeleRaw.objet_association ?? '',
        mentions_complementaires: modeleRaw.mentions_complementaires ?? '',
      })
      setLoading(false)
    }

    fetchSettings()
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
  // Save modèle reçu
  // ---------------------------------------------------------------------------

  async function handleSaveModele(e: FormEvent) {
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
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-slate-400">
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
        <p className="mt-1 text-sm text-slate-500">Gérez les informations et la configuration de votre organisation.</p>
      </div>

      {/* Section 1 — Informations générales */}
      <Section title="Informations générales">
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
      </Section>

      {/* Section 2 — Code PIN bénévole */}
      <Section
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
      </Section>

      {/* Section 3 — Modèle de reçu fiscal */}
      <Section
        title="Modèle de reçu fiscal"
        description="Ces informations apparaissent sur les reçus fiscaux générés pour vos donateurs."
      >
        <form onSubmit={handleSaveModele} className="space-y-4 max-w-lg">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Adresse de l'association</label>
            <input
              type="text"
              value={modele.adresse}
              onChange={(e) => setModele((m) => ({ ...m, adresse: e.target.value }))}
              placeholder="Ex : 12 rue des Lilas, 75011 Paris"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Numéro RNA / SIRET</label>
            <input
              type="text"
              value={modele.siret}
              onChange={(e) => setModele((m) => ({ ...m, siret: e.target.value }))}
              placeholder="Ex : W751234567 ou 123 456 789 00012"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Objet de l'association</label>
            <textarea
              rows={2}
              value={modele.objet_association}
              onChange={(e) => setModele((m) => ({ ...m, objet_association: e.target.value }))}
              placeholder="Ex : association d'intérêt général à but non lucratif"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            <p className="mt-1 text-xs text-slate-400">Affiché dans la phrase de certification du reçu.</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Mentions complémentaires</label>
            <textarea
              rows={3}
              value={modele.mentions_complementaires}
              onChange={(e) => setModele((m) => ({ ...m, mentions_complementaires: e.target.value }))}
              placeholder="Ex : mentions légales supplémentaires, coordonnées bancaires, etc."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={modeleSaving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {modeleSaving ? 'Enregistrement…' : 'Enregistrer le modèle'}
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
      </Section>
    </div>
  )
}
