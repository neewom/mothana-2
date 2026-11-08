// Saisie d'une adhésion dans l'espace bénévole (RPC creer_adhesion_benevole). Contrôles faits
// avant l'appel pour guider le bénévole ; la RPC rejoue toute la validation côté serveur.
import type { ChampsAdhesionValeurs } from './champsAdhesion'
import { isValidEmail } from './textFormat'
import { isAnneeNaissanceValide } from './dateNaissance'

export interface SaisieAdhesionBenevole {
  valeurs: ChampsAdhesionValeurs
  statutsRequis: boolean
  accepteStatuts: boolean
  consentRgpd: boolean
  signature: string | null
  signeSurPapier: boolean
  dateDebut: string
  montant: string
}

/** Borne haute du montant, identique à celle de creer_adhesion_benevole. */
export const MONTANT_COTISATION_MAX = 100000

/** Premier problème bloquant de la saisie, ou null si elle peut être envoyée. */
export function erreurSaisieAdhesionBenevole(s: SaisieAdhesionBenevole): string | null {
  const { courriel, dateNaissance, codePostal, nom } = s.valeurs
  if (nom.trim() === '') return 'Le nom est obligatoire.'
  if (!/^\d{5}$/.test(codePostal)) return 'Le code postal doit contenir 5 chiffres.'
  if (courriel.trim() !== '' && !isValidEmail(courriel)) return "Le format de l'adresse email est invalide."
  if (dateNaissance !== '' && !isAnneeNaissanceValide(dateNaissance)) return "La date de naissance n'est pas valide."
  if (s.statutsRequis && !s.accepteStatuts) return "L'adhérent doit approuver les statuts."
  if (!s.consentRgpd) return "Le consentement de l'adhérent est obligatoire."
  if (!s.signeSurPapier && !s.signature) {
    return "Faites signer l'adhérent à l'écran, ou cochez « Adhésion signée sur papier »."
  }
  if (s.dateDebut === '') return "La date d'adhésion est obligatoire."
  if (s.montant.trim() !== '') {
    const montant = Number(s.montant)
    if (!(montant >= 0 && montant <= MONTANT_COTISATION_MAX)) return 'Le montant de la cotisation est invalide.'
  }
  return null
}

/** Message affiché pour un refus de la RPC (code levé par la fonction SQL). */
export function messageErreurAdhesionBenevole(message: string | undefined): string {
  if (message?.includes('ACCES_REFUSE')) {
    return "La saisie des adhésions n'est pas activée pour votre association. Rapprochez-vous d'un responsable."
  }
  if (message?.includes('SIGNATURE_INVALIDE')) return 'La signature est invalide : effacez-la et recommencez.'
  if (message?.includes('STATUTS_REQUIS')) return "L'adhérent doit approuver les statuts."
  if (message?.includes('MONTANT_INVALIDE')) return 'Le montant de la cotisation est invalide.'
  if (message?.includes('DATE_ADHESION_INVALIDE')) return "La date d'adhésion n'est pas valide."
  if (message?.includes('CONSENTEMENT_REQUIS')) return "Le consentement de l'adhérent est obligatoire."
  return "L'adhésion n'a pas pu être enregistrée. Vérifiez les champs et réessayez."
}
