import type { ProfilParticipant } from '../types'
import { CIVILITE_LABELS } from './civilite'

// Export CSV de la page Donateurs (cadré 2026-10-21) : les donateurs tels qu'affichés —
// recherche appliquée, ordre de tri du tableau, toutes les pages — avec les colonnes du tableau.
// Montant en nombre au format français, sans symbole ni séparateur de milliers : Excel FR le lit
// comme un nombre (additionnable), ce que l'espace insécable fine de toLocaleString empêche.

export function lignesExportDonateurs(
  donateurs: Pick<ProfilParticipant, 'id' | 'personnes'>[],
  totalDons: Map<string, number>,
): Record<string, string>[] {
  return donateurs.map((p) => ({
    'Civilité': p.personnes.civilite ? CIVILITE_LABELS[p.personnes.civilite] : '',
    Nom: p.personnes.nom,
    'Prénom': p.personnes.prenom ?? '',
    'Total dons': (totalDons.get(p.id) ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }),
  }))
}

export function nomFichierExportDonateurs(today: string, recherche: boolean): string {
  return `donateurs_${recherche ? 'recherche_' : ''}${today}.csv`
}
