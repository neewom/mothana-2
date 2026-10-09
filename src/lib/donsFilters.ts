import type { Don } from '../types'
import { normalizeSearchText } from './participantSearch'

export type PeriodeDons = '30j' | '90j' | 'mois' | 'annee' | 'tout'

export const PERIODES_DONS: { key: PeriodeDons; label: string }[] = [
  { key: '30j', label: '30 jours' },
  { key: '90j', label: '90 jours' },
  { key: 'mois', label: 'Ce mois' },
  { key: 'annee', label: 'Cette année' },
  { key: 'tout', label: 'Tout' },
]

export interface DonsFiltres {
  /** Raccourci de période ; 'tout' aussi quand les dates sont saisies à la main. */
  periode: PeriodeDons
  dateDebut: string
  dateFin: string
  participantId: string
  activiteId: string
  mode: string
}

export const DONS_FILTRES_VIDES: DonsFiltres = {
  periode: 'tout',
  dateDebut: '',
  dateFin: '',
  participantId: '',
  activiteId: '',
  mode: '',
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

/** Bornes (AAAA-MM-JJ) d'un raccourci de période, aujourd'hui inclus. */
export function bornesPeriode(periode: PeriodeDons, today: string): { dateDebut: string; dateFin: string } {
  switch (periode) {
    case '30j':
      return { dateDebut: addDays(today, -30), dateFin: today }
    case '90j':
      return { dateDebut: addDays(today, -90), dateFin: today }
    case 'mois':
      return { dateDebut: `${today.slice(0, 7)}-01`, dateFin: today }
    case 'annee':
      return { dateDebut: `${today.slice(0, 4)}-01-01`, dateFin: today }
    case 'tout':
      return { dateDebut: '', dateFin: '' }
  }
}

/** Nombre de filtres actifs (la période compte pour un, qu'elle vienne d'un raccourci ou de dates). */
export function nombreFiltresDons(filtres: DonsFiltres): number {
  return [filtres.dateDebut || filtres.dateFin, filtres.participantId, filtres.activiteId, filtres.mode].filter(Boolean).length
}

function rechercheDon(don: Don): string {
  const p = don.profils_participant?.personnes
  return normalizeSearchText([p?.prenom, p?.nom, p?.email, don.activites?.nom].filter(Boolean).join(' '))
}

/** Filtres du tiroir + recherche libre (donateur, email, activité ; tous les mots doivent figurer). */
export function filtrerDons(dons: Don[], filtres: DonsFiltres, recherche: string): Don[] {
  const tokens = normalizeSearchText(recherche).trim().split(/\s+/).filter(Boolean)
  return dons.filter((d) => {
    if (filtres.dateDebut && d.date < filtres.dateDebut) return false
    if (filtres.dateFin && d.date > filtres.dateFin) return false
    if (filtres.participantId && d.profil_participant_id !== filtres.participantId) return false
    if (filtres.activiteId && d.activite_id !== filtres.activiteId) return false
    if (filtres.mode && String(d.mode_paiement) !== filtres.mode) return false
    if (tokens.length > 0) {
      const haystack = rechercheDon(d)
      if (!tokens.every((t) => haystack.includes(t))) return false
    }
    return true
  })
}
