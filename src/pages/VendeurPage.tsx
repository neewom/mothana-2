import { useNavigate } from 'react-router-dom'
import BenevoleEvenement from '../components/BenevoleEvenement'
import RecetteBanner from '../components/RecetteBanner'
import { Button } from '../components/ui/button'
import { useAuth } from '../hooks/useAuth'

export default function VendeurPage() {
  const { auth, logout } = useAuth()
  const navigate = useNavigate()
  const organisationId = auth.type === 'vendeur' ? auth.organisationId : ''

  async function handleLogout() {
    await logout()
    navigate('/login/vendeur', { replace: true })
  }

  return (
    <div className="flex min-h-dvh flex-col bg-paper font-registre">
      <RecetteBanner />
      <header className="border-b border-paper-border bg-white px-4">
        <div className="flex h-14 items-center justify-between">
          <span className="text-base font-bold tracking-tight text-ink">Samakan</span>
          <Button variant="secondary" size="sm" onClick={handleLogout}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            Quitter
          </Button>
        </div>
        <div className="pb-2 text-xs font-medium text-ink-faint">Espace vendeur — Paiement événement</div>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          <BenevoleEvenement organisationId={organisationId} />
        </div>
      </main>
    </div>
  )
}
