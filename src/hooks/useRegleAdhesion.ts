import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { REGLE_ADHESION_PAR_DEFAUT, type RegleAdhesion, type RegleFinAdhesion } from '../lib/adhesion'

/** Règle de fin des adhésions de l'organisation (règle par défaut tant qu'elle n'est pas chargée). */
export function useRegleAdhesion(organisationId: string | undefined): RegleAdhesion {
  const [regle, setRegle] = useState<RegleAdhesion>(REGLE_ADHESION_PAR_DEFAUT)

  useEffect(() => {
    if (!organisationId) return
    let cancelled = false
    supabase
      .from('organisations')
      .select('adhesion_regle_fin, adhesion_mois_bascule')
      .eq('id', organisationId)
      .single()
      .then(({ data }) => {
        if (cancelled || !data) return
        setRegle({ regleFin: data.adhesion_regle_fin as RegleFinAdhesion, moisBascule: data.adhesion_mois_bascule })
      })
    return () => {
      cancelled = true
    }
  }, [organisationId])

  return regle
}
