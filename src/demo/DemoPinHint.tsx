// Sur l'écran PIN bénévole (qui n'a pas de bandeau), rappelle le code de la démo. Rendu par
// mountApp à côté de l'application, au-dessus de l'écran : aucun fichier applicatif modifié.
import { useLocation } from 'react-router-dom'
import { DEMO_PIN } from './messages'

export function DemoPinHint() {
  const { pathname } = useLocation()
  if (pathname !== '/login/benevole') return null
  return (
    <div role="region" aria-label="Démo" className="flex flex-wrap items-center justify-center gap-x-2 bg-ink px-4 py-2.5 text-sm text-paper">
      <span>
        <span className="font-semibold">Démo :</span> code PIN des bénévoles
      </span>
      <span className="font-registre-mono text-base font-semibold tracking-[0.2em]">{DEMO_PIN}</span>
    </div>
  )
}
