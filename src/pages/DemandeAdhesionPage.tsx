import { useState, useEffect, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { CiviliteAdherent } from '../types'
import { CIVILITE_ADHERENT_OPTIONS } from '../lib/civiliteAdherent'
import SignaturePad from '../components/SignaturePad'
import ShadowHtmlBlock from '../components/ShadowHtmlBlock'
import { substituteFormulaireAdhesionPlaceholders } from '../lib/formulaireAdhesionPreview'

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
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-400">
        Chargement…
      </div>
    )
  }

  if (notFound || !organisation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Formulaire introuvable</h1>
          <p className="mt-2 text-sm text-slate-500">Ce lien n'est pas valide ou n'existe plus.</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Demande envoyée</h1>
          <p className="mt-2 text-sm text-slate-500">
            Votre demande d'adhésion à {organisation.nom} a bien été enregistrée. Elle sera examinée par le conseil
            d'administration.
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
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-xl">
        {organisation.formulaire_adhesion_header_html ? (
          <ShadowHtmlBlock
            className="mb-6"
            html={substituteFormulaireAdhesionPlaceholders(organisation.formulaire_adhesion_header_html, placeholderValues)}
            css={organisation.formulaire_adhesion_css ?? ''}
          />
        ) : (
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-slate-900">Demande d'adhésion</h1>
            <p className="mt-1 text-sm text-slate-500">{organisation.nom}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {submitError && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>}

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
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Civilité <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={civilite === 0 ? '' : civilite}
              onChange={(e) => setCivilite(e.target.value ? (Number(e.target.value) as CiviliteAdherent) : 0)}
              className="select-field w-full rounded-lg border border-slate-300 py-2 pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="" disabled>Sélectionner…</option>
              {CIVILITE_ADHERENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Dupont"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Prénom <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              placeholder="Jean"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Date de naissance <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={dateNaissance}
              onChange={(e) => setDateNaissance(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Adresse <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              placeholder="12 rue des Lilas"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Code postal <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={codePostal}
                onChange={(e) => setCodePostal(e.target.value)}
                placeholder="75000"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Ville <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={ville}
                onChange={(e) => setVille(e.target.value)}
                placeholder="Paris"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Téléphone</label>
            <input
              type="text"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder="06 00 00 00 00"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Courriel</label>
            <input
              type="email"
              value={courriel}
              onChange={(e) => setCourriel(e.target.value)}
              placeholder="jean.dupont@exemple.fr"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="border-t border-slate-200 pt-4">
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                required
                checked={accepteStatuts}
                onChange={(e) => setAccepteStatuts(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                J'ai pris connaissance{' '}
                {organisation.statuts_url ? (
                  <a
                    href={organisation.statuts_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-indigo-600 hover:underline"
                  >
                    des statuts de l'association
                  </a>
                ) : (
                  "des statuts de l'association"
                )}{' '}
                et les approuve. <span className="text-red-500">*</span>
              </span>
            </label>

            <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                required
                checked={consentRgpd}
                onChange={(e) => setConsentRgpd(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                J'accepte que les informations saisies dans ce formulaire soient utilisées par l'association dans le
                cadre du traitement de ma demande d'adhésion. <span className="text-red-500">*</span>
              </span>
            </label>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Signature <span className="text-red-500">*</span>
            </label>
            <SignaturePad onChange={setSignature} />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? 'Envoi…' : 'Envoyer ma demande'}
          </button>
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
