import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/button'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

function MailIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
      />
    </svg>
  )
}

// Désinscription des campagnes mailing (lien des emails envoyés par send-mailing-brevo). Rien
// n'est modifié à l'ouverture du lien — une requête automatique (antivirus, aperçu de messagerie)
// ne doit pas désinscrire la personne : l'appel à unsubscribe-mailing n'a lieu qu'au clic sur
// « Confirmer ma désinscription ». Réponse toujours générique (rien sur la validité du lien).
type Etat = 'confirmation' | 'envoi' | 'fait' | 'lien_incomplet'

export default function DesinscriptionMailingPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [etat, setEtat] = useState<Etat>(token ? 'confirmation' : 'lien_incomplet')

  async function confirmer() {
    if (!token) return
    setEtat('envoi')
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/unsubscribe-mailing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ token }),
      })
    } catch {
      // Réponse toujours générique côté page — pas d'état d'erreur distinct à afficher
    }
    setEtat('fait')
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-paper px-4 py-12 font-registre">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-ink">Samakan</h1>
        </div>

        <div className="rounded-sm border border-paper-border bg-white p-8 text-center">
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-sm bg-stamp text-white">
            <MailIcon />
          </div>
          {etat === 'fait' ? (
            <>
              <h2 className="text-xl font-semibold text-ink">Désinscription prise en compte</h2>
              <p className="mt-2 text-sm text-ink-muted">
                Si ce lien est valide, vous ne recevrez plus d'emails de campagnes d'information de la part de cette association. Cela n'affecte pas les emails liés à votre compte ou à votre adhésion.
              </p>
            </>
          ) : etat === 'lien_incomplet' ? (
            <>
              <h2 className="text-xl font-semibold text-ink">Lien incomplet</h2>
              <p className="mt-2 text-sm text-ink-muted">
                Ce lien de désinscription est incomplet. Utilisez le lien « se désinscrire » figurant en bas d'un email de campagne.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-ink">Se désinscrire des campagnes</h2>
              <p className="mt-2 text-sm text-ink-muted">
                Vous ne recevrez plus d'emails de campagnes d'information de la part de cette association. Cela n'affecte pas les emails liés à votre compte ou à votre adhésion.
              </p>
              <Button type="button" className="mt-6 w-full" disabled={etat === 'envoi'} onClick={() => void confirmer()}>
                {etat === 'envoi' ? 'Désinscription…' : 'Confirmer ma désinscription'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
