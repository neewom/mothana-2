import type { Adhesion } from '../types'

export type EmailFilter = '' | 'avec' | 'sans'

/** Filtres du tiroir de la page Adhérents (la recherche et le statut restent dans la barre). */
export interface AdherentsFiltres {
  tag: string
  excludeTag: string
  email: EmailFilter
  codePostal: string
  ville: string
  pays: string
}

export const ADHERENTS_FILTRES_VIDES: AdherentsFiltres = {
  tag: '',
  excludeTag: '',
  email: '',
  codePostal: '',
  ville: '',
  pays: '',
}

/** Retire les espaces autour des champs texte saisis dans le tiroir. */
export function normaliserFiltresAdherents(filtres: AdherentsFiltres): AdherentsFiltres {
  return { ...filtres, codePostal: filtres.codePostal.trim(), ville: filtres.ville.trim(), pays: filtres.pays.trim() }
}

export function nombreFiltresAdherents(filtres: AdherentsFiltres): number {
  return Object.values(filtres).filter(Boolean).length
}

function dateCourte(iso: string): string {
  const [annee, mois, jour] = iso.split('-')
  return `${jour}/${mois}/${annee}`
}

/**
 * Libellé de la dernière adhésion d'un adhérent : « À jour · jusqu'au … », « Expirée depuis le … »,
 * « Aucune adhésion ». L'ambre signale une adhésion expirée (fait dérivé des dates).
 */
export function libelleAdhesion(
  adhesion: Pick<Adhesion, 'date_fin'> | undefined,
  today: string,
): { label: string; variant: 'success' | 'warning' | 'neutral' } {
  if (!adhesion) return { label: 'Aucune adhésion', variant: 'neutral' }
  if (!adhesion.date_fin) return { label: 'À jour', variant: 'success' }
  if (adhesion.date_fin >= today) return { label: `À jour · jusqu'au ${dateCourte(adhesion.date_fin)}`, variant: 'success' }
  return { label: `Expirée depuis le ${dateCourte(adhesion.date_fin)}`, variant: 'warning' }
}
