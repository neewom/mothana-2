// Logique pure du composant de liste commun (`ui/liste-donnees`) : rôle des colonnes en mode
// cartes, options de « Trier par », préférence tableau / cartes mémorisée par appareil et par liste.

/** Rendu d'une liste : tableau (toujours à partir de 768 px) ou cartes (choix en mobile). */
export type ModeListe = 'tableau' | 'cartes'

/**
 * Place d'une colonne dans une carte (mode cartes, sous 768 px) :
 * - `titre` : première ligne, à gauche (nom du donateur, de l'adhérent) ;
 * - `montant` : première ligne, aligné à droite (montant, en police mono) ;
 * - `secondaire` : ligne de méta-informations sous le titre, valeurs séparées par « · » ;
 * - `pastille` : badges sous les méta-informations ;
 * - `masquee` : absente de la carte (colonne redondante ou réservée au tableau).
 */
export type RoleCarte = 'titre' | 'montant' | 'secondaire' | 'pastille' | 'masquee'

/** Mode par défaut en mobile, tant que l'utilisateur n'a rien choisi sur cet appareil. */
export const MODE_LISTE_DEFAUT: ModeListe = 'cartes'

const STORAGE_PREFIX = 'mothana-liste-mode-v1:'

/** Préférence enregistrée pour la liste `id` ; défaut si absente, illisible ou stockage indisponible. */
export function lireModeListe(id: string): ModeListe {
  try {
    const value = localStorage.getItem(STORAGE_PREFIX + id)
    return value === 'tableau' || value === 'cartes' ? value : MODE_LISTE_DEFAUT
  } catch {
    return MODE_LISTE_DEFAUT
  }
}

/** Enregistre la préférence ; sans stockage (navigation privée…), le choix vaut pour la session de la page. */
export function ecrireModeListe(id: string, mode: ModeListe): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + id, mode)
  } catch {
    // Stockage indisponible : le mode reste celui de l'état React.
  }
}

/** Colonnes d'une carte, rangées par rôle et dans l'ordre de la description. */
export function repartirParRole<C extends { role: RoleCarte }>(colonnes: readonly C[]) {
  return {
    titre: colonnes.filter((c) => c.role === 'titre'),
    montant: colonnes.filter((c) => c.role === 'montant'),
    secondaire: colonnes.filter((c) => c.role === 'secondaire'),
    pastille: colonnes.filter((c) => c.role === 'pastille'),
  }
}

/**
 * Options de « Trier par » (mode cartes) : une par clé de tri, dans l'ordre des colonnes. Une clé
 * portée par deux colonnes (ex. montant dupliqué pour l'ordre mobile du tableau) n'apparaît qu'une fois.
 */
export function optionsDeTri<F extends string, C extends { sortField?: F; label: string }>(colonnes: readonly C[]) {
  const vues = new Set<F>()
  const options: { field: F; label: string }[] = []
  for (const c of colonnes) {
    if (!c.sortField || vues.has(c.sortField)) continue
    vues.add(c.sortField)
    options.push({ field: c.sortField, label: c.label })
  }
  return options
}
