import { describe, expect, it } from 'vitest'
import { compareText, compareValues, directionInitiale, nextSortState, sortRows, type SortColumns } from './tableSort'

describe('compareValues', () => {
  it('compare les textes sans tenir compte des accents ni de la casse', () => {
    expect(compareValues('émile', 'Emile', 'text', 'asc')).toBe(0)
    expect(compareValues('Élodie', 'Fabrice', 'text', 'asc')).toBeLessThan(0)
    expect(compareValues('zoé', 'Alain', 'text', 'asc')).toBeGreaterThan(0)
  })

  it('compare les chiffres d’un texte comme des nombres', () => {
    expect(compareValues('2026-9', '2026-10', 'text', 'asc')).toBeLessThan(0)
  })

  it('compare les nombres et les dates', () => {
    expect(compareValues(5, 200, 'number', 'asc')).toBeLessThan(0)
    expect(compareValues(5, 200, 'number', 'desc')).toBeGreaterThan(0)
    expect(compareValues('2025-04-20', '2026-03-15', 'date', 'asc')).toBeLessThan(0)
    expect(compareValues(new Date('2026-03-15'), '2025-04-20', 'date', 'desc')).toBeLessThan(0)
  })

  it('classe les valeurs vides en dernier dans les deux sens', () => {
    for (const direction of ['asc', 'desc'] as const) {
      expect(compareValues(null, 'Alain', 'text', direction)).toBeGreaterThan(0)
      expect(compareValues('Alain', '', 'text', direction)).toBeLessThan(0)
      expect(compareValues('   ', 'Alain', 'text', direction)).toBeGreaterThan(0)
      expect(compareValues(undefined, 0, 'number', direction)).toBeGreaterThan(0)
      expect(compareValues('2026-01-01', 'pas une date', 'date', direction)).toBeLessThan(0)
      expect(compareValues(null, undefined, 'text', direction)).toBe(0)
    }
  })

  it('compare les tableaux élément par élément, vides en dernier', () => {
    expect(compareValues(['Martin', 'Alain'], ['martin', 'Zoé'], 'text', 'asc')).toBeLessThan(0)
    expect(compareValues(['Martin', 'Alain'], ['martin', 'Zoé'], 'text', 'desc')).toBeGreaterThan(0)
    expect(compareValues(['Martin', null], ['Martin', 'Alain'], 'text', 'desc')).toBeGreaterThan(0)
  })
})

describe('compareText', () => {
  it('trie de A à Z, vides en dernier', () => {
    expect(['b', null, 'Á', 'c'].sort(compareText)).toEqual(['Á', 'b', 'c', null])
  })
})

describe('directionInitiale / nextSortState', () => {
  it('ouvre les textes en croissant, nombres et dates en décroissant', () => {
    expect(directionInitiale('text')).toBe('asc')
    expect(directionInitiale('number')).toBe('desc')
    expect(directionInitiale('date')).toBe('desc')
  })

  it('inverse le sens sur la même colonne, prend le sens initial sur une autre', () => {
    expect(nextSortState({ field: 'nom', direction: 'asc' }, 'nom', 'asc')).toEqual({ field: 'nom', direction: 'desc' })
    expect(nextSortState({ field: 'nom', direction: 'desc' }, 'nom', 'asc')).toEqual({ field: 'nom', direction: 'asc' })
    expect(nextSortState({ field: 'nom', direction: 'desc' }, 'total', 'desc')).toEqual({ field: 'total', direction: 'desc' })
  })
})

describe('sortRows', () => {
  interface Ligne { id: string; nom: string; numero: string | null; total: number }
  const colonnes: SortColumns<Ligne, 'nom' | 'numero' | 'total'> = {
    nom: { type: 'text', value: (l) => l.nom },
    numero: { type: 'text', value: (l) => l.numero },
    total: { type: 'number', value: (l) => l.total },
  }
  const lignes: Ligne[] = [
    { id: '1', nom: 'Durand', numero: '2026-10', total: 50 },
    { id: '2', nom: 'émile', numero: null, total: 50 },
    { id: '3', nom: 'Bernard', numero: '2026-2', total: 200 },
  ]
  const ids = (l: Ligne[]) => l.map((x) => x.id)

  it('trie une copie sans modifier la liste d’origine', () => {
    const copie = [...lignes]
    expect(ids(sortRows(lignes, colonnes, { field: 'nom', direction: 'asc' }))).toEqual(['3', '1', '2'])
    expect(lignes).toEqual(copie)
  })

  it('garde les vides en dernier en décroissant', () => {
    expect(ids(sortRows(lignes, colonnes, { field: 'numero', direction: 'asc' }))).toEqual(['3', '1', '2'])
    expect(ids(sortRows(lignes, colonnes, { field: 'numero', direction: 'desc' }))).toEqual(['1', '3', '2'])
  })

  it('départage par la fonction fournie, indépendante du sens, puis garde l’ordre d’origine', () => {
    const parNom = (a: Ligne, b: Ligne) => compareText(a.nom, b.nom)
    expect(ids(sortRows(lignes, colonnes, { field: 'total', direction: 'desc' }, parNom))).toEqual(['3', '1', '2'])
    expect(ids(sortRows(lignes, colonnes, { field: 'total', direction: 'asc' }, parNom))).toEqual(['1', '2', '3'])
    expect(ids(sortRows(lignes, colonnes, { field: 'total', direction: 'asc' }))).toEqual(['1', '2', '3'])
  })
})
