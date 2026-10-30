import { describe, expect, it } from 'vitest'
import { libelleTableCible } from './journalModifications'

describe('libelleTableCible', () => {
  it('distingue une demande de renouvellement', () => {
    expect(libelleTableCible({ table_cible: 'demandes_adhesion', details: { type: 'renouvellement' } })).toBe('Demande de renouvellement')
  })

  it("garde « Demande d'adhésion » pour une adhésion (y compris les entrées sans type)", () => {
    expect(libelleTableCible({ table_cible: 'demandes_adhesion', details: { nom: 'X' } })).toBe("Demande d'adhésion")
    expect(libelleTableCible({ table_cible: 'demandes_adhesion', details: null })).toBe("Demande d'adhésion")
  })

  it('renvoie le nom brut pour une table inconnue', () => {
    expect(libelleTableCible({ table_cible: 'adherents', details: null })).toBe('Adhérent')
    expect(libelleTableCible({ table_cible: 'autre', details: null })).toBe('autre')
  })
})
