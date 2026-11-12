import { describe, it, expect } from 'vitest'
import { cheminEspaceConnecte } from './espaceUtilisateur'

describe('cheminEspaceConnecte', () => {
  it('envoie chaque rôle connecté vers son espace', () => {
    expect(cheminEspaceConnecte('super_admin')).toBe('/super-admin')
    expect(cheminEspaceConnecte('admin')).toBe('/admin')
    expect(cheminEspaceConnecte('benevole')).toBe('/benevole')
    expect(cheminEspaceConnecte('vendeur')).toBe('/vendeur')
  })

  it("ne redirige pas un visiteur non connecté ni pendant le chargement", () => {
    expect(cheminEspaceConnecte('unauthenticated')).toBeNull()
    expect(cheminEspaceConnecte('loading')).toBeNull()
  })
})
