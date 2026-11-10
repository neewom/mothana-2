import { describe, expect, it } from 'vitest'
import { documentApercuMessage, estCampagneAnterieure, filtreRechercheDestinataires, libelleAuteur } from './campagneMailingDetail'

describe('filtreRechercheDestinataires', () => {
  it('ignore une recherche de moins de 2 caractères', () => {
    expect(filtreRechercheDestinataires('')).toBeNull()
    expect(filtreRechercheDestinataires(' a ')).toBeNull()
  })

  it('cherche dans le nom et l’email, mots dans l’ordre', () => {
    expect(filtreRechercheDestinataires('marie  dup')).toBe('nom.ilike."*marie*dup*",courriel.ilike."*marie*dup*"')
  })

  it('neutralise guillemets, antislash et jokers ; virgules et parenthèses restent entre guillemets', () => {
    expect(filtreRechercheDestinataires('a"b\\c*d%e_f')).toBe('nom.ilike."*a*b*c*d*e*f*",courriel.ilike."*a*b*c*d*e*f*"')
    expect(filtreRechercheDestinataires('x,y)')).toBe('nom.ilike."*x,y)*",courriel.ilike."*x,y)*"')
    expect(filtreRechercheDestinataires('"*"')).toBeNull()
  })
})

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
  })
})
