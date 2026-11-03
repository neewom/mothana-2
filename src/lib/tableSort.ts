// Tri des tableaux de liste (Donateurs, Dons, Reçus fiscaux…) : fonctions pures, sans état React.
// L'état du tri (colonne + sens) vit dans `useTableSort` ; une page triée côté serveur réutilise
// ce hook et `SortableTableHead` sans appeler `sortRows`.

export type SortDirection = 'asc' | 'desc'

export interface SortState<F extends string> {
  field: F
  direction: SortDirection
}

/** Type d'une colonne triable : fixe le comparateur et le sens du premier clic. */
export type SortValueType = 'text' | 'number' | 'date'

/** Valeur triable d'une cellule. `null`/`undefined`/chaîne vide = vide, toujours classé en dernier. */
export type SortValue = string | number | Date | null | undefined

export interface SortColumn<T> {
  type: SortValueType
  value: (row: T) => SortValue
}

export type SortColumns<T, F extends string> = Record<F, SortColumn<T>>

/** Sens du premier clic : textes de A à Z, nombres et dates du plus grand / plus récent au plus petit. */
export function directionInitiale(type: SortValueType): SortDirection {
  return type === 'text' ? 'asc' : 'desc'
}

/** État suivant après un clic sur `field` : même colonne → sens inversé, autre colonne → sens initial. */
export function nextSortState<F extends string>(
  current: SortState<F>,
  field: F,
  initialDirection: SortDirection,
): SortState<F> {
  if (current.field === field) return { field, direction: current.direction === 'asc' ? 'desc' : 'asc' }
  return { field, direction: initialDirection }
}

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })

function isEmpty(v: SortValue): v is null | undefined | '' {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '') || (v instanceof Date && Number.isNaN(v.getTime()))
}

function toTime(v: string | number | Date): number {
  if (v instanceof Date) return v.getTime()
  if (typeof v === 'number') return v
  return new Date(v).getTime()
}

/** Compare deux valeurs non vides selon leur type (ordre croissant). */
function compareFilled(a: string | number | Date, b: string | number | Date, type: SortValueType): number {
  switch (type) {
    case 'text':
      return collator.compare(String(a), String(b))
    case 'number':
      return Number(a) - Number(b)
    case 'date':
      return toTime(a) - toTime(b)
  }
}

/**
 * Comparateur d'une colonne dans un sens donné. Les valeurs vides restent en dernier quel que
 * soit le sens (elles ne remontent pas en tête d'un tri décroissant).
 * Texte : sans tenir compte des accents ni de la casse, chiffres comparés comme des nombres
 * (« 2026-10 » après « 2026-9 »). Date : chaîne ISO, timestamp ou `Date`.
 */
export function compareValues(a: SortValue, b: SortValue, type: SortValueType, direction: SortDirection): number {
  const emptyA = isEmpty(a)
  const emptyB = isEmpty(b)
  if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1
  const result = compareFilled(a as string | number | Date, b as string | number | Date, type)
  return direction === 'asc' ? result : -result
}

/**
 * Trie une copie de `rows` selon la colonne de `state`. À valeur égale, `tieBreak` (indépendant
 * du sens choisi) départage, puis l'ordre d'origine est conservé (tri stable).
 */
export function sortRows<T, F extends string>(
  rows: readonly T[],
  columns: SortColumns<T, F>,
  state: SortState<F>,
  tieBreak?: (a: T, b: T) => number,
): T[] {
  const column = columns[state.field]
  return [...rows].sort(
    (a, b) => compareValues(column.value(a), column.value(b), column.type, state.direction) || (tieBreak ? tieBreak(a, b) : 0),
  )
}

/** Comparaison de textes réutilisable dans un départage (même règles que les colonnes texte). */
export function compareText(a: string | null | undefined, b: string | null | undefined): number {
  return compareValues(a, b, 'text', 'asc')
}
