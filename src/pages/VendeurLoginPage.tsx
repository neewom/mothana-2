import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/button'

export default function VendeurLoginPage() {
  const { loginVendeur } = useAuth()
  const navigate = useNavigate()

  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: loginError } = await loginVendeur(pin)
    setLoading(false)
    if (loginError) {
      setError(loginError)
    } else {
      navigate('/vendeur', { replace: true })
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-paper px-4 py-12 font-registre">
      <div className="w-full max-w-sm">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-1 text-sm text-ink-faint hover:text-ink-muted"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Retour
        </Link>

        <div className="rounded-sm border border-paper-border bg-white p-8">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-sm bg-stamp text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h12A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 12h7.5M12 8.25v7.5" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-ink">Espace vendeur</h1>
          <p className="mt-1 text-sm text-ink-muted">Saisissez le code PIN vendeur de votre organisation</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="text-center">
              <label htmlFor="vendeur-pin" className="sr-only">Code PIN vendeur</label>
              <input
                id="vendeur-pin"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                pattern="[0-9]{6}"
                required
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="block w-full rounded-sm border border-paper-border bg-paper px-4 py-4 text-center font-registre-mono text-3xl font-bold tracking-[0.5em] text-ink focus:border-stamp focus:outline-none focus:ring-2 focus:ring-stamp/70"
                placeholder="••••••"
              />
            </div>

            {error && (
              <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading || pin.length !== 6} className="mt-2 w-full">
              {loading ? 'Vérification…' : 'Accéder à l’espace vendeur'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
