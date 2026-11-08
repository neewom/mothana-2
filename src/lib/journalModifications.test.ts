import { describe, expect, it } from 'vitest'
import { describeJournalEntry, libelleAuteurJournal, libelleTableCible } from './journalModifications'

describe('libelleTableCible', () => {
  it('distingue une demande de renouvellement', () => {
    expect(libelleTableCible({ table_cible: 'demandes_adhesion', details: { type: 'renouvellement' } })).toBe('Demande de renouvellement')
  })

  it("garde « Demande d'adhésion » pour une adhésion (y compris les entrées sans type)", () => {
    expect(libelleTableCible({ table_cible: 'demandes_adhesion', details: { nom: 'X' } })).toBe("Demande d'adhésion")
    expect(libelleTableCible({ table_cible: 'demandes_adhesion', details: null })).toBe("Demande d'adhésion")
  })

  it('renvoie le nom brut pour une table inconnue', () => {
    expect(libelleTableCible({ table_cible: 'adherents', details: null })).toBe('Adhérent')
    expect(libelleTableCible({ table_cible: 'autre', details: null })).toBe('autre')
  })
})

describe('saisie bénévole (creer_adhesion_benevole)', () => {
  const base = {
    id: '1', organisation_id: 'o', table_cible: 'adherents', ligne_id: 'l', action: 'creation' as const,
    auteur_id: 'u', created_at: '2026-11-04T10:00:00Z',
  }

  it('précise l’origine et le mode de signature', () => {
    expect(describeJournalEntry({ ...base, auteur_nom: null, details: { nom: 'DUPONT', prenom: 'Zoé', origine: 'benevole', signature: 'papier' } }))
      .toBe('Zoé DUPONT (saisie bénévole, signée sur papier)')
    expect(describeJournalEntry({ ...base, auteur_nom: null, details: { nom: 'DUPONT', origine: 'benevole', signature: 'tactile' } }))
      .toBe('DUPONT (saisie bénévole, signée à l’écran)')
    expect(describeJournalEntry({ ...base, auteur_nom: 'Admin', details: { nom: 'DUPONT', prenom: 'Zoé' } })).toBe('Zoé DUPONT')
  })

  it('nomme l’auteur « Espace bénévole » faute de profil', () => {
    expect(libelleAuteurJournal({ auteur_nom: null, details: { origine: 'benevole' } })).toBe('Espace bénévole')
    expect(libelleAuteurJournal({ auteur_nom: 'Marie', details: { origine: 'benevole' } })).toBe('Marie')
    expect(libelleAuteurJournal({ auteur_nom: null, details: null })).toBe('—')
  })
})
