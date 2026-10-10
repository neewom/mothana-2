import { normalizeSearchText } from './participantSearch'

/**
 * Recherche libre côté client : chaque mot saisi doit figurer dans l'un des champs
 * (sans accents, casse ni ponctuation). Vide → tout correspond.
 */
export function correspondRecherche(champs: (string | null | undefined)[], recherche: string): boolean {
  const mots = normalizeSearchText(recherche).trim().split(/\s+/).filter(Boolean)
  if (mots.length === 0) return true
  const texte = normalizeSearchText(champs.filter(Boolean).join(' '))
  return mots.every((mot) => texte.includes(mot))
}
