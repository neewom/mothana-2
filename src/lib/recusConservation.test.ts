import { describe, expect, it } from 'vitest'
import { estRefusConservationRecus } from './recusConservation'

describe('estRefusConservationRecus', () => {
  it('reconnaît le refus du trigger des versions de reçus', () => {
    expect(estRefusConservationRecus({
      code: '23514',
      message: "Version 1 du reçu fiscal x : les versions d'un reçu émis sont conservées (obligation de conservation de 6 ans) et ne peuvent pas être supprimées",
    })).toBe(true)
  })

  it('ignore les autres erreurs', () => {
    expect(estRefusConservationRecus(null)).toBe(false)
    expect(estRefusConservationRecus({ code: '23503', message: 'foreign key violation' })).toBe(false)
    expect(estRefusConservationRecus({ code: '23514', message: 'check constraint montant' })).toBe(false)
  })
})
