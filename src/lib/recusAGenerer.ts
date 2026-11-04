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

interface LigneOrdre {
  profil: { id: string; personnes: { nom: string; prenom: string | null } }
}

/**
 * Ordre d'attribution des numéros (« Générer les reçus manquants », lots côté serveur) : nom puis
 * prénom (comparaison française), puis identifiant du profil. Réécrit à l'identique côté serveur
 * par `recus_manquants_lot` (collation `fr-x-icu`, puis `id`) : la liste de référence des deux
 * tests (`recusAGenerer.test.ts`, `supabase/tests/recus_lots.sql`) doit rester la même.
 */
export function comparerOrdreAttribution(a: LigneOrdre, b: LigneOrdre): number {
  return (
    a.profil.personnes.nom.localeCompare(b.profil.personnes.nom, 'fr') ||
    (a.profil.personnes.prenom ?? '').localeCompare(b.profil.personnes.prenom ?? '', 'fr') ||
    (a.profil.id < b.profil.id ? -1 : a.profil.id > b.profil.id ? 1 : 0)
  )
}
