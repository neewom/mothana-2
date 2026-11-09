import { describe, expect, it } from 'vitest'
import type { FonctionnalitesActivees } from '../hooks/useFonctionnalitesActivees'
import { buildNavItems } from './adminNav'
import { buildSearchItems, buildSearchPages, searchPages, type GlobalSearchResponse } from './globalSearch'

const response = (overrides: Partial<GlobalSearchResponse> = {}): GlobalSearchResponse => ({
  personnes: [], portefeuilles: [], activites: [], ...overrides,
})

describe('buildSearchItems', () => {
  it('affiche une personne donatrice et adhérente une seule fois, avec ses raccourcis', () => {
    const items = buildSearchItems(response({
      personnes: [{ participant_id: 'p1', adherent_id: 'a1', nom: 'BOULOM', prenom: 'Nicolas', email: 'n@b.fr', adherent_statut: 'actif' }],
    }))
    const personnes = items.filter((i) => i.group === 'Personnes')
    expect(personnes).toHaveLength(1)
    expect(personnes[0]).toMatchObject({ label: 'Nicolas BOULOM', sublabel: 'Donateur · Adhérent · n@b.fr', to: '/admin/participants?id=p1' })
    expect(items.filter((i) => i.group === 'Raccourcis').map((i) => [i.label, i.to])).toEqual([
      ['Dons de Nicolas BOULOM', '/admin/dons?q=Nicolas%20BOULOM'],
      ['Reçus fiscaux de Nicolas BOULOM', '/admin/recus?q=Nicolas%20BOULOM'],
      ['Fiche adhérent de Nicolas BOULOM', '/admin/adherents?id=a1'],
    ])
  })

  it('ouvre la fiche adhérent pour un adhérent seul, signale l’archivage', () => {
    const [item] = buildSearchItems(response({
      personnes: [{ participant_id: null, adherent_id: 'a2', nom: 'DUPONT', prenom: null, email: null, adherent_statut: 'archive' }],
    }))
    expect(item).toMatchObject({ label: 'DUPONT', sublabel: 'Adhérent (archivé)', to: '/admin/adherents?id=a2' })
  })

  it('n’affiche jamais l’email d’un portefeuille anonymisé', () => {
    const [item] = buildSearchItems(response({
      portefeuilles: [{ id: 'w1', evenement_id: 'e1', evenement_nom: 'Fête', email: null, code_public: 'ABCDEFGHJK12345', solde_centimes: 500, anonymise: true }],
    }))
    expect(item.label).toBe('Acheteur anonymisé')
    expect(item.to).toBe('/admin/activites/porte-monnaie/e1?portefeuille=w1')
  })

  it('ordonne Personnes, Portefeuilles, Activités puis Raccourcis (3 au plus)', () => {
    const personnes = ['a', 'b', 'c', 'd'].map((id) => ({ participant_id: id, adherent_id: null, nom: id, prenom: null, email: null, adherent_statut: null }))
    const items = buildSearchItems(response({
      personnes,
      activites: [{ id: 'act', nom: 'Fête', date_debut: null }],
    }))
    expect(items.map((i) => i.group)).toEqual(['Personnes', 'Personnes', 'Personnes', 'Personnes', 'Activités', 'Raccourcis', 'Raccourcis', 'Raccourcis'])
  })
})

const flags = (overrides: Partial<FonctionnalitesActivees> = {}): FonctionnalitesActivees => ({
  dons: true, adherents: true, evenements: true, credit_manuel: false, ...overrides,
})
const noCounters = { donsReguliersAConfirmer: null, demandesEnAttente: null }
const admin = { canManageTeam: true, canManageSecrets: true }
const pagesFor = (f: FonctionnalitesActivees, options = admin, compte = true) =>
  buildSearchPages(buildNavItems(f, noCounters, options), { compte })
const found = (pages: ReturnType<typeof pagesFor>, terme: string) => searchPages(pages, terme).map((i) => [i.label, i.to])

describe('pages de la recherche globale', () => {
  it('trouve les reçus fiscaux et la page de réglages qui les contient', () => {
    expect(found(pagesFor(flags()), 'reçus')).toEqual([
      ['Reçus fiscaux', '/admin/recus'],
      ['Paramètres des dons', '/admin/dons/parametres'],
    ])
    expect(found(pagesFor(flags()), 'cerfa')).toEqual([['Paramètres des dons', '/admin/dons/parametres']])
  })

  it('« paramètres » trouve les réglages des modules et de l’organisation, sans accent ni casse', () => {
    expect(found(pagesFor(flags()), 'PARAMETRES').map(([, to]) => to)).toEqual([
      '/admin/dons/parametres',
      '/admin/adherents/parametres',
      '/admin/activites/parametres',
      '/admin/parametres',
      '/admin/parametres/equipe',
      '/admin/parametres/integrations',
    ])
  })

  it('ne propose pas les pages d’un module désactivé', () => {
    const pages = pagesFor(flags({ dons: false, evenements: false }))
    expect(found(pages, 'reçus')).toEqual([])
    expect(pages.some((p) => p.to.startsWith('/admin/dons') || p.to === '/admin/statistiques' || p.to.includes('porte-monnaie'))).toBe(false)
    expect(found(pages, 'adhérents').map(([, to]) => to)).toContain('/admin/adherents')
  })

  it('suit les droits du menu : Équipe et Intégrations réservés (super-admin compris via le menu)', () => {
    const contributeur = pagesFor(flags(), { canManageTeam: false, canManageSecrets: false })
    expect(found(contributeur, 'pin')).toEqual([])
    expect(found(contributeur, 'brevo')).toEqual([])
    // Super-admin en mode Consulter : AdminLayout lui donne les droits d'admin, sans « Mon compte ».
    const superAdmin = pagesFor(flags(), admin, false)
    expect(found(superAdmin, 'pin')).toEqual([['Équipe et accès', '/admin/parametres/equipe']])
    expect(found(superAdmin, 'mon compte')).toEqual([])
    expect(found(pagesFor(flags()), 'mon compte')).toEqual([['Mon compte', '/admin/parametres/compte']])
  })

  it('place les pages en tête, avant les résultats de la RPC', () => {
    const pages = searchPages(pagesFor(flags()), 'dons')
    const items = buildSearchItems(response({ activites: [{ id: 'act', nom: 'Dons de printemps', date_debut: null }] }), pages)
    expect(items[0]).toMatchObject({ group: 'Pages', to: '/admin/dons' })
    expect(items[items.length - 1].group).toBe('Activités')
  })

  it('n’affiche rien sous 2 caractères', () => {
    expect(searchPages(pagesFor(flags()), 'd')).toEqual([])
  })

  it('cherche en début de mot : le début d’un nom ne remonte pas de page', () => {
    expect(found(pagesFor(flags()), 'ma')).toEqual([])
    expect(found(pagesFor(flags()), 'param').length).toBe(6)
    expect(found(pagesFor(flags()), 'monnaie').map(([, to]) => to)).toEqual(['/admin/activites/porte-monnaie', '/admin/activites/parametres'])
  })
})
