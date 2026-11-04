import type { ResultatGeneration } from '../_shared/genererRecu.ts'
import type { ResultatEnvoiRecuDonateur } from '../_shared/envoyerRecu.ts'

export interface ResultatLigneLot {
  resultat: 'fait' | 'echec' | 'reessayer'
  erreur: string | null
  recuId: string | null
  recuPreexistant: boolean
}

// Classement d'une génération dans un lot. Passagère (nouvelle tentative au passage suivant) : erreur
// serveur (Gotenberg, Storage, base, réseau, exception) et conflit 409 (génération simultanée ou numéro
// pris : un nouvel essai relit l'état). Définitive : les autres refus (fiche ou organisation incomplète,
// aucun don, modèle absent, numéro de donateur absent ou invalide…), qui ne changeront pas d'eux-mêmes.
export function classerResultatLot(resultat: ResultatGeneration | null, exception?: unknown): ResultatLigneLot {
  if (!resultat) {
    return { resultat: 'reessayer', erreur: `Erreur serveur : ${String(exception)}`, recuId: null, recuPreexistant: false }
  }
  if (resultat.ok) {
    return { resultat: 'fait', erreur: null, recuId: resultat.recuId, recuPreexistant: resultat.dejaExistant }
  }
  const message = typeof resultat.body.error === 'string' ? resultat.body.error : `Erreur ${resultat.status}`
  const passagere = resultat.status >= 500 || resultat.status === 409
  return { resultat: passagere ? 'reessayer' : 'echec', erreur: message, recuId: null, recuPreexistant: false }
}

export interface ResultatLigneEnvoi {
  resultat: 'fait' | 'echec' | 'reessayer' | 'a_verifier'
  erreur: string | null
  recuId: string | null
  versionId: string | null
  envoyeLe: string | null
  canal: string | null
  dejaEnvoye: boolean
}

// Classement d'un envoi dans un lot (carte « Reçus en lot 4/5 »). Jamais de nouvelle tentative
// automatique quand l'email a pu partir : envoi Brevo ambigu (pas de statut, ≥ 500, délai dépassé,
// exception réseau) ou exception pendant l'envoi → « a_verifier ». Un lot n'utilise jamais le secours
// Resend (décision utilisateur, 2026-11-04). Passagère (nouvelle tentative au passage suivant) : erreur
// serveur avant tout envoi (lecture du reçu, téléchargement du PDF) ou refus explicite (4xx) de Brevo.
// Définitive : donateur sans email ou email invalide, reçu introuvable, Brevo non configuré ou
// expéditeur refusé par Brevo.
export function classerEnvoiLot(resultat: ResultatEnvoiRecuDonateur | null, exception?: unknown): ResultatLigneEnvoi {
  const vide = { recuId: null, versionId: null, envoyeLe: null, canal: null, dejaEnvoye: false }
  if (!resultat) {
    return { ...vide, resultat: 'a_verifier', erreur: `Erreur pendant l'envoi, l'email a pu partir : vérifiez avant de renvoyer (${String(exception)})` }
  }
  if (resultat.ok) {
    return {
      resultat: 'fait', erreur: null, recuId: resultat.recuId, versionId: resultat.versionId,
      envoyeLe: resultat.envoyeLe, canal: resultat.canal, dejaEnvoye: resultat.dejaEnvoye,
    }
  }
  if (resultat.incertain) return { ...vide, resultat: 'a_verifier', erreur: resultat.error }
  return { ...vide, resultat: resultat.status >= 500 ? 'reessayer' : 'echec', erreur: resultat.error }
}
