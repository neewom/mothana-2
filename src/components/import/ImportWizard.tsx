import { useState, useEffect, useMemo, Fragment, type ChangeEvent } from 'react'
import ScrollShadowX from '../ScrollShadowX'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Select } from '../ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { cn } from '../../lib/utils'
import { supabase } from '../../lib/supabaseClient'
import type { ImportConfig, PreparedBatch } from '../../lib/import/configs'
import { parseImportFile } from '../../lib/import/parseFile'
import { guessMapping, buildParsedRows } from '../../lib/import/mapping'
import { runImport, type ImportSummary } from '../../lib/import/runImport'
import { defaultResolutions, applyResolutions, type Resolution, type ResolutionMap } from '../../lib/import/conflicts'
import type { ConflictRow, ParsedRow } from '../../lib/import/types'

/** Action sur une ligne "sensible" (collision d'id_externe ou doublon probable) — remplace le picker champ par champ tant qu'elle n'est pas résolue. */
type RowAction = 'ignore' | 'create-new' | 'confirm-merge'

type Step = 'upload' | 'map' | 'preview' | 'conflicts' | 'confirm' | 'running' | 'done'

interface ImportWizardProps {
  open: boolean
  onClose: () => void
  config: ImportConfig
  organisationId: string
  onImported?: () => void
}

const CHECK_CLASS = 'h-4 w-4 rounded-sm border-paper-border accent-stamp focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70'
const RADIO_CLASS = 'h-4 w-4 cursor-pointer accent-stamp focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70'
/** Choix exclusif sélectionné (ligne sensible) : contour au cachet, sans le fond plein réservé au danger. */
const CHOICE_SELECTED_CLASS = 'border-stamp bg-stamp/[0.06] text-stamp hover:bg-stamp/[0.06]'

const NOUVELLE_FICHE_LABEL: Partial<Record<ImportConfig['entity'], string>> = {
  adherents: 'Créer un nouvel adhérent',
  participants: 'Créer un nouveau donateur',
}

export default function ImportWizard({ open, onClose, config, organisationId, onImported }: ImportWizardProps) {
  const [step, setStep] = useState<Step>('upload')
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<unknown[][]>([])
  const [mapping, setMapping] = useState<Record<string, number | null>>({})
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [ignoreErrors, setIgnoreErrors] = useState(true)
  const [batchResult, setBatchResult] = useState<PreparedBatch | null>(null)
  const [resolutions, setResolutions] = useState<ResolutionMap>({})
  const [rowActions, setRowActions] = useState<Record<number, RowAction>>({})
  const [generatedIdExterne, setGeneratedIdExterne] = useState<Record<number, string>>({})
  const [resolvingIndex, setResolvingIndex] = useState<number | null>(null)
  const [finalPayloadRows, setFinalPayloadRows] = useState<Record<string, unknown>[]>([])
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [summary, setSummary] = useState<ImportSummary | null>(null)

  useEffect(() => {
    if (open) {
      setStep('upload')
      setFileName('')
      setHeaders([])
      setRawRows([])
      setMapping({})
      setParsedRows([])
      setIgnoreErrors(true)
      setBatchResult(null)
      setResolutions({})
      setRowActions({})
      setGeneratedIdExterne({})
      setResolvingIndex(null)
      setFinalPayloadRows([])
      setPreparing(false)
      setError(null)
      setProgress({ done: 0, total: 0 })
      setSummary(null)
    }
  }, [open, config])

  const validRows = useMemo(() => parsedRows.filter((r) => Object.keys(r.errors).length === 0), [parsedRows])
  const errorRows = useMemo(() => parsedRows.filter((r) => Object.keys(r.errors).length > 0), [parsedRows])

  const requiredFieldsMapped = config.fieldDefs
    .filter((f) => f.required)
    .every((f) => mapping[f.key] !== null && mapping[f.key] !== undefined)

  const allConflictsResolved = batchResult
    ? batchResult.conflicts.every((c) => {
        if (!c.sensitive) return c.diffs.every((d) => resolutions[c.index]?.[d.key] !== undefined)
        const action = rowActions[c.index]
        if (!action) return false
        if (action === 'create-new' && c.sensitive.kind === 'collision') return generatedIdExterne[c.index] !== undefined
        if (action === 'confirm-merge') return c.diffs.every((d) => resolutions[c.index]?.[d.key] !== undefined)
        return true
      })
    : true

  if (!open) return null

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    try {
      const parsed = await parseImportFile(file)
      setFileName(file.name)
      setHeaders(parsed.headers)
      setRawRows(parsed.rows)
      setMapping(guessMapping(parsed.headers, config.fieldDefs))
      setStep('map')
    } catch (err) {
      console.error('Erreur de lecture du fichier import :', err)
      setError(err instanceof Error ? err.message : 'Erreur de lecture du fichier')
    }
  }

  function handleMappingChange(fieldKey: string, colIndexStr: string) {
    setMapping((prev) => ({ ...prev, [fieldKey]: colIndexStr === '' ? null : Number(colIndexStr) }))
  }

  function handleGoToPreview() {
    const rows = buildParsedRows(rawRows, mapping, config.fieldDefs)
    setParsedRows(config.postProcessRow ? rows.map(config.postProcessRow) : rows)
    setStep('preview')
  }

  async function handleGoToConflictsOrConfirm() {
    setPreparing(true)
    setError(null)
    try {
      const rowsToSend = ignoreErrors ? validRows : parsedRows
      const result = await config.prepareBatch(rowsToSend, mapping, organisationId)
      setBatchResult(result)
      if (result.conflicts.length > 0) {
        setResolutions({})
        setStep('conflicts')
      } else {
        setFinalPayloadRows(result.inserts)
        setStep('confirm')
      }
    } catch (err) {
      console.error('Erreur de préparation de l’import :', err)
      setError(err instanceof Error ? err.message : 'Erreur de préparation de l’import')
    } finally {
      setPreparing(false)
    }
  }

  function setResolutionForField(rowIndex: number, fieldKey: string, resolution: Resolution) {
    setResolutions((prev) => ({ ...prev, [rowIndex]: { ...prev[rowIndex], [fieldKey]: resolution } }))
  }

  function applyBulkResolution(resolution: Resolution) {
    if (!batchResult) return
    // Les lignes sensibles ne suivent jamais une résolution groupée : elles
    // exigent une décision explicite (Ignorer / Créer nouveau / Confirmer).
    const nonSensitive = batchResult.conflicts.filter((c) => !c.sensitive)
    const sensitiveIndices = new Set(batchResult.conflicts.filter((c) => c.sensitive).map((c) => c.index))
    setResolutions((prev) => {
      const preserved: ResolutionMap = {}
      for (const idx of sensitiveIndices) if (prev[idx]) preserved[idx] = prev[idx]
      return { ...preserved, ...defaultResolutions(nonSensitive, resolution) }
    })
  }

  function applyRowResolution(rowIndex: number, fieldKeys: string[], resolution: Resolution) {
    setResolutions((prev) => {
      const rowChoices = { ...prev[rowIndex] }
      for (const key of fieldKeys) rowChoices[key] = resolution
      return { ...prev, [rowIndex]: rowChoices }
    })
  }

  async function handleSensitiveAction(c: ConflictRow, action: RowAction) {
    if (action === 'create-new' && c.sensitive?.kind === 'collision') {
      setResolvingIndex(c.index)
      setError(null)
      const { data, error: err } = await supabase.rpc(config.idExterneRpcName!, { p_organisation_id: organisationId })
      setResolvingIndex(null)
      if (err) {
        setError(err.message)
        return
      }
      setGeneratedIdExterne((prev) => ({ ...prev, [c.index]: data as string }))
    }
    setRowActions((prev) => ({ ...prev, [c.index]: action }))
  }

  function handleGoToConfirmFromConflicts() {
    if (!batchResult) return
    const nonSensitive = batchResult.conflicts.filter((c) => !c.sensitive)
    const sensitiveRows: Record<string, unknown>[] = []
    for (const c of batchResult.conflicts) {
      if (!c.sensitive) continue
      const action = rowActions[c.index]
      if (action === 'ignore' || !action) continue
      if (action === 'create-new') {
        const payload = { ...c.createNewPayload }
        if (c.sensitive.kind === 'collision') payload.id_externe = generatedIdExterne[c.index] ?? null
        sensitiveRows.push(payload)
        continue
      }
      sensitiveRows.push(...applyResolutions([c], resolutions))
    }
    setFinalPayloadRows([...batchResult.inserts, ...applyResolutions(nonSensitive, resolutions), ...sensitiveRows])
    setStep('confirm')
  }

  async function handleRunImport() {
    setStep('running')
    setProgress({ done: 0, total: finalPayloadRows.length })
    const result = await runImport(config.rpcName, finalPayloadRows, organisationId, (done, total) => setProgress({ done, total }))
    setSummary(result)
    setStep('done')
    onImported?.()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="max-w-3xl" aria-describedby={undefined}>
      <DialogHeader className="shrink-0 pr-12">
        <DialogTitle>Importer : {config.title}</DialogTitle>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {error && <div role="alert" className="mb-4 rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">{error}</div>}

        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">
              Sélectionnez un fichier CSV ou Excel (.xlsx) contenant les données à importer. Une seule feuille est prise en compte pour les fichiers Excel (la première).
            </p>
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={handleFileChange}
              className="block w-full rounded-sm font-registre text-sm text-ink-muted file:mr-4 file:cursor-pointer file:rounded-sm file:border file:border-stamp file:bg-transparent file:px-3.5 file:py-2 file:font-registre file:text-sm file:font-medium file:text-stamp hover:file:bg-stamp/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70"
            />
          </div>
        )}

        {step === 'map' && (
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">
              Fichier : <span className="font-medium text-ink">{fileName}</span> ({rawRows.length} ligne{rawRows.length !== 1 ? 's' : ''})
            </p>
            <div className="overflow-hidden rounded-sm border border-paper-border bg-white">
              <ScrollShadowX>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Champ cible</TableHead>
                      <TableHead>Colonne du fichier</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {config.fieldDefs.map((field) => (
                      <TableRow key={field.key}>
                        <TableCell className="whitespace-nowrap font-medium text-ink">
                          {field.label}
                          {field.required && <span className="text-stamp"> *</span>}
                        </TableCell>
                        <TableCell className="min-w-[14rem]">
                          <Select
                            aria-label={`Colonne pour ${field.label}`}
                            value={mapping[field.key] ?? ''}
                            onChange={(e) => handleMappingChange(field.key, e.target.value)}
                            className="w-full"
                          >
                            <option value="">— Ignorer —</option>
                            {headers.map((h, i) => (
                              <option key={i} value={i}>{h}</option>
                            ))}
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollShadowX>
            </div>
            {!requiredFieldsMapped && (
              <p className="text-sm text-warning">Tous les champs obligatoires (*) doivent être mappés.</p>
            )}
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              <StatTile label="Lignes totales" value={parsedRows.length} />
              <StatTile label="Valides" value={validRows.length} />
              <StatTile label="En erreur" value={errorRows.length} tone={errorRows.length > 0 ? 'warn' : 'default'} />
            </div>

            {errorRows.length > 0 && (
              <>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={ignoreErrors} onChange={(e) => setIgnoreErrors(e.target.checked)} className={CHECK_CLASS} />
                  Ignorer les lignes en erreur et importer le reste
                </label>
                <div className="max-h-64 overflow-y-auto rounded-sm border border-paper-border bg-white">
                  <ScrollShadowX>
                    <Table>
                      <TableHeader className="sticky top-0 bg-paper">
                        <TableRow>
                          <TableHead>Ligne</TableHead>
                          <TableHead>Erreurs</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {errorRows.map((row) => (
                          <TableRow key={row.index}>
                            <TableCell className="whitespace-nowrap font-registre-mono text-xs text-ink-faint">{row.index + 2}</TableCell>
                            <TableCell className="whitespace-nowrap text-stamp">
                              {Object.entries(row.errors).map(([k, v]) => `${k} : ${v}`).join(' · ')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollShadowX>
                </div>
              </>
            )}
          </div>
        )}

        {step === 'conflicts' && batchResult && (
          <div className="space-y-4">
            <div className={cn('grid grid-cols-2 gap-3 sm:gap-4', batchResult.conflicts.some((c) => c.sensitive) ? 'sm:grid-cols-4' : 'sm:grid-cols-3')}>
              <StatTile label="Nouveaux" value={batchResult.inserts.length} />
              <StatTile label="Identiques (ignorés)" value={batchResult.identicalCount} />
              <StatTile label="Avec différences" value={batchResult.conflicts.filter((c) => !c.sensitive).length} tone="warn" />
              {batchResult.conflicts.some((c) => c.sensitive) && (
                <StatTile label="Sensibles — à examiner" value={batchResult.conflicts.filter((c) => c.sensitive).length} tone="danger" />
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-muted">
                Pour chaque champ différent, choisissez la valeur à conserver.
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => applyBulkResolution('current')}>
                  Garder l'actuel
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => applyBulkResolution('imported')}>
                  Garder l'import
                </Button>
              </div>
            </div>

            <div className="max-h-96 space-y-2 overflow-y-auto">
              {batchResult.conflicts.map((c) => {
                const name = [c.payloadBase.prenom, c.payloadBase.nom].filter(Boolean).join(' ')

                if (c.sensitive) {
                  const action = rowActions[c.index]
                  const resolved =
                    action === 'ignore' ||
                    (action === 'create-new' && (c.sensitive.kind !== 'collision' || generatedIdExterne[c.index] !== undefined)) ||
                    (action === 'confirm-merge' && c.diffs.every((d) => resolutions[c.index]?.[d.key] !== undefined))
                  return (
                    <details key={c.index} open className="group rounded-sm border-2 border-stamp/40 bg-stamp/[0.04]">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 text-xs font-medium text-stamp [&::-webkit-details-marker]:hidden">
                        <span>
                          ⚠️ Ligne {c.index + 2}
                          {name && ` — ${name}`}
                          {c.idExterne ? ` — id_externe : ${c.idExterne}` : ''}
                        </span>
                        <span className={cn('font-registre-mono', resolved ? 'text-success' : 'text-stamp')}>
                          {resolved ? 'Résolu' : 'Décision requise'}
                        </span>
                      </summary>
                      <div className="space-y-3 border-t border-stamp/20 p-3 text-sm">
                        <p className="text-ink">{c.sensitive.reason}</p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            aria-pressed={action === 'ignore'}
                            onClick={() => handleSensitiveAction(c, 'ignore')}
                            className={cn(action === 'ignore' && CHOICE_SELECTED_CLASS)}
                          >
                            Ignorer cette ligne
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            aria-pressed={action === 'create-new'}
                            onClick={() => handleSensitiveAction(c, 'create-new')}
                            disabled={resolvingIndex === c.index}
                            className={cn(action === 'create-new' && CHOICE_SELECTED_CLASS)}
                          >
                            {resolvingIndex === c.index ? 'Génération…' : (NOUVELLE_FICHE_LABEL[config.entity] ?? 'Créer une nouvelle fiche')}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            aria-pressed={action === 'confirm-merge'}
                            onClick={() => handleSensitiveAction(c, 'confirm-merge')}
                            className={cn(action === 'confirm-merge' && CHOICE_SELECTED_CLASS)}
                          >
                            Confirmer que c'est la même personne
                          </Button>
                        </div>
                        {action === 'create-new' && c.sensitive.kind === 'collision' && generatedIdExterne[c.index] && (
                          <p className="text-xs text-ink-muted">Nouvel id_externe attribué : <span className="font-registre-mono">{generatedIdExterne[c.index]}</span></p>
                        )}
                        {action === 'confirm-merge' && (
                          <div className="grid grid-cols-[minmax(8rem,auto)_1fr_1fr] items-center gap-x-3 gap-y-2 rounded-sm border border-paper-border bg-white p-3">
                            <div />
                            <button
                              type="button"
                              onClick={() => applyRowResolution(c.index, c.diffs.map((d) => d.key), 'current')}
                              className="rounded-sm text-left text-xs font-medium text-ink-faint underline decoration-dotted underline-offset-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70"
                            >
                              Garder l'actuel
                            </button>
                            <button
                              type="button"
                              onClick={() => applyRowResolution(c.index, c.diffs.map((d) => d.key), 'imported')}
                              className="rounded-sm text-left text-xs font-medium text-ink-faint underline decoration-dotted underline-offset-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70"
                            >
                              Garder l'import
                            </button>
                            {c.diffs.map((d) => (
                              <Fragment key={d.key}>
                                <span className="font-medium text-ink">{d.label}</span>
                                <label className="flex cursor-pointer items-center gap-2 rounded-sm border border-paper-border bg-white px-2 py-1.5 has-[:checked]:border-stamp/50 has-[:checked]:bg-stamp/[0.04]">
                                  <input
                                    type="radio"
                                    className={RADIO_CLASS}
                                    name={`resolve-${c.index}-${d.key}`}
                                    checked={resolutions[c.index]?.[d.key] === 'current'}
                                    onChange={() => setResolutionForField(c.index, d.key, 'current')}
                                  />
                                  <span className="text-ink-muted">{d.format(d.current)}</span>
                                </label>
                                <label className="flex cursor-pointer items-center gap-2 rounded-sm border border-paper-border bg-white px-2 py-1.5 has-[:checked]:border-stamp/50 has-[:checked]:bg-stamp/[0.04]">
                                  <input
                                    type="radio"
                                    className={RADIO_CLASS}
                                    name={`resolve-${c.index}-${d.key}`}
                                    checked={resolutions[c.index]?.[d.key] === 'imported'}
                                    onChange={() => setResolutionForField(c.index, d.key, 'imported')}
                                  />
                                  <span className="text-ink-muted">{d.format(d.imported)}</span>
                                </label>
                              </Fragment>
                            ))}
                          </div>
                        )}
                      </div>
                    </details>
                  )
                }

                const unresolvedCount = c.diffs.filter((d) => resolutions[c.index]?.[d.key] === undefined).length
                return (
                  <details key={c.index} className="group rounded-sm border border-warning-border bg-warning-tint">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm p-3 text-xs font-medium text-ink-muted transition-colors hover:bg-warning-border/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70 [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center gap-2">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 shrink-0 text-ink-faint transition-transform group-open:rotate-90"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                        <span>
                          Ligne {c.index + 2}
                          {name && ` — ${name}`}
                          {c.idExterne ? ` — id_externe : ${c.idExterne}` : ''}
                        </span>
                      </span>
                      <span className={cn('font-registre-mono', unresolvedCount > 0 ? 'text-warning' : 'text-success')}>
                        {unresolvedCount > 0 ? `${unresolvedCount} à résoudre` : 'Résolu'}
                      </span>
                    </summary>
                    <div className="grid grid-cols-[minmax(8rem,auto)_1fr_1fr] items-center gap-x-3 gap-y-2 border-t border-warning-border p-3 text-sm">
                      <div />
                      <button
                        type="button"
                        onClick={() => applyRowResolution(c.index, c.diffs.map((d) => d.key), 'current')}
                        className="rounded-sm text-left text-xs font-medium text-ink-faint underline decoration-dotted underline-offset-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70"
                      >
                        Garder l'actuel
                      </button>
                      <button
                        type="button"
                        onClick={() => applyRowResolution(c.index, c.diffs.map((d) => d.key), 'imported')}
                        className="rounded-sm text-left text-xs font-medium text-ink-faint underline decoration-dotted underline-offset-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp/70"
                      >
                        Garder l'import
                      </button>
                      {c.diffs.map((d) => (
                        <Fragment key={d.key}>
                          <span className="font-medium text-ink">{d.label}</span>
                          <label className="flex cursor-pointer items-center gap-2 rounded-sm border border-paper-border bg-white px-2 py-1.5 has-[:checked]:border-stamp/50 has-[:checked]:bg-stamp/[0.04]">
                            <input
                              type="radio"
                              className={RADIO_CLASS}
                              name={`resolve-${c.index}-${d.key}`}
                              checked={resolutions[c.index]?.[d.key] === 'current'}
                              onChange={() => setResolutionForField(c.index, d.key, 'current')}
                            />
                            <span className="text-ink-muted">{d.format(d.current)}</span>
                          </label>
                          <label className="flex cursor-pointer items-center gap-2 rounded-sm border border-paper-border bg-white px-2 py-1.5 has-[:checked]:border-stamp/50 has-[:checked]:bg-stamp/[0.04]">
                            <input
                              type="radio"
                              className={RADIO_CLASS}
                              name={`resolve-${c.index}-${d.key}`}
                              checked={resolutions[c.index]?.[d.key] === 'imported'}
                              onChange={() => setResolutionForField(c.index, d.key, 'imported')}
                            />
                            <span className="text-ink-muted">{d.format(d.imported)}</span>
                          </label>
                        </Fragment>
                      ))}
                    </div>
                  </details>
                )
              })}
            </div>
          </div>
        )}

        {step === 'confirm' && batchResult && (() => {
          const sensitiveIgnored = batchResult.conflicts.filter((c) => c.sensitive && rowActions[c.index] === 'ignore').length
          const sensitiveCreateNew = batchResult.conflicts.filter((c) => c.sensitive && rowActions[c.index] === 'create-new').length
          return (
          <div className="space-y-4">
            <div className={cn('grid grid-cols-2 gap-3 sm:gap-4', sensitiveIgnored > 0 ? 'sm:grid-cols-4' : 'sm:grid-cols-3')}>
              <StatTile label="Nouveaux" value={batchResult.inserts.length + sensitiveCreateNew} />
              <StatTile label="Mis à jour" value={batchResult.conflicts.length - sensitiveIgnored - sensitiveCreateNew} />
              <StatTile label="Identiques (ignorés)" value={batchResult.identicalCount} />
              {sensitiveIgnored > 0 && <StatTile label="Lignes sensibles ignorées" value={sensitiveIgnored} tone="danger" />}
            </div>
            <p className="text-sm text-ink-muted">
              {finalPayloadRows.length} ligne{finalPayloadRows.length !== 1 ? 's' : ''} prête{finalPayloadRows.length !== 1 ? 's' : ''} à être envoyée{finalPayloadRows.length !== 1 ? 's' : ''}.
            </p>
            {batchResult.excluded.length > 0 && (
              <div className="rounded-sm border border-warning-border bg-warning-tint px-4 py-3 text-sm text-warning">
                {batchResult.excluded.length} ligne(s) exclue(s) :
                <ul className="mt-1 list-disc pl-5">
                  {batchResult.excluded.slice(0, 10).map((e) => (
                    <li key={e.index}>Ligne {e.index + 2} : {e.reason}</li>
                  ))}
                </ul>
                {batchResult.excluded.length > 10 && <p className="mt-1">… et {batchResult.excluded.length - 10} autre(s).</p>}
              </div>
            )}
            {batchResult.warnings.length > 0 && (
              <div className="rounded-sm border border-warning-border bg-warning-tint px-4 py-3 text-sm text-warning">
                {batchResult.warnings.length} avertissement(s) :
                <ul className="mt-1 list-disc pl-5">
                  {batchResult.warnings.slice(0, 10).map((w) => (
                    <li key={w.index}>Ligne {w.index + 2} : {w.reason}</li>
                  ))}
                </ul>
                {batchResult.warnings.length > 10 && <p className="mt-1">… et {batchResult.warnings.length - 10} autre(s).</p>}
              </div>
            )}
          </div>
          )
        })()}

        {step === 'running' && (
          <div className="space-y-3">
            <p className="text-sm text-ink-muted">Import en cours…</p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-paper-border/60" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
              <div
                className="h-full bg-stamp transition-all"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="font-registre-mono text-xs text-ink-faint">{progress.done} / {progress.total}</p>
          </div>
        )}

        {step === 'done' && summary && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              <StatTile label="Créés" value={summary.created} />
              <StatTile label="Mis à jour" value={summary.updated} />
              <StatTile label="Ignorés" value={summary.skipped} tone={summary.skipped > 0 ? 'warn' : 'default'} />
            </div>
            {summary.chunkErrors.length > 0 && (
              <div role="alert" className="rounded-sm border border-stamp/30 bg-stamp/[0.04] px-4 py-3 text-sm text-stamp">
                Certains lots ont échoué :
                <ul className="mt-1 list-disc pl-5">
                  {summary.chunkErrors.map((e) => (
                    <li key={e.chunkIndex}>Lignes {e.rowRange[0] + 1}–{e.rowRange[1] + 1} : {e.message}</li>
                  ))}
                </ul>
                <p className="mt-1">Vous pouvez ré-importer le même fichier sans risque de doublon une fois corrigé.</p>
              </div>
            )}
            {summary.chunkErrors.length === 0 && (
              <p className="text-sm text-ink-faint">Import terminé. Ré-importer le même fichier plus tard est sans risque (les lignes déjà importées seront simplement mises à jour).</p>
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-paper-border bg-white px-6 py-4">
        <div>
          {step === 'map' && (
            <Button type="button" variant="ghost" onClick={() => setStep('upload')}>
              Précédent
            </Button>
          )}
          {step === 'preview' && (
            <Button type="button" variant="ghost" onClick={() => setStep('map')}>
              Précédent
            </Button>
          )}
          {step === 'conflicts' && (
            <Button type="button" variant="ghost" onClick={() => setStep('preview')}>
              Précédent
            </Button>
          )}
          {step === 'confirm' && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep(batchResult && batchResult.conflicts.length > 0 ? 'conflicts' : 'preview')}
            >
              Précédent
            </Button>
          )}
        </div>
        <div className="flex gap-3">
          {step === 'map' && (
            <Button
              type="button"
              onClick={handleGoToPreview}
              disabled={!requiredFieldsMapped}
            >
              Suivant
            </Button>
          )}
          {step === 'preview' && (
            <Button
              type="button"
              onClick={handleGoToConflictsOrConfirm}
              disabled={preparing || (errorRows.length > 0 && !ignoreErrors) || (ignoreErrors ? validRows.length === 0 : parsedRows.length === 0)}
            >
              {preparing ? 'Préparation…' : 'Suivant'}
            </Button>
          )}
          {step === 'conflicts' && (
            <Button
              type="button"
              onClick={handleGoToConfirmFromConflicts}
              disabled={!allConflictsResolved}
            >
              Suivant
            </Button>
          )}
          {step === 'confirm' && (
            <Button
              type="button"
              onClick={handleRunImport}
              disabled={finalPayloadRows.length === 0}
            >
              Lancer l'import
            </Button>
          )}
          {step === 'done' && (
            <Button type="button" onClick={onClose}>
              Fermer
            </Button>
          )}
        </div>
      </div>
      </DialogContent>
    </Dialog>
  )
}

function StatTile({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'warn' | 'danger' }) {
  const toneClasses =
    tone === 'danger'
      ? { border: 'border-stamp/40 bg-stamp/[0.04]', text: 'text-stamp' }
      : tone === 'warn'
        ? { border: 'border-warning-border bg-warning-tint', text: 'text-warning' }
        : { border: 'border-paper-border bg-paper', text: 'text-ink' }
  return (
    <div className={cn('rounded-sm border px-4 py-3', toneClasses.border)}>
      <p className="text-xs text-ink-faint">{label}</p>
      <p className={cn('font-registre-mono text-lg font-semibold tabular-nums', toneClasses.text)}>{value}</p>
    </div>
  )
}
