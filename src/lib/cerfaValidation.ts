import type { Personne } from '../types'

// Validation côté client — même règles que l'Edge Function generate-recu
// (docs/regles-recus-fiscaux.md §2-3). Le backend fait autorité ; cette
// couche ne fait que prévenir l'utilisateur avant qu'il clique.

export interface OrganisationFiscale {
  adresse: string | null
  code_postal: string | null
  ville: string | null
  modele_recu_pdf: {
    rna?: string
    siren?: string
    objet_social?: string
    mention_legale?: string
  } | null
}

export function validateOrganisationCerfa(org: OrganisationFiscale): string[] {
  const modele = org.modele_recu_pdf ?? {}
  const missing: string[] = []
  if (!org.adresse) missing.push('adresse')
  if (!org.code_postal) missing.push('code postal')
  if (!org.ville) missing.push('ville')
  if (!modele.rna && !modele.siren) missing.push('RNA ou SIREN')
  if (!modele.objet_social) missing.push('objet social')
  if (!modele.mention_legale) missing.push('mention légale')
  return missing
}

export interface ParticipantValidation {
  blocking: boolean
  missing: string[]
  message?: string
}

export function validateParticipantCerfa(p: Personne): ParticipantValidation {
  if (p.civilite === 7) {
    return {
      blocking: true,
      missing: [],
      message:
        "Les dons enregistrés au nom d'une famille ne permettent pas de générer un reçu fiscal. " +
        'Identifiez le foyer fiscal (Mr & Mme) ou le donateur individuel.',
    }
  }

  if (!p.civilite) {
    return {
      blocking: true,
      missing: [],
      message: 'Civilité du donateur manquante — impossible de déterminer le type de reçu à générer.',
    }
  }

  const missing: string[] = []
  if (!p.nom) missing.push('nom')
  if (!p.adresse) missing.push('adresse')
  if (!p.code_postal) missing.push('code postal')
  if (!p.ville) missing.push('ville')
  if ((p.civilite === 1 || p.civilite === 2 || p.civilite === 3 || p.civilite === 4) && !p.prenom) {
    missing.push('prénom')
  }

  return { blocking: missing.length > 0, missing }
}

/**
 * Résumé court d'un blocage, pour une pastille de liste (le détail reste dans le panneau) :
 * « 3 champs manquants », « Civilité manquante », « Don au nom d'une famille ». `null` si rien ne bloque.
 */
export function resumeValidationParticipant(v: ParticipantValidation): string | null {
  if (v.missing.length > 0) return `${v.missing.length} champ${v.missing.length > 1 ? 's' : ''} manquant${v.missing.length > 1 ? 's' : ''}`
  if (!v.blocking) return null
  return v.message?.startsWith('Civilité') ? 'Civilité manquante' : 'Don au nom d’une famille'
}

/**
 * Pages de Paramètres où compléter les champs manquants de `validateOrganisationCerfa` :
 * l'identité (adresse, RNA/SIREN, objet social) est dans Organisation, la mention légale dans
 * Reçus fiscaux.
 */
export function pagesParametresACompleter(missing: string[]): { label: string; to: string }[] {
  const pages: { label: string; to: string }[] = []
  if (missing.some((field) => field !== 'mention légale')) pages.push({ label: 'Paramètres › Organisation', to: '/admin/parametres' })
  if (missing.includes('mention légale')) pages.push({ label: 'Paramètres › Reçus fiscaux', to: '/admin/parametres/recus-fiscaux' })
  return pages
}
