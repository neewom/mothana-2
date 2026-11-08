import { describe, expect, it } from 'vitest'
import { ADHERENTS_FILTRES_VIDES, EMAIL_FILTRE_LABELS, ajouterJours, etatAdhesion, etatDateFin, libelleAdhesion, nombreFiltresAdherents, normaliserFiltresAdherents } from './adherentsFiltres'

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
  it('distingue à jour, à renouveler, expirée et absente', () => {
    // Ambre : une fiche sans adhésion est classée dans « Expirés » (relecture PR #371).
    expect(libelleAdhesion(undefined, today)).toEqual({ label: 'Aucune adhésion', variant: 'warning' })
    expect(libelleAdhesion({ date_fin: null }, today)).toEqual({ label: 'À jour', variant: 'success' })
    expect(libelleAdhesion({ date_fin: '2027-08-25' }, today)).toEqual({ label: "À jour · jusqu'au 25/08/2027", variant: 'success' })
    // Fin aujourd'hui : encore valide, mais dans les 30 jours → à renouveler (ambre).
    expect(libelleAdhesion({ date_fin: '2026-10-10' }, today)).toEqual({ label: "À renouveler · jusqu'au 10/10/2026", variant: 'warning' })
    expect(libelleAdhesion({ date_fin: '2026-11-09' }, today)).toEqual({ label: "À renouveler · jusqu'au 09/11/2026", variant: 'warning' })
    expect(libelleAdhesion({ date_fin: '2026-11-10' }, today)).toEqual({ label: "À jour · jusqu'au 10/11/2026", variant: 'success' })
    expect(libelleAdhesion({ date_fin: '2026-08-28' }, today)).toEqual({ label: 'Expirée depuis le 28/08/2026', variant: 'warning' })
  })
})

describe('etatAdhesion', () => {
  const today = '2026-10-17'
  it('à renouveler de aujourd’hui à aujourd’hui + 30 jours inclus, expiré à J+1 de la fin', () => {
    expect(etatAdhesion(undefined, today)).toBe('expire')
    expect(etatAdhesion({ date_fin: null }, today)).toBe('a_jour')
    expect(etatAdhesion({ date_fin: '2026-10-16' }, today)).toBe('expire')
    expect(etatAdhesion({ date_fin: '2026-10-17' }, today)).toBe('a_renouveler')
    expect(etatAdhesion({ date_fin: '2026-11-16' }, today)).toBe('a_renouveler')
    expect(etatAdhesion({ date_fin: '2026-11-17' }, today)).toBe('a_jour')
  })
})

describe('etatDateFin', () => {
  it('compte une date de fin vide (aucune adhésion) comme expirée', () => {
    expect(etatDateFin(null, '2026-10-17')).toBe('expire')
    expect(etatDateFin('2026-10-20', '2026-10-17')).toBe('a_renouveler')
    expect(etatDateFin('2027-10-20', '2026-10-17')).toBe('a_jour')
  })

  it('distingue « aucune adhésion » (expirée) de « adhésion sans date de fin » (à jour), comme search_adherents', () => {
    expect(etatDateFin(null, '2026-10-17', false)).toBe('expire')
    expect(etatDateFin(null, '2026-10-17', true)).toBe('a_jour')
    expect(etatDateFin(undefined, '2026-10-17', true)).toBe('a_jour')
    expect(etatDateFin('2026-10-01', '2026-10-17', true)).toBe('expire')
    expect(etatDateFin('2026-10-20', '2026-10-17', true)).toBe('a_renouveler')
  })
})

describe('ajouterJours', () => {
  it('ajoute des jours en franchissant mois et années', () => {
    expect(ajouterJours('2026-10-17', 30)).toBe('2026-11-16')
    expect(ajouterJours('2026-12-15', 30)).toBe('2027-01-14')
    expect(ajouterJours('2028-02-28', 1)).toBe('2028-02-29')
  })
})
