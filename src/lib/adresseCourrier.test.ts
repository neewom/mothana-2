import { describe, expect, it } from 'vitest'
import { champsAdresseManquants, libelleChampsManquants } from './adresseCourrier'

describe('champsAdresseManquants', () => {
  it('liste les champs manquants dans l’ordre d’une adresse, espaces compris', () => {
    expect(champsAdresseManquants({ adresse: '1 rue A', code_postal: '75001', ville: 'Paris' })).toEqual([])
    expect(champsAdresseManquants({ adresse: '1 rue A', code_postal: null, ville: 'Paris' })).toEqual(['Code postal'])
    expect(champsAdresseManquants({ adresse: '   ', code_postal: '', ville: null })).toEqual(['Adresse', 'Code postal', 'Ville'])
  })
})

describe('libelleChampsManquants', () => {
  it('accorde au pluriel', () => {
    expect(libelleChampsManquants(['Code postal'])).toBe('Code postal manquant')
    expect(libelleChampsManquants(['Adresse', 'Ville'])).toBe('Adresse, Ville manquants')
  })
})
