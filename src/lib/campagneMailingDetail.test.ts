import { describe, expect, it } from 'vitest'
import { affichagePiecesJointes, documentApercuMessage, estCampagneAnterieure, libelleAuteur } from './campagneMailingDetail'

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

describe('affichagePiecesJointes', () => {
  it('noms enregistrés, un par pièce jointe', () => {
    expect(affichagePiecesJointes(['convocation.pdf', 'plan.png'], 2)).toEqual({ kind: 'noms', noms: ['convocation.pdf', 'plan.png'] })
  })
  it('tableau vide : aucune', () => {
    expect(affichagePiecesJointes([], 0)).toEqual({ kind: 'aucune' })
  })
  it('noms absents mais nombre enregistré (campagne entre les deux versions)', () => {
    expect(affichagePiecesJointes(null, 2)).toEqual({ kind: 'nombre', nombre: 2 })
    expect(affichagePiecesJointes(null, 0)).toEqual({ kind: 'aucune' })
  })
  it('rien d’enregistré : campagne antérieure', () => {
    expect(affichagePiecesJointes(null, null)).toEqual({ kind: 'non_enregistre' })
  })
})
