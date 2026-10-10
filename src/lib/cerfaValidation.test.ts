import { describe, expect, it } from 'vitest'
import type { Personne } from '../types'
import { pagesParametresACompleter, validateOrganisationCerfa, resumeValidationParticipant, validateParticipantCerfa } from './cerfaValidation'

describe('pagesParametresACompleter', () => {
  it('renvoie Organisation pour l’identité et Reçus fiscaux pour la mention légale', () => {
    expect(pagesParametresACompleter(['adresse', 'RNA ou SIREN']).map((p) => p.to)).toEqual(['/admin/parametres'])
    expect(pagesParametresACompleter(['mention légale']).map((p) => p.to)).toEqual(['/admin/parametres/recus-fiscaux'])
    expect(pagesParametresACompleter(['ville', 'mention légale']).map((p) => p.to)).toEqual(['/admin/parametres', '/admin/parametres/recus-fiscaux'])
    expect(pagesParametresACompleter([])).toEqual([])
  })

  it('couvre tous les champs que la validation peut signaler', () => {
    const missing = validateOrganisationCerfa({ adresse: null, code_postal: null, ville: null, modele_recu_pdf: {} } as never)
    expect(pagesParametresACompleter(missing)).toHaveLength(2)
  })
})

describe('resumeValidationParticipant', () => {
  const personne = (champs: Partial<Personne>) =>
    ({ nom: 'Durand', prenom: 'Anne', civilite: 2, adresse: '1 rue', code_postal: '75001', ville: 'Paris', ...champs }) as Personne

  it('résume un blocage en quelques mots', () => {
    expect(resumeValidationParticipant(validateParticipantCerfa(personne({})))).toBeNull()
    expect(resumeValidationParticipant(validateParticipantCerfa(personne({ adresse: null, ville: null, prenom: null })))).toBe('3 champs manquants')
    expect(resumeValidationParticipant(validateParticipantCerfa(personne({ ville: null })))).toBe('1 champ manquant')
    expect(resumeValidationParticipant(validateParticipantCerfa(personne({ civilite: null })))).toBe('Civilité manquante')
    expect(resumeValidationParticipant(validateParticipantCerfa(personne({ civilite: 7 })))).toBe('Don au nom d’une famille')
  })
})
