import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/button'

export default function BenevoleLoginPage() {
  const { loginBenevole } = useAuth()
  const navigate = useNavigate()

  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: loginError } = await loginBenevole(pin)
    setLoading(false)
    if (loginError) {
      setError(loginError)
    } else {
      navigate('/benevole', { replace: true })
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-paper px-4 py-12 font-registre">
      <div className="w-full max-w-sm">
        {/* Back link */}
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-1 text-sm text-ink-faint hover:text-ink-muted"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Retour
        </Link>

        <div className="rounded-sm border border-paper-border bg-white p-8">
          {/* Header */}
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-sm bg-stamp text-white">
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
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-ink">Espace Bénévole</h1>
          <p className="mt-1 text-sm text-ink-muted">Saisissez votre code PIN pour accéder</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="text-center">
              <label htmlFor="pin" className="sr-only">
                Code PIN
              </label>
              <input
                id="pin"
                type="text"
                inputMode="numeric"
                maxLength={10}
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="block w-full rounded-sm border border-paper-border bg-paper px-4 py-4 text-center font-registre-mono text-3xl font-bold tracking-[0.5em] text-ink focus:border-stamp focus:outline-none focus:ring-2 focus:ring-stamp/70"
                placeholder="••••••"
              />
            </div>

            {error && (
              <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading || pin.length === 0} className="mt-2 w-full">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Vérification…
                </span>
              ) : (
                'Accéder'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
