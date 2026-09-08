import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export interface FonctionnalitesActivees {
  dons: boolean
  adherents: boolean
}

const DEFAULT_FONCTIONNALITES: FonctionnalitesActivees = { dons: true, adherents: true }

/**
 * null tant que non chargé — les appelants doivent traiter null comme
 * "en attente" (pas comme "tout désactivé").
 */
export function useFonctionnalitesActivees(organisationId: string): FonctionnalitesActivees | null {
  const [value, setValue] = useState<FonctionnalitesActivees | null>(null)

  useEffect(() => {
    if (!organisationId) return
    let cancelled = false

    supabase
      .from('organisations')
      .select('fonctionnalites_activees')
      .eq('id', organisationId)
      .single()
      .then(({ data }) => {
        if (cancelled) return
        const raw = data?.fonctionnalites_activees as Partial<FonctionnalitesActivees> | undefined
        setValue({ ...DEFAULT_FONCTIONNALITES, ...raw })
      })

    return () => {
      cancelled = true
    }
  }, [organisationId])

  return value
}
