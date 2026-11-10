// Détail d'une campagne courrier dans l'historique (carte « Courrier : détail figé et notes »,
// 2026-11-10) : libellés, logique pure. Libellés communs avec l'Emailing (auteur, campagne
// antérieure) : campagneMailingDetail.ts.

export type RaisonExclusionCourrier = 'adresse_incomplete'

/** Même raison que l'aperçu avant génération de la page Courrier. */
export const RAISON_EXCLUSION_COURRIER_LABELS: Record<RaisonExclusionCourrier, string> = {
  adresse_incomplete: 'Adresse postale incomplète',
}

/**
 * Une campagne générée avant la carte n'a ni exclusion ni destinataires enregistrés (sa sélection,
 * elle, est figée depuis l'origine).
 */
export function estCampagneCourrierAnterieure(c: { detail_enregistre: boolean | null }): boolean {
  return c.detail_enregistre !== true
}

/** Sélection en une ligne pour la carte mobile : « Tous sauf archivés (sauf liste : Bureau) ». */
export function libelleSelectionCarte(selection: string, exclusion: string | null): string {
  return exclusion ? `${selection} (${exclusion.replace(/^Sauf/, 'sauf')})` : selection
}
