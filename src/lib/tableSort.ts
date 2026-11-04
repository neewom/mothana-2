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
  /**
   * Valeur triée. Un tableau compare élément par élément, dans le même sens (ex. `[nom, prénom]`,
   * `[date, créé le]`) ; chaque élément vide passe en dernier.
   */
  value: (row: T) => SortValue | readonly SortValue[]
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

/** Vide : absent, chaîne blanche, ou valeur illisible pour le type (nombre NaN, date invalide). */
function isEmpty(v: SortValue, type: SortValueType): boolean {
  if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) return true
  if (type === 'number') return Number.isNaN(Number(v))
  if (type === 'date') return Number.isNaN(toTime(v))
  return false
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
export function compareValues(
  a: SortValue | readonly SortValue[],
  b: SortValue | readonly SortValue[],
  type: SortValueType,
  direction: SortDirection,
): number {
  if (Array.isArray(a) || Array.isArray(b)) {
    const listA: readonly SortValue[] = Array.isArray(a) ? a : [a as SortValue]
    const listB: readonly SortValue[] = Array.isArray(b) ? b : [b as SortValue]
    for (let i = 0; i < Math.max(listA.length, listB.length); i++) {
      const result = compareValues(listA[i], listB[i], type, direction)
      if (result !== 0) return result
    }
    return 0
  }
  const valueA = a as SortValue
  const valueB = b as SortValue
  const emptyA = isEmpty(valueA, type)
  const emptyB = isEmpty(valueB, type)
  if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1
  const result = compareFilled(valueA as string | number | Date, valueB as string | number | Date, type)
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
