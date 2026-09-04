import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Input } from './ui/input'
import { Badge } from './ui/badge'

interface ResultatVerification {
  nom: string
  prenom: string | null
  id_externe: string | null
  statut: 'actif' | 'archive'
  date_fin: string | null
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface BenevoleVerificationAdherentProps {
  organisationId: string
}

export default function BenevoleVerificationAdherent({ organisationId }: BenevoleVerificationAdherentProps) {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [resultats, setResultats] = useState<ResultatVerification[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  // Debounce de la recherche, même pattern que la page liste adhérents
  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(timeout)
  }, [searchInput])

  const runSearch = useCallback(async () => {
    if (!organisationId || search === '') {
      setResultats([])
      setSearched(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase.rpc('search_adherents_verification', {
      p_organisation_id: organisationId,
      p_search: search,
      p_limit: 20,
    })
    setLoading(false)
    setSearched(true)
    if (err) {
      setError(err.message)
      return
    }
    setResultats((data ?? []) as ResultatVerification[])
  }, [organisationId, search])

  useEffect(() => {
    runSearch()
  }, [runSearch])

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Vérification adhérent</h1>
        <p className="mt-1 text-sm text-ink-muted">Recherchez un adhérent par nom et/ou prénom.</p>
      </div>

      <div className="rounded-sm border border-paper-border bg-white p-6 font-registre">
        <Input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Nom, prénom…"
          autoFocus
        />

        {error && (
          <div className="mt-4 rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">{error}</div>
        )}

        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-stamp border-t-transparent" />
            </div>
          ) : searched && !error && resultats.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-faint">Aucun adhérent trouvé.</p>
          ) : (
            resultats.map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-sm border border-paper-border px-4 py-3"
              >
                <div>
                  <p className="font-medium text-ink">{[r.prenom, r.nom].filter(Boolean).join(' ')}</p>
                  {r.id_externe && (
                    <p className="mt-0.5 text-xs text-ink-faint">N° adhérent : {r.id_externe}</p>
                  )}
                  {r.date_fin && (
                    <p className="mt-0.5 text-xs text-ink-faint">jusqu'au {formatDate(r.date_fin)}</p>
                  )}
                </div>
                <Badge variant={r.statut === 'actif' ? 'success' : 'neutral'} className="shrink-0">
                  {r.statut === 'actif' ? 'Actif' : 'Archivé'}
                </Badge>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
