import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import RecetteBanner from '../components/RecetteBanner'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

function ShieldIcon() {
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
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
      />
    </svg>
  )
}

export default function HomePage() {
  const { auth, loginAdmin } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSending, setForgotSending] = useState(false)
  const [forgotMessage, setForgotMessage] = useState<string | null>(null)

  useEffect(() => {
    if (auth.type === 'super_admin') navigate('/super-admin', { replace: true })
    else if (auth.type === 'admin') navigate('/admin', { replace: true })
    else if (auth.type === 'benevole') navigate('/benevole', { replace: true })
  }, [auth.type, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: loginError, authType } = await loginAdmin(email, password)
    setLoading(false)
    if (loginError) {
      setError(loginError)
    } else {
      navigate(authType === 'super_admin' ? '/super-admin' : '/admin', { replace: true })
    }
  }

  async function handleForgotSubmit(e: FormEvent) {
    e.preventDefault()
    setForgotSending(true)
    setForgotMessage(null)

    const res = await fetch(`${SUPABASE_URL}/functions/v1/request-password-reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ email: forgotEmail, site_url: window.location.origin }),
    })
    const json = await res.json().catch(() => ({}))
    setForgotSending(false)
    setForgotMessage(json.message ?? "Si un compte existe pour cette adresse, un email de réinitialisation a été envoyé.")
  }

  function backToLogin() {
    setMode('login')
    setForgotEmail('')
    setForgotMessage(null)
  }

  if (auth.type === 'loading' || auth.type === 'super_admin' || auth.type === 'admin' || auth.type === 'benevole') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-stamp border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col bg-paper font-registre">
      <RecetteBanner />
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-ink">Samakan</h1>
          <p className="mt-1 text-sm text-ink-muted">Gestion des dons et bénévoles</p>
        </div>

        <div className="rounded-sm border border-paper-border bg-white p-8">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-sm bg-stamp text-white">
            <ShieldIcon />
          </div>
          {mode === 'login' ? (
            <>
              <h2 className="text-xl font-semibold text-ink">Connexion Admin</h2>
              <p className="mt-1 text-sm text-ink-muted">Accès au tableau de bord</p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <Label htmlFor="email">Adresse e-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1"
                    placeholder="admin@exemple.com"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Mot de passe</Label>
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-xs font-medium text-stamp hover:underline"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1"
                    placeholder="••••••••"
                  />
                </div>

                {error && (
                  <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">
                    {error}
                  </div>
                )}

                <Button type="submit" disabled={loading} className="mt-2 w-full">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Connexion…
                    </span>
                  ) : (
                    'Se connecter'
                  )}
                </Button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-ink">Mot de passe oublié</h2>
              <p className="mt-1 text-sm text-ink-muted">Recevez un lien pour réinitialiser votre mot de passe.</p>

              {forgotMessage ? (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center gap-2 rounded-sm border border-success-border bg-success-tint px-4 py-3 text-sm text-success">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {forgotMessage}
                  </div>
                  <button
                    type="button"
                    onClick={backToLogin}
                    className="text-sm font-medium text-stamp hover:underline"
                  >
                    Retour à la connexion
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="mt-6 space-y-4">
                  <div>
                    <Label htmlFor="forgot-email">Adresse e-mail</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="mt-1"
                      placeholder="admin@exemple.com"
                    />
                  </div>

                  <Button type="submit" disabled={forgotSending} className="mt-2 w-full">
                    {forgotSending ? 'Envoi…' : 'Envoyer le lien'}
                  </Button>

                  <button
                    type="button"
                    onClick={backToLogin}
                    className="w-full text-center text-sm font-medium text-stamp hover:underline"
                  >
                    Retour à la connexion
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-ink-faint">
          Vous êtes bénévole ?{' '}
          <Link to="/login/benevole" className="font-medium text-stamp hover:underline">
            Accéder avec votre code PIN
          </Link>
        </p>
      </div>
      </div>
    </div>
  )
}
