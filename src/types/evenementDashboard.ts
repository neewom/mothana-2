import type { Activite } from './index'
import type { Evenement } from './evenement'

export type MouvementPortefeuilleType = 'credit_initial' | 'credit_recharge' | 'debit'
export type CommandeStatut = 'en_attente_paiement' | 'payee' | 'annulee' | 'expiree' | 'remboursee'
export type CommandeMoyenPaiement = 'en_ligne' | 'manuel'

export interface PortefeuilleEvenement {
  id: string
  organisation_id: string
  evenement_id: string
  email: string
  code_public: string
  solde_centimes: number
  gele: boolean
  email_modifie_le: string | null
  email_modifie_par: string | null
  /** Acheteur anonymisé (RGPD) : email remplacé, accès révoqués, plus de renvoi ni de crédit. */
  anonymise_le: string | null
  /** null quand l'anonymisation vient de la purge automatique. */
  anonymise_par: string | null
  created_at: string
  updated_at: string
}

export interface MouvementPortefeuilleAdmin {
  id: string
  organisation_id: string
  portefeuille_id: string
  type: MouvementPortefeuilleType
  montant_centimes: number
  solde_apres_centimes: number
  commande_id: string | null
  demande_paiement_id: string | null
  acteur_id: string | null
  created_at: string
}

export interface CommandeEvenement {
  id: string
  organisation_id: string
  evenement_id: string
  email: string
  montant_centimes: number
  moyen_paiement: CommandeMoyenPaiement
  statut: CommandeStatut
  payee_le: string | null
  portefeuille_id: string | null
  created_at: string
}

export interface SecretPortefeuilleAdmin {
  id: string
  portefeuille_id: string
  revoque_le: string | null
  created_at: string
  /** Admin ayant généré le lien ; null = lien créé à l'achat. */
  cree_par: string | null
}

/** Nom affiché des comptes de l'organisation, pour attribuer une action (lien généré, adresse corrigée). */
export type AuteursParId = Map<string, string>

export interface EvenementDashboardData {
  evenement: Evenement
  portefeuilles: PortefeuilleEvenement[]
  mouvements: MouvementPortefeuilleAdmin[]
  commandes: CommandeEvenement[]
  secrets: SecretPortefeuilleAdmin[]
  organisationSlug: string
  auteurs: AuteursParId
  /** Pour la modale de modification de l'événement (rattachement à une activité). */
  activites: Activite[]
}
