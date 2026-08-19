import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

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

export default function DesinscriptionMailingPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'done'>(token ? 'loading' : 'done')

  useEffect(() => {
    if (!token) return

    let cancelled = false
    async function run() {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/unsubscribe-mailing`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ token }),
        })
      } catch {
        // Réponse toujours générique côté page — pas d'état d'erreur distinct à afficher
      }
      if (!cancelled) setStatus('done')
    }
    run()

    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Samakan</h1>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          {status === 'loading' ? (
            <div className="flex justify-center py-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            </div>
          ) : (
            <>
              <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white">
                <MailIcon />
              </div>
              <h2 className="text-xl font-semibold text-slate-900">Désinscription prise en compte</h2>
              <p className="mt-2 text-sm text-slate-600">
                Vous ne recevrez plus d'emails de campagnes d'information de la part de cette association. Cela n'affecte pas les emails liés à votre compte ou à votre adhésion.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
