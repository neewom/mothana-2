import { describe, expect, it } from 'vitest'
import type { MouvementPortefeuilleAdmin, PortefeuilleEvenement } from '../types/evenementDashboard'
import {
  calculerStatsEvenement,
  filtrerPortefeuilles,
  libelleMoyenPaiement,
  libelleMouvementAdmin,
  libelleStatutCommande,
} from './evenementDashboard'

const portefeuille = (overrides: Partial<PortefeuilleEvenement> = {}): PortefeuilleEvenement => ({
  id: 'portefeuille-1',
  organisation_id: 'organisation-1',
  evenement_id: 'evenement-1',
  email: 'acheteur@example.com',
  code_public: 'ABC2345678',
  solde_centimes: 900,
  gele: false,
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
  ...overrides,
})

const mouvement = (overrides: Partial<MouvementPortefeuilleAdmin> = {}): MouvementPortefeuilleAdmin => ({
  id: 'mouvement-1',
  organisation_id: 'organisation-1',
  portefeuille_id: 'portefeuille-1',
  type: 'credit_initial',
  montant_centimes: 1500,
  solde_apres_centimes: 1500,
  commande_id: 'commande-1',
  demande_paiement_id: null,
  acteur_id: null,
  created_at: '2026-10-01T10:00:00Z',
  ...overrides,
})

describe('dashboard admin événement', () => {
  it('calcule les montants vendus, dépensés et encore disponibles', () => {
    const stats = calculerStatsEvenement(
      [portefeuille(), portefeuille({ id: 'portefeuille-2', solde_centimes: 400 })],
      [
        mouvement(),
        mouvement({ id: 'mouvement-2', type: 'credit_recharge', montant_centimes: 500 }),
        mouvement({ id: 'mouvement-3', type: 'debit', montant_centimes: 700 }),
      ],
    )

    expect(stats).toEqual({
      venduCentimes: 2000,
      depenseCentimes: 700,
      restantCentimes: 1300,
    })
  })

  it('filtre les portefeuilles par email ou code public sans tenir compte de la casse', () => {
    const portefeuilles = [
      portefeuille(),
      portefeuille({ id: 'portefeuille-2', email: 'autre@example.com', code_public: 'XYZ2345678' }),
    ]

    expect(filtrerPortefeuilles(portefeuilles, 'ACHETEUR')).toHaveLength(1)
    expect(filtrerPortefeuilles(portefeuilles, 'xyz')).toEqual([portefeuilles[1]])
    expect(filtrerPortefeuilles(portefeuilles, '  ')).toEqual(portefeuilles)
  })

  it('présente les valeurs techniques avec des libellés métier', () => {
    expect(libelleMouvementAdmin('credit_recharge')).toBe('Recharge')
    expect(libelleMouvementAdmin('debit')).toBe('Dépense')
    expect(libelleStatutCommande('en_attente_paiement')).toBe('En attente')
    expect(libelleStatutCommande('remboursee')).toBe('Remboursée')
    expect(libelleMoyenPaiement('manuel')).toBe('Crédit manuel')
  })
})
