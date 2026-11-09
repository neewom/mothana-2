import { describe, expect, it } from 'vitest'
import { correspondRecherche, normaliserRecherche } from './faqSearch'

const item = {
  question: 'Comment traiter une demande d’adhésion ou de renouvellement ?',
  answer: 'Les demandes de renouvellement à valider :',
  steps: ['La demande arrive dans Adhérents › Renouvellements.'],
}

describe('normaliserRecherche', () => {
  it('ignore casse, accents et apostrophes', () => {
    expect(normaliserRecherche('Demande d’Adhésion')).toBe('demande d adhesion')
    expect(normaliserRecherche("demande d'adhesion")).toBe('demande d adhesion')
  })
})

describe('correspondRecherche', () => {
  it('trouve avec une apostrophe droite ce qui est écrit avec une typographique', () => {
    expect(correspondRecherche(item, "Comment traiter une demande d'adhésion")).toBe(true)
  })
  it('accepte les mots dans le désordre et sans accents', () => {
    expect(correspondRecherche(item, 'adhesion traiter')).toBe(true)
  })
  it('cherche aussi dans les étapes', () => {
    expect(correspondRecherche(item, 'arrive renouvellements')).toBe(true)
  })
  it('refuse si un mot manque', () => {
    expect(correspondRecherche(item, 'adhésion facture')).toBe(false)
  })
  it('une recherche vide correspond à tout', () => {
    expect(correspondRecherche(item, '  ')).toBe(true)
  })
})
