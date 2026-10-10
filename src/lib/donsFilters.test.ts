import { describe, expect, it } from 'vitest'
import type { Don } from '../types'
import { bornesPeriode, DONS_FILTRES_VIDES, filtrerDons, nombreFiltresDons } from './donsFilters'

const don = (id: string, overrides: Partial<Don> & { nom?: string; prenom?: string | null; email?: string | null; activite?: string } = {}): Don => {
  const { nom = 'Durand', prenom = 'Anne', email = null, activite, ...rest } = overrides
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
    profils_participant: { personnes: { nom, prenom, email } } as unknown as Don['profils_participant'],
    activites: activite ? ({ nom: activite } as unknown as Don['activites']) : null,
    ...rest,
  }
}

const ids = (dons: Don[]) => dons.map((d) => d.id)

describe('bornesPeriode', () => {
  it('calcule les raccourcis, aujourd’hui inclus', () => {
    expect(bornesPeriode('30j', '2026-03-10')).toEqual({ dateDebut: '2026-02-08', dateFin: '2026-03-10' })
    expect(bornesPeriode('mois', '2026-03-10')).toEqual({ dateDebut: '2026-03-01', dateFin: '2026-03-10' })
    expect(bornesPeriode('annee', '2026-03-10')).toEqual({ dateDebut: '2026-01-01', dateFin: '2026-03-10' })
    expect(bornesPeriode('tout', '2026-03-10')).toEqual({ dateDebut: '', dateFin: '' })
  })
})

describe('nombreFiltresDons', () => {
  it('compte la période une seule fois', () => {
    expect(nombreFiltresDons(DONS_FILTRES_VIDES)).toBe(0)
    expect(nombreFiltresDons({ ...DONS_FILTRES_VIDES, dateDebut: '2026-01-01', dateFin: '2026-02-01', mode: '2' })).toBe(2)
  })
})

describe('filtrerDons', () => {
  const liste = [
    don('a', { date: '2026-04-13', nom: 'Boulom', prenom: 'Nicolas', email: 'n@ex.fr', activite: 'Nouvel An Lao', mode_paiement: 2 }),
    don('b', { date: '2025-04-20', nom: 'Bernard', activite: 'Fête', activite_id: 'act-1' }),
    don('c', { date: '2026-03-15', nom: 'Émile', prenom: null, profil_participant_id: 'p2' }),
  ]

  it('applique les bornes de date', () => {
    expect(ids(filtrerDons(liste, { ...DONS_FILTRES_VIDES, dateDebut: '2026-01-01' }, ''))).toEqual(['a', 'c'])
    expect(ids(filtrerDons(liste, { ...DONS_FILTRES_VIDES, dateFin: '2026-03-15' }, ''))).toEqual(['b', 'c'])
  })

  it('filtre par donateur, activité et mode', () => {
    expect(ids(filtrerDons(liste, { ...DONS_FILTRES_VIDES, participantId: 'p2' }, ''))).toEqual(['c'])
    expect(ids(filtrerDons(liste, { ...DONS_FILTRES_VIDES, activiteId: 'act-1' }, ''))).toEqual(['b'])
    expect(ids(filtrerDons(liste, { ...DONS_FILTRES_VIDES, mode: '2' }, ''))).toEqual(['a'])
  })

  it('cherche dans le donateur, l’email et l’activité, sans accents ni casse', () => {
    expect(ids(filtrerDons(liste, DONS_FILTRES_VIDES, 'emile'))).toEqual(['c'])
    expect(ids(filtrerDons(liste, DONS_FILTRES_VIDES, 'nicolas lao'))).toEqual(['a'])
    expect(ids(filtrerDons(liste, DONS_FILTRES_VIDES, 'n@ex'))).toEqual(['a'])
    expect(ids(filtrerDons(liste, DONS_FILTRES_VIDES, 'fete'))).toEqual(['b'])
  })
})
