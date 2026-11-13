import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import RecetteBanner from '../components/RecetteBanner'
import SiteHeader from '../components/site/SiteHeader'
import SiteFooter from '../components/site/SiteFooter'
import IconeCoche from '../components/site/IconeCoche'
import { Button } from '../components/ui/button'
import { getCanonicalSiteUrl } from '../lib/environment'
import { cn } from '../lib/utils'
import { etatConfirmation, LIEN_INSCRIPTION as LIEN, type EtatConfirmation } from '../lib/inscription'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const BOUTON_PRINCIPAL = 'h-11 w-full border-stamp bg-stamp text-base font-semibold text-white hover:bg-stamp/90 sm:w-auto sm:px-6'

/** Textes des états finaux. `refaire` : lien vers /inscription pour refaire la demande. */
const TEXTES: Record<Exclude<EtatConfirmation, 'erreur' | 'trop_d_essais'>, { titre: string; texte: string; succes: boolean; refaire: boolean }> = {
  confirmee: {
    titre: 'Adresse confirmée, ta demande est transmise',
    texte: 'On vérifie ton association sous 48 h. Tu recevras un email quand ton espace sera prêt, pour choisir ton mot de passe.',
    succes: true,
    refaire: false,
  },
  // Page publique : ne rien dire du statut de la demande depuis (en attente, acceptée, refusée).
  deja_confirmee: {
    titre: 'Cette adresse est déjà confirmée',
    texte: 'Pas besoin de cliquer à nouveau.',
    succes: true,
    refaire: false,
  },
  expiree: {
    titre: 'Ce lien a expiré',
    texte: 'Le lien de confirmation n’est valable que 48 h. Refais ta demande : tu recevras un nouveau lien.',
    succes: false,
    refaire: true,
  },
  invalide: {
    titre: 'Ce lien n’est pas valable',
    texte: 'Il est incomplet ou a été remplacé par un lien plus récent. Utilise le dernier email reçu, ou refais ta demande.',
    succes: false,
    refaire: true,
  },
}

export default function InscriptionConfirmerPage() {
  const [params] = useSearchParams()
  // Jeton lu une fois, puis retiré de l'URL pour qu'il ne reste pas dans l'historique.
  const [jeton] = useState(() => params.get('jeton')?.trim() ?? '')
  // Pas de confirmation automatique au chargement : les anti-virus de messagerie ouvrent les liens
  // tout seuls. La demande n'est confirmée qu'au clic sur le bouton.
  const [etat, setEtat] = useState<EtatConfirmation | null>(jeton ? null : 'invalide')
  const [envoi, setEnvoi] = useState(false)
  const titreRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    if (new URLSearchParams(window.location.search).has('jeton')) {
      window.history.replaceState(window.history.state, '', window.location.pathname)
    }
  }, [])

  useEffect(() => {
    if (etat && etat !== 'erreur' && etat !== 'trop_d_essais') titreRef.current?.focus()
  }, [etat])

  async function confirmer() {
    setEnvoi(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/confirmer-demande-inscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ jeton, site_url: getCanonicalSiteUrl() }),
      })
      setEtat(etatConfirmation(res.status, await res.json().catch(() => null)))
    } catch {
      setEtat('erreur')
    } finally {
      setEnvoi(false)
    }
  }

  const final = etat && etat !== 'erreur' && etat !== 'trop_d_essais' ? TEXTES[etat] : null

  return (
    <div className="flex min-h-dvh flex-col bg-paper font-registre text-ink selection:bg-stamp/15">
      <RecetteBanner />
      <SiteHeader className="border-b border-paper-border bg-white" />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pb-24 sm:pt-14">
        {/* Annonce du résultat : le focus passe sur le titre (pas d'aria-live en plus, sinon double annonce) ; les erreurs ont role="alert". */}
        <section className="mx-auto max-w-xl rounded-sm border border-paper-border bg-white p-6 sm:p-10">
          {final ? (
            <>
              {final.succes && (
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full border border-success-border bg-success-tint text-success">
                  <IconeCoche />
                </div>
              )}
              <h1 ref={titreRef} tabIndex={-1} className="text-2xl font-bold tracking-tight text-ink focus:outline-none sm:text-3xl">
                {final.titre}
              </h1>
              <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-muted">{final.texte}</p>
              {etat === 'confirmee' && (
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted">
                  Pense à vérifier tes courriers indésirables (spams) : nos emails y arrivent parfois.
                </p>
              )}
              {final.refaire ? (
                <Button asChild className={cn(BOUTON_PRINCIPAL, 'mt-8')}>
                  <Link to="/inscription">Refaire ma demande</Link>
                </Button>
              ) : (
                <Link to="/" className={cn(LIEN, 'mt-8 inline-block text-sm')}>
                  Retour à l’accueil
                </Link>
              )}
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Confirme ta demande d’espace</h1>
              <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-muted">
                Un dernier clic pour confirmer ton adresse email : ta demande nous est alors transmise, et on vérifie ton association sous 48 h.
              </p>
              {etat === 'erreur' && (
                <div role="alert" className="mt-6 rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">
                  La confirmation n’a pas pu aboutir. Vérifie ta connexion, puis réessaie dans un instant.
                </div>
              )}
              {etat === 'trop_d_essais' && (
                <div role="alert" className="mt-6 rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">
                  Trop d’essais en ce moment. Réessaie dans une heure.
                </div>
              )}
              <Button type="button" onClick={confirmer} disabled={envoi} aria-busy={envoi || undefined} className={cn(BOUTON_PRINCIPAL, 'mt-8')}>
                {envoi ? 'Confirmation…' : 'Confirmer ma demande'}
              </Button>
            </>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
