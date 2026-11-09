import type { ParticipantValidation } from './cerfaValidation'

// Statuts d'une ligne de la page Reçus fiscaux (un donateur avec des dons dans l'année) et filtres
// du tiroir : génération et envoi par email. Lecture seule de recus_fiscaux ; aucun écrivain ici.

/**
 * Génération, trois classes exclusives :
 * - `genere` : un reçu existe pour l'année (même si la fiche a été modifiée depuis et serait
 *   aujourd'hui incomplète : la pastille d'avertissement reste affichée à côté) ;
 * - `a_completer` : pas de reçu, fiche du donateur incomplète (champs manquants, civilité manquante,
 *   don au nom d'une famille) : mêmes lignes que les exclus du lot (`recusExclus`) ;
 * - `non_genere` : pas de reçu, fiche complète : prêt à générer (`recusAGenerer`, hors blocage
 *   de l'organisation, signalé par la bannière de la page).
 */
export type StatutGeneration = 'genere' | 'non_genere' | 'a_completer'

/**
 * Envoi par email de la version actuelle du reçu (seulement pour un reçu généré). Un reçu non envoyé
 * dont le donateur n'a pas d'adresse est classé à part (`sans_email`) : « Non envoyé » regroupe alors
 * les reçus que « Envoyer les N reçus non envoyés » peut traiter (le lot écarte aussi une adresse au
 * format invalide ou rejetée par Brevo, signalée par la pastille « Email invalide »).
 */
export type StatutEnvoi = 'envoye' | 'non_envoye' | 'sans_email'

export interface RecuStatutSource {
  date_generation: string
  email_envoye_at: string | null
}

interface LigneRecuFiltrable {
  recu: RecuStatutSource | null
  validation: ParticipantValidation
  profil: { personnes: { email: string | null } }
}

export function statutGeneration(row: Pick<LigneRecuFiltrable, 'recu' | 'validation'>): StatutGeneration {
  if (row.recu) return 'genere'
  return row.validation.blocking || row.validation.missing.length > 0 ? 'a_completer' : 'non_genere'
}

/**
 * Date d'envoi de la version actuelle, ou `null` si elle n'est pas envoyée.
 * L'envoi marque `email_envoye_at` (et `email_envoye_le` de la dernière version) ; une régénération
 * remplace `date_generation` sans effacer `email_envoye_at`. Un envoi antérieur à la génération
 * actuelle portait donc une version précédente : la version actuelle reste à envoyer, comme pour le
 * lot d'envoi côté serveur (`recus_envoi_lot` : dernière version non marquée envoyée).
 */
export function envoiVersionActuelle(recu: RecuStatutSource): string | null {
  if (!recu.email_envoye_at) return null
  return new Date(recu.email_envoye_at).getTime() >= new Date(recu.date_generation).getTime() ? recu.email_envoye_at : null
}

export function statutEnvoi(recu: RecuStatutSource | null, email: string | null | undefined): StatutEnvoi | null {
  if (!recu) return null
  if (envoiVersionActuelle(recu)) return 'envoye'
  return email?.trim() ? 'non_envoye' : 'sans_email'
}

export interface RecusFiltres {
  generation: StatutGeneration | ''
  envoi: StatutEnvoi | ''
}

export const RECUS_FILTRES_VIDES: RecusFiltres = { generation: '', envoi: '' }

export const GENERATION_OPTIONS: { value: StatutGeneration; label: string }[] = [
  { value: 'genere', label: 'Généré' },
  { value: 'non_genere', label: 'Non généré' },
  { value: 'a_completer', label: 'À compléter' },
]

export const ENVOI_OPTIONS: { value: StatutEnvoi; label: string }[] = [
  { value: 'envoye', label: 'Envoyé' },
  { value: 'non_envoye', label: 'Non envoyé' },
  { value: 'sans_email', label: 'Sans email' },
]

/** Un filtre d'envoi ne retient que des reçus générés (un donateur sans reçu n'a rien à envoyer). */
export function filtrerRecus<T extends LigneRecuFiltrable>(rows: T[], filtres: RecusFiltres): T[] {
  return rows.filter(
    (r) =>
      (!filtres.generation || statutGeneration(r) === filtres.generation) &&
      (!filtres.envoi || statutEnvoi(r.recu, r.profil.personnes.email) === filtres.envoi),
  )
}

export function nombreFiltresRecus(filtres: RecusFiltres): number {
  return (filtres.generation ? 1 : 0) + (filtres.envoi ? 1 : 0)
}
