import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import SignaturePad from '../components/SignaturePad'
import ShadowHtmlBlock from '../components/ShadowHtmlBlock'
import ChampsAdhesion, { ConsentementsAdhesion } from '../components/ChampsAdhesion'
import { substituteFormulaireAdhesionPlaceholders } from '../lib/formulaireAdhesionPreview'
import { champsAdhesionPayload, type ChampsAdhesionValeurs } from '../lib/champsAdhesion'
import {
  empreinteSecretRenouvellement,
  extraireSecretRenouvellement,
  formatDateFinAdhesion,
  valeursPreremplies,
  type AdherentPrerempli,
} from '../lib/renouvellementAdhesion'
import { isValidEmail } from '../lib/textFormat'
import { getCanonicalSiteUrl } from '../lib/environment'
import { Button } from '../components/ui/button'
import { Label } from '../components/ui/label'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

interface OrganisationRenouvellement {
  nom: string
  statuts_url: string | null
  formulaire_adhesion_header_html: string | null
  formulaire_adhesion_footer_html: string | null
  formulaire_adhesion_css: string | null
  assets: { identifiant: string; url: string }[] | null
}

type EtatNonValide = 'lien_invalide' | 'lien_expire' | 'deja_envoye' | 'deja_renouvele'

type EtatPage =
  | { type: 'chargement' }
  | { type: 'erreur'; message: string }
  | { type: 'etat'; etat: EtatNonValide; dateFin: string | null }
  | { type: 'formulaire' }
  | { type: 'envoye' }

const ETATS_NON_VALIDES: EtatNonValide[] = ['lien_invalide', 'lien_expire', 'deja_envoye', 'deja_renouvele']

function etatNonValide(valeur: unknown): EtatNonValide {
  return ETATS_NON_VALIDES.includes(valeur as EtatNonValide) ? (valeur as EtatNonValide) : 'lien_invalide'
}

async function appelerFonction(nom: string, corps: unknown): Promise<{ status: number; body: Record<string, unknown> | null }> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/${nom}`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(corps),
    })
    let body: Record<string, unknown> | null = null
    try {
      body = (await response.json()) as Record<string, unknown>
    } catch {
      body = null
    }
    return { status: response.status, body }
  } catch {
    return { status: 0, body: null }
  }
}

/** Page publique de renouvellement par lien personnel : /adhesion/<slug>/renouveler#<secret>. */
export default function RenouvellementAdhesionPage() {
  const { slug } = useParams<{ slug: string }>()
  // Le secret ne quitte jamais le navigateur : seule son empreinte est envoyée.
  const [secretHash] = useState(() => {
    const secret = extraireSecretRenouvellement(window.location.hash)
    return secret ? empreinteSecretRenouvellement(secret) : null
  })

  const [page, setPage] = useState<EtatPage>({ type: 'chargement' })
  const [organisation, setOrganisation] = useState<OrganisationRenouvellement | null>(null)
  const [prenomAccueil, setPrenomAccueil] = useState('')
  const [valeurs, setValeurs] = useState<ChampsAdhesionValeurs | null>(null)
  const [accepteStatuts, setAccepteStatuts] = useState(false)
  const [consentRgpd, setConsentRgpd] = useState(false)
  const [signature, setSignature] = useState<string | null>(null)
  // Champ piège anti-spam, comme le formulaire d'adhésion.
  const [siteWeb, setSiteWeb] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Page personnelle : jamais indexée.
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => {
      meta.remove()
    }
  }, [])

  useEffect(() => {
    if (!slug || !secretHash) {
      setPage({ type: 'etat', etat: 'lien_invalide', dateFin: null })
      return
    }
    let annule = false
    void (async () => {
      const { status, body } = await appelerFonction('lire-renouvellement-adhesion', { secret_hash: secretHash, slug })
      if (annule) return
      if (status === 429) {
        setPage({ type: 'erreur', message: 'Trop de tentatives depuis cette connexion. Merci de réessayer dans quelques minutes.' })
        return
      }
      if (status === 404) {
        setPage({ type: 'etat', etat: 'lien_invalide', dateFin: null })
        return
      }
      if (status !== 200 || !body) {
        setPage({ type: 'erreur', message: 'Le service est momentanément indisponible. Merci de réessayer plus tard.' })
        return
      }
      setOrganisation((body.organisation as OrganisationRenouvellement | null) ?? null)
      if (body.etat === 'valide' && body.adherent) {
        const adherent = body.adherent as AdherentPrerempli
        setPrenomAccueil(adherent.prenom ?? '')
        setValeurs(valeursPreremplies(adherent))
        setPage({ type: 'formulaire' })
        return
      }
      setPage({ type: 'etat', etat: etatNonValide(body.etat), dateFin: typeof body.date_fin === 'string' ? body.date_fin : null })
    })()
    return () => {
      annule = true
    }
  }, [slug, secretHash])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    if (siteWeb || !valeurs || !organisation || !secretHash) return
    if (!signature) {
      setSubmitError('Merci de signer avant de valider la demande.')
      return
    }
    if (valeurs.courriel.trim() !== '' && !isValidEmail(valeurs.courriel)) {
      setSubmitError("Le format de l'adresse email est invalide.")
      return
    }
    if (valeurs.codePostal.length !== 5) {
      setSubmitError('Le code postal doit contenir 5 chiffres.')
      return
    }

    setSubmitting(true)
    const { status, body } = await appelerFonction('soumettre-renouvellement-adhesion', {
      slug,
      secret_hash: secretHash,
      site_url: getCanonicalSiteUrl(),
      site_web: siteWeb,
      ...champsAdhesionPayload({ ...valeurs, dateNaissance: '' }),
      signature_data_url: signature,
      accepte_statuts: organisation.statuts_url ? accepteStatuts : true,
      consent_rgpd: consentRgpd,
    })
    setSubmitting(false)

    if (status === 200) {
      setPage({ type: 'envoye' })
      return
    }
    if (status === 409 || status === 404) {
      setPage({ type: 'etat', etat: etatNonValide(body?.etat), dateFin: typeof body?.date_fin === 'string' ? body.date_fin : null })
      return
    }
    setSubmitError(
      status === 429
        ? 'Trop de tentatives depuis cette connexion. Merci de réessayer dans une heure.'
        : "Une erreur est survenue lors de l'envoi de votre demande. Merci de vérifier vos informations et de réessayer.",
    )
  }

  const placeholderValues: Record<string, string> = { organisation_nom: organisation?.nom ?? '' }
  for (const asset of organisation?.assets ?? []) {
    placeholderValues[`asset_${asset.identifiant}`] = asset.url
  }
  const enTete = organisation?.formulaire_adhesion_header_html ? (
    <ShadowHtmlBlock
      className="mb-6"
      html={substituteFormulaireAdhesionPlaceholders(organisation.formulaire_adhesion_header_html, placeholderValues)}
      css={organisation.formulaire_adhesion_css ?? ''}
    />
  ) : null
  const piedDePage = organisation?.formulaire_adhesion_footer_html ? (
    <ShadowHtmlBlock
      className="mt-6"
      html={substituteFormulaireAdhesionPlaceholders(organisation.formulaire_adhesion_footer_html, placeholderValues)}
      css={organisation.formulaire_adhesion_css ?? ''}
    />
  ) : null

  if (page.type === 'chargement') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper font-registre text-sm text-ink-faint">
        Chargement…
      </div>
    )
  }

  if (page.type !== 'formulaire' || !valeurs || !organisation) {
    const nomOrganisation = organisation?.nom ?? "l'association"
    let titre: string
    let message: ReactNode
    if (page.type === 'erreur') {
      titre = 'Page indisponible'
      message = page.message
    } else if (page.type === 'envoye') {
      titre = 'Demande de renouvellement envoyée'
      message = `Votre demande de renouvellement d'adhésion à ${nomOrganisation} a bien été enregistrée. Elle sera examinée par le conseil d'administration.`
    } else if (page.type === 'etat' && page.etat === 'deja_envoye') {
      titre = 'Demande déjà envoyée'
      message = `Votre demande de renouvellement d'adhésion à ${nomOrganisation} a déjà été envoyée. Elle sera examinée par le conseil d'administration.`
    } else if (page.type === 'etat' && page.etat === 'deja_renouvele') {
      const dateFin = formatDateFinAdhesion(page.dateFin)
      titre = 'Adhésion déjà renouvelée'
      message = dateFin
        ? `Votre adhésion à ${nomOrganisation} est à jour jusqu'au ${dateFin}.`
        : `Votre adhésion à ${nomOrganisation} est à jour.`
    } else if (page.type === 'etat' && page.etat === 'lien_expire') {
      titre = 'Lien expiré'
      message = `Ce lien de renouvellement a expiré. Pour renouveler votre adhésion, contactez ${nomOrganisation}.`
    } else {
      titre = 'Lien non valide'
      message = `Ce lien de renouvellement n'est pas valide ou a déjà été utilisé. Pour renouveler votre adhésion, contactez ${nomOrganisation}.`
    }
    return (
      <div className="min-h-dvh bg-paper px-4 py-10 font-registre">
        <div className="mx-auto max-w-xl">
          {enTete}
          <div className="rounded-sm border border-paper-border bg-white p-6 text-center">
            <h1 className="text-lg font-semibold text-ink">{titre}</h1>
            <p className="mt-2 text-sm text-ink-faint">{message}</p>
          </div>
          {piedDePage}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-paper px-4 py-10 font-registre">
      <div className="mx-auto max-w-xl">
        {enTete ?? (
          <div className="mb-6 text-center">
            <p className="text-sm text-ink-muted">{organisation.nom}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 rounded-sm border border-paper-border bg-white p-6">
          <div>
            <h1 className="text-xl font-bold text-ink">
              {prenomAccueil ? `Bonjour ${prenomAccueil},` : 'Bonjour,'}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              Renouvelez votre adhésion à {organisation.nom}. Vos informations sont préremplies : vérifiez-les et
              modifiez-les si besoin.
            </p>
          </div>

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

          <ChampsAdhesion
            valeurs={valeurs}
            onChange={(patch) => setValeurs((v) => (v ? { ...v, ...patch } : v))}
            avecDateNaissance={false}
          />

          <ConsentementsAdhesion
            statutsUrl={organisation.statuts_url}
            accepteStatuts={accepteStatuts}
            consentRgpd={consentRgpd}
            onAccepteStatutsChange={setAccepteStatuts}
            onConsentRgpdChange={setConsentRgpd}
            objet="ma demande de renouvellement d'adhésion"
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
            {submitting ? 'Envoi…' : 'Envoyer ma demande de renouvellement'}
          </Button>
        </form>

        {piedDePage}
      </div>
    </div>
  )
}
