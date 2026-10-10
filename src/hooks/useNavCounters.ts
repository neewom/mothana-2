import { useCallback, useContext, useEffect, useState } from 'react'
import { NavCountersContext, type NavCounters } from '../contexts/navCountersContext'
import { compterDonsReguliersAConfirmer } from '../lib/donsReguliers'
import { supabase } from '../lib/supabaseClient'

/** Pastilles du menu, lues par les pages via le contexte fourni par AdminLayout. */
export function useNavCountersContext() {
  return useContext(NavCountersContext)
}

/** Charge les compteurs du menu (mêmes règles que les alertes de l'accueil) ; utilisé par AdminLayout. */
export function useLoadNavCounters(organisationId: string, flags: { dons: boolean; adherents: boolean } | null) {
  const [counters, setCounters] = useState<NavCounters>({ donsReguliersAConfirmer: null, demandesEnAttente: null })
  const [tick, setTick] = useState(0)
  const dons = flags?.dons ?? false
  const adherents = flags?.adherents ?? false

  useEffect(() => {
    if (!organisationId || !flags) return
    let cancelled = false

    async function load() {
      const [engagementsRes, donsGeneresRes, demandesRes] = await Promise.all([
        dons
          ? supabase.from('dons_reguliers').select('id, jour_prelevement, date_debut, date_fin').eq('organisation_id', organisationId).eq('statut', 'actif')
          : Promise.resolve(null),
        dons
          ? supabase.from('dons').select('don_regulier_id, date').eq('organisation_id', organisationId).not('don_regulier_id', 'is', null)
          : Promise.resolve(null),
        adherents
          ? supabase.from('demandes_adhesion').select('id', { count: 'exact', head: true }).eq('organisation_id', organisationId).eq('statut', 'en_attente')
          : Promise.resolve(null),
      ])
      if (cancelled) return

      const donsOk = engagementsRes && !engagementsRes.error && donsGeneresRes && !donsGeneresRes.error
      setCounters({
        donsReguliersAConfirmer: donsOk
          ? compterDonsReguliersAConfirmer(
              (engagementsRes.data ?? []) as { id: string; jour_prelevement: number; date_debut: string; date_fin: string | null }[],
              (donsGeneresRes.data ?? []) as { don_regulier_id: string | null; date: string }[],
            )
          : null,
        demandesEnAttente: demandesRes && !demandesRes.error ? demandesRes.count ?? 0 : null,
      })
    }

    void load()
    return () => { cancelled = true }
  }, [organisationId, flags, dons, adherents, tick])

  const refreshNavCounters = useCallback(() => setTick((t) => t + 1), [])
  return { ...counters, refreshNavCounters }
}
