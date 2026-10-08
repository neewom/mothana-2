// Règles RGPD du porte-monnaie événementiel, partagées par l'admin et les pages publiques.
// L'échéance doit rester alignée sur la purge SQL : `date_fin + make_interval(months => n)`
// (fin de mois ramenée au dernier jour du mois cible, comme Postgres).

export const CONSERVATION_MOIS_DEFAUT = 18
export const CONSERVATION_MOIS_MIN = 1
export const CONSERVATION_MOIS_MAX = 120

/** Dernier jour de conservation (AAAA-MM-JJ) : les données sont anonymisées le lendemain. */
export function dateFinConservation(dateFin: string, mois: number): string {
  const [annee, moisIndex, jour] = dateFin.split('-').map(Number)
  const totalMois = moisIndex - 1 + mois
  const anneeCible = annee + Math.floor(totalMois / 12)
  const moisCible = totalMois % 12
  const dernierJour = new Date(Date.UTC(anneeCible, moisCible + 1, 0)).getUTCDate()
  const jourCible = Math.min(jour, dernierJour)
  return `${anneeCible}-${String(moisCible + 1).padStart(2, '0')}-${String(jourCible).padStart(2, '0')}`
}

export function formatDateLongue(date: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(`${date}T12:00:00`))
}

export function conservationMoisValide(valeur: number): boolean {
  return Number.isInteger(valeur) && valeur >= CONSERVATION_MOIS_MIN && valeur <= CONSERVATION_MOIS_MAX
}

/** URL de politique de confidentialité : http(s) uniquement (même règle que le CHECK SQL). */
export function urlPolitiqueValide(valeur: string): boolean {
  const trimmed = valeur.trim()
  if (!/^https?:\/\/\S+$/i.test(trimmed) || trimmed.length > 2048) return false
  try {
    const url = new URL(trimmed)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.includes('.')
  } catch {
    return false
  }
}
