import { describe, expect, it } from 'vitest'
import { achatSimuleErrorMessage, isEvenementPublic } from './evenementAchat'

describe('isEvenementPublic', () => {
  const event = {
    id: 'c7e3e34d-f160-4ca5-98f0-d77cb68e4788',
    nom: 'Fête du temple',
    date_evenement: '2026-10-02',
    montants_credit_centimes: [500, 1000],
    nom_organisation: 'Association de démonstration',
  }

  it('accepte un événement public complet', () => {
    expect(isEvenementPublic(event)).toBe(true)
  })

  it('refuse des paliers vides ou invalides', () => {
    expect(isEvenementPublic({ ...event, montants_credit_centimes: [] })).toBe(false)
    expect(isEvenementPublic({ ...event, montants_credit_centimes: [0, 500] })).toBe(false)
  })
})

describe('achatSimuleErrorMessage', () => {
  it('rend explicite la désactivation du kill-switch', () => {
    expect(achatSimuleErrorMessage('SIMULATION_DESACTIVEE')).toContain('désactivé')
  })

  it('ne révèle pas de détail serveur pour une erreur inconnue', () => {
    expect(achatSimuleErrorMessage('ERREUR_INTERNE')).toBe(
      'Le service est momentanément indisponible. Réessayez dans un instant.',
    )
  })

  it('ne promet pas un email lors de la reprise d’une commande déjà traitée', () => {
    expect(achatSimuleErrorMessage('COMMANDE_DEJA_TRAITEE')).toContain('déjà crédité')
    expect(achatSimuleErrorMessage('COMMANDE_DEJA_TRAITEE')).not.toContain('envoyé')
  })
})
