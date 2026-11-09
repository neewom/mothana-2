import { describe, expect, it } from 'vitest'
import { libelleAValider, libelleDecidees } from './renouvellementsLibelles'

describe('libelleAValider', () => {
  it('compte les renouvellements seuls', () => {
    expect(libelleAValider(0, 0)).toBe('0 renouvellement à valider')
    expect(libelleAValider(1, 0)).toBe('1 renouvellement à valider')
    expect(libelleAValider(3, 0)).toBe('3 renouvellements à valider')
  })

  it("ajoute les anciennes demandes d'adhésion encore en attente", () => {
    expect(libelleAValider(1, 1)).toBe("1 renouvellement à valider · 1 ancienne demande d'adhésion")
    expect(libelleAValider(0, 4)).toBe("4 anciennes demandes d'adhésion à valider")
  })
})

describe('libelleDecidees', () => {
  it('accorde « validée » / « refusée »', () => {
    expect(libelleDecidees(1, 'ratifiee')).toBe('1 demande validée')
    expect(libelleDecidees(2, 'ratifiee')).toBe('2 demandes validées')
    expect(libelleDecidees(0, 'refusee')).toBe('0 demande refusée')
  })
})
