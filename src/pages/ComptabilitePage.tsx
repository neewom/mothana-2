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
import { computeSamePeriodComparison, formatDayMonth } from '../lib/samePeriodComparison'
import type { Don, ModePaiement } from '../types'
import { Button } from '../components/ui/button'
import { PageHeader } from '../components/ui/page-header'
import { StatTiles } from '../components/ui/stat-tiles'

// ---------------------------------------------------------------------------
// Palette — charte Mothana (DESIGN.md › Colors) plutôt que les couleurs par défaut
// d'une librairie : cachet pour la série mise en avant (année N, montants par
// activité), encre et nuances neutres pour le contexte et les autres catégories.
// Valeurs reprises des tokens Tailwind (Recharts se pilote en props SVG, pas en
// classes, d'où l'exception hex de ce fichier dans eslint.design-system.js).
// ---------------------------------------------------------------------------

const STAMP = '#a8281f' // stamp
const INK = '#241f19' // ink
const INK_FAINT = '#726860' // ink-faint
const NEUTRAL_LIGHT = '#d6cec2' // nuance papier foncée, 4e catégorie
const ACCENT = STAMP
const CONTEXT_GRAY = INK_FAINT // année N-1 : contexte
// Modes de paiement (Espèces, Chèque, Prélèvement-virement, Autres) et couleur du libellé
// posé sur chaque segment (blanc sur fond foncé, encre sur la nuance claire).
const CATEGORICAL = [STAMP, INK, INK_FAINT, NEUTRAL_LIGHT] as const
const CATEGORICAL_LABEL = ['#ffffff', '#ffffff', '#ffffff', INK] as const
const GRID_STROKE = '#e8e4dc' // paper-border
const AXIS_STROKE = '#726860' // ink-faint

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

// Espace insécable avant « € » : le libellé SVG de Recharts (`Text`) coupe sur les espaces
// ordinaires, ce qui faisait passer « € » seul à la ligne sous la valeur.
function formatEur(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + '\u00a0€'
}

// Libellé d'un segment de la barre empilée (modes de paiement) : centré dans le segment s'il y
// tient, sinon omis plutôt que coupé sur deux lignes ou superposé au voisin — le montant de
// chaque mode reste lisible dans la légende, sous la barre.
const SEGMENT_LABEL_CHAR_WIDTH = 7.5 // largeur moyenne d'un caractère à 12px, gras
const SEGMENT_LABEL_PADDING = 8

interface SegmentLabelProps {
  x?: number | string
  y?: number | string
  width?: number | string
  height?: number | string
  value?: unknown
  color: string
}

function SegmentLabel({ x, y, width, height, value, color }: SegmentLabelProps) {
  if (typeof value !== 'number' || value <= 0) return null
  const text = formatEur(value)
  const left = Number(x ?? 0)
  const top = Number(y ?? 0)
  const w = Number(width ?? 0)
  const h = Number(height ?? 0)
  if (text.length * SEGMENT_LABEL_CHAR_WIDTH + SEGMENT_LABEL_PADDING > w) return null
  return (
    <text x={left + w / 2} y={top + h / 2} textAnchor="middle" dominantBaseline="central" fill={color} fontSize={12} fontWeight={600}>
      {text}
    </text>
  )
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
// Tooltip partagé — valeur en avant (Strong), nom de série en second,
// repère de série en trait court (line key) plutôt qu'un carré de couleur.
// ---------------------------------------------------------------------------

interface TooltipPayloadItem {
  name?: string
  value?: number | null
  color?: string
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-sm border border-paper-border bg-white px-3 py-2 font-registre text-sm shadow-lg">
      {label && <p className="mb-1 font-medium text-ink-faint">{label}</p>}
      {payload.filter((entry) => entry.value != null).map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-3" style={{ backgroundColor: entry.color }} />
          <span className="font-semibold text-ink">{formatEur(entry.value ?? 0)}</span>
          <span className="text-ink-faint">{entry.name}</span>
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
    // La courbe de l'année affichée s'arrête au mois courant (2026-11-09) : un mois à venir vaut
    // `null` (pas de point, pas de chute à 0) sauf s'il porte déjà un don daté dans le futur.
    // L'année précédente reste complète.
    const now = new Date()
    const estAVenir = (i: number) => year > now.getFullYear() || (year === now.getFullYear() && i > now.getMonth())
    return MOIS.map((mois, i) => ({
      mois,
      montantN: estAVenir(i) && totalsN[i] === 0 ? null : totalsN[i],
      montantN1: totalsN1[i],
    }))
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

  // Tuiles : total de l'année affichée (inchangé) et comparaison à période égale — année en
  // cours du 1er janvier à aujourd'hui sur les deux années, année passée complète. La courbe
  // N-1 du graphique reste, elle, sur l'année entière.
  const totalN = useMemo(() => monthlyData.reduce((s, m) => s + (m.montantN ?? 0), 0), [monthlyData])
  const comparison = useMemo(() => computeSamePeriodComparison(dons, year, new Date()), [dons, year])
  const periodLabel = comparison.cutoff ? `1ᵉʳ janv. – ${formatDayMonth(comparison.cutoff)}` : null
  const variationPct = comparison.variationPct

  return (
    <div className="-m-6 min-h-[calc(100%+3rem)] space-y-6 bg-paper p-6 font-registre">
      {/* Titre + sélecteur d'année (action de page) */}
      <PageHeader
        title="Statistiques"
        subtitle="Vue d'ensemble des dons collectés"
        actions={
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => setYear((y) => y - 1)} disabled={year <= minYear}>
            ‹
          </Button>
          <span className="min-w-[4rem] text-center font-registre-mono text-sm font-semibold text-ink">{year}</span>
          <Button type="button" variant="secondary" size="sm" onClick={() => setYear((y) => y + 1)} disabled={year >= maxYear}>
            ›
          </Button>
        </div>
        }
      />

      {error && (
        <div className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">Erreur : {error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-stamp border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Stats */}
          <StatTiles
            items={[
              {
                label: `Total ${year}`,
                value: formatEur(totalN),
                // Dons datés après aujourd'hui (saisis d'avance) : comptés dans le total de l'année
                // mais hors de la comparaison à date, d'où la précision pour que les tuiles se recoupent.
                hint: comparison.cutoff && comparison.totalAfterCutoff > 0
                  ? `dont ${formatEur(comparison.totalAfterCutoff)} de dons après le ${formatDayMonth(comparison.cutoff)}`
                  : undefined,
              },
              {
                // « à date » dans le libellé : le hint (période exacte) est masqué en mobile.
                label: comparison.cutoff ? `${year - 1} à date` : `Total ${year - 1}`,
                value: formatEur(comparison.totalN1),
                hint: periodLabel ?? undefined,
              },
              variationPct === null
                ? {
                    label: 'Évolution',
                    value: '—',
                    // À date, N-1 = 0 sur la période ne veut pas dire aucun don dans l'année N-1.
                    hint: comparison.cutoff ? `pas de dons sur la même période ${year - 1}` : `pas de dons en ${year - 1}`,
                  }
                : {
                    label: 'Évolution',
                    value: `${variationPct >= 0 ? '+' : ''}${variationPct.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`,
                    hint: periodLabel
                      ? `${variationPct >= 0 ? '↑' : '↓'} vs même période ${year - 1} (${periodLabel})`
                      : `${variationPct >= 0 ? '↑' : '↓'} vs ${year - 1}`,
                    hintTone: variationPct >= 0 ? 'success' : 'warning',
                  },
            ]}
          />

          {/* Courbe mensuelle N vs N-1 */}
          <div className="rounded-sm border border-paper-border bg-white p-5">
            <h2 className="mb-4 font-registre font-semibold text-ink">Dons par mois — {year} vs {year - 1}</h2>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={monthlyData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="mois" stroke={AXIS_STROKE} tickLine={false} axisLine={{ stroke: GRID_STROKE }} tick={{ fontSize: 12 }} />
                <YAxis stroke={AXIS_STROKE} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={(v: number) => formatEur(v)} width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Line type="monotone" dataKey="montantN" name={`${year}`} stroke={ACCENT} strokeWidth={2} dot={{ r: 4, fill: ACCENT, stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="montantN1" name={`${year - 1}`} stroke={CONTEXT_GRAY} strokeWidth={2} dot={{ r: 4, fill: CONTEXT_GRAY, stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Répartition par activité */}
            <div className="rounded-sm border border-paper-border bg-white p-5">
              <h2 className="mb-4 font-registre font-semibold text-ink">Répartition par activité — {year}</h2>
              {activiteBreakdown.length === 0 ? (
                <p className="py-8 text-center font-registre text-sm text-ink-faint">Aucun don sur cette année</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(160, activiteBreakdown.length * 44)}>
                  <BarChart data={activiteBreakdown} layout="vertical" margin={{ top: 0, right: 72, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
                    <XAxis type="number" stroke={AXIS_STROKE} tickLine={false} axisLine={{ stroke: GRID_STROKE }} tick={{ fontSize: 12 }} tickFormatter={(v: number) => formatEur(v)} />
                    <YAxis type="category" dataKey="nom" stroke={AXIS_STROKE} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={120} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="montant" name="Montant" fill={ACCENT} radius={[0, 4, 4, 0]} barSize={20}>
                      <LabelList dataKey="montant" position="right" formatter={(v: number | string | boolean | null | undefined) => (typeof v === 'number' ? formatEur(v) : '')} style={{ fill: INK_FAINT, fontSize: 12 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Répartition par mode de paiement */}
            <div className="rounded-sm border border-paper-border bg-white p-5">
              <h2 className="mb-4 font-registre font-semibold text-ink">Répartition par mode de paiement — {year}</h2>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={modeBreakdown} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  {/* Domaine borné au total : la barre occupe toute la largeur (le domaine « arrondi »
                      par défaut la laissait à mi-carte et rétrécissait les segments). */}
                  <XAxis type="number" hide domain={[0, 'dataMax']} />
                  <YAxis type="category" dataKey="name" hide />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    content={() => (
                      <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
                        {MODE_PAIEMENT_OPTIONS.map((o, i) => (
                          <li key={o.value} className="flex items-center gap-1.5 whitespace-nowrap">
                            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: CATEGORICAL[i] }} />
                            <span className="font-registre text-ink-muted">{o.label}</span>
                            <span className="font-registre-mono text-ink">{formatEur(Number(modeBreakdown[0][`mode_${o.value}`] ?? 0))}</span>
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
                        content={(props) => <SegmentLabel x={props.x} y={props.y} width={props.width} height={props.height} value={props.value} color={CATEGORICAL_LABEL[i]} />}
                      />
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </>
      )}
    </div>
  )
}
