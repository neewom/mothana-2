import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function ShieldIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-10 w-10"
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

function HeartIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-10 w-10"
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
  )
}

export default function HomePage() {
  const { auth } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (auth.type === 'admin') navigate('/admin/dons', { replace: true })
    else if (auth.type === 'benevole') navigate('/benevole', { replace: true })
  }, [auth.type, navigate])

  if (auth.type === 'loading' || auth.type === 'admin' || auth.type === 'benevole') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      {/* Header */}
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Mothana</h1>
        <p className="mt-2 text-slate-500">Gestion des dons et bénévoles</p>
      </div>

      {/* Cards */}
      <div className="flex w-full max-w-2xl flex-col gap-6 sm:flex-row">
        {/* Admin card */}
        <div className="flex flex-1 flex-col rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <ShieldIcon />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Espace Admin</h2>
          <p className="mt-2 flex-1 text-sm text-slate-500">
            Connexion avec votre adresse e-mail
          </p>
          <button
            onClick={() => navigate('/login/admin')}
            className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Se connecter
          </button>
        </div>

        {/* Benevole card */}
        <div className="flex flex-1 flex-col rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-xl bg-rose-500 text-white">
            <HeartIcon />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Espace Bénévole</h2>
          <p className="mt-2 flex-1 text-sm text-slate-500">
            Accès avec votre code PIN
          </p>
          <button
            onClick={() => navigate('/login/benevole')}
            className="mt-6 w-full rounded-lg bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2"
          >
            Accéder
          </button>
        </div>
      </div>
    </div>
  )
}
