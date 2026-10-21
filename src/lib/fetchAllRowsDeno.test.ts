import { describe, expect, it } from 'vitest'
import { fetchAllRows } from '../../supabase/functions/_shared/fetchAllRows'

const lignes = Array.from({ length: 23 }, (_, i) => ({ id: i }))
const page = (calls: [number, number][]) => async (from: number, to: number) => {
  calls.push([from, to])
  return { data: lignes.slice(from, to + 1), error: null }
}

describe('fetchAllRows (Edge Functions)', () => {
  it('lit toutes les pages, sans doublon ni omission', async () => {
    const calls: [number, number][] = []
    const { data, error } = await fetchAllRows(page(calls), 10)
    expect(error).toBeNull()
    expect(data.map((l) => l.id)).toEqual(lignes.map((l) => l.id))
    expect(calls).toEqual([[0, 9], [10, 19], [20, 29]])
  })

  it('s’arrête après une page pleine suivie d’une page vide', async () => {
    const calls: [number, number][] = []
    const { data } = await fetchAllRows(async (from, to) => {
      calls.push([from, to])
      return { data: lignes.slice(0, 20).slice(from, to + 1), error: null }
    }, 10)
    expect(data).toHaveLength(20)
    expect(calls).toHaveLength(3)
  })

  it('remonte l’erreur d’une page', async () => {
    const { error } = await fetchAllRows(async (from) => (
      from === 0 ? { data: lignes.slice(0, 10), error: null } : { data: null, error: { message: 'boom' } }
    ), 10)
    expect(error?.message).toBe('boom')
  })
})
