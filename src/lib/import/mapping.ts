import type { FieldDef, ParsedRow } from './types'

function normalizeHeader(s: string): string {
  return s
    .normalize('NFD')
    .replace(new RegExp(`[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`, 'g'), '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

// En-dessous de cette longueur, une correspondance partielle (substring) est
// trop permissive (ex : "cp" matcherait quasiment n'importe quoi) — on exige
// une correspondance exacte pour les candidats très courts.
const MIN_LENGTH_FOR_PARTIAL_MATCH = 3

function partialMatch(a: string, b: string): boolean {
  if (a.length < MIN_LENGTH_FOR_PARTIAL_MATCH || b.length < MIN_LENGTH_FOR_PARTIAL_MATCH) return false
  return a.includes(b) || b.includes(a)
}

/**
 * Mapping = clé de champ cible -> index de colonne source (ou null si non mappé).
 *
 * Deux passes pour éviter qu'une même colonne soit assignée à plusieurs champs
 * (ex : l'en-tête "name" ne doit pas matcher à la fois "nom" et "nom2", ce
 * dernier ayant l'alias "name2" qui contient "name" en correspondance partielle) :
 * 1. Toutes les correspondances EXACTES d'abord, qui "réservent" leur colonne.
 * 2. Puis les correspondances partielles, uniquement sur les colonnes encore libres.
 */
export function guessMapping(headers: string[], fieldDefs: FieldDef[]): Record<string, number | null> {
  const normalizedHeaders = headers.map(normalizeHeader)
  const mapping: Record<string, number | null> = {}
  const usedIndices = new Set<number>()

  function candidatesFor(field: FieldDef): string[] {
    return [field.key, field.label, ...(field.aliases ?? [])].map(normalizeHeader)
  }

  for (const field of fieldDefs) {
    const candidates = candidatesFor(field)
    const index = normalizedHeaders.findIndex((h, i) => !usedIndices.has(i) && candidates.includes(h))
    if (index !== -1) {
      mapping[field.key] = index
      usedIndices.add(index)
    }
  }

  for (const field of fieldDefs) {
    if (mapping[field.key] !== undefined) continue
    const candidates = candidatesFor(field)
    const index = normalizedHeaders.findIndex((h, i) => !usedIndices.has(i) && candidates.some((c) => partialMatch(h, c)))
    mapping[field.key] = index === -1 ? null : index
    if (index !== -1) usedIndices.add(index)
  }

  return mapping
}

export function buildParsedRows(
  rawRows: unknown[][],
  mapping: Record<string, number | null>,
  fieldDefs: FieldDef[]
): ParsedRow[] {
  return rawRows.map((rawRow, index) => {
    const values: Record<string, unknown> = {}
    const errors: Record<string, string> = {}

    for (const field of fieldDefs) {
      const colIndex = mapping[field.key]
      const raw = colIndex === null || colIndex === undefined ? null : rawRow[colIndex]

      if ((colIndex === null || colIndex === undefined) && field.required) {
        errors[field.key] = 'Champ non mappé'
        continue
      }

      const result = field.parse(raw)
      if (result.ok) {
        values[field.key] = result.value
      } else {
        errors[field.key] = result.error
      }
    }

    return { index, values, errors }
  })
}
