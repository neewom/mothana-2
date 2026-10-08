export interface WalletAccessResendResponse {
  ok?: boolean
  error?: string
  portefeuille_url?: string
  email?: string
  email_envoye?: boolean
}

export function walletAccessResendErrorMessage(code: string | null): string {
  switch (code) {
    case 'EMAIL_DEJA_UTILISE':
      return 'Cette adresse possède déjà un autre portefeuille pour cet événement. Les portefeuilles ne peuvent pas être fusionnés.'
    case 'EMAIL_INVALIDE':
    case 'REQUETE_INVALIDE':
      return 'Renseignez une adresse email valide.'
    case 'ACCES_INTERDIT':
    case 'NON_AUTORISE':
      return 'Vous n’avez pas les droits nécessaires pour renvoyer cet accès.'
    case 'PORTEFEUILLE_INTROUVABLE':
      return 'Ce portefeuille n’existe plus. Actualisez la page et réessayez.'
    case 'EMAIL_NON_ENVOYE':
      return 'L’email n’a pas pu être envoyé. Le nouveau lien a tout de même été créé : copiez-le ci-dessous pour le transmettre manuellement.'
    default:
      return 'Le nouvel accès n’a pas pu être créé. Réessayez dans un instant.'
  }
}

// `functions.invoke` place les réponses non-2xx (401/403/503…) dans son erreur, avec la
// réponse HTTP brute dans `context` : on relit le corps pour récupérer le code métier
// renvoyé par l'Edge Function plutôt que d'afficher le message générique.
export async function walletAccessResendErrorCode(invocationError: unknown): Promise<string | null> {
  const context = (invocationError as { context?: unknown } | null)?.context
  if (!context || typeof (context as Response).json !== 'function') return null
  try {
    const body = await (context as Response).json() as { error?: unknown }
    return typeof body.error === 'string' ? body.error : null
  } catch {
    return null
  }
}
