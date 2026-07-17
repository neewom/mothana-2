export type Civilite = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type ModePaiement = 1 | 2 | 3 | 4

export interface Personne {
  id: string
  nom: string
  prenom: string | null
  email: string | null
  telephone: string | null
  civilite: Civilite | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  pays: string | null
  nom2: string | null
  prenom2: string | null
}

export interface ProfilParticipant {
  id: string
  personne_id: string
  organisation_id: string
  notes: string | null
  id_externe: string | null
  created_at: string
  personnes: Personne
}

export interface Activite {
  id: string
  organisation_id: string
  nom: string
  id_externe: string | null
  date_debut: string | null
  date_fin: string | null
}

export interface RecuFiscal {
  id: string
  profil_participant_id: string
  organisation_id: string
  annee: number
  montant_total: number
  fichier_url: string | null
  date_generation: string
}

export interface Don {
  id: string
  profil_participant_id: string
  organisation_id: string
  activite_id: string | null
  montant: number
  date: string  // ISO date string YYYY-MM-DD
  mode_paiement: ModePaiement
  created_by_role: 'admin' | 'benevole'
  id_externe: string | null
  created_at: string
  updated_at: string
  profils_participant: ProfilParticipant
  activites: Activite | null
}
