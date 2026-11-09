import { describe, expect, it } from 'vitest'
import { buildActivitesBatch } from './buildBatch'
import type { ExistingRef } from './prefetch'
import { ACTIVITE_DATES_ERROR } from '../activiteDates'

const fullMapping = { id_externe: 0, nom: 1, date_debut: 2, date_fin: 3 }

function row(index: number, values: Record<string, unknown>) {
  return { index, values, errors: {} }
}

describe('buildActivitesBatch — cohérence des dates', () => {
  it('écarte une nouvelle ligne dont la fin précède le début, garde les autres', () => {
    const result = buildActivitesBatch(
      [
        row(0, { id_externe: 'A1', nom: 'Noël', date_debut: '2026-12-21', date_fin: '2026-09-27' }),
        row(1, { id_externe: 'A2', nom: 'Pâques', date_debut: '2026-04-05', date_fin: '2026-04-05' }),
        row(2, { id_externe: 'A3', nom: 'Sans fin', date_debut: '2026-04-05', date_fin: null }),
      ],
      fullMapping,
      new Map()
    )
    expect(result.excluded).toEqual([{ index: 0, reason: ACTIVITE_DATES_ERROR }])
    expect(result.inserts.map((r) => r.id_externe)).toEqual(['A2', 'A3'])
  })

  it('écarte une mise à jour incohérente avec la date actuelle non mappée', () => {
    const existing = new Map<string, ExistingRef>([
      ['A1', { id: 'id-a1', values: { nom: 'Noël', date_debut: '2026-12-21', date_fin: '2026-12-27' } }],
    ])
    const result = buildActivitesBatch(
      [row(0, { id_externe: 'A1', date_fin: '2026-09-27' })],
      { id_externe: 0, date_fin: 1 },
      existing
    )
    expect(result.excluded).toHaveLength(1)
    expect(result.conflicts).toHaveLength(0)
  })

  it('laisse passer une mise à jour qui corrige une ligne existante incohérente', () => {
    const existing = new Map<string, ExistingRef>([
      ['A1', { id: 'id-a1', values: { nom: 'Noël', date_debut: '2026-12-21', date_fin: '2026-09-27' } }],
    ])
    const result = buildActivitesBatch(
      [row(0, { id_externe: 'A1', nom: 'Noël', date_debut: '2026-12-21', date_fin: '2026-12-27' })],
      fullMapping,
      existing
    )
    expect(result.excluded).toHaveLength(0)
    expect(result.conflicts).toHaveLength(1)
  })
})
