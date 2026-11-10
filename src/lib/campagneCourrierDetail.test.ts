import { describe, expect, it } from 'vitest'
import { estCampagneCourrierAnterieure, libelleSelectionCarte, RAISON_EXCLUSION_COURRIER_LABELS } from './campagneCourrierDetail'

describe('estCampagneCourrierAnterieure', () => {
  it('détail non enregistré (campagne antérieure à la carte) ou valeur absente', () => {
    expect(estCampagneCourrierAnterieure({ detail_enregistre: false })).toBe(true)
    expect(estCampagneCourrierAnterieure({ detail_enregistre: null })).toBe(true)
    expect(estCampagneCourrierAnterieure({ detail_enregistre: true })).toBe(false)
  })
})

describe('libelleSelectionCarte', () => {
  it('sélection seule ou suivie de l’exclusion', () => {
    expect(libelleSelectionCarte('Tous sauf archivés', null)).toBe('Tous sauf archivés')
    expect(libelleSelectionCarte('Liste : Bureau', 'Sauf liste : Bénévoles')).toBe('Liste : Bureau (sauf liste : Bénévoles)')
  })
})

describe('RAISON_EXCLUSION_COURRIER_LABELS', () => {
  it('une seule raison, adresse incomplète', () => {
    expect(RAISON_EXCLUSION_COURRIER_LABELS.adresse_incomplete).toBe('Adresse postale incomplète')
  })
})
