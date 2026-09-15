import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Cadré 2026-09-15 (carte Trello "Cerfa/super-admin : lever les blocages
// Supabase pour l'onboarding") — dérive l'organisation d'appel :
// profils_organisation de l'utilisateur connecté (rôle admin) en priorité,
// ou — si absent et que le JWT porte is_super_admin — l'organisation
// explicitement demandée par le client (mode "Consulter" super-admin,
// cf. useOrganisationId() côté frontend). Étend aux Edge Functions le même
// niveau de confiance déjà accordé au super-admin au niveau RLS
// (super_admin_rls.sql : is_super_admin = true OR organisation_id = ...),
// que ces fonctions contournent de toute façon via la clé service_role.

export interface ResolvedOrganisation {
  organisationId: string
  role: string
}

export async function resolveOrganisationId(
  adminClient: SupabaseClient,
  user: { id: string; app_metadata?: Record<string, unknown> },
  requestedOrganisationId?: string | null,
): Promise<ResolvedOrganisation | null> {
  const { data: profilOrg } = await adminClient
    .from('profils_organisation')
    .select('organisation_id, role')
    .eq('utilisateur_id', user.id)
    .eq('role', 'admin')
    .single()

  if (profilOrg) {
    return { organisationId: profilOrg.organisation_id, role: profilOrg.role }
  }

  const isSuperAdmin = user.app_metadata?.is_super_admin === true
  if (isSuperAdmin && requestedOrganisationId) {
    return { organisationId: requestedOrganisationId, role: 'super_admin' }
  }

  return null
}
