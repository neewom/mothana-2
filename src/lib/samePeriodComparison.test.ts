import { describe, expect, it } from 'vitest'
import { computeSamePeriodComparison, formatDayMonth } from './samePeriodComparison'

const dons = [
  { date: '2025-01-01', montant: 100 },
  { date: '2025-11-09', montant: 50 },
  { date: '2025-11-10', montant: 1000 },
  { date: '2025-12-31', montant: 2000 },
  { date: '2026-01-15', montant: 300 },
  { date: '2026-11-09', montant: 20 },
  { date: '2026-12-20', montant: 7 }, // don daté dans le futur
  { date: '2024-06-01', montant: 999 },
]

describe('computeSamePeriodComparison', () => {
  it("année en cours : du 1er janvier à aujourd'hui inclus, sur les deux années", () => {
    const r = computeSamePeriodComparison(dons, 2026, new Date(2026, 10, 9))
    expect(r.totalN).toBe(320)
    expect(r.totalN1).toBe(150)
    expect(r.variationPct).toBeCloseTo(((320 - 150) / 150) * 100)
    expect(r.cutoff).toBe('11-09')
  })

  it('année passée : année complète contre année complète', () => {
    const r = computeSamePeriodComparison(dons, 2025, new Date(2026, 10, 9))
    expect(r.totalN).toBe(3150)
    expect(r.totalN1).toBe(999)
    expect(r.cutoff).toBeNull()
  })

  it("N-1 = 0 : variation null (affichée « — »)", () => {
    const r = computeSamePeriodComparison(dons, 2024, new Date(2026, 10, 9))
    expect(r.totalN1).toBe(0)
    expect(r.variationPct).toBeNull()
  })

  it('29 février : N-1 non bissextile arrêtée au 28 février', () => {
    const leap = [
      { date: '2027-02-28', montant: 10 },
      { date: '2027-03-01', montant: 500 },
      { date: '2028-02-29', montant: 40 },
      { date: '2028-03-01', montant: 900 },
    ]
    const r = computeSamePeriodComparison(leap, 2028, new Date(2028, 1, 29))
    expect(r.totalN).toBe(40)
    expect(r.totalN1).toBe(10)
    expect(r.cutoff).toBe('02-29')
    expect(r.variationPct).toBeCloseTo(300)
  })

  it('28 février d’une année bissextile : le 29 février N-1 n’existe pas, rien de perdu', () => {
    const r = computeSamePeriodComparison(
      [{ date: '2028-02-28', montant: 5 }, { date: '2027-02-28', montant: 5 }],
      2028,
      new Date(2028, 1, 28),
    )
    expect(r.variationPct).toBe(0)
  })

  it('totalAfterCutoff : dons datés après aujourd’hui, arrondi au centime', () => {
    const r = computeSamePeriodComparison(
      [
        { date: '2026-03-01', montant: 0.1 },
        { date: '2026-04-01', montant: 0.2 },
        { date: '2026-11-09', montant: 0.3 },
        { date: '2026-12-01', montant: 12.34 },
        { date: '2026-12-31', montant: 0.01 },
        { date: '2025-12-01', montant: 99 },
      ],
      2026,
      new Date(2026, 10, 9),
    )
    expect(r.totalAfterCutoff).toBe(12.35)
    expect(r.totalN).toBeCloseTo(0.6)
  })

  it('totalAfterCutoff vaut exactement 0 sans don futur, malgré les résidus flottants', () => {
    const dons = [
      { date: '2026-01-10', montant: 0.2 },
      { date: '2026-02-10', montant: 0.3 },
      { date: '2026-02-20', montant: 0.1 },
    ]
    const r = computeSamePeriodComparison(dons, 2026, new Date(2026, 10, 9))
    // Cas reproduit : la somme des sommes mensuelles (monthlyData de la page) dépasse
    // la somme don par don, alors qu'aucun don n'est daté après aujourd'hui.
    const monthlySum = 0.2 + (0.3 + 0.1)
    expect(monthlySum).toBeGreaterThan(r.totalN)
    expect(r.totalAfterCutoff).toBe(0)
  })

  it('année passée : totalAfterCutoff à 0', () => {
    const r = computeSamePeriodComparison([{ date: '2025-12-31', montant: 7 }], 2025, new Date(2026, 10, 9))
    expect(r.totalAfterCutoff).toBe(0)
  })

  it('tolère une date avec heure', () => {
    const r = computeSamePeriodComparison([{ date: '2026-11-09T10:00:00', montant: 3 }], 2026, new Date(2026, 10, 9))
    expect(r.totalN).toBe(3)
  })
})

describe('formatDayMonth', () => {
  it('formate jour et mois abrégé', () => {
    expect(formatDayMonth('11-09')).toBe('9 nov.')
    expect(formatDayMonth('01-01')).toBe('1ᵉʳ janv.')
  })
})
