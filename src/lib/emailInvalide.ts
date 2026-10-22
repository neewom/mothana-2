// Libellé lisible du rejet qui a fait marquer une adresse « email invalide » (fiche adhérent).
// Événements écrits par brevo-bounce-webhook (normalisés, _shared/brevoRejets.ts) ou à la
// validation d'une demande d'adhésion dont la confirmation a été rejetée (Resend).

const LIBELLES: Record<string, string> = {
  hard_bounce: 'Adresse inexistante (rejet définitif)',
  invalid_email: 'Adresse invalide',
  blocked: 'Adresse bloquée par Brevo après des rejets',
  confirmation_demande: "Rejet de l'email de confirmation de la demande d'adhésion",
}

export function libelleRejetEmail(evenement: string | null, raison: string | null): string | null {
  if (raison && /unable to find mx|domain not found|no such domain|nxdomain/i.test(raison)) return 'Domaine introuvable'
  if (evenement && LIBELLES[evenement]) return LIBELLES[evenement]
  if (raison) return raison
  return null
}
