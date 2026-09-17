import { describe, expect, it } from 'vitest'
import type { ProfilParticipant } from '../types'
import { filterParticipants, matchesParticipantSearch } from './participantSearch'

function participant(nom: string, prenom: string | null): ProfilParticipant {
  return {
    id: crypto.randomUUID(),
    personne_id: crypto.randomUUID(),
    organisation_id: crypto.randomUUID(),
    notes: null,
    id_externe: null,
    created_at: '2026-09-17T00:00:00.000Z',
    personnes: {
      id: crypto.randomUUID(),
      nom,
      prenom,
      email: null,
      telephone: null,
      civilite: null,
      nom2: null,
      prenom2: null,
      adresse: null,
      code_postal: null,
      ville: null,
      pays: null,
    },
  }
}

describe('participant search', () => {
  const jeanDupont = participant('Dupont', 'Jean')

  it.each(['Jean Dupont', 'Dupont Jean', 'Dup Jea', '  DUPONT   jean  '])(
    'finds a participant with "%s"',
    (search) => {
      expect(matchesParticipantSearch(jeanDupont, search)).toBe(true)
    },
  )

  it('rejects a participant when one token is absent', () => {
    expect(matchesParticipantSearch(jeanDupont, 'Dupont Marie')).toBe(false)
  })

  it('filters a participant list independently of name order', () => {
    const marieMartin = participant('Martin', 'Marie')

    expect(filterParticipants([marieMartin, jeanDupont], 'Dupont Jean')).toEqual([jeanDupont])
  })
})
