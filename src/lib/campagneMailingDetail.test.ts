import { describe, expect, it } from 'vitest'
import { documentApercuMessage, estCampagneAnterieure, libelleAuteur } from './campagneMailingDetail'

describe('libelleAuteur', () => {
  const auteurs = new Map([['u1', 'Claire Martin'], ['u2', '  ']])
  it('nom affiché du compte, repli pour un compte inconnu ou sans nom', () => {
    expect(libelleAuteur('u1', auteurs)).toBe('Claire Martin')
    expect(libelleAuteur('u2', auteurs)).toBe('Un administrateur')
    expect(libelleAuteur('u3', auteurs)).toBe('Un administrateur')
    expect(libelleAuteur(null, auteurs)).toBe('—')
  })
})

describe('estCampagneAnterieure', () => {
  it('sans libellé de sélection', () => {
    expect(estCampagneAnterieure({ selection_label: null })).toBe(true)
    expect(estCampagneAnterieure({ selection_label: 'Tous sauf archivés' })).toBe(false)
  })
})

describe('documentApercuMessage', () => {
  it('enveloppe le corps sans script ajouté', () => {
    const doc = documentApercuMessage('<p>Bonjour</p>')
    expect(doc).toContain('<body><p>Bonjour</p></body>')
    expect(doc).not.toContain('<script')
    expect(doc).toContain('<base target="_blank">')
  })
})
