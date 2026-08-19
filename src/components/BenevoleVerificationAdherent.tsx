import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

interface ResultatVerification {
  nom: string
  prenom: string | null
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
        <h1 className="text-2xl font-bold text-slate-900">Vérification adhérent</h1>
        <p className="mt-1 text-sm text-slate-600">Recherchez un adhérent par nom et/ou prénom.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Nom, prénom…"
          autoFocus
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            </div>
          ) : searched && !error && resultats.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Aucun adhérent trouvé.</p>
          ) : (
            resultats.map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-slate-900">{[r.prenom, r.nom].filter(Boolean).join(' ')}</p>
                  {r.date_fin && (
                    <p className="mt-0.5 text-xs text-slate-500">jusqu'au {formatDate(r.date_fin)}</p>
                  )}
                </div>
                <span
                  className={`inline-block shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    r.statut === 'actif' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {r.statut === 'actif' ? 'Actif' : 'Archivé'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
