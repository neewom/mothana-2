// Validation d'une demande de renouvellement par l'admin (épique Renouvellement, carte 3/3) :
// comparatif « actuel → proposé » des coordonnées et messages d'erreur de la RPC
// valider_renouvellement. La date de naissance n'est jamais comparée : la page publique ne la
// saisit pas et la RPC refuse de l'appliquer.
import type { Adherent, DemandeAdhesion } from '../types'
import { CIVILITE_ADHERENT_LABELS } from './civiliteAdherent'

export type ChampCoordonnee =
  | 'civilite'
  | 'nom'
  | 'prenom'
  | 'adresse'
  | 'code_postal'
  | 'ville'
  | 'pays'
  | 'telephone'
  | 'courriel'

export const CHAMPS_COORDONNEES: { champ: ChampCoordonnee; label: string }[] = [
  { champ: 'civilite', label: 'Civilité' },
  { champ: 'nom', label: 'Nom' },
  { champ: 'prenom', label: 'Prénom' },
  { champ: 'adresse', label: 'Adresse' },
  { champ: 'code_postal', label: 'Code postal' },
  { champ: 'ville', label: 'Ville' },
  { champ: 'pays', label: 'Pays' },
  { champ: 'telephone', label: 'Téléphone' },
  { champ: 'courriel', label: 'Courriel' },
]

export interface DifferenceCoordonnee {
  champ: ChampCoordonnee
  label: string
  actuel: string
  propose: string
}

type Coordonnees = Pick<Adherent, ChampCoordonnee>

function normaliser(valeur: unknown): string | number | null {
  if (valeur === null || valeur === undefined) return null
  if (typeof valeur === 'number') return valeur
  const texte = String(valeur).trim()
  return texte === '' ? null : texte
}

function afficher(champ: ChampCoordonnee, valeur: string | number | null): string {
  if (valeur === null) return '—'
  if (champ === 'civilite') return CIVILITE_ADHERENT_LABELS[valeur as keyof typeof CIVILITE_ADHERENT_LABELS] ?? String(valeur)
  return String(valeur)
}

/** Coordonnées dont la valeur proposée diffère de la fiche (espaces et vide ignorés). */
export function differencesCoordonnees(adherent: Coordonnees, demande: Coordonnees): DifferenceCoordonnee[] {
  return CHAMPS_COORDONNEES.flatMap(({ champ, label }) => {
    const actuel = normaliser(adherent[champ])
    const propose = normaliser(demande[champ])
    if (actuel === propose) return []
    return [{ champ, label, actuel: afficher(champ, actuel), propose: afficher(champ, propose) }]
  })
}

export function estRenouvellement(demande: Pick<DemandeAdhesion, 'type'>): boolean {
  return demande.type === 'renouvellement'
}

export const MESSAGE_ERREUR_GENERIQUE = "La demande n'a pas pu être validée. Rechargez la page et réessayez ; si le problème persiste, contactez le support."

export const MESSAGE_DEMANDE_DEJA_TRAITEE = 'Cette demande a déjà été traitée.'

/** Message lisible pour une erreur de valider_renouvellement (code levé par la RPC). */
export function messageErreurValidation(message: string): string {
  if (message.includes('ADHERENT_INTROUVABLE')) return "L'adhérent visé par cette demande a été supprimé : elle ne peut plus être validée."
  if (message.includes('ADHERENT_ARCHIVE')) return "L'adhérent est archivé : confirmez sa réactivation pour valider."
  if (message.includes('DEMANDE_DEJA_TRAITEE')) return MESSAGE_DEMANDE_DEJA_TRAITEE
  if (message.includes('ACCES_REFUSE')) return "Vous n'avez pas les droits pour valider cette demande."
  if (message.includes('DATE_ADHESION_REQUISE')) return "La date d'adhésion est obligatoire."
  if (message.includes('REGLE_ADHESION_INTROUVABLE')) {
    return "Aucune durée d'adhésion n'est configurée pour l'organisation : réglez-la dans Paramètres → Adhésions."
  }
  // Tout autre code levé par la base (DEMANDE_PAS_UN_RENOUVELLEMENT, CHAMP_INVALIDE…) : jamais le
  // code brut à l'écran. Un message technique non codé (réseau…) reste affiché tel quel.
  if (/\b[A-Z][A-Z0-9]*(_[A-Z0-9]+)+\b/.test(message)) return MESSAGE_ERREUR_GENERIQUE
  return message
}

/** Une mise à jour filtrée sur `statut = 'en_attente'` qui ne renvoie aucune ligne signifie qu'un autre admin a déjà décidé. */
export function demandeDejaTraitee(lignes: unknown[] | null): boolean {
  return !lignes || lignes.length === 0
}
