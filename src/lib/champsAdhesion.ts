// Champs du formulaire public d'adhésion, partagés par la demande d'adhésion (/adhesion/<slug>)
// et le renouvellement par lien personnel (/adhesion/<slug>/renouveler).
import type { CiviliteAdherent } from '../types'

export interface ChampsAdhesionValeurs {
  civilite: CiviliteAdherent
  nom: string
  prenom: string
  dateNaissance: string
  adresse: string
  codePostal: string
  ville: string
  pays: string
  telephone: string
  courriel: string
}

export const CHAMPS_ADHESION_VIDES: ChampsAdhesionValeurs = {
  civilite: 0,
  nom: '',
  prenom: '',
  dateNaissance: '',
  adresse: '',
  codePostal: '',
  ville: '',
  pays: 'France',
  telephone: '',
  courriel: '',
}

/** Corps commun envoyé aux Edge Functions (noms de colonnes de demandes_adhesion). */
export function champsAdhesionPayload(v: ChampsAdhesionValeurs) {
  return {
    civilite: v.civilite,
    nom: v.nom,
    prenom: v.prenom || null,
    date_naissance: v.dateNaissance || null,
    adresse: v.adresse || null,
    code_postal: v.codePostal || null,
    ville: v.ville || null,
    pays: v.pays || null,
    telephone: v.telephone || null,
    courriel: v.courriel || null,
  }
}
