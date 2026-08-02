import { supabase } from './supabaseClient'

export interface OrganisationAsset {
  id: string
  identifiant: string
  libelle: string
  url: string
}

export function assetPlaceholderKey(identifiant: string): string {
  return `asset_${identifiant}`
}

export function slugifyIdentifiant(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export async function fetchOrganisationAssets(organisationId: string): Promise<OrganisationAsset[]> {
  const { data, error } = await supabase
    .from('organisation_assets')
    .select('id, identifiant, libelle, url')
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as OrganisationAsset[]
}

export function buildAssetPlaceholders(assets: OrganisationAsset[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const asset of assets) {
    result[assetPlaceholderKey(asset.identifiant)] = asset.url
  }
  return result
}
