import { describe, expect, it } from 'vitest'
import type { FonctionnalitesActivees } from '../hooks/useFonctionnalitesActivees'
import { buildNavItems, type NavEntry } from './adminNav'

const flags = (overrides: Partial<FonctionnalitesActivees> = {}): FonctionnalitesActivees => ({
  dons: true, adherents: true, evenements: true, credit_manuel: false, ...overrides,
})
const noCounters = { donsReguliersAConfirmer: null, demandesEnAttente: null }

const labels = (entries: NavEntry[]) => entries.map((e) => e.label)
const group = (entries: NavEntry[], label: string) => {
  const entry = entries.find((e) => e.label === label)
  return entry?.type === 'group' ? entry.items : undefined
}

describe('buildNavItems', () => {
  it('range Communication et le porte-monnaie selon la simulation 1', () => {
    const nav = buildNavItems(flags(), noCounters)
    expect(labels(nav)).toEqual(['Accueil', 'Dons', 'Adhérents', 'Activités', 'Communication', 'Statistiques', 'Paramètres'])
    expect(group(nav, 'Activités')?.map((i) => i.to)).toEqual(['/admin/activites', '/admin/activites/porte-monnaie'])
    expect(group(nav, 'Communication')?.map((i) => i.to)).toEqual(['/admin/communication/emailing', '/admin/communication/courrier'])
    expect(group(nav, 'Adhérents')?.map((i) => i.label)).toEqual(['Adhérents', 'Demandes'])
  })

  it('sans le module adhérents : ni Adhérents ni Communication', () => {
    const nav = buildNavItems(flags({ adherents: false }), noCounters)
    expect(labels(nav)).not.toContain('Adhérents')
    expect(labels(nav)).not.toContain('Communication')
    expect(group(nav, 'Paramètres')?.map((i) => i.label)).not.toContain('Adhérents')
  })

  it('sans evenements : pas de Porte-monnaie', () => {
    const nav = buildNavItems(flags({ evenements: false }), noCounters)
    expect(group(nav, 'Activités')?.map((i) => i.label)).toEqual(['Toutes les activités'])
  })

  it('avec seulement evenements : Activités ne contient que le porte-monnaie', () => {
    const nav = buildNavItems(flags({ dons: false, adherents: false }), noCounters)
    expect(labels(nav)).toEqual(['Accueil', 'Activités', 'Paramètres'])
    expect(group(nav, 'Activités')?.map((i) => i.label)).toEqual(['Porte-monnaie'])
  })

  it('sans dons : ni Dons ni Statistiques', () => {
    const nav = buildNavItems(flags({ dons: false }), noCounters)
    expect(labels(nav)).not.toContain('Dons')
    expect(labels(nav)).not.toContain('Statistiques')
  })

  it('porte les compteurs sur Dons réguliers et Demandes', () => {
    const nav = buildNavItems(flags(), { donsReguliersAConfirmer: 3, demandesEnAttente: 2 })
    expect(group(nav, 'Dons')?.find((i) => i.label === 'Dons réguliers')?.count).toBe(3)
    expect(group(nav, 'Adhérents')?.find((i) => i.label === 'Demandes')?.count).toBe(2)
  })
})
