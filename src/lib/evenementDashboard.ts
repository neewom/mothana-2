import type {
  CommandeMoyenPaiement,
  CommandeStatut,
  MouvementPortefeuilleAdmin,
  MouvementPortefeuilleType,
  PortefeuilleEvenement,
  SecretPortefeuilleAdmin,
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

export interface ResumeAccesPortefeuille {
  actifs: number
  total: number
  /** Lien le plus récent, révoqué ou non ; null si aucun lien n'a jamais été généré. */
  dernier: SecretPortefeuilleAdmin | null
}

export function resumerAccesParPortefeuille(
  secrets: SecretPortefeuilleAdmin[],
): Map<string, ResumeAccesPortefeuille> {
  const resumes = new Map<string, ResumeAccesPortefeuille>()
  for (const secret of secrets) {
    const resume = resumes.get(secret.portefeuille_id) ?? { actifs: 0, total: 0, dernier: null }
    resume.total += 1
    if (!secret.revoque_le) resume.actifs += 1
    if (!resume.dernier || secret.created_at > resume.dernier.created_at) resume.dernier = secret
    resumes.set(secret.portefeuille_id, resume)
  }
  return resumes
}
