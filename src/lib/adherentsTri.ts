import { directionInitiale, type SortDirection, type SortState, type SortValueType } from './tableSort'

/**
 * Colonnes triables de la page Adhérents. Le tri est fait par la RPC `search_adherents` sur toute
 * la liste filtrée : ces clés sont exactement celles qu'elle accepte (liste fermée côté SQL).
 * « Adhésion » trie sur la date de fin de la dernière adhésion, « Localisation » sur le code
 * postal (puis la ville).
 */
export type AdherentSortField = 'nom' | 'prenom' | 'statut' | 'date_adhesion' | 'date_fin' | 'code_postal'

/** Ordre historique de la liste : nom, prénom croissants. */
export const ADHERENT_SORT_DEFAUT: SortState<AdherentSortField> = { field: 'nom', direction: 'asc' }

const TYPES: Record<AdherentSortField, SortValueType> = {
  nom: 'text',
  prenom: 'text',
  statut: 'text',
  date_adhesion: 'date',
  date_fin: 'date',
  code_postal: 'text',
}

/** Sens du premier clic : dates de la plus récente à la plus ancienne, textes de A à Z. */
export function directionInitialeAdherent(field: AdherentSortField): SortDirection {
  return directionInitiale(TYPES[field])
}

/** Paramètres de tri de `search_adherents` (liste affichée et export). */
export function paramsTriAdherents(sort: SortState<AdherentSortField>): { p_tri: AdherentSortField; p_sens: SortDirection } {
  return { p_tri: sort.field, p_sens: sort.direction }
}
