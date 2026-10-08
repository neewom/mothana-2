import { describe, expect, it } from 'vitest'
import { conservationMoisValide, dateFinConservation, urlPolitiqueValide } from './couponRgpd'

describe('dateFinConservation', () => {
  it('ajoute la durée en mois à la date de fin de l’événement', () => {
    expect(dateFinConservation('2026-10-05', 18)).toBe('2028-04-05')
    expect(dateFinConservation('2026-12-15', 1)).toBe('2027-01-15')
  })

  it('ramène une fin de mois au dernier jour du mois cible, comme Postgres', () => {
    expect(dateFinConservation('2026-08-31', 18)).toBe('2028-02-29')
    expect(dateFinConservation('2027-01-31', 1)).toBe('2027-02-28')
  })
})

describe('conservationMoisValide', () => {
  it('borne la durée entre 1 et 120 mois entiers', () => {
    expect(conservationMoisValide(18)).toBe(true)
    expect(conservationMoisValide(0)).toBe(false)
    expect(conservationMoisValide(121)).toBe(false)
    expect(conservationMoisValide(12.5)).toBe(false)
  })
})

describe('urlPolitiqueValide', () => {
  it('accepte une URL http(s) complète', () => {
    expect(urlPolitiqueValide('https://asso.fr/confidentialite')).toBe(true)
    expect(urlPolitiqueValide(' http://asso.org/rgpd ')).toBe(true)
  })

  it('refuse les autres schémas et les adresses incomplètes', () => {
    expect(urlPolitiqueValide('javascript:alert(1)')).toBe(false)
    expect(urlPolitiqueValide('asso.fr/confidentialite')).toBe(false)
    expect(urlPolitiqueValide('https://localhost')).toBe(false)
    expect(urlPolitiqueValide('https://asso.fr/a b')).toBe(false)
  })
})
