import { useState, useEffect, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import SignaturePad from '../components/SignaturePad'
import ShadowHtmlBlock from '../components/ShadowHtmlBlock'
import ChampsAdhesion, { ConsentementsAdhesion } from '../components/ChampsAdhesion'
import { substituteFormulaireAdhesionPlaceholders } from '../lib/formulaireAdhesionPreview'
import { CHAMPS_ADHESION_VIDES, champsAdhesionPayload, type ChampsAdhesionValeurs } from '../lib/champsAdhesion'
import { isValidEmail } from '../lib/textFormat'
import { isAnneeNaissanceValide } from '../lib/dateNaissance'
import { getCanonicalSiteUrl } from '../lib/environment'
import { Button } from '../components/ui/button'
import { Label } from '../components/ui/label'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

interface OrganisationAssetPublic {
  identifiant: string
  url: string
}

interface OrganisationPublic {
  nom: string
  statuts_url: string | null
  formulaire_adhesion_header_html: string | null
  formulaire_adhesion_footer_html: string | null
  formulaire_adhesion_css: string | null
  formulaire_adhesion_message_succes: string | null
  assets: OrganisationAssetPublic[] | null
}

export default function DemandeAdhesionPage() {
  const { slug } = useParams<{ slug: string }>()

  const [organisation, setOrganisation] = useState<OrganisationPublic | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [valeurs, setValeurs] = useState<ChampsAdhesionValeurs>(CHAMPS_ADHESION_VIDES)
  const [accepteStatuts, setAccepteStatuts] = useState(false)
  const [consentRgpd, setConsentRgpd] = useState(false)
  const [signature, setSignature] = useState<string | null>(null)
  // Honeypot anti-spam : champ invisible pour un humain, souvent rempli par les bots
  const [siteWeb, setSiteWeb] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const { courriel, dateNaissance, codePostal } = valeurs
  const dateNaissanceInvalid = dateNaissance !== '' && !isAnneeNaissanceValide(dateNaissance)

  useEffect(() => {
    if (!slug) return

    async function fetchOrganisation() {
      setLoading(true)
      const { data, error } = await supabase.rpc('get_organisation_public', { p_slug: slug })

      if (error || !data || data.length === 0) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setOrganisation(data[0] as OrganisationPublic)
      setLoading(false)
    }

    fetchOrganisation()
  }, [slug])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    if (siteWeb) {
      // Honeypot rempli : on n'informe pas le bot, on ignore silencieusement.
      return
    }
    if (!signature) {
      setSubmitError('Merci de signer avant de valider la demande.')
      return
    }
    if (courriel.trim() !== '' && !isValidEmail(courriel)) {
      setSubmitError("Le format de l'adresse email est invalide.")
      return
    }
    if (dateNaissanceInvalid) {
      setSubmitError("La date de naissance n'est pas valide.")
      return
    }
    if (codePostal.length !== 5) {
      setSubmitError('Le code postal doit contenir 5 chiffres.')
      return
    }
    if (!organisation) return

    setSubmitting(true)

    // Seul chemin d'écriture : l'Edge Function soumettre-demande-adhesion (validation, limite de
    // débit par IP, email de confirmation). Plus d'insert direct par la clé publique.
    let status: number
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/soumettre-demande-adhesion`, {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slug,
          // Origine du lien envoyé aux comptes de l'organisation (filtrée côté serveur).
          site_url: getCanonicalSiteUrl(),
          site_web: siteWeb,
          ...champsAdhesionPayload(valeurs),
          signature_data_url: signature,
          // Sans statuts_url, la case n'est pas affichée (rien à accepter) : le serveur ne
          // l'exige alors pas.
          accepte_statuts: organisation.statuts_url ? accepteStatuts : true,
          consent_rgpd: consentRgpd,
        }),
      })
      status = response.status
    } catch {
      status = 0
    }

    if (status !== 200) {
      setSubmitError(
        status === 429
          ? "Trop de demandes ont été envoyées depuis cette connexion. Merci de réessayer dans une heure."
          : "Une erreur est survenue lors de l'envoi de votre demande. Merci de réessayer.",
      )
      setSubmitting(false)
      return
    }

    setSubmitted(true)
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper font-registre text-sm text-ink-faint">
        Chargement…
      </div>
    )
  }

  if (notFound || !organisation) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper px-4 font-registre">
        <div className="max-w-md rounded-sm border border-paper-border bg-white p-6 text-center">
          <h1 className="text-lg font-semibold text-ink">Formulaire introuvable</h1>
          <p className="mt-2 text-sm text-ink-faint">Ce lien n'est pas valide ou n'existe plus.</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper px-4 font-registre">
        <div className="max-w-md rounded-sm border border-paper-border bg-white p-6 text-center">
          <h1 className="text-lg font-semibold text-ink">Demande envoyée</h1>
          <p className="mt-2 whitespace-pre-line text-sm text-ink-faint">
            {organisation.formulaire_adhesion_message_succes ||
              `Votre demande d'adhésion à ${organisation.nom} a bien été enregistrée. Elle sera examinée par le conseil d'administration.`}
          </p>
        </div>
      </div>
    )
  }

  const placeholderValues: Record<string, string> = { organisation_nom: organisation.nom }
  for (const asset of organisation.assets ?? []) {
    placeholderValues[`asset_${asset.identifiant}`] = asset.url
  }

  return (
    <div className="min-h-dvh bg-paper px-4 py-10 font-registre">
      <div className="mx-auto max-w-xl">
        {organisation.formulaire_adhesion_header_html ? (
          <ShadowHtmlBlock
            className="mb-6"
            html={substituteFormulaireAdhesionPlaceholders(organisation.formulaire_adhesion_header_html, placeholderValues)}
            css={organisation.formulaire_adhesion_css ?? ''}
          />
        ) : (
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-ink">Demande d'adhésion</h1>
            <p className="mt-1 text-sm text-ink-muted">{organisation.nom}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 rounded-sm border border-paper-border bg-white p-6">
          {submitError && <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">{submitError}</div>}

          <input
            type="text"
            value={siteWeb}
            onChange={(e) => setSiteWeb(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
          />

          <ChampsAdhesion valeurs={valeurs} onChange={(patch) => setValeurs((v) => ({ ...v, ...patch }))} />

          <ConsentementsAdhesion
            statutsUrl={organisation.statuts_url}
            accepteStatuts={accepteStatuts}
            consentRgpd={consentRgpd}
            onAccepteStatutsChange={setAccepteStatuts}
            onConsentRgpdChange={setConsentRgpd}
            objet="ma demande d'adhésion"
          />

          <div>
            <Label>
              Signature <span className="text-stamp">*</span>
            </Label>
            <div className="mt-1">
              <SignaturePad onChange={setSignature} />
            </div>
          </div>

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Envoi…' : 'Envoyer ma demande'}
          </Button>
        </form>

        {organisation.formulaire_adhesion_footer_html && (
          <ShadowHtmlBlock
            className="mt-6"
            html={substituteFormulaireAdhesionPlaceholders(organisation.formulaire_adhesion_footer_html, placeholderValues)}
            css={organisation.formulaire_adhesion_css ?? ''}
          />
        )}
      </div>
    </div>
  )
}
