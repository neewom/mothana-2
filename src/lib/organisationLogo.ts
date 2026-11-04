import { supabase } from './supabaseClient'

/** Événement émis après un changement de logo (Paramètres → Visuels), écouté par l'en-tête admin. */
export const ORGANISATION_LOGO_CHANGE_EVENT = 'organisation-logo-change'

/** Seuls les visuels image (PNG/JPEG) peuvent servir de logo ; la base le revérifie (trigger). */
export function isLogoEligibleUrl(url: string): boolean {
  return /\.(png|jpe?g)$/i.test(url.split(/[?#]/)[0])
}

/** URL du logo de l'organisation (null si aucun) ; RPC lisible par l'admin, le bénévole et le super-admin. */
export async function fetchOrganisationLogoUrl(organisationId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_organisation_logo_url', { p_organisation_id: organisationId })
  if (error) throw error
  return (data as string | null) ?? null
}

export async function setOrganisationLogo(organisationId: string, assetId: string | null): Promise<void> {
  const { data, error } = await supabase
    .from('organisations')
    .update({ logo_asset_id: assetId })
    .eq('id', organisationId)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Modification refusée')
  window.dispatchEvent(new Event(ORGANISATION_LOGO_CHANGE_EVENT))
}
