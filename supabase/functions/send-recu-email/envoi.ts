// Choix du canal d'envoi d'un reçu fiscal (carte « Reçus en lot 3/5 », 2026-11-04) : le compte Brevo
// de l'organisation quand il est configuré et que son expéditeur est validé, sinon Resend (compte
// Samakan, noreply@samakan.fr) comme avant. Un échec de Brevo retombe aussi sur Resend, pour que le
// donateur reçoive son reçu. Dépendances injectées pour les tests (envoi.test.ts).
import { envoyerEmailBrevo, tagsEmailRecu, verifierExpediteurBrevo } from '../_shared/brevo.ts'
import type { SendResult } from '../_shared/resend.ts'

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
}

export type ResultatEnvoiRecu =
  | { ok: true; canal: CanalEmail; motifSecours: string | null }
  | { ok: false; detail: string }

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
      )
      if (resultat.ok) return { ok: true, canal: 'brevo', motifSecours: null }
      console.error('send-recu-email: envoi Brevo refusé, secours Resend', resultat.status, resultat.detail)
      motifSecours = 'erreur_brevo'
    }
  }

  const resend = await deps.envoyerResend(email.destinataire.email, email.objet, email.html, {
    attachments: [{ filename: email.pieceJointe.nom, content: email.pieceJointe.contenuBase64 }],
  })
  if (!resend.ok) return { ok: false, detail: resend.detail ?? 'Erreur Resend' }
  return { ok: true, canal: 'resend', motifSecours }
}
