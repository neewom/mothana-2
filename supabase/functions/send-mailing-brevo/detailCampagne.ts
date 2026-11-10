// Détail figé d'une campagne (carte « Emailing : détail figé et notes », 2026-11-09) :
// libellés de la sélection et de l'exclusion, construits ici à partir des paramètres reçus
// (jamais fournis tels quels par le client), et lignes destinataires / exclus avec leur raison.

export type FiltreStatut = 'actif' | 'archive' | 'tous'
export type RaisonExclusion = 'email_manquant' | 'email_invalide' | 'email_rejete'

// Mêmes libellés que le sélecteur « Envoyer à » de CampagneMailingPage.
const LIBELLES_STATUT: Record<FiltreStatut, string> = {
  actif: 'Tous sauf archivés',
  archive: 'Adhérents archivés',
  tous: 'Tous les adhérents',
}

/**
 * Libellé de la sélection : une liste prime sur le statut (comme la requête des destinataires).
 * `nomListe` : nom relu dans listes_diffusion ; à défaut (liste renommée ou supprimée entre-temps),
 * l'étiquette réellement utilisée pour filtrer.
 */
export function libelleSelection(filtreStatut: FiltreStatut, tagEnvoi: string | null, nomListe: string | null): string {
  if (tagEnvoi) return `Liste : ${nomListe ?? tagEnvoi}`
  return LIBELLES_STATUT[filtreStatut]
}

export function libelleExclusion(excludeTag: string | null, nomListe: string | null): string | null {
  if (!excludeTag) return null
  return `Sauf liste : ${nomListe ?? excludeTag}`
}

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

/** Découpe en lots (insertion de plusieurs milliers de lignes sans requête géante). */
export function enLots<T>(items: T[], taille: number): T[][] {
  const lots: T[][] = []
  for (let i = 0; i < items.length; i += taille) lots.push(items.slice(i, i + taille))
  return lots
}

/** Noms des pièces jointes envoyées, figés sans les fichiers : bornés en nombre et en longueur. */
export function nomsPiecesJointes(pieces: { nom: string }[], max: number, longueurMax = 255): string[] {
  return pieces.slice(0, max).map((p) => p.nom.slice(0, longueurMax))
}
