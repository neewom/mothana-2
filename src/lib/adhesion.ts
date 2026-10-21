// Date de fin d'une adhésion — calculée en base (`calculer_date_fin_adhesion`, trigger sur
// adhesions) selon la règle de l'organisation ; cette fonction en est le miroir, utilisé
// seulement pour afficher la date de fin prévue avant enregistrement (cadré 2026-10-21).
//   - 'glissante' (défaut) : date d'adhésion + 1 an (29 février → 28 février, comme PostgreSQL) ;
//   - 'annee_civile' : 31/12 de l'année d'adhésion, ou de l'année suivante à partir du mois de
//     bascule.

export type RegleFinAdhesion = 'glissante' | 'annee_civile'

export interface RegleAdhesion {
  regleFin: RegleFinAdhesion
  /** 1 à 12 : à partir de ce mois, une adhésion « au 31 décembre » vaut aussi l'année suivante. */
  moisBascule: number
}

export const REGLE_ADHESION_PAR_DEFAUT: RegleAdhesion = { regleFin: 'glissante', moisBascule: 12 }

export function computeDateFin(dateDebut: string, regle: RegleAdhesion = REGLE_ADHESION_PAR_DEFAUT): string {
  const [year, month, day] = dateDebut.split('-').map(Number)
  if (regle.regleFin === 'annee_civile') {
    return `${month >= regle.moisBascule ? year + 1 : year}-12-31`
  }
  const dernierJour = new Date(Date.UTC(year + 1, month, 0)).getUTCDate()
  return `${year + 1}-${String(month).padStart(2, '0')}-${String(Math.min(day, dernierJour)).padStart(2, '0')}`
}

/** « Valable jusqu'au 31/12/2026 » — date de fin prévue, affichée sous la date d'adhésion. */
export function libelleFinPrevue(dateDebut: string, regle: RegleAdhesion): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateDebut)) return ''
  const [annee, mois, jour] = computeDateFin(dateDebut, regle).split('-')
  return `Valable jusqu'au ${jour}/${mois}/${annee}`
}
