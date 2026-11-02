import { describe, expect, it } from 'vitest'
import {
  demandeDejaTraitee,
  differencesCoordonnees,
  MESSAGE_DEMANDE_DEJA_TRAITEE,
  MESSAGE_ERREUR_GENERIQUE,
  messageErreurValidation,
} from './validationRenouvellement'

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

  it('traduit l’absence de règle d’adhésion en renvoyant vers les paramètres', () => {
    expect(messageErreurValidation('REGLE_ADHESION_INTROUVABLE')).toMatch(/Paramètres → Adhésions/)
  })

  it('traduit une demande déjà traitée', () => {
    expect(messageErreurValidation('DEMANDE_DEJA_TRAITEE')).toBe(MESSAGE_DEMANDE_DEJA_TRAITEE)
  })

  it('n’affiche jamais un code inconnu brut', () => {
    for (const code of ['DEMANDE_PAS_UN_RENOUVELLEMENT', 'CHAMP_INVALIDE', 'UN_CODE_FUTUR']) {
      const message = messageErreurValidation(code)
      expect(message).toBe(MESSAGE_ERREUR_GENERIQUE)
      expect(message).not.toContain(code)
    }
  })

  it('garde un message technique non codé tel quel', () => {
    expect(messageErreurValidation('boom')).toBe('boom')
    expect(messageErreurValidation('Failed to fetch')).toBe('Failed to fetch')
  })
})

describe('demandeDejaTraitee', () => {
  it('signale une mise à jour conditionnelle qui ne touche aucune ligne', () => {
    expect(demandeDejaTraitee([])).toBe(true)
    expect(demandeDejaTraitee(null)).toBe(true)
  })

  it('laisse passer une mise à jour effective', () => {
    expect(demandeDejaTraitee([{ id: 'x' }])).toBe(false)
  })
})
