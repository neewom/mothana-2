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

export const MODE_PAIEMENT_BADGE_CLASSES: Record<ModePaiement, string> = {
  1: 'bg-green-100 text-green-800',
  2: 'bg-amber-100 text-amber-800',
  3: 'bg-blue-100 text-blue-800',
  4: 'bg-slate-100 text-slate-800',
}
