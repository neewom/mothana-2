import { describe, expect, it } from 'vitest'
import { differencesCoordonnees, messageErreurValidation } from './validationRenouvellement'

const fiche = {
  civilite: 1 as const,
  nom: 'BOULOM',
  prenom: 'Nicolas',
  adresse: '1 rue de la Paix',
  code_postal: '75001',
  ville: 'Paris',
  pays: 'France',
  telephone: '0600000000',
  courriel: 'nicolas@example.org',
}

describe('differencesCoordonnees', () => {
  it('ne renvoie rien quand les coordonnées sont identiques', () => {
    expect(differencesCoordonnees(fiche, { ...fiche })).toEqual([])
  })

  it('ignore les espaces et assimile vide et absent', () => {
    expect(differencesCoordonnees({ ...fiche, telephone: null }, { ...fiche, telephone: '  ', ville: ' Paris ' })).toEqual([])
  })

  it('liste chaque champ modifié dans l’ordre du formulaire, avec ses valeurs affichables', () => {
    expect(differencesCoordonnees(fiche, { ...fiche, courriel: null, ville: 'Lyon', civilite: 2 })).toEqual([
      { champ: 'civilite', label: 'Civilité', actuel: 'Monsieur', propose: 'Madame' },
      { champ: 'ville', label: 'Ville', actuel: 'Paris', propose: 'Lyon' },
      { champ: 'courriel', label: 'Courriel', actuel: 'nicolas@example.org', propose: '—' },
    ])
  })
})

describe('messageErreurValidation', () => {
  it('traduit les codes de la RPC', () => {
    expect(messageErreurValidation('ADHERENT_ARCHIVE')).toMatch(/réactivation/)
    expect(messageErreurValidation('ADHERENT_INTROUVABLE')).toMatch(/supprimé/)
  })

  it('garde un message inconnu tel quel', () => {
    expect(messageErreurValidation('boom')).toBe('boom')
  })
})
