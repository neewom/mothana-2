import type { ResultatGeneration } from '../_shared/genererRecu.ts'

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
