// Lots de génération de reçus fiscaux traités côté serveur (migration recus_lots.sql).

export type RecuLotStatut = 'en_cours' | 'arrete' | 'termine'

export interface RecuLot {
  id: string
  organisation_id: string
  annee: number
  type: 'generation'
  statut: RecuLotStatut
  cree_par: string | null
  cree_le: string
  arrete_par: string | null
  arrete_le: string | null
  termine_le: string | null
  nb_total: number
  nb_faits: number
  nb_echecs: number
  traitement_jusqu_a: string | null
}

export type RecuLotLigneStatut = 'a_faire' | 'en_cours' | 'fait' | 'echec'

// Ligne en échec affichée dans le bilan (jointure sur le donateur).
export interface RecuLotEchec {
  id: string
  profil_participant_id: string
  rang: number
  erreur: string | null
  profils_participant: { personnes: { nom: string; prenom: string | null } } | null
}
