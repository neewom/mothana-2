import type { ReactNode } from 'react'

// Dégradés CSS (sans JS) signalant qu'un contenu scrollable horizontalement déborde du
// conteneur — les tableaux en overflow-x-auto n'avaient sinon aucun indice de scroll
// possible (audit UI), particulièrement sur mobile où les colonnes de droite/actions
// étaient hors écran sans affordance visuelle.
export default function ScrollShadowX({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`overflow-x-auto ${className}`}
      style={{
        backgroundImage:
          'linear-gradient(to right, white 30%, rgba(255,255,255,0)), ' +
          'linear-gradient(to right, rgba(255,255,255,0), white 70%) 100% 0, ' +
          'linear-gradient(to right, rgba(15,23,42,0.12), rgba(15,23,42,0)), ' +
          'linear-gradient(to left, rgba(15,23,42,0.12), rgba(15,23,42,0)) 100% 0',
        backgroundRepeat: 'no-repeat',
        backgroundColor: 'white',
        backgroundSize: '40px 100%, 40px 100%, 14px 100%, 14px 100%',
        backgroundPosition: '0 0, 100% 0, 0 0, 100% 0',
        backgroundAttachment: 'local, local, scroll, scroll',
      }}
    >
      {children}
    </div>
  )
}
