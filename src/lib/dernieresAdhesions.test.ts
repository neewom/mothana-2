import { describe, expect, it } from 'vitest'
import { adherentsARenouveler } from './dernieresAdhesions'

const today = '2026-10-21'
const horizon = '2026-11-20'
const adherents = [
  { id: 'a', nom: 'ALPHA', prenom: 'A' },
  { id: 'b', nom: 'BRAVO', prenom: null },
  { id: 'c', nom: 'CHARLIE', prenom: 'C' },
  { id: 'd', nom: 'DELTA', prenom: 'D' },
]

describe('adherentsARenouveler', () => {
  it('garde les dernières adhésions qui expirent dans la période, de la plus proche à la plus lointaine', () => {
    const dernieres = new Map([
      ['a', { date_fin: '2026-11-20' }],
      ['b', { date_fin: '2026-10-21' }],
      ['c', { date_fin: '2026-11-21' }], // après l'horizon
      ['d', { date_fin: '2026-10-20' }], // déjà expirée
    ])
    expect(adherentsARenouveler(adherents, dernieres, today, horizon).map((a) => a.adherentId)).toEqual(['b', 'a'])
  })

  it('ignore un adhérent sans adhésion ou dont la dernière adhésion n’a pas de fin', () => {
    const dernieres = new Map([['a', { date_fin: null }]])
    expect(adherentsARenouveler(adherents, dernieres, today, horizon)).toEqual([])
  })
})
