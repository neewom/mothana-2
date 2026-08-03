import type { CiviliteAdherent } from '../types'

export const CIVILITE_ADHERENT_LABELS: Record<CiviliteAdherent, string> = {
  0: 'Non renseigné',
  1: 'Monsieur',
  2: 'Madame',
}

export const CIVILITE_ADHERENT_OPTIONS: { value: CiviliteAdherent; label: string }[] = [
  { value: 1, label: 'Monsieur' },
  { value: 2, label: 'Madame' },
]
