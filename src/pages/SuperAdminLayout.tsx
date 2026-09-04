import { useNavigate } from 'react-router-dom'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { User } from '@supabase/supabase-js'
import RecetteBanner from '../components/RecetteBanner'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'

export default function SuperAdminLayout() {
  const { auth, logout } = useAuth()
  const navigate = useNavigate()

  const user = auth.type === 'super_admin' ? (auth.user as User) : null

  async function handleLogout() {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-paper">
      <RecetteBanner />

      {/* Top bar */}
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-paper-border bg-white px-6 font-registre">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-tight text-ink">Samakan</span>
          <Badge variant="stamp">Super Admin</Badge>
        </div>
        <div className="flex items-center gap-4">
          {user?.email && (
            <span className="hidden text-sm text-ink-faint sm:block">{user.email}</span>
          )}
          <Button variant="secondary" size="sm" onClick={handleLogout}>
            Se déconnecter
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-6">
        <Outlet />
      </main>
    </div>
  )
}
