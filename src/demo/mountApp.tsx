// Spike démo PGlite — monte l'application réelle, inchangée, avec un bandeau de démo.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '../index.css'
import App from '../App.tsx'
import { DemoBanner } from './DemoBanner'

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
