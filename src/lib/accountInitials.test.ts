import { describe, expect, it } from 'vitest'
import { accountInitials } from './accountInitials'

describe('accountInitials', () => {
  it('prend la première et la dernière initiale du nom affiché', () => {
    expect(accountInitials('Admin Démo', 'x@y.fr')).toBe('AD')
    expect(accountInitials('Jean Pierre Martin', null)).toBe('JM')
    expect(accountInitials('élise', null)).toBe('ÉL')
  })

  it('se rabat sur la partie locale de l’email', () => {
    expect(accountInitials(null, 'admin-demo@mothana-staging.internal')).toBe('AD')
    expect(accountInitials('  ', 'nicolas.boulom@gmail.com')).toBe('NB')
    expect(accountInitials(undefined, 'contact@asso.fr')).toBe('CO')
  })

  it('renvoie « ? » sans aucune donnée', () => {
    expect(accountInitials(null, null)).toBe('?')
  })
})
