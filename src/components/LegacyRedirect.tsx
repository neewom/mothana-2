import { Navigate, useLocation, useParams } from 'react-router-dom'

/**
 * Redirige une ancienne adresse (favoris, liens déjà envoyés) vers la nouvelle, en conservant
 * les paramètres (`:id`), la query et le fragment. `to` peut contenir des `:param`.
 */
export default function LegacyRedirect({ to }: { to: string }) {
  const params = useParams()
  const { search, hash } = useLocation()
  const path = to.replace(/:([A-Za-z]+)/g, (_, name: string) => encodeURIComponent(params[name] ?? ''))
  return <Navigate to={`${path}${search}${hash}`} replace />
}
