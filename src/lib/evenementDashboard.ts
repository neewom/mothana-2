import type {
  CommandeMoyenPaiement,
  CommandeStatut,
  MouvementPortefeuilleAdmin,
  MouvementPortefeuilleType,
  PortefeuilleEvenement,
} from '../types/evenementDashboard'

export interface EvenementDashboardStats {
  venduCentimes: number
  depenseCentimes: number
  restantCentimes: number
}

export function calculerStatsEvenement(
  portefeuilles: PortefeuilleEvenement[],
  mouvements: MouvementPortefeuilleAdmin[],
): EvenementDashboardStats {
  return {
    venduCentimes: mouvements
      .filter((mouvement) => mouvement.type === 'credit_initial' || mouvement.type === 'credit_recharge')
      .reduce((total, mouvement) => total + mouvement.montant_centimes, 0),
    depenseCentimes: mouvements
      .filter((mouvement) => mouvement.type === 'debit')
      .reduce((total, mouvement) => total + mouvement.montant_centimes, 0),
    restantCentimes: portefeuilles.reduce((total, portefeuille) => total + portefeuille.solde_centimes, 0),
  }
}

export function libelleMouvementAdmin(type: MouvementPortefeuilleType): string {
  switch (type) {
    case 'credit_initial':
      return 'Crédit initial'
    case 'credit_recharge':
      return 'Recharge'
    case 'debit':
      return 'Dépense'
  }
}

export function libelleStatutCommande(statut: CommandeStatut): string {
  switch (statut) {
    case 'en_attente_paiement':
      return 'En attente'
    case 'payee':
      return 'Payée'
    case 'annulee':
      return 'Annulée'
    case 'expiree':
      return 'Expirée'
    case 'remboursee':
      return 'Remboursée'
  }
}

export function libelleMoyenPaiement(moyen: CommandeMoyenPaiement): string {
  return moyen === 'manuel' ? 'Crédit manuel' : 'En ligne'
}

export function filtrerPortefeuilles(
  portefeuilles: PortefeuilleEvenement[],
  recherche: string,
): PortefeuilleEvenement[] {
  const terme = recherche.trim().toLocaleLowerCase('fr-FR')
  if (!terme) return portefeuilles

  return portefeuilles.filter((portefeuille) =>
    portefeuille.email.toLocaleLowerCase('fr-FR').includes(terme)
      || portefeuille.code_public.toLocaleLowerCase('fr-FR').includes(terme),
  )
}
