// Tri des retours Brevo (webhook transactionnel, campagnes de send-mailing-brevo) : une adresse
// n'est marquée « email invalide » que si le rejet vient du destinataire. Un rejet dû à
// l'expéditeur, au domaine d'envoi ou au compte Brevo ne doit jamais marquer les destinataires
// (cadré 2026-10-23 : un expéditeur non validé faisait marquer chaque destinataire).
// Module pur : testé par Vitest (src/lib/brevoRejets.test.ts), avec des raisons réelles.
//
// Données réelles (API statistiques Brevo, staging, 2026-10-23) : tous les `error` observés
// portaient « Sending has been rejected because the sender you used … is not valid… » (dont
// ceux du 2026-09-10 sur @exemple.fr, attribués à tort à un domaine sans MX) ; le vrai cas
// « Unable to find MX of domain … » arrive en `softBounce`, événement non souscrit.

export type EvenementRejet = 'hard_bounce' | 'invalid_email' | 'blocked' | 'error'

// Noms d'abonnement (hardBounce, invalid) et noms documentés du payload (hard_bounce,
// invalid_email) : les deux formes sont acceptées, aucun hard bounce n'ayant encore été observé.
const EVENEMENTS: Record<string, EvenementRejet> = {
  hardBounce: 'hard_bounce',
  hard_bounce: 'hard_bounce',
  invalid: 'invalid_email',
  invalid_email: 'invalid_email',
  blocked: 'blocked',
  error: 'error',
}

// Raisons qui mettent en cause l'expéditeur, le domaine d'envoi ou le compte Brevo.
const RAISON_COTE_EXPEDITEUR = [
  /\bsender\b/i,
  /authenticate your domain/i,
  /domain (is )?not (verified|authenticated)/i,
  /\baccount\b/i,
  /\bapi key\b/i,
  /\bcredits?\b/i,
  /\bquota\b/i,
]

export type DecisionRejet =
  | { marquer: true; evenement: EvenementRejet; raison: string | null }
  | { marquer: false; motif: 'evenement_non_concerne' | 'cote_expediteur' }

export function classerRejet(evenement: unknown, raison: unknown): DecisionRejet {
  const normalise = typeof evenement === 'string' ? EVENEMENTS[evenement] : undefined
  if (!normalise) return { marquer: false, motif: 'evenement_non_concerne' }
  const texte = typeof raison === 'string' && raison.trim() !== '' ? raison.trim().slice(0, 500) : null
  // hard_bounce / invalid_email : propres au destinataire. blocked / error : selon la raison.
  if ((normalise === 'blocked' || normalise === 'error') && texte && RAISON_COTE_EXPEDITEUR.some((r) => r.test(texte))) {
    return { marquer: false, motif: 'cote_expediteur' }
  }
  return { marquer: true, evenement: normalise, raison: texte }
}
