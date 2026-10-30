import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { StatusNotice } from '@/components/ui/status-notice'

interface LoadErrorBoundaryProps {
  children: ReactNode
  /** Message affiché à la place du contenu qui n'a pas pu être chargé. */
  message: string
}

interface LoadErrorBoundaryState {
  erreur: boolean
}

// Filet autour d'un composant chargé à la demande (lazy) : si son chunk est introuvable
// (ancien déploiement remplacé, réseau coupé), l'erreur reste confinée à cette zone au lieu
// de démonter toute l'application (React 19 sans error boundary = page blanche).
// Réessai = rechargement de la page : lazy() mémorise le rejet, et un chunk d'un ancien
// déploiement ne réapparaîtra pas sans récupérer le nouvel index.html.
export class LoadErrorBoundary extends Component<LoadErrorBoundaryProps, LoadErrorBoundaryState> {
  state: LoadErrorBoundaryState = { erreur: false }

  static getDerivedStateFromError(): LoadErrorBoundaryState {
    return { erreur: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Échec du chargement d’un module à la demande', error, info.componentStack)
  }

  render() {
    if (!this.state.erreur) return this.props.children
    return (
      <StatusNotice tone="warning" role="alert" heading={this.props.message} className="m-3">
        <p>Vérifiez votre connexion, puis rechargez la page.</p>
        <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => window.location.reload()}>
          Recharger la page
        </Button>
      </StatusNotice>
    )
  }
}
