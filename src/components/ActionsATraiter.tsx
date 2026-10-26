import { Link } from 'react-router-dom'

// Bloc « À traiter » de l'accueil (maquette validée le 2026-10-21) : toutes les actions en
// attente dans un seul encadré ambre, une ligne par action — remplace les encarts empilés.

export interface ActionATraiter {
  key: string
  /** Tracé SVG (heroicons outline, 24×24) de l'icône. */
  icone: string
  titre: string
  detail: string
  libelle: string
  /** Destination de la ligne ; sinon `onClick` (ex. ouverture d'une modale). */
  to?: string
  onClick?: () => void
}

function ContenuLigne({ action }: { action: ActionATraiter }) {
  return (
    <>
      <svg xmlns="http://www.w3.org/2000/svg" className="mt-0.5 h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d={action.icone} />
      </svg>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{action.titre}</span>
        <span className="block text-xs sm:truncate">{action.detail}</span>
        <span className="mt-1 block text-xs font-semibold sm:hidden">{action.libelle} →</span>
      </span>
      <span className="hidden shrink-0 text-sm font-semibold sm:block">{action.libelle} →</span>
    </>
  )
}

const LIGNE = 'flex w-full items-start gap-3 px-4 py-3 text-left text-warning transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-warning sm:items-center'

export function ActionsATraiter({ actions }: { actions: ActionATraiter[] }) {
  if (actions.length === 0) return null
  return (
    <section aria-labelledby="a-traiter-titre" className="rounded-sm border-2 border-warning-border bg-warning-tint">
      <div className="flex items-center gap-2.5 border-b border-warning-border px-4 py-2.5">
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-warning px-1.5 font-registre-mono text-xs font-bold text-white" aria-hidden>
          {actions.length}
        </span>
        <h2 id="a-traiter-titre" className="font-registre-mono text-xs font-semibold uppercase tracking-wide text-warning">
          À traiter<span className="sr-only"> : {actions.length} action{actions.length > 1 ? 's' : ''}</span>
        </h2>
      </div>
      <ul className="divide-y divide-warning-border">
        {actions.map((action) => (
          <li key={action.key}>
            {action.to ? (
              <Link to={action.to} className={LIGNE}>
                <ContenuLigne action={action} />
              </Link>
            ) : (
              <button type="button" onClick={action.onClick} className={LIGNE}>
                <ContenuLigne action={action} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
