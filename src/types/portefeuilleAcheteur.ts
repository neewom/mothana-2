export type MouvementPortefeuilleType = 'credit_initial' | 'credit_recharge' | 'debit'

export interface MouvementPortefeuilleAcheteur {
  type: MouvementPortefeuilleType
  montantCentimes: number
  soldeApresCentimes: number
  createdAt: string
}

export interface PortefeuilleAcheteurState {
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
  }
  mouvements: MouvementPortefeuilleAcheteur[]
}

export type PortefeuilleAcheteurError =
  | 'lien_invalide'
  | 'hors_ligne'
  | 'limite'
  | 'indisponible'
