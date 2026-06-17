export interface Personne {
  id: string
  nom: string
  prenom: string | null
  email: string | null
  telephone: string | null
}

export interface ProfilParticipant {
  id: string
  personne_id: string
  organisation_id: string
  notes: string | null
  created_at: string
  personnes: Personne
}

export interface Activite {
  id: string
  organisation_id: string
  nom: string
}

export interface Don {
  id: string
  profil_participant_id: string
  organisation_id: string
  activite_id: string | null
  montant: number
  date: string  // ISO date string YYYY-MM-DD
  mode_paiement: 'virement' | 'cheque' | 'especes'
  created_by_role: 'admin' | 'benevole'
  created_at: string
  updated_at: string
  profils_participant: ProfilParticipant
  activites: Activite | null
}
