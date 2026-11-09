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
 * que le lot d'envoi écarte est classé à part (`non_envoyable`) : « Non envoyé » regroupe exactement
 * les reçus que « Envoyer les N reçus non envoyés » traite. Les exclus viennent du serveur
 * (`recapitulatif_envoi_lot_recus` → `recus_envoi_lot`, `raison` non nulle : aucune adresse, adresse au
 * format invalide, adresse rejetée par Brevo, envoi incertain lors d'un lot précédent). Tant que ce
 * récapitulatif n'est pas chargé, repli sur la seule règle connue côté client : l'adresse vide.
 */
export type StatutEnvoi = 'envoye' | 'non_envoye' | 'non_envoyable'

/** Exclus du lot d'envoi, par donateur (`profil_participant_id` → raison du serveur). */
export type ExclusEnvoi = ReadonlyMap<string, string>

/** Raison affichée en repli (récapitulatif serveur absent), même libellé que le serveur. */
export const RAISON_SANS_EMAIL = 'Aucune adresse email'

export function exclusEnvoiParDonateur(
  exclus: readonly { profil_participant_id: string; raison: string }[] | null | undefined,
): ExclusEnvoi | null {
  if (!exclus) return null
  return new Map(exclus.map((e) => [e.profil_participant_id, e.raison]))
}

export interface RecuStatutSource {
  date_generation: string
  email_envoye_at: string | null
}

interface LigneRecuFiltrable {
  recu: RecuStatutSource | null
  validation: ParticipantValidation
  profil: { id: string; personnes: { email: string | null } }
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

/**
 * Statut d'envoi d'une ligne, et la raison quand le reçu n'est pas envoyable. `exclus` : exclus du lot
 * d'envoi (récapitulatif serveur) ; `null` tant qu'il n'est pas chargé (repli : adresse vide).
 */
export function envoiLigne(
  row: Pick<LigneRecuFiltrable, 'recu' | 'profil'>,
  exclus: ExclusEnvoi | null,
): { statut: StatutEnvoi; raison: string | null } | null {
  if (!row.recu) return null
  if (envoiVersionActuelle(row.recu)) return { statut: 'envoye', raison: null }
  if (exclus) {
    const raison = exclus.get(row.profil.id)
    return raison ? { statut: 'non_envoyable', raison } : { statut: 'non_envoye', raison: null }
  }
  return row.profil.personnes.email?.trim()
    ? { statut: 'non_envoye', raison: null }
    : { statut: 'non_envoyable', raison: RAISON_SANS_EMAIL }
}

export function statutEnvoi(row: Pick<LigneRecuFiltrable, 'recu' | 'profil'>, exclus: ExclusEnvoi | null): StatutEnvoi | null {
  return envoiLigne(row, exclus)?.statut ?? null
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
  { value: 'non_envoyable', label: 'Non envoyable' },
]

/** Un filtre d'envoi ne retient que des reçus générés (un donateur sans reçu n'a rien à envoyer). */
export function filtrerRecus<T extends LigneRecuFiltrable>(rows: T[], filtres: RecusFiltres, exclus: ExclusEnvoi | null): T[] {
  return rows.filter(
    (r) =>
      (!filtres.generation || statutGeneration(r) === filtres.generation) &&
      (!filtres.envoi || statutEnvoi(r, exclus) === filtres.envoi),
  )
}

export function nombreFiltresRecus(filtres: RecusFiltres): number {
  return (filtres.generation ? 1 : 0) + (filtres.envoi ? 1 : 0)
}
