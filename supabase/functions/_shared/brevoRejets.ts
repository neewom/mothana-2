// Tri des retours Brevo (webhook transactionnel, campagnes de send-mailing-brevo) : une adresse
// n'est marquée « email invalide » que si le rejet vient du destinataire. Un rejet dû à
// l'expéditeur, au domaine d'envoi ou au compte Brevo ne doit jamais marquer les destinataires
// (cadré 2026-10-23 : un expéditeur non validé faisait marquer chaque destinataire).
// Module pur : testé par Vitest (src/lib/brevoRejets.test.ts), avec des raisons réelles.
//
// Données réelles (API statistiques Brevo, staging, 2026-10-23) : tous les `error` observés
// portaient « Sending has been rejected because the sender you used … is not valid… » (dont
// ceux du 2026-09-10 sur @exemple.fr, attribués à tort à un domaine sans MX) ; le vrai cas
// « Unable to find MX of domain … » arrive en `softBounce`, souscrit depuis le 2026-11-08 : un soft
// bounce ne marque l'adresse que si son domaine est introuvable (les autres sont temporaires).
// Seul `invalid_email` marque toujours : un hard bounce peut aussi venir d'un refus de
// l'expéditeur (« 550 5.7.1 <…>: Sender address rejected: Access denied »), écarté comme les
// autres événements (le script de rattrapage rejoue 90 jours de hardBounces).

export type EvenementRejet = 'hard_bounce' | 'soft_bounce' | 'invalid_email' | 'blocked' | 'error'

// Noms d'abonnement (hardBounce, invalid) et noms documentés du payload (hard_bounce,
// invalid_email) : les deux formes sont acceptées, aucun hard bounce n'ayant encore été observé.
const EVENEMENTS: Record<string, EvenementRejet> = {
  hardBounce: 'hard_bounce',
  hard_bounce: 'hard_bounce',
  softBounce: 'soft_bounce',
  soft_bounce: 'soft_bounce',
  invalid: 'invalid_email',
  invalid_email: 'invalid_email',
  blocked: 'blocked',
  error: 'error',
}

// Raisons qui mettent en cause l'expéditeur, le domaine d'envoi ou le **compte d'envoi** Brevo.
// Motifs volontairement étroits : « account », « quota » ou « credits » seuls désignent aussi des
// rejets propres au destinataire (« The email account that you tried to reach does not exist »,
// « mailbox is over quota », « Recipient account disabled »), qui doivent marquer l'adresse.
const RAISON_COTE_EXPEDITEUR = [
  /\bsender\b/i,
  /authenticate your domain/i,
  /domain (is )?not (verified|authenticated)/i,
  /\byour (brevo |sendinblue )?account\b/i,
  /\baccount (is |has been )?(suspended|deactivated|blocked|not (yet )?activated|under validation)\b/i,
  /\b(not enough|insufficient|no) (email )?credits?\b/i,
  /\bsending (quota|limit)\b/i,
  /\bapi key\b/i,
]

// Domaine du destinataire introuvable (faute de frappe : hotmail.co, mail.frs…) : raison réelle
// Brevo « Unable to find MX of domain … » (soft bounce). Partagé avec le libellé de la fiche
// (src/lib/emailInvalide.ts).
const RAISON_DOMAINE_INTROUVABLE = /unable to find mx|domain not found|no such domain|nxdomain/i

export function estDomaineIntrouvable(raison: unknown): boolean {
  return typeof raison === 'string' && RAISON_DOMAINE_INTROUVABLE.test(raison)
}

// Raison qui met en cause l'expéditeur (ex. Postfix reject_unknown_sender_domain : « 450 4.1.8
// <comite@…>: Sender address rejected: Domain not found »). Aussi utilisé par le libellé de la
// fiche, pour ne pas afficher « Domaine introuvable » sur un domaine d'expéditeur.
export function estRejetCoteExpediteur(raison: unknown): boolean {
  return typeof raison === 'string' && RAISON_COTE_EXPEDITEUR.some((r) => r.test(raison))
}

export type DecisionRejet =
  | { marquer: true; evenement: EvenementRejet; raison: string | null }
  | { marquer: false; motif: 'evenement_non_concerne' | 'cote_expediteur' | 'rejet_temporaire' }

export function classerRejet(evenement: unknown, raison: unknown): DecisionRejet {
  const normalise = typeof evenement === 'string' ? EVENEMENTS[evenement] : undefined
  if (!normalise) return { marquer: false, motif: 'evenement_non_concerne' }
  const texte = typeof raison === 'string' && raison.trim() !== '' ? raison.trim().slice(0, 500) : null
  // invalid_email : propre au destinataire, toujours marqué. Tous les autres (hard_bounce, blocked,
  // error, soft_bounce) : un rejet côté expéditeur est écarté en premier (un « Sender address
  // rejected: Domain not found » ne doit pas passer pour un domaine destinataire introuvable).
  if (normalise !== 'invalid_email' && estRejetCoteExpediteur(texte)) {
    return { marquer: false, motif: 'cote_expediteur' }
  }
  // soft_bounce : temporaire (boîte pleine, serveur indisponible…), sauf domaine introuvable.
  if (normalise === 'soft_bounce' && !estDomaineIntrouvable(texte)) {
    return { marquer: false, motif: 'rejet_temporaire' }
  }
  return { marquer: true, evenement: normalise, raison: texte }
}

// L'API statistiques Brevo (GET /v3/smtp/statistics/events, script de rattrapage) nomme les
// événements autrement que le webhook (constaté sur staging le 2026-11-08 : `softBounces`,
// `hardBounces`) : traduction vers les noms d'abonnement du webhook, acceptés par classerRejet.
const EVENEMENTS_STATISTIQUES: Record<string, string> = {
  hardBounces: 'hardBounce',
  softBounces: 'softBounce',
  invalid: 'invalid',
  blocked: 'blocked',
  error: 'error',
}

export function evenementDepuisStatistiques(evenement: unknown): string | null {
  return typeof evenement === 'string' ? (EVENEMENTS_STATISTIQUES[evenement] ?? null) : null
}

// Clé de comparaison d'une adresse (repli par adresse de brevo-bounce-webhook) : même
// normalisation que la RPC profils_donateur_par_emails, lower(btrim(email, ' \t\r\n')).
export function normaliserEmail(email: string): string {
  return email.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '').toLowerCase()
}
