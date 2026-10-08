import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { compterDonsReguliersAConfirmer } from './donsReguliers'

describe('compterDonsReguliersAConfirmer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15T12:00:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('compte les mois sans don généré, par engagement', () => {
    const engagements = [
      { id: 'a', date_debut: '2026-08-05', date_fin: null, jour_prelevement: 5 }, // août, sept., oct.
      { id: 'b', date_debut: '2026-10-01', date_fin: null, jour_prelevement: 1 }, // oct.
    ]
    const dons = [
      { don_regulier_id: 'a', date: '2026-08-05' },
      { don_regulier_id: null, date: '2026-09-05' },
    ]
    expect(compterDonsReguliersAConfirmer(engagements, dons)).toBe(3)
  })

  it('renvoie 0 sans engagement', () => {
    expect(compterDonsReguliersAConfirmer([], [])).toBe(0)
  })
})
