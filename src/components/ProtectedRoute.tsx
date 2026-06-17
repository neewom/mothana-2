import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface ProtectedRouteProps {
  allowedRoles: Array<'admin' | 'benevole'>
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { auth } = useAuth()

  if (auth.type === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  if (auth.type === 'unauthenticated') {
    return <Navigate to="/" replace />
  }

  if (!allowedRoles.includes(auth.type as 'admin' | 'benevole')) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
