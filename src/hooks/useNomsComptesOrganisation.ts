import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/**
 * Noms affichés des comptes de l'organisation (RLS scopée), pour « Envoyée par » / « Générée par »
 * des historiques de campagnes — sans lire auth.users. Clé : utilisateur_id.
 */
export function useNomsComptesOrganisation(organisationId: string | null | undefined): ReadonlyMap<string, string> {
  const [noms, setNoms] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    if (!organisationId) return
    supabase
      .from('profils_organisation')
      .select('utilisateur_id, nom_affiche')
      .eq('organisation_id', organisationId)
      .then(({ data }) => {
        const rows = (data ?? []) as { utilisateur_id: string; nom_affiche: string | null }[]
        setNoms(new Map(rows.filter((r) => r.nom_affiche).map((r) => [r.utilisateur_id, r.nom_affiche as string])))
      })
  }, [organisationId])

  return noms
}
