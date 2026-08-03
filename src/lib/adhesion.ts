// Durée de validité d'une adhésion : 1 an glissant depuis la date de début
// (décision utilisateur du 2026-08-04 — pas d'année civile, pas de durée
// configurable par organisation, aucun besoin exprimé en ce sens).
export function computeDateFin(dateDebut: string): string {
  const [year, month, day] = dateDebut.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCFullYear(date.getUTCFullYear() + 1)
  return date.toISOString().split('T')[0]
}
