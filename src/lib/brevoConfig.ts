import { supabase } from './supabaseClient'

// État de la configuration Brevo d'une organisation (RPC etat_config_brevo) : la clé API n'est
// jamais renvoyée au navigateur (organisation_secrets, audit sécurité 2026-10-24).
export interface EtatConfigBrevo {
  cleConfiguree: boolean
  expediteurNom: string
  expediteurEmail: string
}

export function brevoConfigure(etat: EtatConfigBrevo): boolean {
  return etat.cleConfiguree && etat.expediteurNom.trim() !== '' && etat.expediteurEmail.trim() !== ''
}

export async function chargerEtatConfigBrevo(organisationId: string): Promise<EtatConfigBrevo | null> {
  const { data, error } = await supabase.rpc('etat_config_brevo', { p_organisation_id: organisationId })
  if (error || !data) return null
  const raw = data as { cle_configuree: boolean; expediteur_nom: string | null; expediteur_email: string | null }
  return { cleConfiguree: raw.cle_configuree, expediteurNom: raw.expediteur_nom ?? '', expediteurEmail: raw.expediteur_email ?? '' }
}
