import { supabase } from './supabaseClient'
import type { Adherent } from '../types'

export const RAISON_EMAIL = 'email identique'
export const RAISON_TELEPHONE = 'téléphone identique'
export const RAISON_NOM_PRENOM = 'nom et prénom identiques'

export interface DuplicateMatch {
  adherent: Adherent
  raisons: string[]
}

interface DemandeIdentite {
  nom: string
  prenom: string | null
  courriel: string | null
  telephone: string | null
}

// Échappe une valeur pour un filtre PostgREST .or() (les caractères ,.():*"\ y sont significatifs)
function escapeOrValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

// Recherche des adhérents déjà existants (même organisation) partageant l'email, le téléphone,
// ou le couple nom+prénom avec une demande d'adhésion. `excludeAdherentId` évite qu'une demande
// déjà ratifiée ne remonte l'adhérent qu'elle a elle-même créé comme un doublon d'elle-même.
export async function findAdherentDuplicates(
  organisationId: string,
  demande: DemandeIdentite,
  excludeAdherentId?: string | null,
): Promise<DuplicateMatch[]> {
  const orParts: string[] = []
  if (demande.courriel) orParts.push(`courriel.ilike.${escapeOrValue(demande.courriel)}`)
  if (demande.telephone) orParts.push(`telephone.eq.${escapeOrValue(demande.telephone)}`)
  if (demande.nom && demande.prenom) {
    orParts.push(`and(nom.ilike.${escapeOrValue(demande.nom)},prenom.ilike.${escapeOrValue(demande.prenom)})`)
  }

  if (orParts.length === 0) return []

  let query = supabase
    .from('adherents')
    .select('*')
    .eq('organisation_id', organisationId)
    .or(orParts.join(','))

  if (excludeAdherentId) query = query.neq('id', excludeAdherentId)

  const { data, error } = await query

  if (error || !data) return []

  return (data as Adherent[]).map((existing) => {
    const raisons: string[] = []
    if (demande.courriel && existing.courriel && existing.courriel.toLowerCase() === demande.courriel.toLowerCase()) {
      raisons.push(RAISON_EMAIL)
    }
    if (demande.telephone && existing.telephone && existing.telephone === demande.telephone) {
      raisons.push(RAISON_TELEPHONE)
    }
    if (
      demande.nom && demande.prenom && existing.prenom &&
      existing.nom.toLowerCase() === demande.nom.toLowerCase() &&
      existing.prenom.toLowerCase() === demande.prenom.toLowerCase()
    ) {
      raisons.push(RAISON_NOM_PRENOM)
    }
    return { adherent: existing, raisons }
  })
}
