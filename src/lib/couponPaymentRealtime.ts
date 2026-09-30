import type { PaymentRequestStatus } from './paiementVendeur'

export const PAYMENT_CHANGED_EVENT = 'changed'

export function sellerPaymentTopic(requestId: string): string {
  return `coupon-payment:${requestId}`
}

export function timestampRevision(value: string): number {
  const milliseconds = Date.parse(value)
  if (!Number.isFinite(milliseconds)) return 0

  const fractional = value.match(/\.(\d+)(?:Z|[+-]\d{2}:?\d{2})$/)?.[1] ?? ''
  const microsecondsAfterMilliseconds = Number(fractional.padEnd(6, '0').slice(3, 6) || '0')
  return (milliseconds * 1000) + microsecondsAfterMilliseconds
}

export function paymentRequestRevision(
  updatedAt: string,
  expiresAt: string,
  status: PaymentRequestStatus,
  now = Date.now(),
): number {
  const updatedRevision = timestampRevision(updatedAt)
  if (status !== 'en_attente' || Date.parse(expiresAt) > now) return updatedRevision
  return Math.max(updatedRevision, timestampRevision(expiresAt))
}

export function paymentDecisionReasonMessage(reason: string | null | undefined): string {
  switch (reason) {
    case 'DEMANDE_EXPIREE':
      return 'Le délai de validation est dépassé.'
    case 'DEJA_DECIDEE':
      return 'Cette demande a déjà été traitée.'
    case 'PORTEFEUILLE_GELE':
      return 'Ce portefeuille est temporairement bloqué.'
    case 'SOLDE_INSUFFISANT':
      return 'Le solde disponible ne permet plus ce paiement.'
    case 'EVENEMENT_CLOS':
    case 'EVENEMENT_NON_OUVERT':
      return 'Cet événement ne permet plus de valider un paiement.'
    case 'DEMANDE_INTROUVABLE':
    case 'PORTEFEUILLE_INTROUVABLE':
      return 'Cette demande n’est plus disponible.'
    default:
      return 'La décision n’a pas pu être enregistrée. Réessayez.'
  }
}
