import type { Adherent } from '../types'

export function adherentFullName(a: Adherent): string {
  return a.prenom ? `${a.prenom} ${a.nom}` : a.nom
}
