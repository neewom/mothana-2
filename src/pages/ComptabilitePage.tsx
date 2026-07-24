import { useState, useEffect, useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend, LabelList,
} from 'recharts'
import { supabase } from '../lib/supabaseClient'
import { useOrganisationId } from '../hooks/useOrganisationId'
import { fetchAllRows } from '../lib/fetchAllRows'
import { MODE_PAIEMENT_OPTIONS } from '../lib/modePaiement'
import DeclarationCerfaCard from '../components/DeclarationCerfaCard'
import type { Don, ModePaiement } from '../types'

// ---------------------------------------------------------------------------
// Palette — voir le skill dataviz (references/palette.md), instance validée
// (node scripts/validate_palette.js) pour les 4 premiers slots catégoriels en
// mode clair. L'app n'a pas de mode sombre. Le chrome (grilles, axes, encre)
// réutilise les gris slate déjà utilisés partout ailleurs dans l'app plutôt
// que d'introduire un second système de gris pour un rendu quasi identique.
// ---------------------------------------------------------------------------

const CATEGORICAL = ['#2a78d6', '#008300', '#e87ba4', '#eda100'] as const // blue, green, magenta, yellow
const ACCENT = CATEGORICAL[0]
const CONTEXT_GRAY = '#52514e' // encre secondaire — année N-1, "contexte" (emphasis job)
const GOOD = '#0ca30c'
const CRITICAL = '#d03b3b'
const GRID_STROKE = '#e2e8f0' // slate-200
const AXIS_STROKE = '#94a3b8' // slate-400

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

function formatEur(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €'
}

// ---------------------------------------------------------------------------
// useDons — variante allégée de celui de DonsPage.tsx : pas besoin du join
// profils_participant/personnes, ce tableau de bord n'affiche aucun nom.
// ---------------------------------------------------------------------------

function useDonsForDashboard(organisationId: string) {
  const [dons, setDons] = useState<Don[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!organisationId) return
    let cancelled = false

    async function fetchAll() {
      setLoading(true)
      setError(null)

      const { data, error: err } = await fetchAllRows<Don>((from, to) =>
        supabase
          .from('dons')
          .select('id, montant, date, mode_paiement, activite_id, activites(id, nom, organisation_id)')
          .eq('organisation_id', organisationId)
          .order('id', { ascending: true })
          .range(from, to) as unknown as PromiseLike<{ data: Don[] | null; error: { message: string } | null }>
      )

      if (cancelled) return

      if (err) {
        setError(err)
        setLoading(false)
        return
      }

      setDons(data)
      setLoading(false)
    }

    fetchAll()
    return () => { cancelled = true }
  }, [organisationId])

  return { dons, loading, error }
}

// ---------------------------------------------------------------------------
// useRecusForDeclaration — pour le récapitulatif article 222 bis CGI.
// recus_fiscaux a une contrainte UNIQUE (profil_participant_id, annee) et
// generate-recu fait un upsert dessus : une régénération met à jour la ligne
// existante, jamais de doublon. COUNT(*) par année est donc fiable.
// ---------------------------------------------------------------------------

interface RecuDeclaratif {
  id: string
  annee: number
  montant_total: number
  type_cerfa: '11580' | '16216' | null
}

function useRecusForDeclaration(organisationId: string) {
  const [recus, setRecus] = useState<RecuDeclaratif[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!organisationId) return
    let cancelled = false

    async function fetchAll() {
      setLoading(true)
      setError(null)

      const { data, error: err } = await fetchAllRows<RecuDeclaratif>((from, to) =>
        supabase
          .from('recus_fiscaux')
          .select('id, annee, montant_total, type_cerfa')
          .eq('organisation_id', organisationId)
          .order('id', { ascending: true })
          .range(from, to) as unknown as PromiseLike<{ data: RecuDeclaratif[] | null; error: { message: string } | null }>
      )

      if (cancelled) return

      if (err) {
        setError(err)
        setLoading(false)
        return
      }

      setRecus(data)
      setLoading(false)
    }

    fetchAll()
    return () => { cancelled = true }
  }, [organisationId])

  return { recus, loading, error }
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

function StatCard({ label, value, delta }: { label: string; value: string; delta?: { pct: number; goodUp: boolean } }) {
  const deltaColor = delta
    ? (delta.pct >= 0) === delta.goodUp ? GOOD : CRITICAL
    : undefined
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {delta && (
        <p className="mt-1 text-sm font-medium" style={{ color: deltaColor }}>
          {delta.pct >= 0 ? '↑' : '↓'} {Math.abs(delta.pct).toFixed(1)}% vs année précédente
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tooltip partagé — valeur en avant (Strong), nom de série en second,
// repère de série en trait court (line key) plutôt qu'un carré de couleur.
// ---------------------------------------------------------------------------

interface TooltipPayloadItem {
  name?: string
  value?: number
  color?: string
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      {label && <p className="mb-1 font-medium text-slate-500">{label}</p>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-3" style={{ backgroundColor: entry.color }} />
          <span className="font-semibold text-slate-900">{formatEur(entry.value ?? 0)}</span>
          <span className="text-slate-500">{entry.name}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ComptabilitePage
// ---------------------------------------------------------------------------

export default function ComptabilitePage() {
  const organisationId = useOrganisationId()
  const { dons, loading, error } = useDonsForDashboard(organisationId)
  const { recus, loading: recusLoading } = useRecusForDeclaration(organisationId)

  const availableYears = useMemo(() => {
    const years = new Set(dons.map((d) => Number(d.date.slice(0, 4))))
    years.add(new Date().getFullYear())
    return Array.from(years).sort((a, b) => b - a)
  }, [dons])

  const [year, setYear] = useState(new Date().getFullYear())
  const minYear = availableYears[availableYears.length - 1]
  const maxYear = availableYears[0]

  const monthlyData = useMemo(() => {
    const totalsN = Array(12).fill(0)
    const totalsN1 = Array(12).fill(0)
    for (const d of dons) {
      const [y, m] = d.date.split('-')
      const monthIdx = Number(m) - 1
      if (Number(y) === year) totalsN[monthIdx] += d.montant
      else if (Number(y) === year - 1) totalsN1[monthIdx] += d.montant
    }
    return MOIS.map((mois, i) => ({ mois, montantN: totalsN[i], montantN1: totalsN1[i] }))
  }, [dons, year])

  const activiteBreakdown = useMemo(() => {
    const totals = new Map<string, number>()
    for (const d of dons) {
      if (Number(d.date.slice(0, 4)) !== year) continue
      const nom = d.activites?.nom ?? 'Non affecté'
      totals.set(nom, (totals.get(nom) ?? 0) + d.montant)
    }
    return Array.from(totals.entries())
      .map(([nom, montant]) => ({ nom, montant }))
      .sort((a, b) => b.montant - a.montant)
  }, [dons, year])

  const modeBreakdown = useMemo(() => {
    const totals: Record<ModePaiement, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
    for (const d of dons) {
      if (Number(d.date.slice(0, 4)) !== year) continue
      totals[d.mode_paiement] += d.montant
    }
    const row: Record<string, number | string> = { name: 'Total' }
    for (const o of MODE_PAIEMENT_OPTIONS) row[`mode_${o.value}`] = totals[o.value]
    return [row]
  }, [dons, year])

  const stats = useMemo(() => {
    const totalN = monthlyData.reduce((s, m) => s + m.montantN, 0)
    const totalN1 = monthlyData.reduce((s, m) => s + m.montantN1, 0)
    const variationPct = totalN1 > 0 ? ((totalN - totalN1) / totalN1) * 100 : 0
    return { totalN, totalN1, variationPct }
  }, [monthlyData])

  const declarationParAnnee = useMemo(() => {
    const totals = new Map<number, { nbRecus: number; montant: number }>()
    for (const r of recus) {
      const entry = totals.get(r.annee) ?? { nbRecus: 0, montant: 0 }
      entry.nbRecus += 1
      entry.montant += r.montant_total
      totals.set(r.annee, entry)
    }
    return Array.from(totals.entries())
      .map(([annee, v]) => ({ annee, ...v }))
      .sort((a, b) => b.annee - a.annee)
  }, [recus])

  return (
    <div className="space-y-6">
      {/* Page title + sélecteur d'année */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Comptabilité</h1>
          <p className="mt-1 text-sm text-slate-500">Vue d'ensemble des dons collectés</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setYear((y) => y - 1)}
            disabled={year <= minYear}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ‹
          </button>
          <span className="min-w-[4rem] text-center text-sm font-semibold text-slate-900">{year}</span>
          <button
            type="button"
            onClick={() => setYear((y) => y + 1)}
            disabled={year >= maxYear}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ›
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">Erreur : {error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label={`Total ${year}`} value={formatEur(stats.totalN)} />
            <StatCard label={`Total ${year - 1}`} value={formatEur(stats.totalN1)} />
            <StatCard
              label="Évolution"
              value={`${stats.variationPct >= 0 ? '+' : ''}${stats.variationPct.toFixed(1)}%`}
              delta={{ pct: stats.variationPct, goodUp: true }}
            />
          </div>

          {/* Courbe mensuelle N vs N-1 */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold text-slate-900">Dons par mois — {year} vs {year - 1}</h2>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={monthlyData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="mois" stroke={AXIS_STROKE} tickLine={false} axisLine={{ stroke: GRID_STROKE }} tick={{ fontSize: 12 }} />
                <YAxis stroke={AXIS_STROKE} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={(v) => v.toLocaleString('fr-FR')} width={70} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Line type="monotone" dataKey="montantN" name={`${year}`} stroke={ACCENT} strokeWidth={2} dot={{ r: 4, fill: ACCENT, stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="montantN1" name={`${year - 1}`} stroke={CONTEXT_GRAY} strokeWidth={2} dot={{ r: 4, fill: CONTEXT_GRAY, stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Répartition par activité */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 font-semibold text-slate-900">Répartition par activité — {year}</h2>
              {activiteBreakdown.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">Aucun don sur cette année</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(160, activiteBreakdown.length * 44)}>
                  <BarChart data={activiteBreakdown} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
                    <XAxis type="number" stroke={AXIS_STROKE} tickLine={false} axisLine={{ stroke: GRID_STROKE }} tick={{ fontSize: 12 }} tickFormatter={(v) => v.toLocaleString('fr-FR')} />
                    <YAxis type="category" dataKey="nom" stroke={AXIS_STROKE} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={120} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="montant" name="Montant" fill={ACCENT} radius={[0, 4, 4, 0]} barSize={20}>
                      <LabelList dataKey="montant" position="right" formatter={(v: number | string | boolean | null | undefined) => (typeof v === 'number' ? formatEur(v) : '')} style={{ fill: '#52514e', fontSize: 12 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Répartition par mode de paiement */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 font-semibold text-slate-900">Répartition par mode de paiement — {year}</h2>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={modeBreakdown} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" hide />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    content={() => (
                      <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
                        {MODE_PAIEMENT_OPTIONS.map((o, i) => (
                          <li key={o.value} className="flex items-center gap-1.5">
                            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: CATEGORICAL[i] }} />
                            <span className="text-slate-600">{o.label}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  />
                  {MODE_PAIEMENT_OPTIONS.map((o, i) => (
                    <Bar
                      key={o.value}
                      dataKey={`mode_${o.value}`}
                      name={o.label}
                      stackId="modes"
                      fill={CATEGORICAL[i]}
                      stroke="#ffffff"
                      strokeWidth={2}
                      barSize={40}
                    >
                      <LabelList
                        dataKey={`mode_${o.value}`}
                        position="center"
                        formatter={(v: number | string | boolean | null | undefined) => (typeof v === 'number' && v > 0 ? formatEur(v) : '')}
                        style={{ fill: '#ffffff', fontSize: 12, fontWeight: 600 }}
                      />
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <DeclarationCerfaCard rows={declarationParAnnee} loading={recusLoading} />
        </>
      )}
    </div>
  )
}
