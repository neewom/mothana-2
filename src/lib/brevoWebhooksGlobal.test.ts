import { describe, expect, it } from 'vitest'
import { interpreterResultatWebhook, interpreterResultatsWebhooks } from './brevoWebhooksGlobal'

const ORG = 'b2f0c9e4-0000-4000-8000-000000000001'

describe('interpreterResultatWebhook', () => {
  it('webhook créé', () => {
    expect(interpreterResultatWebhook({ organisation_id: ORG, nom: 'Pagode', ok: true, already_registered: false }))
      .toEqual({ organisationId: ORG, nom: 'Pagode', statut: 'cree', libelle: 'Créé', detail: null })
  })

  it('webhook existant mis à jour', () => {
    expect(interpreterResultatWebhook({ organisation_id: ORG, nom: 'Pagode', ok: true, already_registered: true }).statut)
      .toBe('mis_a_jour')
  })

  it('organisation sans clé ignorée', () => {
    const ligne = interpreterResultatWebhook({ organisation_id: ORG, nom: 'Pagode', skipped: true, reason: 'Pas de clé API Brevo configurée' })
    expect(ligne.statut).toBe('ignore')
    expect(ligne.libelle).toBe('Ignoré (sans clé)')
  })

  it('erreur Brevo remontée avec son message', () => {
    expect(interpreterResultatWebhook({ organisation_id: ORG, nom: 'Pagode', error: 'Erreur lors de la création du webhook Brevo', status: 502 }))
      .toMatchObject({ statut: 'erreur', detail: 'Erreur lors de la création du webhook Brevo' })
  })

  it('réponse sans statut reconnaissable : erreur', () => {
    expect(interpreterResultatWebhook({ organisation_id: ORG, nom: 'Pagode' }))
      .toMatchObject({ statut: 'erreur', detail: 'Réponse inattendue' })
  })

  it('nom absent : identifiant affiché', () => {
    expect(interpreterResultatWebhook({ organisation_id: ORG, nom: null, ok: true }).nom).toBe(ORG)
  })
})

describe('interpreterResultatsWebhooks', () => {
  it('trie par nom', () => {
    const lignes = interpreterResultatsWebhooks([
      { organisation_id: 'b', nom: 'Zen', ok: true },
      { organisation_id: 'a', nom: 'Association', ok: true },
    ])
    expect(lignes.map((l) => l.nom)).toEqual(['Association', 'Zen'])
  })
})
