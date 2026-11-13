import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import RecetteBanner from '../components/RecetteBanner'
import SiteHeader from '../components/site/SiteHeader'
import SiteFooter from '../components/site/SiteFooter'
import IconeCoche from '../components/site/IconeCoche'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import ChampEmail from '../components/ChampEmail'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { getCanonicalSiteUrl } from '../lib/environment'
import { cn } from '../lib/utils'
import { CGU_PUBLIEES } from '../../supabase/functions/_shared/cgu.ts'
import {
  CHAMP_PIEGE,
  corpsDemandeInscription,
  erreursInscription,
  LIEN_INSCRIPTION as LIEN,
  LONGUEURS_INSCRIPTION,
  ORDRE_CHAMPS_INSCRIPTION,
  SAISIE_VIDE,
  type ChampInscription,
  type SaisieInscription,
} from '../lib/inscription'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const ID_CHAMP: Record<ChampInscription, string> = {
  nom_association: 'inscription-association',
  ville: 'inscription-ville',
  rna: 'inscription-rna',
  siren: 'inscription-siren',
  prenom: 'inscription-prenom',
  nom: 'inscription-nom',
  email: 'inscription-email',
  message: 'inscription-message',
  cgu: 'inscription-cgu',
}

const ETAPES = [
  { titre: 'Ta demande', texte: 'Deux minutes pour présenter ton association, puis tu confirmes ton adresse email.' },
  { titre: 'On vérifie, sous 48 h', texte: 'Un membre de l’équipe Samakan examine chaque demande.' },
  { titre: 'Ton invitation', texte: 'Tu reçois un email pour choisir ton mot de passe et entrer dans ton espace.' },
]

/** Écran « Demande reçue » : l'adresse reste à confirmer avant que la demande soit transmise. */
const ETAPES_ENVOI = [
  { titre: 'Ta demande', texte: 'Envoyée.' },
  { titre: 'Confirme ton adresse', texte: 'Clique sur le lien reçu par email, valable 48 h.' },
  { titre: 'On vérifie, sous 48 h', texte: 'Un membre de l’équipe Samakan examine ta demande.' },
  { titre: 'Ton invitation', texte: 'Tu reçois un email pour choisir ton mot de passe.' },
]

function Champ({
  champ,
  label,
  facultatif,
  aide,
  erreur,
  children,
  className,
}: {
  champ: ChampInscription
  label: string
  facultatif?: boolean
  aide?: ReactNode
  erreur?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={ID_CHAMP[champ]} className="text-ink">
        {label}
        {facultatif ? <span className="font-normal text-ink-faint"> (facultatif)</span> : <span className="text-stamp" aria-hidden="true"> *</span>}
      </Label>
      {children}
      {erreur ? (
        <p id={`${ID_CHAMP[champ]}-erreur`} className="font-registre-mono text-[11px] text-stamp">{erreur}</p>
      ) : aide ? (
        <p id={`${ID_CHAMP[champ]}-aide`} className="text-xs text-ink-faint">{aide}</p>
      ) : null}
    </div>
  )
}

export default function InscriptionPage() {
  const [saisie, setSaisie] = useState<SaisieInscription>(SAISIE_VIDE)
  const [touches, setTouches] = useState<Partial<Record<ChampInscription, boolean>>>({})
  const [piege, setPiege] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreurEnvoi, setErreurEnvoi] = useState<string | null>(null)
  const [emailEnvoye, setEmailEnvoye] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const titreFinRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    if (emailEnvoye) titreFinRef.current?.focus()
  }, [emailEnvoye])

  const erreurs = erreursInscription(saisie, CGU_PUBLIEES)
  const erreurAffichee = (champ: ChampInscription) => (touches[champ] ? erreurs[champ] : undefined)

  function maj<K extends keyof SaisieInscription>(cle: K, valeur: SaisieInscription[K], champ: ChampInscription) {
    setSaisie((s) => ({ ...s, [cle]: valeur }))
    setTouches((t) => ({ ...t, [champ]: true }))
    setErreurEnvoi(null)
  }

  function focaliser(champ: ChampInscription) {
    const el = formRef.current?.querySelector<HTMLElement>(`#${ID_CHAMP[champ]}`)
    el?.focus()
  }

  function aria(champ: ChampInscription, avecAide = false) {
    const erreur = erreurAffichee(champ)
    return {
      id: ID_CHAMP[champ],
      'aria-invalid': erreur ? true : undefined,
      'aria-describedby': erreur ? `${ID_CHAMP[champ]}-erreur` : avecAide ? `${ID_CHAMP[champ]}-aide` : undefined,
      className: cn(erreur && 'border-stamp'),
    }
  }

  async function envoyer(e: FormEvent) {
    e.preventDefault()
    const corps = corpsDemandeInscription(saisie, CGU_PUBLIEES, getCanonicalSiteUrl(), piege)
    if (!corps) {
      setTouches(Object.fromEntries(ORDRE_CHAMPS_INSCRIPTION.map((c) => [c, true])))
      const premier = ORDRE_CHAMPS_INSCRIPTION.find((c) => erreurs[c])
      if (premier) focaliser(premier)
      return
    }
    setEnvoi(true)
    setErreurEnvoi(null)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/soumettre-demande-inscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify(corps),
      })
      if (res.ok) {
        setEmailEnvoye(saisie.email.trim().toLowerCase())
        window.scrollTo(0, 0)
      } else if (res.status === 429) {
        setErreurEnvoi('Trop de demandes en ce moment. Réessaie dans une heure.')
      } else {
        setErreurEnvoi('Ta demande n’a pas pu être envoyée. Vérifie les champs, puis réessaie dans un instant.')
      }
    } catch {
      setErreurEnvoi('Connexion impossible. Vérifie ton réseau, puis réessaie.')
    } finally {
      setEnvoi(false)
    }
  }

  function corrigerEmail() {
    setEmailEnvoye(null)
    // Le formulaire réapparaît prérempli ; focus sur l'email une fois rendu.
    requestAnimationFrame(() => focaliser('email'))
  }

  return (
    <div className="flex min-h-dvh flex-col bg-paper font-registre text-ink selection:bg-stamp/15">
      <RecetteBanner />
      <SiteHeader className="border-b border-paper-border bg-white" />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pb-24 sm:pt-14">
        {emailEnvoye ? (
          // Le focus passe sur le titre (annonce) : pas d'aria-live en plus, sinon double annonce.
          <section className="mx-auto max-w-xl rounded-sm border border-paper-border bg-white p-6 sm:p-10">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-success-border bg-success-tint text-success">
              <IconeCoche />
            </div>
            <h1 ref={titreFinRef} tabIndex={-1} className="mt-5 text-2xl font-bold tracking-tight text-ink focus:outline-none sm:text-3xl">
              Demande reçue ! Vérifie ta boîte mail.
            </h1>
            <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-muted">
              Clique sur le lien envoyé à <span className="break-all font-medium text-ink">{emailEnvoye}</span> pour confirmer ta demande : on ne la reçoit qu’après ce clic.{' '}
              <button type="button" onClick={corrigerEmail} className={LIEN}>
                Ce n’est pas la bonne ?
              </button>
            </p>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted">
              Rien reçu d’ici quelques minutes ? Regarde dans tes courriers indésirables (spams).
            </p>
            <ol className="mt-6 space-y-3 border-t border-paper-border pt-6">
              {ETAPES_ENVOI.map((etape, i) => (
                <li key={etape.titre} className="flex gap-3 text-sm" aria-current={i === 1 ? 'step' : undefined}>
                  <span
                    className={cn(
                      'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full font-registre-mono text-xs',
                      i === 0 && 'bg-success-tint text-success',
                      i === 1 && 'border border-ink font-medium text-ink',
                      i > 1 && 'border border-paper-border text-ink-faint',
                    )}
                  >
                    {i === 0 ? <IconeCoche className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className="text-ink-muted">
                    <span className="font-medium text-ink">{etape.titre}</span> — {etape.texte}
                  </span>
                </li>
              ))}
            </ol>
            <Link to="/" className={cn(LIEN, 'mt-8 inline-block text-sm')}>
              Retour à l’accueil
            </Link>
          </section>
        ) : (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16">
            {/* Présentation : la validation comme une garantie, les 3 étapes, la réassurance */}
            <div className="lg:pt-4">
              <h1 className="text-balance text-[2rem] font-bold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[2.75rem]">
                Demande ton espace Samakan
              </h1>
              <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-ink-muted sm:text-lg">
                On vérifie chaque association avant d’ouvrir son espace{'\u00a0'}: c’est ce qui garantit des reçus fiscaux fiables.
              </p>

              <ol className="mt-6 space-y-3 sm:mt-8 sm:space-y-5">
                {ETAPES.map((etape, i) => (
                  <li key={etape.titre} className="flex gap-4">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-paper-border bg-white font-registre-mono text-sm font-medium text-ink">
                      {i + 1}
                    </span>
                    <div className="pt-1">
                      <p className="font-semibold text-ink">{etape.titre}</p>
                      <p className="mt-0.5 hidden text-sm leading-relaxed text-ink-muted sm:block">{etape.texte}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <ul className="mt-8 flex flex-col gap-2 border-t border-paper-border pt-6 text-sm text-ink-muted sm:flex-row sm:gap-6">
                <li className="flex items-center gap-2">
                  <IconeCoche className="h-4 w-4 text-success" />
                  Gratuit, sans carte bancaire
                </li>
                <li className="flex items-center gap-2">
                  <IconeCoche className="h-4 w-4 text-success" />
                  Données hébergées en Europe
                </li>
              </ul>
            </div>

            {/* Formulaire */}
            <form ref={formRef} onSubmit={envoyer} noValidate className="rounded-sm border border-paper-border bg-white p-5 sm:p-8">
              <h2 className="text-lg font-semibold text-ink">Ton association</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Champ champ="nom_association" label="Nom de l’association" erreur={erreurAffichee('nom_association')} className="sm:col-span-2">
                  <Input
                    {...aria('nom_association')}
                    type="text"
                    autoComplete="organization"
                    maxLength={LONGUEURS_INSCRIPTION.nom_association.max}
                    value={saisie.nom_association}
                    onChange={(e) => maj('nom_association', e.target.value, 'nom_association')}
                    placeholder="Ex. Les Amis du Quartier"
                  />
                </Champ>
                <Champ champ="ville" label="Ville" erreur={erreurAffichee('ville')} className="sm:col-span-2">
                  <Input
                    {...aria('ville')}
                    type="text"
                    autoComplete="address-level2"
                    maxLength={LONGUEURS_INSCRIPTION.ville.max}
                    value={saisie.ville}
                    onChange={(e) => maj('ville', e.target.value, 'ville')}
                    placeholder="Ex. Lyon"
                  />
                </Champ>
                <Champ champ="rna" label="Numéro RNA" facultatif erreur={erreurAffichee('rna')}>
                  <Input
                    {...aria('rna')}
                    type="text"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    maxLength={14}
                    value={saisie.rna}
                    onChange={(e) => maj('rna', e.target.value, 'rna')}
                    placeholder="W751234567"
                    className={cn('font-registre-mono', erreurAffichee('rna') && 'border-stamp')}
                  />
                </Champ>
                <Champ champ="siren" label="SIREN" facultatif erreur={erreurAffichee('siren')}>
                  <Input
                    {...aria('siren')}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={11}
                    value={saisie.siren}
                    onChange={(e) => maj('siren', e.target.value.replace(/[^\d ]/g, ''), 'siren')}
                    placeholder="123456789"
                    className={cn('font-registre-mono', erreurAffichee('siren') && 'border-stamp')}
                  />
                </Champ>
                <p className="-mt-2 text-xs text-ink-faint sm:col-span-2">
                  RNA ou SIREN : facultatif — accélère la vérification, et sera nécessaire pour les reçus fiscaux.
                </p>
              </div>

              <h2 className="mt-8 border-t border-paper-border pt-6 text-lg font-semibold text-ink">Toi</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Champ champ="prenom" label="Prénom" erreur={erreurAffichee('prenom')}>
                  <Input
                    {...aria('prenom')}
                    type="text"
                    autoComplete="given-name"
                    maxLength={LONGUEURS_INSCRIPTION.prenom.max}
                    value={saisie.prenom}
                    onChange={(e) => maj('prenom', e.target.value, 'prenom')}
                  />
                </Champ>
                <Champ champ="nom" label="Nom" erreur={erreurAffichee('nom')}>
                  <Input
                    {...aria('nom')}
                    type="text"
                    autoComplete="family-name"
                    maxLength={LONGUEURS_INSCRIPTION.nom.max}
                    value={saisie.nom}
                    onChange={(e) => maj('nom', e.target.value, 'nom')}
                  />
                </Champ>
                <Champ
                  champ="email"
                  label="Adresse email"
                  erreur={erreurAffichee('email')}
                  aide="Tu y recevras un lien pour confirmer ta demande, puis ton invitation."
                  className="sm:col-span-2"
                >
                  <ChampEmail
                    {...aria('email', true)}
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={LONGUEURS_INSCRIPTION.email.max}
                    value={saisie.email}
                    onValueChange={(value) => maj('email', value, 'email')}
                    placeholder="prenom@exemple.fr"
                  />
                </Champ>
                <Champ champ="message" label="Un mot sur ton association" facultatif erreur={erreurAffichee('message')} className="sm:col-span-2">
                  <Textarea
                    {...aria('message')}
                    rows={3}
                    maxLength={LONGUEURS_INSCRIPTION.message.max}
                    value={saisie.message}
                    onChange={(e) => maj('message', e.target.value, 'message')}
                    placeholder="Ex. Association culturelle d’une centaine d’adhérents, on gère aujourd’hui les dons sur un tableur."
                  />
                </Champ>
              </div>

              {/* Champ piège : invisible pour un humain, rempli par les robots */}
              <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
                <label htmlFor="inscription-site-web">Site web</label>
                <input
                  id="inscription-site-web"
                  name={CHAMP_PIEGE}
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={piege}
                  onChange={(e) => setPiege(e.target.value)}
                />
              </div>

              <div className="mt-6 border-t border-paper-border pt-6">
                {CGU_PUBLIEES ? (
                  <div className="space-y-1.5">
                    <label className="flex items-start gap-2 text-sm text-ink">
                      <input
                        id={ID_CHAMP.cgu}
                        type="checkbox"
                        checked={saisie.cgu_acceptees}
                        onChange={(e) => maj('cgu_acceptees', e.target.checked, 'cgu')}
                        aria-invalid={erreurAffichee('cgu') ? true : undefined}
                        aria-describedby={erreurAffichee('cgu') ? `${ID_CHAMP.cgu}-erreur` : undefined}
                        className="mt-0.5 h-4 w-4 rounded-sm border-paper-border accent-stamp focus-visible:ring-2 focus-visible:ring-stamp/70"
                      />
                      <span>
                        J’accepte les{' '}
                        <Link to="/cgu" target="_blank" className={LIEN}>
                          conditions générales d’utilisation
                        </Link>
                      </span>
                    </label>
                    {erreurAffichee('cgu') && (
                      <p id={`${ID_CHAMP.cgu}-erreur`} className="font-registre-mono text-[11px] text-stamp">{erreurAffichee('cgu')}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs leading-relaxed text-ink-faint">
                    Ces informations servent à examiner ta demande et à te recontacter.{' '}
                    <Link to="/confidentialite" target="_blank" className={LIEN}>
                      En savoir plus sur tes données
                    </Link>
                  </p>
                )}

                {erreurEnvoi && (
                  <div role="alert" className="mt-4 rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">
                    {erreurEnvoi}
                  </div>
                )}

                <Button type="submit" disabled={envoi} className="mt-5 h-11 w-full border-stamp bg-stamp text-base font-semibold text-white hover:bg-stamp/90 sm:w-auto sm:px-6">
                  {envoi ? 'Envoi…' : 'Envoyer ma demande'}
                </Button>
              </div>
            </form>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  )
}
