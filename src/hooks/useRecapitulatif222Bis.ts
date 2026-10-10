import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { fetchAllRows } from '../lib/fetchAllRows'
import type { DeclarationCerfaRow } from '../components/DeclarationCerfaCard'

// Récapitulatif article 222 bis CGI (nombre de reçus émis et montant par année), affiché
// sur Reçus fiscaux. recus_fiscaux a une contrainte UNIQUE (profil_participant_id, annee)
// et generate-recu fait un upsert dessus : une régénération met à jour la ligne existante,
// jamais de doublon. COUNT(*) par année est donc fiable.

interface RecuDeclaratif {
  id: string
  annee: number
  montant_total: number
}

/** `refreshKey` : changer sa valeur recharge le récapitulatif (ex. après une génération). */
export function useRecapitulatif222Bis(organisationId: string, refreshKey: unknown) {
  const [recus, setRecus] = useState<RecuDeclaratif[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!organisationId) return
    let cancelled = false
    void fetchAllRows<RecuDeclaratif>((from, to) =>
      supabase
        .from('recus_fiscaux')
        .select('id, annee, montant_total')
        .eq('organisation_id', organisationId)
        .order('id', { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: RecuDeclaratif[] | null; error: { message: string } | null }>
    ).then(({ data }) => {
      if (cancelled) return
      setRecus(data)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [organisationId, refreshKey])

  const rows = useMemo<DeclarationCerfaRow[]>(() => {
    const totals = new Map<number, { nbRecus: number; montant: number }>()
    for (const r of recus) {
      const entry = totals.get(r.annee) ?? { nbRecus: 0, montant: 0 }
      entry.nbRecus += 1
      entry.montant += Number(r.montant_total)
      totals.set(r.annee, entry)
    }
    return Array.from(totals.entries())
      .map(([annee, v]) => ({ annee, ...v }))
      .sort((a, b) => b.annee - a.annee)
  }, [recus])

  return { rows, loading }
}
