export type EvenementStatut = 'brouillon' | 'ouvert' | 'clos'

export interface EvenementPublic {
  id: string
  nom: string
  date_evenement: string
  montants_credit_centimes: number[]
  nom_organisation: string
}

export interface AchatSimuleResponse {
  ok: true
  portefeuille_url?: string
  code_public?: string
  montant_centimes?: number
  email_envoye?: boolean
}

export interface Evenement {
  id: string
  organisation_id: string
  activite_id: string | null
  slug: string
  nom: string
  date_evenement: string
  date_fin: string
  statut: EvenementStatut
  montants_credit_centimes: number[]
  created_at: string
  updated_at: string
}
