import { describe, expect, it } from 'vitest'
import { buildSearchItems, type GlobalSearchResponse } from './globalSearch'

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
