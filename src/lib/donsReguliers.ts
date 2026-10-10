export interface MoisAGenerer {
  anneeMois: string // 'YYYY-MM'
  label: string // 'Janvier 2026'
  date: string // ISO date YYYY-MM-DD, jour clampé au nombre de jours du mois
}

function joursDansMois(annee: number, moisIndex0: number): number {
  return new Date(annee, moisIndex0 + 1, 0).getDate()
}

function moisLabel(annee: number, moisIndex0: number): string {
  const label = new Date(annee, moisIndex0, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

// Calcule les mois entre date_debut (ou le dernier mois généré) et aujourd'hui (ou
// date_fin si atteinte) pour lesquels aucun don n'a encore été généré — un mois
// rétroactif manquant (date_debut ancienne) est traité exactement comme un mois
// courant : proposé à la confirmation, jamais inséré automatiquement.
export function moisManquants(
  engagement: { date_debut: string; date_fin: string | null; jour_prelevement: number },
  moisDejaGeneres: Set<string>
): MoisAGenerer[] {
  const debut = new Date(engagement.date_debut)
  const today = new Date()
  const limite = engagement.date_fin ? new Date(engagement.date_fin) : today
  const fin = limite < today ? limite : today

  const result: MoisAGenerer[] = []
  let annee = debut.getFullYear()
  let mois = debut.getMonth()

  while (annee < fin.getFullYear() || (annee === fin.getFullYear() && mois <= fin.getMonth())) {
    const anneeMois = `${annee}-${String(mois + 1).padStart(2, '0')}`
    if (!moisDejaGeneres.has(anneeMois)) {
      const jour = Math.min(engagement.jour_prelevement, joursDansMois(annee, mois))
      const date = `${annee}-${String(mois + 1).padStart(2, '0')}-${String(jour).padStart(2, '0')}`
      result.push({ anneeMois, label: moisLabel(annee, mois), date })
    }
    mois += 1
    if (mois > 11) { mois = 0; annee += 1 }
  }

  return result
}

export function anneeMoisDeDate(iso: string): string {
  return iso.slice(0, 7)
}

/**
 * Nombre de mois en attente de confirmation, tous engagements actifs confondus — même règle
 * que la page Dons réguliers. Partagé par l'accueil et la pastille du menu.
 */
export function compterDonsReguliersAConfirmer(
  engagements: { id: string; date_debut: string; date_fin: string | null; jour_prelevement: number }[],
  donsGeneres: { don_regulier_id: string | null; date: string }[],
): number {
  const moisParEngagement = new Map<string, Set<string>>()
  for (const don of donsGeneres) {
    if (!don.don_regulier_id) continue
    if (!moisParEngagement.has(don.don_regulier_id)) moisParEngagement.set(don.don_regulier_id, new Set())
    moisParEngagement.get(don.don_regulier_id)!.add(anneeMoisDeDate(don.date))
  }
  return engagements.reduce(
    (total, engagement) => total + moisManquants(engagement, moisParEngagement.get(engagement.id) ?? new Set()).length,
    0,
  )
}

function dateCourte(iso: string): string {
  const [annee, mois, jour] = iso.split('-')
  return `${jour}/${mois}/${annee}`
}

/** Période d'un engagement en clair : « depuis le 01/05/2026, sans date de fin » ou « du … au … ». */
export function periodeEngagement(dateDebut: string, dateFin: string | null): string {
  return dateFin
    ? `du ${dateCourte(dateDebut)} au ${dateCourte(dateFin)}`
    : `depuis le ${dateCourte(dateDebut)}, sans date de fin`
}
