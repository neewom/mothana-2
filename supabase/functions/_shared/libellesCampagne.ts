// Libellés figés d'une campagne (Emailing et Courrier, cartes « détail figé et notes »,
// 2026-11-09) : construits côté serveur à partir des paramètres reçus (jamais fournis tels
// quels par le client), noms de listes relus en base.

export type FiltreStatut = 'actif' | 'archive' | 'tous'

// Mêmes libellés que le sélecteur « Envoyer à » / « Destinataires » des pages Emailing et Courrier.
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

/** Découpe en lots (insertion de plusieurs milliers de lignes sans requête géante). */
export function enLots<T>(items: T[], taille: number): T[][] {
  const lots: T[][] = []
  for (let i = 0; i < items.length; i += taille) lots.push(items.slice(i, i + taille))
  return lots
}
