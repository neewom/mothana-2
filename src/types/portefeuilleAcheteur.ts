export type MouvementPortefeuilleType = 'credit_initial' | 'credit_recharge' | 'debit'

export interface MouvementPortefeuilleAcheteur {
  type: MouvementPortefeuilleType
  montantCentimes: number
  soldeApresCentimes: number
  createdAt: string
}

export interface PortefeuilleAcheteurState {
  revision: number
  portefeuille: {
    codePublic: string
    soldeCentimes: number
    gele: boolean
  }
  evenement: {
    nom: string
    dateDebut: string
    dateFin: string
    statut: 'brouillon' | 'ouvert' | 'clos'
    organisationNom: string
    /** Durée de conservation de l'organisation (mois après dateFin), aussi validité du crédit. */
    conservationMois: number
    urlPolitiqueConfidentialite: string | null
  }
  mouvements: MouvementPortefeuilleAcheteur[]
  demandeEnAttente: {
    id: string
    montantCentimes: number
    expireLe: string
    createdAt: string
  } | null
}

export type PortefeuilleAcheteurError =
  | 'lien_invalide'
  | 'hors_ligne'
  | 'limite'
  | 'indisponible'
