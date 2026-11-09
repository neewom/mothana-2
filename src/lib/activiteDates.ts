// Cohérence des dates d'une activité (carte Trello JaknySME) — même règle que la
// contrainte SQL activites_dates_check : une date absente n'est pas contrôlée,
// le même jour est accepté, seule une fin strictement antérieure au début est refusée.

export const ACTIVITE_DATES_ERROR = 'La date de fin ne peut pas être antérieure à la date de début.'

/** Dates au format ISO `AAAA-MM-JJ` (comparables lexicographiquement), vides ou nulles acceptées. */
export function isActiviteDateRangeInvalid(
  dateDebut: string | null | undefined,
  dateFin: string | null | undefined
): boolean {
  if (!dateDebut || !dateFin) return false
  return dateFin < dateDebut
}

/** Traduit un refus de la base en message lisible ; renvoie le message brut sinon. */
export function activiteDbErrorMessage(message: string): string {
  return message.includes('activites_dates_check') ? ACTIVITE_DATES_ERROR : message
}
