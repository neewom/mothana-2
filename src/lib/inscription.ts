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
  statut: 'en_attente' | 'acceptee' | 'refusee'
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
