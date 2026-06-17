import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import type { RecuFiscal } from '../types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParticipantRow {
  profil_participant_id: string
  nom: string
  prenom: string | null
  email: string | null
  total_dons: number
  recu: RecuFiscal | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMontant(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

function currentYear() {
  return new Date().getFullYear()
}

function yearOptions() {
  const cy = currentYear()
  return [cy, cy - 1, cy - 2, cy - 3]
}

// ---------------------------------------------------------------------------
// RecusFiscauxPage
// ---------------------------------------------------------------------------

export default function RecusFiscauxPage() {
  const { auth } = useAuth()
  const organisationId = auth.type === 'admin' ? auth.organisationId : ''

  const [annee, setAnnee] = useState<number>(currentYear())
  const [rows, setRows] = useState<ParticipantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Per-row generation state: profil_participant_id → loading | error | null
  const [genLoading, setGenLoading] = useState<Record<string, boolean>>({})
  const [genError, setGenError] = useState<Record<string, string>>({})
  const [dlLoading, setDlLoading] = useState<Record<string, boolean>>({})

  const [generateAllLoading, setGenerateAllLoading] = useState(false)

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    if (!organisationId) return
    setLoading(true)
    setError(null)

    // 1. Fetch all dons for this org + year (only need profil_participant_id + montant)
    const dateStart = `${annee}-01-01`
    const dateEnd = `${annee}-12-31`

    const { data: dons, error: donsErr } = await supabase
      .from('dons')
      .select('profil_participant_id, montant')
      .eq('organisation_id', organisationId)
      .gte('date', dateStart)
      .lte('date', dateEnd)

    if (donsErr) { setError(donsErr.message); setLoading(false); return }

    // 2. Aggregate totals per profil_participant_id
    const totalsMap: Record<string, number> = {}
    for (const don of dons ?? []) {
      totalsMap[don.profil_participant_id] = (totalsMap[don.profil_participant_id] ?? 0) + Number(don.montant)
    }

    const profilIds = Object.keys(totalsMap)

    if (profilIds.length === 0) {
      setRows([])
      setLoading(false)
      return
    }

    // 3. Fetch participant info for those IDs
    const { data: profils, error: profilsErr } = await supabase
      .from('profils_participant')
      .select('id, personnes(nom, prenom, email)')
      .in('id', profilIds)

    if (profilsErr) { setError(profilsErr.message); setLoading(false); return }

    // 4. Fetch existing recus_fiscaux for this org + year
    const { data: recus, error: recusErr } = await supabase
      .from('recus_fiscaux')
      .select('*')
      .eq('organisation_id', organisationId)
      .eq('annee', annee)

    if (recusErr) { setError(recusErr.message); setLoading(false); return }

    const recusMap: Record<string, RecuFiscal> = {}
    for (const r of recus ?? []) {
      recusMap[r.profil_participant_id] = r as RecuFiscal
    }

    // 5. Build rows
    const built: ParticipantRow[] = (profils ?? []).map((p) => {
      const personne = p.personnes as { nom: string; prenom: string | null; email: string | null } | null
      return {
        profil_participant_id: p.id,
        nom: personne?.nom ?? '',
        prenom: personne?.prenom ?? null,
        email: personne?.email ?? null,
        total_dons: totalsMap[p.id] ?? 0,
        recu: recusMap[p.id] ?? null,
      }
    })

    // Sort by nom then prenom
    built.sort((a, b) => a.nom.localeCompare(b.nom) || (a.prenom ?? '').localeCompare(b.prenom ?? ''))

    setRows(built)
    setLoading(false)
  }, [organisationId, annee])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ---------------------------------------------------------------------------
  // Generate a single recu
  // ---------------------------------------------------------------------------

  async function generateRecu(profilId: string) {
    setGenLoading((prev) => ({ ...prev, [profilId]: true }))
    setGenError((prev) => ({ ...prev, [profilId]: '' }))

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setGenError((prev) => ({ ...prev, [profilId]: 'Session expirée' }))
      setGenLoading((prev) => ({ ...prev, [profilId]: false }))
      return
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
    const res = await fetch(`${supabaseUrl}/functions/v1/generate-recu`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      },
      body: JSON.stringify({ profil_participant_id: profilId, annee }),
    })

    const json = await res.json()
    if (!res.ok) {
      setGenError((prev) => ({ ...prev, [profilId]: json.error ?? 'Erreur inconnue' }))
      setGenLoading((prev) => ({ ...prev, [profilId]: false }))
      return
    }

    setGenLoading((prev) => ({ ...prev, [profilId]: false }))
    fetchData()
  }

  // ---------------------------------------------------------------------------
  // Download a recu (signed URL)
  // ---------------------------------------------------------------------------

  async function downloadRecu(row: ParticipantRow) {
    if (!row.recu?.fichier_url) return
    setDlLoading((prev) => ({ ...prev, [row.profil_participant_id]: true }))

    const { data, error: urlErr } = await supabase.storage
      .from('recus-fiscaux')
      .createSignedUrl(row.recu.fichier_url, 3600)

    if (urlErr || !data?.signedUrl) {
      alert('Impossible de générer le lien de téléchargement')
      setDlLoading((prev) => ({ ...prev, [row.profil_participant_id]: false }))
      return
    }

    window.open(data.signedUrl, '_blank')
    setDlLoading((prev) => ({ ...prev, [row.profil_participant_id]: false }))
  }

  // ---------------------------------------------------------------------------
  // Generate all (no existing reçu or regenerate all)
  // ---------------------------------------------------------------------------

  async function generateAll() {
    setGenerateAllLoading(true)
    for (const row of rows) {
      await generateRecu(row.profil_participant_id)
    }
    setGenerateAllLoading(false)
  }

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  const totalGeneres = rows.filter((r) => r.recu !== null).length

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reçus fiscaux</h1>
          <p className="mt-1 text-sm text-slate-500">
            {rows.length} participant{rows.length !== 1 ? 's' : ''} avec des dons en {annee}
            {totalGeneres > 0 && ` · ${totalGeneres} reçu${totalGeneres !== 1 ? 's' : ''} généré${totalGeneres !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Year selector */}
          <select
            value={annee}
            onChange={(e) => setAnnee(Number(e.target.value))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {yearOptions().map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Generate all */}
          {rows.length > 0 && (
            <button
              onClick={generateAll}
              disabled={generateAllLoading}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {generateAllLoading ? (
                <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
              )}
              Générer tous
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">
            Chargement…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="mb-3 h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
            <p className="text-sm font-medium text-slate-500">Aucun don enregistré en {annee}</p>
            <p className="mt-1 text-xs text-slate-400">Sélectionnez une autre année ou ajoutez des dons.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Participant</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Total dons</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Statut</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const fullName = [row.prenom, row.nom].filter(Boolean).join(' ')
                const isGenLoading = genLoading[row.profil_participant_id]
                const genErr = genError[row.profil_participant_id]
                const isDlLoading = dlLoading[row.profil_participant_id]
                const hasRecu = row.recu !== null

                return (
                  <tr key={row.profil_participant_id} className="hover:bg-slate-50">
                    {/* Participant */}
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{fullName}</div>
                      {row.email && <div className="text-xs text-slate-400">{row.email}</div>}
                    </td>

                    {/* Total */}
                    <td className="px-6 py-4 text-right font-medium text-slate-900">
                      {formatMontant(row.total_dons)}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      {hasRecu ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Généré
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                          Non généré
                        </span>
                      )}
                      {genErr && (
                        <p className="mt-1 text-xs text-red-600">{genErr}</p>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        {/* Download (only if recu exists) */}
                        {hasRecu && (
                          <button
                            onClick={() => downloadRecu(row)}
                            disabled={isDlLoading}
                            title="Télécharger le reçu PDF"
                            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                          >
                            {isDlLoading ? (
                              <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                              </svg>
                            )}
                            PDF
                          </button>
                        )}

                        {/* Generate / Regenerate */}
                        <button
                          onClick={() => generateRecu(row.profil_participant_id)}
                          disabled={isGenLoading || generateAllLoading}
                          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                        >
                          {isGenLoading ? (
                            <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                          )}
                          {hasRecu ? 'Regénérer' : 'Générer'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
