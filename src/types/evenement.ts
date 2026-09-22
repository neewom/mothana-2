export type EvenementStatut = 'brouillon' | 'ouvert' | 'clos'

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
