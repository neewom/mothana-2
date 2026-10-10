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

function termeRecherche(recherche: string): string {
  return recherche.trim().toLocaleLowerCase('fr-FR')
}

// L'adresse de remplacement d'un acheteur anonymisé ne doit pas remonter en recherche.
function portefeuilleCorrespond(
  portefeuille: Pick<PortefeuilleEvenement, 'email' | 'code_public' | 'anonymise_le'>,
  terme: string,
): boolean {
  return (!portefeuille.anonymise_le && portefeuille.email.toLocaleLowerCase('fr-FR').includes(terme))
    || portefeuille.code_public.toLocaleLowerCase('fr-FR').includes(terme)
}

export function filtrerPortefeuilles(
  portefeuilles: PortefeuilleEvenement[],
  recherche: string,
): PortefeuilleEvenement[] {
  const terme = termeRecherche(recherche)
  if (!terme) return portefeuilles
  return portefeuilles.filter((portefeuille) => portefeuilleCorrespond(portefeuille, terme))
}

/** Mouvements dont le portefeuille correspond (email ou code public). */
export function filtrerMouvements<M extends { portefeuille_id: string }>(
  mouvements: M[],
  portefeuillesParId: Map<string, PortefeuilleEvenement>,
  recherche: string,
): M[] {
  const terme = termeRecherche(recherche)
  if (!terme) return mouvements
  return mouvements.filter((mouvement) => {
    const portefeuille = portefeuillesParId.get(mouvement.portefeuille_id)
    return !!portefeuille && portefeuilleCorrespond(portefeuille, terme)
  })
}

/** Commandes par email (jamais l'adresse anonymisée) ou par code du portefeuille crédité. */
export function filtrerCommandes<C extends { email: string; portefeuille_id: string | null }>(
  commandes: C[],
  portefeuillesParId: Map<string, PortefeuilleEvenement>,
  recherche: string,
): C[] {
  const terme = termeRecherche(recherche)
  if (!terme) return commandes
  return commandes.filter((commande) => {
    if (!commande.email.endsWith(DOMAINE_ANONYMISE) && commande.email.toLocaleLowerCase('fr-FR').includes(terme)) return true
    const portefeuille = commande.portefeuille_id ? portefeuillesParId.get(commande.portefeuille_id) : undefined
    return !!portefeuille && portefeuilleCorrespond(portefeuille, terme)
  })
}

export const LIBELLE_ACHETEUR_ANONYMISE = 'Acheteur anonymisé'

// Domaine des adresses de remplacement posées par anonymiser_portefeuille_interne (SQL).
const DOMAINE_ANONYMISE = '@anonyme.invalid'

/** Email d'une commande à afficher : les commandes sans portefeuille sont anonymisées aussi. */
export function emailCommandeAffiche(email: string): string {
  return email.endsWith(DOMAINE_ANONYMISE) ? LIBELLE_ACHETEUR_ANONYMISE : email
}

/** Email à afficher : jamais l'adresse de remplacement d'un acheteur anonymisé. */
export function emailAffiche(portefeuille: Pick<PortefeuilleEvenement, 'email' | 'anonymise_le'>): string {
  return portefeuille.anonymise_le ? LIBELLE_ACHETEUR_ANONYMISE : portefeuille.email
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
