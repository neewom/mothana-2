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
