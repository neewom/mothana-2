import { describe, expect, it } from 'vitest'
import { computeDateFin } from './adhesion'

// Mêmes cas que supabase/tests/adhesion_duree_reglable.sql (la base fait foi).
describe('computeDateFin', () => {
  it('règle par défaut : un an après la date d’adhésion', () => {
    expect(computeDateFin('2026-03-15')).toBe('2027-03-15')
    expect(computeDateFin('2024-02-29')).toBe('2025-02-28')
    expect(computeDateFin('2026-12-31')).toBe('2027-12-31')
  })

  it('au 31 décembre, bascule en décembre', () => {
    const regle = { regleFin: 'annee_civile' as const, moisBascule: 12 }
    expect(computeDateFin('2026-03-15', regle)).toBe('2026-12-31')
    expect(computeDateFin('2026-11-30', regle)).toBe('2026-12-31')
    expect(computeDateFin('2026-12-05', regle)).toBe('2027-12-31')
  })

  it('au 31 décembre, bascule en octobre', () => {
    const regle = { regleFin: 'annee_civile' as const, moisBascule: 10 }
    expect(computeDateFin('2026-09-30', regle)).toBe('2026-12-31')
    expect(computeDateFin('2026-10-15', regle)).toBe('2027-12-31')
  })
})
