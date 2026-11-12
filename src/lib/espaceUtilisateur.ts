import type { AuthState } from '../contexts/authContextInstance'

/**
 * Espace où envoyer un utilisateur déjà connecté qui arrive sur une page publique
 * d'accueil (`/` ou `/login`). `null` : pas connecté (ou état encore en chargement).
 */
export function cheminEspaceConnecte(authType: AuthState['type']): string | null {
  switch (authType) {
    case 'super_admin':
      return '/super-admin'
    case 'admin':
      return '/admin'
    case 'benevole':
      return '/benevole'
    case 'vendeur':
      return '/vendeur'
    default:
      return null
  }
}
