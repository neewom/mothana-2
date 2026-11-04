import type { ParticipantValidation } from './cerfaValidation'

interface LigneRecu {
  recu: unknown | null
  validation: ParticipantValidation
}

/**
 * Lignes que « Générer les reçus manquants » doit traiter : donateurs sans reçu pour
 * l'année, dont la fiche est complète. Un reçu déjà généré n'est jamais régénéré en lot
 * (chaque régénération crée une nouvelle version conservée) : cela passe par son bouton
 * « Regénérer ». L'ordre des lignes est conservé (ordre d'attribution des numéros).
 */
export function recusAGenerer<T extends LigneRecu>(rows: T[], organisationIncomplete: boolean): T[] {
  if (organisationIncomplete) return []
  return rows.filter((r) => !r.recu && !r.validation.blocking && r.validation.missing.length === 0)
}
