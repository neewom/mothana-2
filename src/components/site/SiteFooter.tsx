import { Link } from 'react-router-dom'
import { PAGES_LEGALES } from '../../pages/legal/pagesLegales'

// Le routeur ne remet pas le défilement à zéro : on repart du haut de la page ouverte.
const enHaut = () => window.scrollTo(0, 0)

const LIEN =
  'rounded-sm text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70'

/** Pied de page des pages publiques du site (landing, pages légales). */
export default function SiteFooter() {
  return (
    <footer className="border-t border-paper-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-base font-bold tracking-tight text-ink">Samakan</p>
          <p className="mt-1 text-sm text-ink-faint">La gestion des associations, sans la complexité.</p>
        </div>
        <nav aria-label="Liens du pied de page">
          <ul className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
            <li>
              <Link to="/aide" className={LIEN} onClick={enHaut}>Aide</Link>
            </li>
            {PAGES_LEGALES.map((page) => (
              <li key={page.path}>
                <Link to={page.path} className={LIEN} onClick={enHaut}>{page.label}</Link>
              </li>
            ))}
            <li>
              <Link to="/login" className={LIEN} onClick={enHaut}>Se connecter</Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  )
}
