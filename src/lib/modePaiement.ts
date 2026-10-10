import type { ModePaiement } from '../types'

export const MODE_PAIEMENT_LABELS: Record<ModePaiement, string> = {
  1: 'Espèces',
  2: 'Chèque',
  3: 'Prélèvement - virement',
  4: 'Autres',
}

export const MODE_PAIEMENT_OPTIONS: { value: ModePaiement; label: string }[] = [
  { value: 1, label: 'Espèces' },
  { value: 2, label: 'Chèque' },
  { value: 3, label: 'Prélèvement - virement' },
  { value: 4, label: 'Autres' },
]
