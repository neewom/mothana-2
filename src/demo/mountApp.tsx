// Monte l'application réelle, inchangée. Le bandeau de la démo s'affiche à la place du bandeau
// « Environnement de test » (src/components/RecetteBanner.tsx), en tête de chaque écran.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '../index.css'
import App from '../App.tsx'

export function mountApp() {
  const root = document.getElementById('root')
  if (!root) throw new Error('#root introuvable')
  createRoot(root).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
}
