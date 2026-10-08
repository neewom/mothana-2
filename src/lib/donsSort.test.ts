import { describe, expect, it } from 'vitest'
import type { Don } from '../types'
import { directionInitialeDon, trierDons } from './donsSort'

const don = (id: string, overrides: Partial<Don> & { nom?: string; prenom?: string | null } = {}): Don => {
  const { nom = 'Durand', prenom = 'Anne', ...rest } = overrides
  return {
    id,
    profil_participant_id: 'p',
    organisation_id: 'o',
    activite_id: null,
    montant: 10,
    date: '2026-01-01',
    mode_paiement: 1,
    created_by_role: 'admin',
    id_externe: null,
    don_regulier_id: null,
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-01T10:00:00Z',
    profils_participant: { personnes: { nom, prenom } } as unknown as Don['profils_participant'],
    activites: null,
    ...rest,
  }
}

const ids = (dons: Don[]) => dons.map((d) => d.id)

describe('trierDons', () => {
  // Exemple de la carte : 13 avril 2026, 20 avril 2025, 15 mars 2026 (ordre des UUID).
  const liste = [
    don('a', { date: '2026-04-13', montant: 50 }),
    don('b', { date: '2025-04-20', montant: 200, nom: 'Bernard' }),
    don('c', { date: '2026-03-15', montant: 5, nom: 'Émile', prenom: null }),
  ]

  it('met le don le plus récent en tête par défaut', () => {
    expect(ids(trierDons(liste, 'date', 'desc'))).toEqual(['a', 'c', 'b'])
  })

  it('départage par date de création à date égale', () => {
    const memeJour = [
      don('ancien', { date: '2026-05-01', created_at: '2026-05-01T08:00:00Z' }),
      don('recent', { date: '2026-05-01', created_at: '2026-05-01T18:00:00Z' }),
    ]
    expect(ids(trierDons(memeJour, 'date', 'desc'))).toEqual(['recent', 'ancien'])
    expect(ids(trierDons(memeJour, 'date', 'asc'))).toEqual(['ancien', 'recent'])
  })

  it('trie par montant dans les deux sens', () => {
    expect(ids(trierDons(liste, 'montant', 'desc'))).toEqual(['b', 'a', 'c'])
    expect(ids(trierDons(liste, 'montant', 'asc'))).toEqual(['c', 'a', 'b'])
  })

  it('trie les donateurs par nom puis prénom, sans tenir compte des accents ni de la casse', () => {
    // Bernard, Durand, Émile (É classé avec E)
    expect(ids(trierDons(liste, 'donateur', 'asc'))).toEqual(['b', 'a', 'c'])
    const homonymes = [don('zoe', { nom: 'martin', prenom: 'Zoé' }), don('alain', { nom: 'Martin', prenom: 'Alain' })]
    expect(ids(trierDons(homonymes, 'donateur', 'asc'))).toEqual(['alain', 'zoe'])
  })

  it('ne modifie pas la liste d’origine', () => {
    const copie = [...liste]
    trierDons(liste, 'montant', 'asc')
    expect(liste).toEqual(copie)
  })

  it('ouvre Date et Montant en décroissant, Donateur en croissant', () => {
    expect(directionInitialeDon('date')).toBe('desc')
    expect(directionInitialeDon('montant')).toBe('desc')
    expect(directionInitialeDon('donateur')).toBe('asc')
  })
})
