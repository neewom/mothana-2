import type { ProfilParticipant } from '../types'
import { CIVILITE_LABELS } from './civilite'

export function participantFullName(p: ProfilParticipant): string {
  return p.personnes.prenom
    ? `${p.personnes.prenom} ${p.personnes.nom}`
    : p.personnes.nom
}

export function matchesParticipantSearch(p: ProfilParticipant, search: string): boolean {
  const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true

  const civiliteLabel = p.personnes.civilite ? CIVILITE_LABELS[p.personnes.civilite] : null
  const haystack = [p.personnes.nom, p.personnes.prenom, p.personnes.nom2, p.personnes.prenom2, civiliteLabel]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return tokens.every((token) => haystack.includes(token))
}

export function filterParticipants(participants: ProfilParticipant[], search: string): ProfilParticipant[] {
  if (!search.trim()) return participants
  return participants.filter((p) => matchesParticipantSearch(p, search))
}
