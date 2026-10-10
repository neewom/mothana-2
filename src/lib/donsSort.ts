import type { Don } from '../types'

export type DonSortField = 'date' | 'donateur' | 'montant'
export type SortDirection = 'asc' | 'desc'

export const DON_SORT_DEFAUT: { field: DonSortField; direction: SortDirection } = { field: 'date', direction: 'desc' }

/** Sens du premier clic sur une colonne : le plus récent / le plus gros d'abord, les noms de A à Z. */
export function directionInitialeDon(field: DonSortField): SortDirection {
  return field === 'donateur' ? 'asc' : 'desc'
}

export function nomDonateur(don: Don): string {
  const p = don.profils_participant?.personnes
  if (!p) return '—'
  return p.prenom ? `${p.prenom} ${p.nom}` : p.nom
}

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })

function cleDonateur(don: Don): string {
  const p = don.profils_participant?.personnes
  return p ? `${p.nom} ${p.prenom ?? ''}` : ''
}

/**
 * Trie une copie de la liste. À valeur égale, départage toujours par date puis date de
 * création décroissantes, pour un ordre stable quel que soit l'ordre de chargement.
 */
export function trierDons(dons: Don[], field: DonSortField, direction: SortDirection): Don[] {
  const sens = direction === 'asc' ? 1 : -1
  const plusRecentDabord = (a: Don, b: Don) =>
    b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id)

  return [...dons].sort((a, b) => {
    let comparaison = 0
    switch (field) {
      case 'date':
        comparaison = a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at)
        break
      case 'donateur':
        // Ordre d'annuaire : nom puis prénom (l'affichage reste « Prénom Nom »).
        comparaison = collator.compare(cleDonateur(a), cleDonateur(b))
        break
      case 'montant':
        comparaison = a.montant - b.montant
        break
    }
    return comparaison * sens || plusRecentDabord(a, b)
  })
}
