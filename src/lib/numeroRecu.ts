import type { FormatNumeroRecu } from '../types'

// Exemple affiché dans Paramètres › Reçus fiscaux et dans la prévisualisation des modèles.
// Le vrai numéro est attribué uniquement par l'Edge Function generate-recu
// (supabase/functions/_shared/numeroRecu.ts et RPC next_numero_recu) : même forme, jamais fabriqué ici.

export function formatNumeroRecu(valeur: unknown): FormatNumeroRecu {
  return valeur === 'donateur' ? 'donateur' : 'sequence'
}

export function exempleNumeroRecu(
  format: FormatNumeroRecu,
  annee: number,
  options: { numeroDepart?: number; numeroDonateur?: string } = {},
): string {
  if (format === 'donateur') return `${annee}-${options.numeroDonateur ?? '2803'}`
  const depart = Number.isFinite(options.numeroDepart) && (options.numeroDepart ?? 0) > 0 ? Math.trunc(options.numeroDepart!) : 1
  return `${annee}-${String(depart).padStart(3, '0')}`
}
