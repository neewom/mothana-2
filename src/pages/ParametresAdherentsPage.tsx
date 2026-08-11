import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useOrganisationId } from '../hooks/useOrganisationId'
import ParametresSection from '../components/ParametresSection'
import CarteAdherentSection from '../components/CarteAdherentSection'
import FormulaireAdhesionEditorModal from '../components/FormulaireAdhesionEditorModal'
import { slugifyUrl } from '../lib/organisationAssets'
import { copyTextToClipboard } from '../lib/clipboard'

const MAX_STATUTS_SIZE = 2 * 1024 * 1024

// Réutilise le bucket public organisation-assets (déjà scopé par organisation_id,
// pas de confidentialité à préserver pour un document destiné à être consulté publiquement).
async function uploadStatutsFile(organisationId: string, file: File): Promise<string | null> {
  const path = `${organisationId}/statuts-${Date.now()}.pdf`

  const { error: uploadError } = await supabase.storage
    .from('organisation-assets')
    .upload(path, file, { contentType: 'application/pdf' })

  if (uploadError) return null

  const { data } = supabase.storage.from('organisation-assets').getPublicUrl(path)
  return data.publicUrl
}

interface OrgSettings {
  slug: string
  statuts_url: string | null
  formulaire_adhesion_header_html: string | null
  formulaire_adhesion_footer_html: string | null
  formulaire_adhesion_css: string | null
  formulaire_adhesion_message_succes: string | null
}

export default function ParametresAdherentsPage() {
  const organisationId = useOrganisationId()

  const [settings, setSettings] = useState<OrgSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Adhésion en ligne (slug public + statuts PDF)
  const [slug, setSlug] = useState('')
  const [slugSaving, setSlugSaving] = useState(false)
  const [slugSuccess, setSlugSuccess] = useState(false)
  const [slugError, setSlugError] = useState<string | null>(null)
  const [slugCopied, setSlugCopied] = useState(false)
  const [statutsUrl, setStatutsUrl] = useState<string | null>(null)
  const [statutsUploading, setStatutsUploading] = useState(false)
  const [statutsError, setStatutsError] = useState<string | null>(null)
  const [formulaireHeaderHtml, setFormulaireHeaderHtml] = useState<string | null>(null)
  const [formulaireFooterHtml, setFormulaireFooterHtml] = useState<string | null>(null)
  const [formulaireCss, setFormulaireCss] = useState<string | null>(null)
  const [formulaireEditorOpen, setFormulaireEditorOpen] = useState(false)
  const [messageSucces, setMessageSucces] = useState('')
  const [messageSuccesInitial, setMessageSuccesInitial] = useState('')
  const [messageSuccesSaving, setMessageSuccesSaving] = useState(false)
  const [messageSuccesSuccess, setMessageSuccesSuccess] = useState(false)
  const [messageSuccesError, setMessageSuccesError] = useState<string | null>(null)

  useEffect(() => {
    if (!organisationId) return

    async function fetchSettings() {
      setLoading(true)
      setFetchError(null)

      const { data, error } = await supabase
        .from('organisations')
        .select(
          'slug, statuts_url, formulaire_adhesion_header_html, formulaire_adhesion_footer_html, formulaire_adhesion_css, formulaire_adhesion_message_succes',
        )
        .eq('id', organisationId)
        .single()

      if (error || !data) {
        setFetchError(error?.message ?? 'Erreur de chargement')
        setLoading(false)
        return
      }

      const raw = data as OrgSettings

      setSettings(raw)
      setSlug(raw.slug)
      setStatutsUrl(raw.statuts_url)
      setFormulaireHeaderHtml(raw.formulaire_adhesion_header_html)
      setFormulaireFooterHtml(raw.formulaire_adhesion_footer_html)
      setFormulaireCss(raw.formulaire_adhesion_css)
      setMessageSucces(raw.formulaire_adhesion_message_succes ?? '')
      setMessageSuccesInitial(raw.formulaire_adhesion_message_succes ?? '')
      setLoading(false)
    }

    fetchSettings()
  }, [organisationId])

  async function handleSaveSlug(e: FormEvent) {
    e.preventDefault()
    const normalized = slugifyUrl(slug)
    if (!normalized) {
      setSlugError('Slug invalide')
      return
    }

    setSlugSaving(true)
    setSlugError(null)
    setSlugSuccess(false)

    const { error } = await supabase
      .from('organisations')
      .update({ slug: normalized })
      .eq('id', organisationId)

    if (error) {
      setSlugError(error.code === '23505' ? 'Ce slug est déjà utilisé par une autre organisation' : error.message)
    } else {
      setSlug(normalized)
      setSlugSuccess(true)
      setTimeout(() => setSlugSuccess(false), 3000)
    }
    setSlugSaving(false)
  }

  function handleCopySlugUrl() {
    copyTextToClipboard(`${window.location.origin}/adhesion/${slug}`)
    setSlugCopied(true)
    setTimeout(() => setSlugCopied(false), 2000)
  }

  async function handleUploadStatuts(file: File | null) {
    if (!file) return
    if (file.type !== 'application/pdf') {
      setStatutsError('Format non supporté (PDF uniquement)')
      return
    }
    if (file.size > MAX_STATUTS_SIZE) {
      setStatutsError('Fichier trop volumineux (2 Mo max)')
      return
    }

    setStatutsError(null)
    setStatutsUploading(true)

    const url = await uploadStatutsFile(organisationId, file)
    if (!url) {
      setStatutsError("Erreur lors de l'envoi du fichier")
      setStatutsUploading(false)
      return
    }

    const { error } = await supabase
      .from('organisations')
      .update({ statuts_url: url })
      .eq('id', organisationId)

    if (error) {
      setStatutsError(error.message)
    } else {
      setStatutsUrl(url)
    }
    setStatutsUploading(false)
  }

  async function handleSaveMessageSucces(e: FormEvent) {
    e.preventDefault()
    setMessageSuccesSaving(true)
    setMessageSuccesError(null)
    setMessageSuccesSuccess(false)

    const trimmed = messageSucces.trim()
    const { error } = await supabase
      .from('organisations')
      .update({ formulaire_adhesion_message_succes: trimmed || null })
      .eq('id', organisationId)

    if (error) {
      setMessageSuccesError(error.message)
    } else {
      setMessageSucces(trimmed)
      setMessageSuccesInitial(trimmed)
      setMessageSuccesSuccess(true)
      setTimeout(() => setMessageSuccesSuccess(false), 3000)
    }
    setMessageSuccesSaving(false)
  }

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
        <h1 className="text-2xl font-bold text-slate-900">Paramètres — Adhérents</h1>
        <p className="mt-1 text-sm text-slate-600">Carte adhérent et formulaire public de demande d'adhésion.</p>
      </div>

      <ParametresSection
        title="Carte adhérent"
        description="Gérez le gabarit HTML utilisé pour imprimer les cartes adhérent (planche A4)."
      >
        {organisationId && <CarteAdherentSection organisationId={organisationId} />}
      </ParametresSection>

      <ParametresSection
        title="Adhésion en ligne"
        description="Formulaire public permettant de soumettre une demande d'adhésion, à ratifier ensuite depuis l'espace Adhérents."
      >
        <form onSubmit={handleSaveSlug} className="max-w-lg space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Adresse du formulaire</label>
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
              <span className="break-all text-sm text-slate-500">{window.location.origin}/adhesion/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="ex : mon-association"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:flex-1"
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Lettres minuscules, chiffres et tirets uniquement. Modifier ce slug change l'adresse du formulaire public.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={slugSaving || slug === settings?.slug}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {slugSaving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button
              type="button"
              onClick={handleCopySlugUrl}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {slugCopied ? 'Copié !' : "Copier l'adresse"}
            </button>
            {slugSuccess && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Enregistré
              </span>
            )}
            {slugError && <span className="text-sm text-red-600">{slugError}</span>}
          </div>
        </form>

        <div className="mt-6 max-w-lg">
          <p className="mb-2 text-sm font-medium text-slate-700">Statuts de l'association</p>
          <p className="mb-3 text-xs text-slate-500">
            PDF affiché et téléchargeable sur le formulaire public, pour que le demandeur puisse en prendre connaissance avant de signer.
          </p>
          <div className="flex items-center gap-3">
            {statutsUrl && (
              <a
                href={statutsUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Voir le PDF actuel
              </a>
            )}
            <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
              {statutsUploading ? 'Envoi…' : statutsUrl ? 'Remplacer' : 'Choisir un fichier'}
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                disabled={statutsUploading}
                onChange={(e) => {
                  handleUploadStatuts(e.target.files?.[0] ?? null)
                  e.target.value = ''
                }}
              />
            </label>
          </div>
          {statutsError && <p className="mt-1.5 text-xs text-red-600">{statutsError}</p>}
        </div>

        <div className="mt-6 max-w-lg">
          <p className="mb-2 text-sm font-medium text-slate-700">En-tête et pied de page</p>
          <p className="mb-3 text-xs text-slate-500">
            Le formulaire central reste inchangé. Personnalisez l'en-tête et le pied de page avec vos assets (logo, bannière…) via l'éditeur.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFormulaireEditorOpen(true)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {formulaireHeaderHtml || formulaireFooterHtml ? 'Modifier' : 'Personnaliser'}
            </button>
            {(formulaireHeaderHtml || formulaireFooterHtml) && (
              <span className="text-xs text-emerald-600">Personnalisé</span>
            )}
          </div>
        </div>

        <form onSubmit={handleSaveMessageSucces} className="mt-6 max-w-lg">
          <p className="mb-2 text-sm font-medium text-slate-700">Message de succès</p>
          <p className="mb-3 text-xs text-slate-500">
            Affiché au demandeur une fois le formulaire envoyé. Laissez vide pour garder le message par défaut.
          </p>
          <textarea
            value={messageSucces}
            onChange={(e) => setMessageSucces(e.target.value)}
            placeholder="Votre demande d'adhésion a bien été enregistrée. Elle sera examinée par le conseil d'administration."
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              type="submit"
              disabled={messageSuccesSaving || messageSucces.trim() === messageSuccesInitial}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {messageSuccesSaving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            {messageSuccesSuccess && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Enregistré
              </span>
            )}
            {messageSuccesError && <span className="text-sm text-red-600">{messageSuccesError}</span>}
          </div>
        </form>
      </ParametresSection>

      {organisationId && (
        <FormulaireAdhesionEditorModal
          open={formulaireEditorOpen}
          onClose={() => setFormulaireEditorOpen(false)}
          onSaved={async () => {
            const { data } = await supabase
              .from('organisations')
              .select('formulaire_adhesion_header_html, formulaire_adhesion_footer_html, formulaire_adhesion_css')
              .eq('id', organisationId)
              .single()
            if (data) {
              setFormulaireHeaderHtml(data.formulaire_adhesion_header_html)
              setFormulaireFooterHtml(data.formulaire_adhesion_footer_html)
              setFormulaireCss(data.formulaire_adhesion_css)
            }
          }}
          organisationId={organisationId}
          headerHtml={formulaireHeaderHtml}
          footerHtml={formulaireFooterHtml}
          css={formulaireCss}
        />
      )}
    </div>
  )
}
