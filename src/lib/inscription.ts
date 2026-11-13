// Formulaire public /inscription : règles de saisie partagées avec l'Edge Function
// soumettre-demande-inscription (supabase/functions/_shared/inscription.ts).
import {
  erreursInscription,
  type SaisieInscription,
} from '../../supabase/functions/_shared/inscription.ts'

export {
  erreurChampInscription,
  erreursInscription,
  normaliserRna,
  normaliserSiren,
  ORDRE_CHAMPS_INSCRIPTION,
  LONGUEURS_INSCRIPTION,
  type ChampInscription,
  type SaisieInscription,
} from '../../supabase/functions/_shared/inscription.ts'

export const SAISIE_VIDE: SaisieInscription = {
  nom_association: '',
  ville: '',
  rna: '',
  siren: '',
  prenom: '',
  nom: '',
  email: '',
  message: '',
  cgu_acceptees: false,
}

/** Nom du champ piège (invisible) : rempli = robot, la demande est ignorée côté serveur. */
export const CHAMP_PIEGE = 'site_web'

/**
 * Corps envoyé à l'Edge Function, ou null si un champ est en erreur. `cguPubliees` (constante
 * CGU_PUBLIEES) : la case est alors obligatoire et son acceptation transmise ; sinon elle n'est ni
 * exigée ni envoyée.
 */
export function corpsDemandeInscription(
  saisie: SaisieInscription,
  cguPubliees: boolean,
  siteUrl: string,
  piege: string,
): Record<string, unknown> | null {
  if (Object.keys(erreursInscription(saisie, cguPubliees)).length > 0) return null
  return {
    nom_association: saisie.nom_association,
    ville: saisie.ville,
    rna: saisie.rna,
    siren: saisie.siren,
    prenom: saisie.prenom,
    nom: saisie.nom,
    email: saisie.email,
    message: saisie.message,
    cgu_acceptees: cguPubliees ? saisie.cgu_acceptees : false,
    site_url: siteUrl,
    [CHAMP_PIEGE]: piege,
  }
}

/** Nom d'association comparable : sans casse, accents ni ponctuation, espaces resserrés. */
export function cleNomAssociation(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export interface DemandeComparable {
  id: string
  nom_association: string
  email: string
  statut: 'a_confirmer' | 'en_attente' | 'acceptee' | 'refusee'
}

/**
 * Autres demandes en attente ou acceptées qui portent le même nom d'association (sans casse ni
 * accents) ou le même email — cas typique : « Ce n'est pas la bonne ? » crée une 2e demande.
 */
export function doublonsDemande<T extends DemandeComparable>(demande: DemandeComparable, autres: T[]): T[] {
  const nom = cleNomAssociation(demande.nom_association)
  const email = demande.email.trim().toLowerCase()
  return autres.filter((a) =>
    a.id !== demande.id
    && (a.statut === 'en_attente' || a.statut === 'acceptee')
    && ((nom !== '' && cleNomAssociation(a.nom_association) === nom) || a.email.trim().toLowerCase() === email))
}

/** Lien texte des pages publiques d'inscription (cachet, souligné au survol, anneau de focus). */
export const LIEN_INSCRIPTION =
  'font-medium text-stamp underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70 rounded-sm'

/** États de la page /inscription/confirmer, après le clic sur « Confirmer ma demande ». */
export type EtatConfirmation = 'confirmee' | 'deja_confirmee' | 'expiree' | 'invalide' | 'trop_d_essais' | 'erreur'

/**
 * Réponse de l'Edge Function confirmer-demande-inscription → état affiché. 429 : trop d'essais ;
 * 400 : lien invalide (jeton absent ou abîmé) ; toute autre erreur : réessayer plus tard.
 */
export function etatConfirmation(status: number, corps: unknown): EtatConfirmation {
  if (status === 429) return 'trop_d_essais'
  if (status === 400) return 'invalide'
  const cas = corps && typeof corps === 'object' ? (corps as { cas?: unknown }).cas : undefined
  if (status === 200 && (cas === 'confirmee' || cas === 'deja_confirmee' || cas === 'expiree' || cas === 'invalide')) return cas
  return 'erreur'
}
