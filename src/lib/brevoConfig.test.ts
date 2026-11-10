import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabaseClient', () => ({ supabase: {} }))

import { statutExpediteurDepuisReponse } from './brevoConfig'

describe('statutExpediteurDepuisReponse', () => {
  it('reprend le statut renvoyé par la fonction', () => {
    for (const statut of ['non_configure', 'valide', 'en_attente', 'introuvable', 'erreur']) {
      expect(statutExpediteurDepuisReponse({ statut }, null)).toBe(statut)
    }
  })

  it("erreur d'appel (401, 403, réseau) : erreur", () => {
    expect(statutExpediteurDepuisReponse(null, new Error('FunctionsHttpError'))).toBe('erreur')
    expect(statutExpediteurDepuisReponse({ statut: 'valide' }, new Error('x'))).toBe('erreur')
  })

  it('réponse inattendue : erreur', () => {
    expect(statutExpediteurDepuisReponse(null, null)).toBe('erreur')
    expect(statutExpediteurDepuisReponse({}, null)).toBe('erreur')
    expect(statutExpediteurDepuisReponse({ statut: 'actif' }, null)).toBe('erreur')
  })
})
