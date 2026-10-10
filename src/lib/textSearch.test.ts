import { describe, expect, it } from 'vitest'
import { correspondRecherche } from './textSearch'

describe('correspondRecherche', () => {
  it('cherche chaque mot dans les champs, sans accents ni casse', () => {
    expect(correspondRecherche(['Émile', 'Durand', null], '')).toBe(true)
    expect(correspondRecherche(['Émile', 'Durand', null], 'emile')).toBe(true)
    expect(correspondRecherche(['Anou Phetsomphou', 'Soutien mensuel'], 'anou soutien')).toBe(true)
    expect(correspondRecherche(['Anou Phetsomphou', 'Soutien mensuel'], 'anou fete')).toBe(false)
  })
})
