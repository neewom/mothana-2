import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabaseClient'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'

const MIN_PASSWORD_LENGTH = 8

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

export default function ResetPasswordPage() {
  const { auth } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`)
      return
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSuccess(true)
    setTimeout(() => navigate('/admin', { replace: true }), 1500)
  }

  const content = (() => {
    if (auth.type === 'loading') {
      return (
        <div className="flex justify-center py-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-stamp border-t-transparent" />
        </div>
      )
    }

    if (auth.type !== 'admin' && auth.type !== 'super_admin') {
      return (
        <>
          <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">
            Ce lien est invalide ou a expiré. Demandez un nouveau lien ou contactez votre administrateur.
          </div>
          <Link
            to="/"
            className="mt-4 inline-block text-sm font-medium text-stamp hover:underline"
          >
            Retour à la connexion
          </Link>
        </>
      )
    }

    if (success) {
      return (
        <div className="flex items-center gap-2 rounded-sm border border-success-border bg-success-tint px-4 py-3 text-sm text-success">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Mot de passe défini — redirection en cours…
        </div>
      )
    }

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="password">Nouveau mot de passe</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1"
            placeholder="••••••••"
          />
        </div>

        <div>
          <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
              Enregistrement…
            </span>
          ) : (
            'Définir le mot de passe'
          )}
        </Button>
      </form>
    )
  })()

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-paper px-4 py-12 font-registre">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-ink">Samakan</h1>
          <p className="mt-1 text-sm text-ink-muted">Gestion des dons et bénévoles</p>
        </div>

        <div className="rounded-sm border border-paper-border bg-white p-8">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-sm bg-stamp text-white">
            <ShieldIcon />
          </div>
          <h2 className="text-xl font-semibold text-ink">Définir votre mot de passe</h2>
          <p className="mt-1 text-sm text-ink-muted">Choisissez un mot de passe pour accéder à votre espace admin.</p>

          <div className="mt-6">{content}</div>
        </div>
      </div>
    </div>
  )
}
