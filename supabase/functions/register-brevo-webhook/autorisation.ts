// Autorisation du mode { toutes_organisations: true } de register-brevo-webhook.
//
// Carte « Emailing : réenregistrer les webhooks Brevo en prod » (2026-10-30) : la comparaison à
// la clé service_role ne passe plus depuis la migration des clés API prod (2026-10-21). Le
// réenregistrement global est désormais réservé à une session super-admin : garde stricte
// `app_metadata.is_super_admin === true`, toute autre valeur (absente, null, "true"…) → 403,
// pas de session valide → 401.

export interface UtilisateurSession {
  app_metadata?: Record<string, unknown>
}

export type DecisionAutorisation = { autorise: true } | { autorise: false; status: 401 | 403; error: string }

export function autoriserToutesOrganisations(
  user: UtilisateurSession | null | undefined,
  userError: unknown,
): DecisionAutorisation {
  if (userError || !user) return { autorise: false, status: 401, error: 'Non autorisé' }
  if (user.app_metadata?.is_super_admin !== true) return { autorise: false, status: 403, error: 'Accès refusé' }
  return { autorise: true }
}
