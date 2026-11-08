// Lots de reçus fiscaux traités côté serveur (migrations recus_lots.sql et recus_lots_envoi.sql) :
// génération des reçus manquants, ou envoi par email des reçus non envoyés.

export type RecuLotType = 'generation' | 'envoi'

export type RecuLotStatut = 'en_cours' | 'arrete' | 'termine'

export interface RecuLot {
  id: string
  organisation_id: string
  annee: number
  type: RecuLotType
  statut: RecuLotStatut
  cree_par: string | null
  cree_le: string
  arrete_par: string | null
  arrete_le: string | null
  termine_le: string | null
  nb_total: number
  nb_faits: number
  nb_echecs: number
  /** Lot d'envoi : envois ambigus (l'email a pu partir), jamais retentés automatiquement. */
  nb_a_verifier: number
  traitement_jusqu_a: string | null
  /** Lot d'envoi : quota d'envoi atteint, reprise à partir de cette date. */
  en_attente_jusqu_a: string | null
}

export type RecuLotLigneStatut = 'a_faire' | 'en_cours' | 'fait' | 'echec' | 'a_verifier'

// Ligne en échec (ou à vérifier, lot d'envoi) affichée dans le bilan (jointure sur le donateur).
export interface RecuLotEchec {
  id: string
  profil_participant_id: string
  rang: number
  statut: RecuLotLigneStatut
  erreur: string | null
  profils_participant: { personnes: { nom: string; prenom: string | null } } | null
}

// Récapitulatif avant un lot d'envoi (RPC recapitulatif_envoi_lot_recus).
export interface RecapitulatifEnvoi {
  a_envoyer: number
  exclus: { profil_participant_id: string; nom: string; prenom: string | null; raison: string }[]
  par_jour: number
  par_minute: number
  envoyes_24h: number
  /** Envoi en lot réservé aux organisations qui ont configuré Brevo (BREVO_REQUIS sinon). */
  brevo_configure: boolean
}
