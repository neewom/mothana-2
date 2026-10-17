import { describe, expect, it } from 'vitest'
import { ADHERENTS_FILTRES_VIDES, EMAIL_FILTRE_LABELS, libelleAdhesion, nombreFiltresAdherents, normaliserFiltresAdherents } from './adherentsFiltres'

describe('nombreFiltresAdherents', () => {
  it('compte chaque filtre renseigné', () => {
    expect(nombreFiltresAdherents(ADHERENTS_FILTRES_VIDES)).toBe(0)
    expect(nombreFiltresAdherents({ ...ADHERENTS_FILTRES_VIDES, tag: 'Bureau', ville: 'Paris', email: 'sans' })).toBe(3)
    expect(nombreFiltresAdherents({ ...ADHERENTS_FILTRES_VIDES, excludeTag: 'Courrier', email: 'invalide' })).toBe(2)
  })

  it('ignore un champ texte fait d’espaces une fois normalisé', () => {
    expect(nombreFiltresAdherents(normaliserFiltresAdherents({ ...ADHERENTS_FILTRES_VIDES, ville: '  ' }))).toBe(0)
  })
})

describe('EMAIL_FILTRE_LABELS', () => {
  it('propose les adhérents dont l’email est invalide', () => {
    expect(EMAIL_FILTRE_LABELS.invalide).toBe('Email invalide')
    expect(Object.keys(EMAIL_FILTRE_LABELS)).toEqual(['avec', 'sans', 'invalide'])
  })
})

describe('libelleAdhesion', () => {
  const today = '2026-10-10'
  it('distingue à jour, expirée et absente', () => {
    expect(libelleAdhesion(undefined, today)).toEqual({ label: 'Aucune adhésion', variant: 'neutral' })
    expect(libelleAdhesion({ date_fin: null }, today)).toEqual({ label: 'À jour', variant: 'success' })
    expect(libelleAdhesion({ date_fin: '2027-08-25' }, today)).toEqual({ label: "À jour · jusqu'au 25/08/2027", variant: 'success' })
    expect(libelleAdhesion({ date_fin: '2026-10-10' }, today).variant).toBe('success')
    expect(libelleAdhesion({ date_fin: '2026-08-28' }, today)).toEqual({ label: 'Expirée depuis le 28/08/2026', variant: 'warning' })
  })
})
