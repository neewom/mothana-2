// Comparaison « à période égale » de la tuile Évolution (page Statistiques).
// Année en cours : du 1er janvier à aujourd'hui sur les deux années, au jour près
// (aujourd'hui = 29 février d'une année bissextile → l'année précédente s'arrête au 28 février).
// Année passée (ou future) : année complète contre année complète.

export interface DatedAmount {
  /** Date du don, format ISO `YYYY-MM-DD`. */
  date: string
  montant: number
}

export interface SamePeriodComparison {
  /** Total de l'année affichée sur la période comparée. */
  totalN: number
  /** Total de l'année précédente sur la même période. */
  totalN1: number
  /** Variation en %, `null` quand l'année précédente vaut 0 (affichée « — »). */
  variationPct: number | null
  /** Dons de l'année affichée datés après la coupure (saisis d'avance), arrondi au centime ; 0 pour une année complète. */
  totalAfterCutoff: number
  /** Dernier jour inclus (`MM-DD`) quand la comparaison est à date, `null` pour une année complète. */
  cutoff: string | null
}

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function computeSamePeriodComparison(
  dons: readonly DatedAmount[],
  year: number,
  today: Date,
): SamePeriodComparison {
  const toDate = year === today.getFullYear()
  const cutoffN = toDate ? `${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}` : '12-31'
  const cutoffN1 = cutoffN === '02-29' && !isLeapYear(year - 1) ? '02-28' : cutoffN
  const endN = `${year}-${cutoffN}`
  const endN1 = `${year - 1}-${cutoffN1}`

  let totalN = 0
  let totalN1 = 0
  let totalAfterCutoff = 0
  for (const d of dons) {
    const y = Number(d.date.slice(0, 4))
    const day = d.date.slice(0, 10)
    if (y === year && day <= endN) totalN += d.montant
    else if (y === year) totalAfterCutoff += d.montant
    else if (y === year - 1 && day <= endN1) totalN1 += d.montant
  }

  return {
    totalN,
    totalN1,
    variationPct: totalN1 > 0 ? ((totalN - totalN1) / totalN1) * 100 : null,
    // Arrondi au centime : une somme de montants à centimes laisse des résidus flottants (~1e-13).
    totalAfterCutoff: Math.round(totalAfterCutoff * 100) / 100,
    cutoff: toDate ? cutoffN : null,
  }
}

const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

/** `MM-DD` → « 9 nov. » (1er du mois : « 1ᵉʳ janv. »). */
export function formatDayMonth(mmdd: string): string {
  const [m, d] = mmdd.split('-').map(Number)
  return `${d === 1 ? '1ᵉʳ' : d} ${MOIS_COURTS[m - 1]}`
}
