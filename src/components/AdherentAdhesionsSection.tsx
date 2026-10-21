import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Adhesion } from '../types'
import { MODE_PAIEMENT_LABELS } from '../lib/modePaiement'

// Cycles d'adhésion d'un adhérent, du plus récent au plus ancien (lecture seule). Avec la règle
// « au 31 décembre », toutes les fins d'une année sont identiques : la date d'adhésion est ce
// qui distingue les cycles.

function dateFr(iso: string | null): string {
  if (!iso) return '—'
  const [annee, mois, jour] = iso.split('-')
  return `${jour}/${mois}/${annee}`
}

function formatEur(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

export default function AdherentAdhesionsSection({ adherentId }: { adherentId: string }) {
  const [adhesions, setAdhesions] = useState<Adhesion[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('adhesions')
      .select('*')
      .eq('adherent_id', adherentId)
      .order('date_debut', { ascending: false })
      .order('date_fin', { ascending: false, nullsFirst: true })
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) setError(err.message)
        setAdhesions((data ?? []) as Adhesion[])
      })
    return () => {
      cancelled = true
    }
  }, [adherentId])

  return (
    <details open className="rounded-sm border border-paper-border bg-white">
      <summary className="cursor-pointer select-none rounded-sm px-3 py-2 font-registre text-sm font-medium text-ink-muted hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70">
        Adhésions{adhesions && adhesions.length > 0 ? ` (${adhesions.length})` : ''}
      </summary>
      <div className="border-t border-paper-border px-3 py-2">
        {error && <p role="alert" className="text-sm text-stamp">Erreur : {error}</p>}
        {adhesions === null ? (
          <div className="flex items-center justify-center py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-4 border-stamp border-t-transparent" />
          </div>
        ) : adhesions.length === 0 ? (
          <p className="py-2 text-sm text-ink-faint">Aucune adhésion enregistrée.</p>
        ) : (
          <ul className="divide-y divide-paper-border-muted">
            {adhesions.map((a) => (
              <li key={a.id} className="py-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-ink">
                    Adhésion du {dateFr(a.date_debut)}
                    {a.renouvellement && <span className="font-normal text-ink-faint"> · renouvellement</span>}
                  </span>
                  <span className="shrink-0 font-registre-mono text-xs text-ink-faint">jusqu'au {dateFr(a.date_fin)}</span>
                </div>
                <p className="mt-0.5 text-xs text-ink-faint">
                  {[
                    a.montant_cotisation != null ? `Cotisation ${formatEur(Number(a.montant_cotisation))}` : 'Cotisation non renseignée',
                    a.mode_paiement ? MODE_PAIEMENT_LABELS[a.mode_paiement] : null,
                  ].filter(Boolean).join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  )
}
