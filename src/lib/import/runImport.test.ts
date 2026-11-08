import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabaseClient', () => ({ supabase: {} }))

import { orderRowsWithIdExterneFirst } from './runImport'

describe('orderRowsWithIdExterneFirst', () => {
  it('place les lignes numérotées avant les lignes sans numéro, ordre relatif conservé', () => {
    const rows = [
      { k: 'a', id_externe: null },
      { k: 'b', id_externe: '12' },
      { k: 'c', id_externe: '' },
      { k: 'd', id_externe: '7' },
      { k: 'e' },
      { k: 'f', id_externe: '  ' },
      { k: 'g', id_externe: '3' },
    ]
    expect(orderRowsWithIdExterneFirst(rows).map((r) => r.k)).toEqual(['b', 'd', 'g', 'a', 'c', 'e', 'f'])
  })

  it('ne modifie pas le tableau reçu', () => {
    const rows = [{ id_externe: null }, { id_externe: '1' }]
    const copy = [...rows]
    orderRowsWithIdExterneFirst(rows)
    expect(rows).toEqual(copy)
  })

  it('tableau vide', () => {
    expect(orderRowsWithIdExterneFirst([])).toEqual([])
  })
})
