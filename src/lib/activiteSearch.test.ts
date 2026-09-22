import { describe, expect, it } from 'vitest'
import type { Activite } from '../types'
import { filterActivites, findExactActivite } from './activiteSearch'

const activites: Activite[] = [
  { id: '1', organisation_id: 'org', nom: 'Nouvel An lao', id_externe: null, date_debut: null, date_fin: null },
  { id: '2', organisation_id: 'org', nom: 'Fête culturelle', id_externe: null, date_debut: null, date_fin: null },
]

describe('recherche d’activités', () => {
  it('conserve le filtrage partiel utilisé par l’autocomplete', () => {
    expect(filterActivites(activites, 'an lao')).toEqual([activites[0]])
  })

  it('retrouve une activité existante sur une correspondance exacte normalisée', () => {
    expect(findExactActivite(activites, '  FÊTE CULTURELLE  ')).toEqual(activites[1])
  })

  it('laisse un nom libre sans correspondance pour une création', () => {
    expect(findExactActivite(activites, 'Nouvelle activité')).toBeUndefined()
  })
})
