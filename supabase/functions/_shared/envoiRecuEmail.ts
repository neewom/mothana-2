// Choix du canal d'envoi d'un reçu fiscal (carte « Reçus en lot 3/5 », 2026-11-04) : le compte Brevo
// de l'organisation quand il est configuré et que son expéditeur est validé, sinon Resend (compte
// Samakan, noreply@samakan.fr) comme avant. Un refus explicite de Brevo (4xx) retombe aussi sur
// Resend, pour que le donateur reçoive son reçu. Un échec ambigu (exception réseau, délai dépassé,
// statut ≥ 500 : Brevo a peut-être envoyé quand même) ne retombe pas sur Resend, pour ne pas envoyer
// le reçu deux fois par deux expéditeurs (décision TL, relecture PR #339) : erreur `incertain`, et
// l'appelant ne marque pas l'envoi. Dépendances injectées pour les tests (envoi.test.ts).
import { envoyerEmailBrevo, tagsEmailRecu, verifierExpediteurBrevo } from './brevo.ts'
import type { SendResult } from './resend.ts'

export type CanalEmail = 'brevo' | 'resend'

export interface ConfigBrevoOrganisation {
  apiKey: string | null
  expediteurNom: string | null
  expediteurEmail: string | null
}

export interface EmailRecu {
  destinataire: { email: string; nom: string }
  objet: string
  html: string
  pieceJointe: { nom: string; contenuBase64: string }
  profilParticipantId: string
}

export interface DependancesEnvoi {
  fetchFn: typeof fetch
  envoyerResend: (
    to: string,
    subject: string,
    html: string,
    options: { attachments: { filename: string; content: string }[] },
  ) => Promise<SendResult>
  /** Délai maximal de l'envoi Brevo (défaut DELAI_ENVOI_BREVO_MS) ; réduit dans les tests. */
  delaiEnvoiBrevoMs?: number
}

export const MESSAGE_ENVOI_BREVO_INCERTAIN = 'Envoi Brevo incertain : vérifiez dans Brevo avant de renvoyer'

export type ResultatEnvoiRecu =
  | { ok: true; canal: CanalEmail; motifSecours: string | null }
  | { ok: false; incertain: boolean; detail: string }

/** Échec Brevo après lequel l'email a pu partir quand même : pas de secours Resend. */
export function echecBrevoAmbigu(status: number | null): boolean {
  return status === null || status >= 500
}

export function brevoUtilisable(config: ConfigBrevoOrganisation): config is {
  apiKey: string
  expediteurNom: string
  expediteurEmail: string
} {
  return Boolean(config.apiKey && config.expediteurNom?.trim() && config.expediteurEmail?.trim())
}

export async function envoyerEmailRecu(
  email: EmailRecu,
  brevo: ConfigBrevoOrganisation,
  deps: DependancesEnvoi,
): Promise<ResultatEnvoiRecu> {
  let motifSecours: string
  if (!brevoUtilisable(brevo)) {
    motifSecours = 'brevo_non_configure'
  } else {
    // Même règle que send-mailing-brevo : seul un refus explicite de Brevo (expéditeur absent ou
    // inactif) écarte Brevo ; une vérification impossible (clé à permissions restreintes, réseau)
    // laisse tenter l'envoi.
    const verification = await verifierExpediteurBrevo(brevo.apiKey, brevo.expediteurEmail, 'send-recu-email', deps.fetchFn)
    if (verification === 'non_valide') {
      motifSecours = 'expediteur_non_valide'
    } else {
      const resultat = await envoyerEmailBrevo(
        brevo.apiKey,
        {
          expediteur: { nom: brevo.expediteurNom, email: brevo.expediteurEmail },
          destinataire: email.destinataire,
          objet: email.objet,
          html: email.html,
          piecesJointes: [email.pieceJointe],
          tags: tagsEmailRecu(email.profilParticipantId),
        },
        deps.fetchFn,
        deps.delaiEnvoiBrevoMs,
      )
      if (resultat.ok) return { ok: true, canal: 'brevo', motifSecours: null }
      if (echecBrevoAmbigu(resultat.status)) {
        console.error('send-recu-email: envoi Brevo incertain, pas de secours Resend', resultat.status, resultat.detail)
        return { ok: false, incertain: true, detail: MESSAGE_ENVOI_BREVO_INCERTAIN }
      }
      console.error('send-recu-email: envoi Brevo refusé, secours Resend', resultat.status, resultat.detail)
      motifSecours = 'erreur_brevo'
    }
  }

  const resend = await deps.envoyerResend(email.destinataire.email, email.objet, email.html, {
    attachments: [{ filename: email.pieceJointe.nom, content: email.pieceJointe.contenuBase64 }],
  })
  if (!resend.ok) return { ok: false, incertain: false, detail: resend.detail ?? 'Erreur Resend' }
  return { ok: true, canal: 'resend', motifSecours }
}
