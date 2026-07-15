import type { Civilite } from '../types'

export const CIVILITE_LABELS: Record<Civilite, string> = {
  1: 'Monsieur',
  2: 'Madame',
  3: 'Mademoiselle',
  4: 'Foyer',
  5: 'Société',
  6: 'Association',
  7: 'Famille',
}

export const CIVILITE_OPTIONS: { value: Civilite; label: string }[] = [
  { value: 1, label: 'Monsieur' },
  { value: 2, label: 'Madame' },
  { value: 3, label: 'Mademoiselle' },
  { value: 4, label: 'Foyer' },
  { value: 5, label: 'Société' },
  { value: 6, label: 'Association' },
  { value: 7, label: 'Famille' },
]
