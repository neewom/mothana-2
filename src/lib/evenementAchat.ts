import type { EvenementPublic } from '../types/evenement'

export type AchatSimuleErrorCode =
  | 'SIMULATION_DESACTIVEE'
  | 'EVENEMENT_INTROUVABLE'
  | 'EVENEMENT_CLOS'
  | 'EVENEMENT_NON_OUVERT'
  | 'MODULE_DESACTIVE'
  | 'MONTANT_INVALIDE'
  | 'EMAIL_INVALIDE'
  | 'COMMANDE_DEJA_TRAITEE'
  | 'SERVICE_INDISPONIBLE'
  | 'REQUETE_INVALIDE'

export const DEMANDE_LIEN_CONFIRMATION =
  'Si un portefeuille existe pour cette adresse, un email a été envoyé.'

export function isEvenementPublic(value: unknown): value is EvenementPublic {
  if (!value || typeof value !== 'object') return false
  const event = value as Partial<EvenementPublic>
  return typeof event.id === 'string'
    && typeof event.nom === 'string'
    && typeof event.date_evenement === 'string'
    && typeof event.nom_organisation === 'string'
    && Array.isArray(event.montants_credit_centimes)
    && event.montants_credit_centimes.length > 0
    && event.montants_credit_centimes.every((amount) => Number.isInteger(amount) && amount > 0)
}

export function achatSimuleErrorMessage(code: string | null): string {
  switch (code as AchatSimuleErrorCode) {
    case 'SIMULATION_DESACTIVEE':
      return "L'achat de démonstration est actuellement désactivé. Demandez à l'organisateur de l'activer."
    case 'EVENEMENT_INTROUVABLE':
    case 'EVENEMENT_CLOS':
    case 'EVENEMENT_NON_OUVERT':
    case 'MODULE_DESACTIVE':
      return "Cet événement n'est plus disponible à l'achat."
    case 'MONTANT_INVALIDE':
      return "Ce montant n'est plus proposé. Actualisez la page et réessayez."
    case 'EMAIL_INVALIDE':
      return "L'adresse email n'est pas valide."
    case 'COMMANDE_DEJA_TRAITEE':
      return "Cette opération a déjà crédité un portefeuille. Consultez l'email reçu ou contactez l'organisateur avant de réessayer."
    case 'REQUETE_INVALIDE':
      return 'Les informations envoyées ne sont pas valides.'
    default:
      return 'Le service est momentanément indisponible. Réessayez dans un instant.'
  }
}
