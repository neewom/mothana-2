import { useCallback, useState } from 'react'
import { nextSortState, type SortDirection, type SortState } from '../lib/tableSort'

interface UseTableSortOptions<F extends string> {
  /** Tri à l'ouverture de la page. */
  initial: SortState<F>
  /** Sens du premier clic sur une colonne (ex. `(f) => directionInitiale(COLUMNS[f].type)`). Défaut : croissant. */
  initialDirection?: (field: F) => SortDirection
  /** Appelé à chaque changement de tri (retour page 1, nouvelle requête serveur…). */
  onSortChange?: (state: SortState<F>) => void
}

/**
 * État du tri d'un tableau : colonne + sens, et le gestionnaire de clic d'en-tête. Ne trie rien :
 * la page applique `sortRows` (tri navigateur) ou passe l'état à sa requête (tri serveur).
 */
export function useTableSort<F extends string>({ initial, initialDirection, onSortChange }: UseTableSortOptions<F>) {
  const [sort, setSort] = useState<SortState<F>>(initial)

  const toggleSort = useCallback(
    (field: F) => {
      const next = nextSortState(sort, field, initialDirection ? initialDirection(field) : 'asc')
      setSort(next)
      onSortChange?.(next)
    },
    [sort, initialDirection, onSortChange],
  )

  return { sortField: sort.field, sortDirection: sort.direction, sort, toggleSort }
}
