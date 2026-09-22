import type { Activite } from '../types'

export function matchesActiviteSearch(a: Activite, search: string): boolean {
  const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true

  const haystack = a.nom.toLowerCase()
  return tokens.every((token) => haystack.includes(token))
}

export function filterActivites(activites: Activite[], search: string): Activite[] {
  if (!search.trim()) return activites
  return activites.filter((a) => matchesActiviteSearch(a, search))
}

export function findExactActivite(activites: Activite[], search: string): Activite | undefined {
  const normalized = search.trim().toLocaleLowerCase('fr-FR')
  if (!normalized) return undefined
  return activites.find((activite) => activite.nom.trim().toLocaleLowerCase('fr-FR') === normalized)
}

export function filterUpcomingDatedActivites(activites: Activite[], todayIso: string): Activite[] {
  return activites.filter((activite) => activite.date_debut !== null && activite.date_debut >= todayIso)
}
