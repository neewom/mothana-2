// Spike démo PGlite — monte l'application réelle, inchangée, avec un bandeau de démo.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '../index.css'
import App from '../App.tsx'

function DemoBanner() {
  return (
    <div className="fixed bottom-2 left-2 z-[9999] flex items-center gap-2 rounded-md bg-ink px-3 py-1.5 text-xs text-paper">
      <span>Démo : vos saisies restent dans ce navigateur</span>
      <button type="button" className="underline" onClick={() => window.__demo?.reset()}>
        Remettre à zéro
      </button>
    </div>
  )
}

export function mountApp() {
  const root = document.getElementById('root')
  if (!root) throw new Error('#root introuvable')
  createRoot(root).render(
    <StrictMode>
      <BrowserRouter>
        <App />
        <DemoBanner />
      </BrowserRouter>
    </StrictMode>,
  )
}
