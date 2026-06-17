import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Back link */}
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
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

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {/* Header */}
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500 text-white">
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
          <h1 className="text-xl font-semibold text-slate-900">Espace Bénévole</h1>
          <p className="mt-1 text-sm text-slate-500">Saisissez votre code PIN pour accéder</p>

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
                className="block w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-4 text-center text-3xl font-bold tracking-[0.5em] text-slate-900 shadow-sm focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
                placeholder="••••••"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || pin.length === 0}
              className="mt-2 w-full rounded-lg bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
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
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
