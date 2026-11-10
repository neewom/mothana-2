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

// État réel, dans Brevo, de l'expéditeur configuré (Edge Function verifier-expediteur-brevo,
// carte B4) : la clé API reste côté serveur.
export type StatutExpediteurBrevo = 'non_configure' | 'valide' | 'en_attente' | 'introuvable' | 'erreur'

const STATUTS_EXPEDITEUR: readonly StatutExpediteurBrevo[] = ['non_configure', 'valide', 'en_attente', 'introuvable', 'erreur']

/** Réponse de la fonction → statut ; toute erreur d'appel ou réponse inattendue → 'erreur'. */
export function statutExpediteurDepuisReponse(data: unknown, error: unknown): StatutExpediteurBrevo {
  if (error) return 'erreur'
  const statut = (data as { statut?: unknown } | null)?.statut
  return STATUTS_EXPEDITEUR.includes(statut as StatutExpediteurBrevo) ? (statut as StatutExpediteurBrevo) : 'erreur'
}

export async function verifierExpediteurBrevo(organisationId: string): Promise<StatutExpediteurBrevo> {
  try {
    const { data, error } = await supabase.functions.invoke('verifier-expediteur-brevo', {
      body: { organisation_id: organisationId },
    })
    return statutExpediteurDepuisReponse(data, error)
  } catch {
    return 'erreur'
  }
}
