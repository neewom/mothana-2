import { describe, expect, it } from 'vitest'
import { erreurSaisieAdhesionBenevole, messageErreurAdhesionBenevole, type SaisieAdhesionBenevole } from './adhesionBenevole'
import { CHAMPS_ADHESION_VIDES } from './champsAdhesion'

const valide: SaisieAdhesionBenevole = {
  valeurs: { ...CHAMPS_ADHESION_VIDES, civilite: 1, nom: 'DUPONT', prenom: 'Zoé', codePostal: '75001' },
  statutsRequis: true,
  accepteStatuts: true,
  consentRgpd: true,
  signature: 'data:image/png;base64,AAAA',
  signeSurPapier: false,
  dateDebut: '2026-11-04',
  montant: '',
}

describe('erreurSaisieAdhesionBenevole', () => {
  it('accepte une saisie complète, signée à l’écran ou sur papier', () => {
    expect(erreurSaisieAdhesionBenevole(valide)).toBeNull()
    expect(erreurSaisieAdhesionBenevole({ ...valide, signature: null, signeSurPapier: true })).toBeNull()
  })

  it('exige une signature ou la case papier', () => {
    expect(erreurSaisieAdhesionBenevole({ ...valide, signature: null })).toMatch(/signée sur papier/)
  })

  it('exige les statuts seulement si l’organisation en publie', () => {
    expect(erreurSaisieAdhesionBenevole({ ...valide, accepteStatuts: false })).toMatch(/statuts/)
    expect(erreurSaisieAdhesionBenevole({ ...valide, accepteStatuts: false, statutsRequis: false })).toBeNull()
  })

  it('refuse les champs non conformes', () => {
    expect(erreurSaisieAdhesionBenevole({ ...valide, consentRgpd: false })).toMatch(/consentement/)
    expect(erreurSaisieAdhesionBenevole({ ...valide, valeurs: { ...valide.valeurs, codePostal: '7500' } })).toMatch(/code postal/)
    expect(erreurSaisieAdhesionBenevole({ ...valide, valeurs: { ...valide.valeurs, courriel: 'x@' } })).toMatch(/email/)
    expect(erreurSaisieAdhesionBenevole({ ...valide, dateDebut: '' })).toMatch(/date d'adhésion/)
    expect(erreurSaisieAdhesionBenevole({ ...valide, montant: '-5' })).toMatch(/montant/)
    expect(erreurSaisieAdhesionBenevole({ ...valide, montant: '15.50' })).toBeNull()
  })
})

describe('messageErreurAdhesionBenevole', () => {
  it('explique un refus d’accès (réglage désactivé)', () => {
    expect(messageErreurAdhesionBenevole('ACCES_REFUSE')).toMatch(/pas activée/)
    expect(messageErreurAdhesionBenevole(undefined)).toMatch(/n'a pas pu être enregistrée/)
  })
})
