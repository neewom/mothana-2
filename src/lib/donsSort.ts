import type { Don } from '../types'
import { MODE_PAIEMENT_LABELS } from './modePaiement'
import { directionInitiale, sortRows, type SortColumns, type SortDirection, type SortState } from './tableSort'

export type { SortDirection } from './tableSort'

export type DonSortField = 'date' | 'donateur' | 'montant' | 'mode'

export const DON_SORT_DEFAUT: SortState<DonSortField> = { field: 'date', direction: 'desc' }

export function nomDonateur(don: Don): string {
  const p = don.profils_participant?.personnes
  if (!p) return '—'
  return p.prenom ? `${p.prenom} ${p.nom}` : p.nom
}

export const DON_SORT_COLUMNS: SortColumns<Don, DonSortField> = {
  // À date égale, la date de création départage dans le même sens.
  date: { type: 'date', value: (d) => [d.date, d.created_at] },
  // Ordre d'annuaire : nom puis prénom (l'affichage reste « Prénom Nom »).
  donateur: {
    type: 'text',
    value: (d) => {
      const p = d.profils_participant?.personnes
      return p ? [p.nom, p.prenom] : null
    },
  },
  montant: { type: 'number', value: (d) => d.montant },
  mode: { type: 'text', value: (d) => MODE_PAIEMENT_LABELS[d.mode_paiement] },
}

/** Sens du premier clic sur une colonne : le plus récent / le plus gros d'abord, les textes de A à Z. */
export function directionInitialeDon(field: DonSortField): SortDirection {
  return directionInitiale(DON_SORT_COLUMNS[field].type)
}

const plusRecentDabord = (a: Don, b: Don) =>
  b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id)

/**
 * Trie une copie de la liste. À valeur égale, départage toujours par date puis date de
 * création décroissantes, pour un ordre stable quel que soit l'ordre de chargement.
 */
export function trierDons(dons: Don[], field: DonSortField, direction: SortDirection): Don[] {
  return sortRows(dons, DON_SORT_COLUMNS, { field, direction }, plusRecentDabord)
}
