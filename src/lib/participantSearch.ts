import type { ProfilParticipant } from '../types'
import { CIVILITE_LABELS } from './civilite'

const DIACRITICS_PATTERN = new RegExp(`[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`, 'g')
const SPECIAL_CHARACTERS_PATTERN = /[^\p{L}\p{N}\s]/gu

function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(DIACRITICS_PATTERN, '')
    .replace(SPECIAL_CHARACTERS_PATTERN, '')
    .toLowerCase()
}

export function participantFullName(p: ProfilParticipant): string {
  return p.personnes.prenom
    ? `${p.personnes.prenom} ${p.personnes.nom}`
    : p.personnes.nom
}

export function matchesParticipantSearch(p: ProfilParticipant, search: string): boolean {
  const tokens = normalizeSearchText(search).trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true

  const civiliteLabel = p.personnes.civilite ? CIVILITE_LABELS[p.personnes.civilite] : null
  const participantData = [p.personnes.nom, p.personnes.prenom, p.personnes.nom2, p.personnes.prenom2, civiliteLabel]
    .filter(Boolean)
    .join(' ')
  const haystack = normalizeSearchText(participantData)

  return tokens.every((token) => haystack.includes(token))
}

export function filterParticipants(participants: ProfilParticipant[], search: string): ProfilParticipant[] {
  if (!search.trim()) return participants
  return participants.filter((p) => matchesParticipantSearch(p, search))
}
