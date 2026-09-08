import { Navigate, Outlet } from 'react-router-dom'
import type { FonctionnalitesActivees } from '../hooks/useFonctionnalitesActivees'
import { useAdminOutletContext } from '../hooks/useAdminOutletContext'

/** Redirige vers /admin si la fonctionnalité est désactivée pour l'organisation courante. */
export default function FeatureGuard({ feature }: { feature: keyof FonctionnalitesActivees }) {
  const { fonctionnalitesActivees } = useAdminOutletContext()

  if (fonctionnalitesActivees === null) return null
  if (!fonctionnalitesActivees[feature]) return <Navigate to="/admin" replace />

  return <Outlet context={{ fonctionnalitesActivees }} />
}
