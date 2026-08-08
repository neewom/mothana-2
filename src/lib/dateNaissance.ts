// Garde-fou anti-erreur de saisie (pas une règle d'âge légal — un mineur a le
// droit d'adhérer librement à une association, loi n°2017-86 art. 2 bis) :
// l'année de naissance doit être antérieure à l'année en cours, jamais
// l'année courante ni une année future.
export function maxAnneeNaissance(): number {
  return new Date().getFullYear() - 1
}

export function maxDateNaissance(): string {
  return `${maxAnneeNaissance()}-12-31`
}

export function isAnneeNaissanceValide(date: string): boolean {
  const year = Number(date.slice(0, 4))
  return Number.isFinite(year) && year <= maxAnneeNaissance()
}
