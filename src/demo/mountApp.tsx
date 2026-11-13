// Monte l'application réelle, inchangée. Le bandeau de la démo s'affiche à la place du bandeau
// « Environnement de test » (src/components/RecetteBanner.tsx), en tête de chaque écran ; l'écran
// PIN bénévole, qui n'a pas ce bandeau, reçoit le rappel du code de la démo (DemoPinHint).
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '../index.css'
import App from '../App.tsx'
import { DemoPinHint } from './DemoPinHint'

export function mountApp() {
  const root = document.getElementById('root')
  if (!root) throw new Error('#root introuvable')
  createRoot(root).render(
    <StrictMode>
      <BrowserRouter>
        <DemoPinHint />
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
}
