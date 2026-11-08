import type { Adhesion } from '../types'

export type EmailFilter = '' | 'avec' | 'sans' | 'invalide'

/** Options du filtre Email (tiroir et pastille). « Email invalide » : adresse rejetée par Brevo
 * (`email_invalide_at`), remise à zéro quand l'email est corrigé. */
export const EMAIL_FILTRE_LABELS: Record<Exclude<EmailFilter, ''>, string> = {
  avec: 'Avec email',
  sans: 'Sans email',
  invalide: 'Email invalide',
}

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

/** Seuil de l'état « À renouveler » : la date de fin tombe dans les N prochains jours (même seuil
 * que la tuile « Adhésions à renouveler (30 j) » de l'accueil et que `search_adherents`). */
export const JOURS_A_RENOUVELER = 30

/** `today` (AAAA-MM-JJ) + `jours`, au même format (calcul en UTC, comme `today`). */
export function ajouterJours(today: string, jours: number): string {
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + jours)
  return d.toISOString().slice(0, 10)
}

export type EtatAdhesion = 'a_jour' | 'a_renouveler' | 'expire'

/**
 * État de la dernière adhésion d'un adhérent non archivé, même règle que `search_adherents` :
 * « À renouveler » si la date de fin tombe entre aujourd'hui et aujourd'hui + 30 jours (inclus),
 * « Expiré » si elle est passée ou s'il n'y a aucune adhésion, « À jour » sinon (y compris sans
 * date de fin).
 */
export function etatAdhesion(adhesion: Pick<Adhesion, 'date_fin'> | undefined, today: string): EtatAdhesion {
  if (!adhesion) return 'expire'
  if (!adhesion.date_fin || adhesion.date_fin > ajouterJours(today, JOURS_A_RENOUVELER)) return 'a_jour'
  return adhesion.date_fin >= today ? 'a_renouveler' : 'expire'
}

/**
 * État d'après la date de fin de la dernière adhésion et l'existence d'une adhésion, tels que les
 * renvoie `search_adherents_verification` (bénévole), même règle que `search_adherents` : aucune
 * adhésion → expiré ; adhésion sans date de fin → à jour. `aAdhesion` absent (ancienne version de
 * la fonction, sans la colonne `a_adhesion`) : une date de fin vide vaut « aucune adhésion ».
 */
export function etatDateFin(
  dateFin: string | null | undefined,
  today: string,
  aAdhesion: boolean = Boolean(dateFin),
): EtatAdhesion {
  return etatAdhesion(aAdhesion ? { date_fin: dateFin ?? null } : undefined, today)
}

export const ETAT_ADHESION_LIBELLES: Record<EtatAdhesion, string> = {
  a_jour: 'À jour',
  a_renouveler: 'À renouveler',
  expire: 'Adhésion expirée',
}

/**
 * Libellé de la dernière adhésion d'un adhérent : « À jour · jusqu'au … », « À renouveler ·
 * jusqu'au … », « Expirée depuis le … », « Aucune adhésion ». L'ambre signale une adhésion à
 * renouveler, expirée ou absente (fait dérivé des dates ; une fiche sans adhésion est classée dans
 * « Expirés »).
 */
export function libelleAdhesion(
  adhesion: Pick<Adhesion, 'date_fin'> | undefined,
  today: string,
): { label: string; variant: 'success' | 'warning' } {
  if (!adhesion) return { label: 'Aucune adhésion', variant: 'warning' }
  if (!adhesion.date_fin) return { label: 'À jour', variant: 'success' }
  const fin = dateCourte(adhesion.date_fin)
  switch (etatAdhesion(adhesion, today)) {
    case 'a_jour':
      return { label: `À jour · jusqu'au ${fin}`, variant: 'success' }
    case 'a_renouveler':
      return { label: `À renouveler · jusqu'au ${fin}`, variant: 'warning' }
    default:
      return { label: `Expirée depuis le ${fin}`, variant: 'warning' }
  }
}
