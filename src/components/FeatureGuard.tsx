import { Navigate, Outlet } from 'react-router-dom'
import type { FonctionnalitesActivees } from '../hooks/useFonctionnalitesActivees'
import { useAdminOutletContext } from '../hooks/useAdminOutletContext'

/**
 * Redirige vers /admin si la fonctionnalité est désactivée pour l'organisation
 * courante. Un tableau de fonctionnalités est accepté pour une route accessible
 * dès qu'au moins une des fonctionnalités listées est active (logique OR) —
 * ex. Activités, utilisée par les dons et les adhérents.
 */
export default function FeatureGuard({ feature }: { feature: keyof FonctionnalitesActivees | (keyof FonctionnalitesActivees)[] }) {
  const { fonctionnalitesActivees } = useAdminOutletContext()

  if (fonctionnalitesActivees === null) return null

  const features = Array.isArray(feature) ? feature : [feature]
  const autorise = features.some((f) => fonctionnalitesActivees[f])
  if (!autorise) return <Navigate to="/admin" replace />

  return <Outlet context={{ fonctionnalitesActivees }} />
}
