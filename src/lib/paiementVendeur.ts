export type PaymentRequestStatus = 'en_attente' | 'validee' | 'refusee' | 'expiree' | 'annulee'

const MAX_POSTGRES_INTEGER = 2_147_483_647

export const PAYMENT_REQUEST_REASON_MESSAGES: Readonly<Record<string, string>> = {
  ACCES_INTERDIT: 'Votre session bénévole n’est pas autorisée à effectuer cette action.',
  AUTRE_EVENEMENT: 'Ce portefeuille appartient à un autre événement.',
  DEMANDE_EN_COURS: 'Une demande est déjà en attente pour ce portefeuille. Vérifiez son statut avant de recommencer.',
  DEMANDE_INTROUVABLE: 'Cette demande de paiement est introuvable.',
  DEMANDE_NON_ANNULABLE: 'Cette demande ne peut plus être annulée car son état a déjà changé.',
  EVENEMENT_CLOS: 'Cet événement est clos. Aucune nouvelle demande ne peut être créée.',
  EVENEMENT_INTROUVABLE: 'L’événement sélectionné est introuvable.',
  EVENEMENT_NON_OUVERT: 'Cet événement n’est pas ouvert aux paiements.',
  MONTANT_INVALIDE: 'Saisissez un montant supérieur à 0, avec deux décimales maximum.',
  PORTEFEUILLE_GELE: 'Ce portefeuille est temporairement indisponible.',
  PORTEFEUILLE_INTROUVABLE: 'Aucun portefeuille ne correspond à ce code pour cet événement.',
  SOLDE_INSUFFISANT: 'Solde insuffisant pour ce paiement.',
}

export function eurosToCentimes(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null

  const centimes = Math.round(Number(normalized) * 100)
  return Number.isSafeInteger(centimes) && centimes > 0 && centimes <= MAX_POSTGRES_INTEGER
    ? centimes
    : null
}

export function normalizeWalletCode(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/g, '')
}

export function isValidWalletCode(value: string): boolean {
  return /^[2-9A-H]{10,64}$/.test(normalizeWalletCode(value))
}

export function paymentRequestReasonMessage(reason: string | null | undefined): string {
  return PAYMENT_REQUEST_REASON_MESSAGES[reason ?? ''] ?? 'La demande de paiement n’a pas pu être traitée.'
}

export function paymentRequestErrorMessage(message: string): string {
  const reason = Object.keys(PAYMENT_REQUEST_REASON_MESSAGES).find((candidate) => message.includes(candidate))
  return reason ? PAYMENT_REQUEST_REASON_MESSAGES[reason] : 'Le service de paiement est momentanément indisponible. Réessayez.'
}

export function paymentRequestStatusLabel(status: PaymentRequestStatus): string {
  switch (status) {
    case 'en_attente':
      return 'En attente de validation'
    case 'validee':
      return 'Paiement validé'
    case 'refusee':
      return 'Paiement refusé'
    case 'expiree':
      return 'Demande expirée'
    case 'annulee':
      return 'Demande annulée'
  }
}
