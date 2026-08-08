export type Civilite = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type ModePaiement = 1 | 2 | 3 | 4

// Enum dédié aux adhérents, distinct de Civilite (7 valeurs des participants) —
// pas de personne morale/famille adhérente pour l'instant.
export type CiviliteAdherent = 0 | 1 | 2

export interface Adherent {
  id: string
  organisation_id: string
  id_externe: string | null
  civilite: CiviliteAdherent
  nom: string
  prenom: string | null
  date_naissance: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  pays: string | null
  telephone: string | null
  courriel: string | null
  statut: 'actif' | 'archive'
  statuts_acceptes: boolean
  consent_rgpd: boolean
  created_at: string
  updated_at: string
}

export interface Adhesion {
  id: string
  adherent_id: string
  date_debut: string
  date_fin: string | null
  montant_cotisation: number | null
  date_paiement_cotisation: string | null
  mode_paiement: ModePaiement | null
  renouvellement: boolean
  droit_vote_ag: boolean
  bulletin_signe: boolean
  created_at: string
}

export interface DemandeAdhesion {
  id: string
  organisation_id: string
  civilite: CiviliteAdherent
  nom: string
  prenom: string | null
  date_naissance: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  pays: string | null
  telephone: string | null
  courriel: string | null
  signature_data_url: string
  accepte_statuts: boolean
  consent_rgpd: boolean
  statut: 'en_attente' | 'ratifiee' | 'refusee'
  decided_at: string | null
  decided_by: string | null
  adherent_id: string | null
  motif_refus: string | null
  created_at: string
}

export interface JournalModification {
  id: string
  table_cible: string
  ligne_id: string
  action: string
  details: Record<string, unknown> | null
  auteur_id: string | null
  auteur_nom: string | null
  created_at: string
}

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
  numero_ordre: string | null
  type_cerfa: '11580' | '16216' | null
}

export interface TemplateRecu {
  id: string
  organisation_id: string
  nom: string
  type_cerfa: '11580' | '16216'
  html_template: string
  css: string | null
  is_active: boolean
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface TemplateCarteAdherent {
  id: string
  organisation_id: string
  nom: string
  html_template: string
  css: string | null
  is_active: boolean
  is_archived: boolean
  created_at: string
  updated_at: string
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
