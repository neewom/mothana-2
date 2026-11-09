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
    expect(group(nav, 'Activités')?.map((i) => i.to)).toEqual(['/admin/activites', '/admin/activites/porte-monnaie', '/admin/activites/parametres'])
    expect(group(nav, 'Communication')?.map((i) => i.to)).toEqual(['/admin/communication/emailing', '/admin/communication/courrier'])
    expect(group(nav, 'Adhérents')?.map((i) => i.label)).toEqual(['Adhérents', 'Renouvellements', 'Journal', 'Paramètres'])
  })

  it('sans le module adhérents : ni Adhérents ni Communication', () => {
    const nav = buildNavItems(flags({ adherents: false }), noCounters, { canManageTeam: true, canManageSecrets: true })
    expect(labels(nav)).not.toContain('Adhérents')
    expect(labels(nav)).not.toContain('Communication')
    expect(group(nav, 'Paramètres')?.map((i) => i.label)).not.toContain('Adhérents')
  })

  it('sans evenements : pas de Porte-monnaie', () => {
    const nav = buildNavItems(flags({ evenements: false }), noCounters, { canManageTeam: true, canManageSecrets: true })
    expect(group(nav, 'Activités')?.map((i) => i.label)).toEqual(['Toutes les activités'])
    expect(group(nav, 'Paramètres')?.map((i) => i.label)).not.toContain('Porte-monnaie')
  })

  it('avec seulement evenements : Activités ne contient que le porte-monnaie', () => {
    const nav = buildNavItems(flags({ dons: false, adherents: false }), noCounters)
    expect(labels(nav)).toEqual(['Accueil', 'Activités', 'Paramètres'])
    expect(group(nav, 'Activités')?.map((i) => i.label)).toEqual(['Porte-monnaie', 'Paramètres'])
  })

  it('sans dons : ni Dons ni Statistiques', () => {
    const nav = buildNavItems(flags({ dons: false }), noCounters)
    expect(labels(nav)).not.toContain('Dons')
    expect(labels(nav)).not.toContain('Statistiques')
  })

  it('porte les compteurs sur Dons réguliers et Renouvellements', () => {
    const nav = buildNavItems(flags(), { donsReguliersAConfirmer: 3, demandesEnAttente: 2 })
    expect(group(nav, 'Dons')?.find((i) => i.label === 'Dons réguliers')?.count).toBe(3)
    expect(group(nav, 'Adhérents')?.find((i) => i.label === 'Renouvellements')?.count).toBe(2)
  })

  it('range les réglages de chaque module dans son groupe', () => {
    const nav = buildNavItems(flags(), noCounters, { canManageTeam: true, canManageSecrets: true })
    expect(group(nav, 'Dons')?.map((i) => i.to)).toEqual(['/admin/dons', '/admin/dons-reguliers', '/admin/participants', '/admin/recus', '/admin/dons/parametres'])
    expect(group(nav, 'Adhérents')?.map((i) => i.to)).toEqual(['/admin/adherents', '/admin/adherents/renouvellements', '/admin/adherents/journal', '/admin/adherents/parametres'])
    // Un seul item allumé : « Dons » et « Adhérents » ne doivent pas l'être sur leur page Paramètres.
    expect(group(nav, 'Dons')?.find((i) => i.label === 'Dons')?.end).toBe(true)
    expect(group(nav, 'Adhérents')?.find((i) => i.label === 'Adhérents')?.end).toBe(true)
  })

  it('aucune adresse de page n’est préfixe d’une adresse d’un autre groupe (un seul groupe allumé)', () => {
    const nav = buildNavItems(flags(), noCounters, { canManageTeam: true, canManageSecrets: true })
    const groups = nav.filter((e) => e.type === 'group')
    for (const g of groups) {
      for (const other of groups) {
        if (other === g) continue
        for (const item of g.items) {
          for (const o of other.items) expect(o.to.startsWith(item.to), `${item.to} / ${o.to}`).toBe(false)
        }
      }
    }
  })

  it('Paramètres ne garde que le transversal, Équipe et accès et Intégrations selon les droits', () => {
    const admin = group(buildNavItems(flags(), noCounters, { canManageTeam: true, canManageSecrets: true }), 'Paramètres')!
    expect(admin.map((i) => i.label)).toEqual(['Organisation', 'Équipe et accès', 'Intégrations'])
    expect(admin.find((i) => i.label === 'Équipe et accès')?.to).toBe('/admin/parametres/equipe')
    const contributeurNav = buildNavItems(flags(), noCounters, { canManageTeam: false, canManageSecrets: false })
    // Secrets (audit sécurité 2026-10-24) : ni Équipe et accès (codes PIN) ni Intégrations pour un membre, donc
    // Organisation seule : « Paramètres » devient un lien direct, pas un groupe à un élément.
    expect(contributeurNav.find((e) => e.label === 'Paramètres')).toEqual({ type: 'link', label: 'Paramètres', to: '/admin/parametres', icon: 'cog', end: true })
    expect(group(contributeurNav, 'Adhérents')?.map((i) => i.label)).toContain('Journal')
    expect(group(contributeurNav, 'Dons')?.map((i) => i.label)).toContain('Paramètres')
    // Super-admin en mode Consulter : mêmes droits que l'admin (AdminLayout passe les deux à true).
    const superAdmin = group(buildNavItems(flags(), noCounters, { canManageTeam: true, canManageSecrets: true }), 'Paramètres')!
    expect(superAdmin.map((i) => i.label)).toEqual(['Organisation', 'Équipe et accès', 'Intégrations'])
  })

  it('Intégrations dès que Dons ou Adhérents est actif', () => {
    const opts = { canManageTeam: true, canManageSecrets: true }
    expect(group(buildNavItems(flags({ adherents: false }), noCounters, opts), 'Paramètres')?.map((i) => i.label)).toContain('Intégrations')
    expect(group(buildNavItems(flags({ dons: false }), noCounters, opts), 'Paramètres')?.map((i) => i.label)).toContain('Intégrations')
    expect(group(buildNavItems(flags({ dons: false, adherents: false }), noCounters, opts), 'Paramètres')?.map((i) => i.label)).not.toContain('Intégrations')
    expect(group(buildNavItems(flags(), noCounters, { canManageTeam: false, canManageSecrets: false }), 'Paramètres')).toBeUndefined()
  })

  it('Paramètres suit les modules actifs', () => {
    const items = group(buildNavItems(flags({ dons: false, adherents: false, evenements: false }), noCounters, { canManageTeam: true, canManageSecrets: true }), 'Paramètres')!
    expect(items.map((i) => i.label)).toEqual(['Organisation', 'Équipe et accès'])
  })

  it('un membre sans module adhérents garde Paramètres en lien direct', () => {
    const nav = buildNavItems(flags({ adherents: false }), noCounters, { canManageTeam: false, canManageSecrets: false })
    expect(nav.find((e) => e.label === 'Paramètres')?.type).toBe('link')
  })
})
