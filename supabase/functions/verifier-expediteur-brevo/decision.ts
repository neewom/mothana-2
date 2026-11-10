// Logique de décision de verifier-expediteur-brevo (carte B4), séparée de index.ts pour être testée.
import type { StatutExpediteurBrevo } from '../_shared/brevo.ts'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ROLES_AUTORISES = ['admin', 'contributeur']

export interface UtilisateurSession {
  app_metadata?: Record<string, unknown>
}

export type DecisionAutorisation =
  | { autorise: true; organisationId: string }
  | { autorise: false; status: 400 | 401 | 403; error: string }

export function estSuperAdmin(user: UtilisateurSession): boolean {
  return user.app_metadata?.is_super_admin === true
}

export function organisationDemandeeValide(organisationId: unknown): organisationId is string {
  return typeof organisationId === 'string' && UUID_REGEX.test(organisationId)
}

/**
 * Accès : session valide (401 sinon), organisation demandée valide (400), puis super-admin (claim
 * strictement true) ou admin/contributeur de CETTE organisation (`roleDansOrganisation` = rôle du
 * profils_organisation de l'appelant pour l'organisation demandée, null s'il n'en a pas).
 * Bénévole, vendeur et membre d'une autre organisation : 403.
 */
export function autoriserAppelant(
  user: UtilisateurSession | null | undefined,
  userError: unknown,
  organisationDemandee: unknown,
  roleDansOrganisation: string | null,
): DecisionAutorisation {
  if (userError || !user) return { autorise: false, status: 401, error: 'Non autorisé' }
  if (!organisationDemandeeValide(organisationDemandee)) {
    return { autorise: false, status: 400, error: 'organisation_id invalide' }
  }
  if (estSuperAdmin(user)) return { autorise: true, organisationId: organisationDemandee }
  if (roleDansOrganisation !== null && ROLES_AUTORISES.includes(roleDansOrganisation)) {
    return { autorise: true, organisationId: organisationDemandee }
  }
  return { autorise: false, status: 403, error: 'Accès refusé' }
}

export type StatutAffiche = 'non_configure' | 'valide' | 'en_attente' | 'introuvable' | 'erreur'

export function configBrevoComplete(apiKey: string | null | undefined, expediteurEmail: string | null | undefined): boolean {
  return !!apiKey?.trim() && !!expediteurEmail?.trim()
}

export function statutAffiche(statut: StatutExpediteurBrevo): StatutAffiche {
  switch (statut) {
    case 'actif':
      return 'valide'
    case 'inactif':
      return 'en_attente'
    case 'introuvable':
      return 'introuvable'
    default:
      return 'erreur'
  }
}
