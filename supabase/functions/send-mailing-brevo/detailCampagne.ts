// Détail figé d'une campagne (carte « Emailing : détail figé et notes », 2026-11-09) :
// lignes destinataires / exclus avec leur raison. Libellés de la sélection et de l'exclusion :
// _shared/libellesCampagne.ts (communs avec le Courrier), réexportés ici.

export { enLots, libelleExclusion, libelleSelection, type FiltreStatut } from '../_shared/libellesCampagne.ts'
export type RaisonExclusion = 'email_manquant' | 'email_invalide' | 'email_rejete'

interface AdherentClasse {
  id: string
  courriel: string | null
  nom: string
  prenom: string | null
  email_invalide_at: string | null
}

/**
 * Raison d'exclusion d'un adhérent, ou null s'il reçoit la campagne. Même classement que
 * src/lib/mailingRecipients.ts (email manquant, format invalide, adresse rejetée) ; les
 * désinscrits ne font pas partie de la sélection (filtrés par la requête).
 */
export function raisonExclusion(a: AdherentClasse, emailRegex: RegExp): RaisonExclusion | null {
  const email = a.courriel?.trim() ?? ''
  if (!email) return 'email_manquant'
  if (!emailRegex.test(email)) return 'email_invalide'
  if (a.email_invalide_at) return 'email_rejete'
  return null
}

export interface LigneDestinataire {
  campagne_id: string
  organisation_id: string
  adherent_id: string
  nom: string
  courriel: string | null
  statut: 'envoye' | 'exclu'
  raison_exclusion: RaisonExclusion | null
}

export function lignesDestinataires(
  adherents: AdherentClasse[],
  campagneId: string,
  organisationId: string,
  emailRegex: RegExp,
): LigneDestinataire[] {
  return adherents.map((a) => {
    const raison = raisonExclusion(a, emailRegex)
    return {
      campagne_id: campagneId,
      organisation_id: organisationId,
      adherent_id: a.id,
      nom: [a.prenom, a.nom].filter(Boolean).join(' '),
      courriel: a.courriel?.trim() || null,
      statut: raison ? 'exclu' : 'envoye',
      raison_exclusion: raison,
    }
  })
}

/** Noms des pièces jointes envoyées, figés sans les fichiers : bornés en nombre et en longueur. */
export function nomsPiecesJointes(pieces: { nom: string }[], max: number, longueurMax = 255): string[] {
  // Coupe par caractère (Array.from) : un slice UTF-16 pourrait couper un emoji en deux (JSON refusé par Postgres).
  return pieces.slice(0, max).map((p) => Array.from(p.nom).slice(0, longueurMax).join(''))
}
