import { useState, useEffect, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { CiviliteAdherent } from '../types'
import { CIVILITE_ADHERENT_OPTIONS } from '../lib/civiliteAdherent'
import SignaturePad from '../components/SignaturePad'
import ShadowHtmlBlock from '../components/ShadowHtmlBlock'
import { substituteFormulaireAdhesionPlaceholders } from '../lib/formulaireAdhesionPreview'
import { toUpperName, toCapitalizedName, isValidEmail, sanitizeDigits } from '../lib/textFormat'
import { COUNTRIES } from '../lib/countries'
import { maxDateNaissance, isAnneeNaissanceValide } from '../lib/dateNaissance'
import { cn } from '../lib/utils'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select } from '../components/ui/select'

interface OrganisationAssetPublic {
  identifiant: string
  url: string
}

interface OrganisationPublic {
  id: string
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

  const [civilite, setCivilite] = useState<CiviliteAdherent>(0)
  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [dateNaissance, setDateNaissance] = useState('')
  const [adresse, setAdresse] = useState('')
  const [codePostal, setCodePostal] = useState('')
  const [ville, setVille] = useState('')
  const [pays, setPays] = useState('France')
  const [telephone, setTelephone] = useState('')
  const [courriel, setCourriel] = useState('')
  const [accepteStatuts, setAccepteStatuts] = useState(false)
  const [consentRgpd, setConsentRgpd] = useState(false)
  const [signature, setSignature] = useState<string | null>(null)
  // Honeypot anti-spam : champ invisible pour un humain, souvent rempli par les bots
  const [siteWeb, setSiteWeb] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const courrielInvalid = courriel.length > 0 && !isValidEmail(courriel)
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

    const { error } = await supabase.from('demandes_adhesion').insert({
      organisation_id: organisation.id,
      civilite,
      nom,
      prenom: prenom || null,
      date_naissance: dateNaissance || null,
      adresse: adresse || null,
      code_postal: codePostal || null,
      ville: ville || null,
      pays: pays || null,
      telephone: telephone || null,
      courriel: courriel || null,
      signature_data_url: signature,
      accepte_statuts: accepteStatuts,
      consent_rgpd: consentRgpd,
    })

    if (error) {
      setSubmitError("Une erreur est survenue lors de l'envoi de votre demande. Merci de réessayer.")
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

          <div>
            <Label>
              Civilité <span className="text-stamp">*</span>
            </Label>
            <Select
              required
              value={civilite === 0 ? '' : civilite}
              onChange={(e) => setCivilite(e.target.value ? (Number(e.target.value) as CiviliteAdherent) : 0)}
              className="mt-1 w-full"
            >
              <option value="" disabled>Sélectionner…</option>
              {CIVILITE_ADHERENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="nom">
              Nom <span className="text-stamp">*</span>
            </Label>
            <Input
              id="nom"
              type="text"
              required
              value={nom}
              onChange={(e) => setNom(toUpperName(e.target.value))}
              placeholder="DUPONT"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="prenom">
              Prénom <span className="text-stamp">*</span>
            </Label>
            <Input
              id="prenom"
              type="text"
              required
              value={prenom}
              onChange={(e) => setPrenom(toCapitalizedName(e.target.value))}
              placeholder="Jean"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="date-naissance">
              Date de naissance <span className="text-stamp">*</span>
            </Label>
            <Input
              id="date-naissance"
              type="date"
              required
              value={dateNaissance}
              onChange={(e) => setDateNaissance(e.target.value)}
              aria-invalid={dateNaissanceInvalid}
              className={cn('mt-1', dateNaissanceInvalid && 'border-stamp focus-visible:ring-stamp/70')}
            />
            {dateNaissanceInvalid && (
              <p className="mt-1 text-xs text-stamp">
                L'année de naissance doit être {maxDateNaissance().slice(0, 4)} ou antérieure.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="adresse">
              Adresse <span className="text-stamp">*</span>
            </Label>
            <Input
              id="adresse"
              type="text"
              required
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              placeholder="12 rue des Lilas"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="code-postal">
                Code postal <span className="text-stamp">*</span>
              </Label>
              <Input
                id="code-postal"
                type="text"
                required
                inputMode="numeric"
                maxLength={5}
                value={codePostal}
                onChange={(e) => setCodePostal(sanitizeDigits(e.target.value))}
                placeholder="75000"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="ville">
                Ville <span className="text-stamp">*</span>
              </Label>
              <Input
                id="ville"
                type="text"
                required
                value={ville}
                onChange={(e) => setVille(e.target.value)}
                placeholder="Paris"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label>Pays</Label>
            <Select value={pays} onChange={(e) => setPays(e.target.value)} className="mt-1 w-full">
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="telephone">Téléphone</Label>
            <Input
              id="telephone"
              type="tel"
              inputMode="numeric"
              minLength={10}
              maxLength={25}
              value={telephone}
              onChange={(e) => setTelephone(sanitizeDigits(e.target.value))}
              placeholder="0600000000"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="courriel">Courriel</Label>
            <Input
              id="courriel"
              type="email"
              value={courriel}
              onChange={(e) => setCourriel(e.target.value)}
              placeholder="jean.dupont@exemple.fr"
              aria-invalid={courrielInvalid}
              className={cn('mt-1', courrielInvalid && 'border-stamp focus-visible:ring-stamp/70')}
            />
            {courrielInvalid && <p className="mt-1 text-xs text-stamp">Format d'email invalide.</p>}
          </div>

          <div className="border-t border-paper-border pt-4">
            <label className="flex items-start gap-2 text-sm text-ink-muted">
              <input
                type="checkbox"
                required
                checked={accepteStatuts}
                onChange={(e) => setAccepteStatuts(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded-sm border-paper-border text-stamp focus:ring-stamp/70"
              />
              <span>
                J'ai pris connaissance{' '}
                {organisation.statuts_url ? (
                  <a
                    href={organisation.statuts_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-stamp hover:underline"
                  >
                    des statuts de l'association
                  </a>
                ) : (
                  "des statuts de l'association"
                )}{' '}
                et les approuve. <span className="text-stamp">*</span>
              </span>
            </label>

            <label className="mt-3 flex items-start gap-2 text-sm text-ink-muted">
              <input
                type="checkbox"
                required
                checked={consentRgpd}
                onChange={(e) => setConsentRgpd(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded-sm border-paper-border text-stamp focus:ring-stamp/70"
              />
              <span>
                J'accepte que les informations saisies dans ce formulaire soient utilisées par l'association dans le
                cadre du traitement de ma demande d'adhésion. <span className="text-stamp">*</span>
              </span>
            </label>
          </div>

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
