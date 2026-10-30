import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LoadErrorBoundary } from './LoadErrorBoundary'

// Pas de DOM de test dans le projet : on vérifie la bascule d'état déclenchée par une erreur
// d'un enfant, puis le rendu de la boundary dans chacun des deux états.
function rendre(erreur: boolean): string {
  const boundary = new LoadErrorBoundary({ message: "Impossible de charger l'éditeur.", children: <p>éditeur</p> })
  boundary.state = erreur ? LoadErrorBoundary.getDerivedStateFromError() : { erreur: false }
  return renderToStaticMarkup(<>{boundary.render()}</>)
}

describe('LoadErrorBoundary', () => {
  it("passe en état d'erreur quand un enfant lève une erreur", () => {
    expect(LoadErrorBoundary.getDerivedStateFromError()).toEqual({ erreur: true })
  })

  it('affiche ses enfants tant que rien n’a échoué', () => {
    const html = rendre(false)
    expect(html).toContain('éditeur')
    expect(html).not.toContain('Recharger la page')
  })

  it('affiche le message et le bouton de rechargement après une erreur', () => {
    const html = rendre(true)
    expect(html).toContain('Impossible de charger l&#x27;éditeur.')
    expect(html).toContain('role="alert"')
    expect(html).toMatch(/<button[^>]*>Recharger la page<\/button>/)
    expect(html).not.toContain('<p>éditeur</p>')
  })
})
