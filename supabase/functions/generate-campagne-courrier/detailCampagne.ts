// Détail figé d'une campagne courrier (carte « Courrier : détail figé et notes », 2026-11-10) :
// classement destinataire / exclu et lignes à enregistrer, nom et adresse figés à la génération.
// Libellés de la sélection et de l'exclusion : _shared/libellesCampagne.ts (communs avec l'Emailing).

export type RaisonExclusionCourrier = 'adresse_incomplete'

export interface AdherentAdresse {
  id: string
  nom: string
  prenom: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
}

/**
 * Adresse postale complète : adresse, code postal et ville renseignés (un champ fait d'espaces
 * compte comme vide), le pays n'étant pas exigé — même critère que champsAdresseManquants
 * (src/lib/adresseCourrier.ts), utilisé par l'aperçu de la page Courrier.
 */
export function adresseComplete(a: Pick<AdherentAdresse, 'adresse' | 'code_postal' | 'ville'>): boolean {
  return !!(a.adresse?.trim() && a.code_postal?.trim() && a.ville?.trim())
}

/** Raison d'exclusion d'un adhérent, ou null s'il figure sur la planche. */
export function raisonExclusion(a: Pick<AdherentAdresse, 'adresse' | 'code_postal' | 'ville'>): RaisonExclusionCourrier | null {
  return adresseComplete(a) ? null : 'adresse_incomplete'
}

/** Adresse telle qu'imprimée (« 1 rue X, 75000 Paris »), ou la partie connue pour un exclu ; null si rien. */
export function adresseFigee(a: Pick<AdherentAdresse, 'adresse' | 'code_postal' | 'ville'>): string | null {
  const ligne1 = a.adresse?.trim() ?? ''
  const ligne2 = [a.code_postal?.trim(), a.ville?.trim()].filter(Boolean).join(' ')
  return [ligne1, ligne2].filter(Boolean).join(', ') || null
}

export interface LigneDestinataireCourrier {
  campagne_id: string
  organisation_id: string
  adherent_id: string
  nom: string
  adresse: string | null
  statut: 'genere' | 'exclu'
  raison_exclusion: RaisonExclusionCourrier | null
}

export function lignesDestinataires(adherents: AdherentAdresse[], campagneId: string, organisationId: string): LigneDestinataireCourrier[] {
  return adherents.map((a) => {
    const raison = raisonExclusion(a)
    return {
      campagne_id: campagneId,
      organisation_id: organisationId,
      adherent_id: a.id,
      nom: [a.prenom, a.nom].filter(Boolean).join(' '),
      adresse: adresseFigee(a),
      statut: raison ? 'exclu' : 'genere',
      raison_exclusion: raison,
    }
  })
}
