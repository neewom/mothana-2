import { Navigate, useLocation, useParams } from 'react-router-dom'

/**
 * Redirige une ancienne adresse (favoris, liens déjà envoyés) vers la nouvelle, en conservant
 * les paramètres (`:id`), la query et le fragment. `to` peut contenir des `:param` et un fragment
 * par défaut (`#codes-pin`), remplacé par celui de l'ancienne adresse s'il y en a un.
 */
export default function LegacyRedirect({ to }: { to: string }) {
  const params = useParams()
  const { search, hash } = useLocation()
  const [target, defaultHash = ''] = to.split('#')
  const path = target.replace(/:([A-Za-z]+)/g, (_, name: string) => encodeURIComponent(params[name] ?? ''))
  return <Navigate to={`${path}${search}${hash || (defaultHash ? `#${defaultHash}` : '')}`} replace />
}
