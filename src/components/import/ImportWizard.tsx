import { useState, useEffect, useMemo, Fragment, type ChangeEvent } from 'react'
import Modal from '../Modal'
import type { ImportConfig, PreparedBatch } from '../../lib/import/configs'
import { parseImportFile } from '../../lib/import/parseFile'
import { guessMapping, buildParsedRows } from '../../lib/import/mapping'
import { runImport, type ImportSummary } from '../../lib/import/runImport'
import { defaultResolutions, applyResolutions, type Resolution, type ResolutionMap } from '../../lib/import/conflicts'
import type { ParsedRow } from '../../lib/import/types'

type Step = 'upload' | 'map' | 'preview' | 'conflicts' | 'confirm' | 'running' | 'done'

interface ImportWizardProps {
  open: boolean
  onClose: () => void
  config: ImportConfig
  organisationId: string
  onImported?: () => void
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
    ? batchResult.conflicts.every((c) => c.diffs.every((d) => resolutions[c.index]?.[d.key] !== undefined))
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
    setParsedRows(buildParsedRows(rawRows, mapping, config.fieldDefs))
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
    setResolutions(defaultResolutions(batchResult.conflicts, resolution))
  }

  function applyRowResolution(rowIndex: number, fieldKeys: string[], resolution: Resolution) {
    setResolutions((prev) => {
      const rowChoices = { ...prev[rowIndex] }
      for (const key of fieldKeys) rowChoices[key] = resolution
      return { ...prev, [rowIndex]: rowChoices }
    })
  }

  function handleGoToConfirmFromConflicts() {
    if (!batchResult) return
    setFinalPayloadRows([...batchResult.inserts, ...applyResolutions(batchResult.conflicts, resolutions)])
    setStep('confirm')
  }

  async function handleRunImport() {
    setStep('running')
    setProgress({ done: 0, total: finalPayloadRows.length })
    const result = await runImport(config.rpcName, finalPayloadRows, (done, total) => setProgress({ done, total }))
    setSummary(result)
    setStep('done')
    onImported?.()
  }

  return (
    <Modal open={open} onClose={onClose} maxWidthClassName="max-w-3xl" labelledBy="import-wizard-title">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 id="import-wizard-title" className="text-lg font-semibold text-slate-900">
          Importer : {config.title}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Sélectionnez un fichier CSV ou Excel (.xlsx) contenant les données à importer. Une seule feuille est prise en compte pour les fichiers Excel (la première).
            </p>
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-600 hover:file:bg-indigo-100"
            />
          </div>
        )}

        {step === 'map' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Fichier : <span className="font-medium">{fileName}</span> ({rawRows.length} ligne{rawRows.length !== 1 ? 's' : ''})
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pb-2 font-medium">Champ cible</th>
                  <th className="pb-2 font-medium">Colonne du fichier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {config.fieldDefs.map((field) => (
                  <tr key={field.key}>
                    <td className="py-2 pr-4">
                      {field.label}
                      {field.required && <span className="text-red-500"> *</span>}
                    </td>
                    <td className="py-2">
                      <select
                        value={mapping[field.key] ?? ''}
                        onChange={(e) => handleMappingChange(field.key, e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">— Ignorer —</option>
                        {headers.map((h, i) => (
                          <option key={i} value={i}>{h}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!requiredFieldsMapped && (
              <p className="text-sm text-amber-600">Tous les champs obligatoires (*) doivent être mappés.</p>
            )}
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <StatTile label="Lignes totales" value={parsedRows.length} />
              <StatTile label="Valides" value={validRows.length} />
              <StatTile label="En erreur" value={errorRows.length} tone={errorRows.length > 0 ? 'warn' : 'default'} />
            </div>

            {errorRows.length > 0 && (
              <>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={ignoreErrors} onChange={(e) => setIgnoreErrors(e.target.checked)} />
                  Ignorer les lignes en erreur et importer le reste
                </label>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr className="text-left text-slate-500">
                        <th className="px-3 py-2 font-medium">Ligne</th>
                        <th className="px-3 py-2 font-medium">Erreurs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {errorRows.map((row) => (
                        <tr key={row.index}>
                          <td className="px-3 py-2 text-slate-500">{row.index + 2}</td>
                          <td className="px-3 py-2 text-red-600">
                            {Object.entries(row.errors).map(([k, v]) => `${k} : ${v}`).join(' · ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {step === 'conflicts' && batchResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <StatTile label="Nouveaux" value={batchResult.inserts.length} />
              <StatTile label="Identiques (ignorés)" value={batchResult.identicalCount} />
              <StatTile label="Avec différences" value={batchResult.conflicts.length} tone="warn" />
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Pour chaque champ différent, choisissez la valeur à conserver.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => applyBulkResolution('current')}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Garder l'actuel
                </button>
                <button
                  type="button"
                  onClick={() => applyBulkResolution('imported')}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Garder l'import
                </button>
              </div>
            </div>

            <div className="max-h-96 space-y-2 overflow-y-auto">
              {batchResult.conflicts.map((c) => {
                const unresolvedCount = c.diffs.filter((d) => resolutions[c.index]?.[d.key] === undefined).length
                const name = [c.payloadBase.prenom, c.payloadBase.nom].filter(Boolean).join(' ')
                return (
                  <details key={c.index} className="group rounded-lg border border-amber-200 bg-amber-50/50">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 text-xs font-medium text-slate-600 transition-colors hover:bg-amber-100/60 [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center gap-2">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90"
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
                      <span className={unresolvedCount > 0 ? 'text-amber-700' : 'text-emerald-600'}>
                        {unresolvedCount > 0 ? `${unresolvedCount} à résoudre` : 'Résolu'}
                      </span>
                    </summary>
                    <div className="grid grid-cols-[minmax(8rem,auto)_1fr_1fr] items-center gap-x-3 gap-y-2 border-t border-amber-200 p-3 text-sm">
                      <div />
                      <button
                        type="button"
                        onClick={() => applyRowResolution(c.index, c.diffs.map((d) => d.key), 'current')}
                        className="text-left text-xs font-medium text-slate-500 underline decoration-dotted hover:text-slate-700"
                      >
                        Garder l'actuel
                      </button>
                      <button
                        type="button"
                        onClick={() => applyRowResolution(c.index, c.diffs.map((d) => d.key), 'imported')}
                        className="text-left text-xs font-medium text-slate-500 underline decoration-dotted hover:text-slate-700"
                      >
                        Garder l'import
                      </button>
                      {c.diffs.map((d) => (
                        <Fragment key={d.key}>
                          <span className="font-medium text-slate-700">{d.label}</span>
                          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                            <input
                              type="radio"
                              className="cursor-pointer"
                              name={`resolve-${c.index}-${d.key}`}
                              checked={resolutions[c.index]?.[d.key] === 'current'}
                              onChange={() => setResolutionForField(c.index, d.key, 'current')}
                            />
                            <span className="text-slate-600">{d.format(d.current)}</span>
                          </label>
                          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                            <input
                              type="radio"
                              className="cursor-pointer"
                              name={`resolve-${c.index}-${d.key}`}
                              checked={resolutions[c.index]?.[d.key] === 'imported'}
                              onChange={() => setResolutionForField(c.index, d.key, 'imported')}
                            />
                            <span className="text-slate-600">{d.format(d.imported)}</span>
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

        {step === 'confirm' && batchResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <StatTile label="Nouveaux" value={batchResult.inserts.length} />
              <StatTile label="Mis à jour" value={batchResult.conflicts.length} />
              <StatTile label="Identiques (ignorés)" value={batchResult.identicalCount} />
            </div>
            <p className="text-sm text-slate-600">
              {finalPayloadRows.length} ligne{finalPayloadRows.length !== 1 ? 's' : ''} prête{finalPayloadRows.length !== 1 ? 's' : ''} à être envoyée{finalPayloadRows.length !== 1 ? 's' : ''}.
            </p>
            {batchResult.excluded.length > 0 && (
              <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
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
              <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
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
        )}

        {step === 'running' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Import en cours…</p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-indigo-600 transition-all"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">{progress.done} / {progress.total}</p>
          </div>
        )}

        {step === 'done' && summary && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-4">
              <StatTile label="Créés" value={summary.created} />
              <StatTile label="Mis à jour" value={summary.updated} />
              <StatTile label="Ignorés" value={summary.skipped} tone={summary.skipped > 0 ? 'warn' : 'default'} />
            </div>
            {summary.chunkErrors.length > 0 && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
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
              <p className="text-sm text-slate-500">Import terminé. Ré-importer le même fichier plus tard est sans risque (les lignes déjà importées seront simplement mises à jour).</p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
        <div>
          {step === 'map' && (
            <button type="button" onClick={() => setStep('upload')} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Précédent
            </button>
          )}
          {step === 'preview' && (
            <button type="button" onClick={() => setStep('map')} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Précédent
            </button>
          )}
          {step === 'conflicts' && (
            <button type="button" onClick={() => setStep('preview')} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Précédent
            </button>
          )}
          {step === 'confirm' && (
            <button
              type="button"
              onClick={() => setStep(batchResult && batchResult.conflicts.length > 0 ? 'conflicts' : 'preview')}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Précédent
            </button>
          )}
        </div>
        <div className="flex gap-3">
          {step === 'map' && (
            <button
              type="button"
              onClick={handleGoToPreview}
              disabled={!requiredFieldsMapped}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              Suivant
            </button>
          )}
          {step === 'preview' && (
            <button
              type="button"
              onClick={handleGoToConflictsOrConfirm}
              disabled={preparing || (errorRows.length > 0 && !ignoreErrors) || (ignoreErrors ? validRows.length === 0 : parsedRows.length === 0)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {preparing ? 'Préparation…' : 'Suivant'}
            </button>
          )}
          {step === 'conflicts' && (
            <button
              type="button"
              onClick={handleGoToConfirmFromConflicts}
              disabled={!allConflictsResolved}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              Suivant
            </button>
          )}
          {step === 'confirm' && (
            <button
              type="button"
              onClick={handleRunImport}
              disabled={finalPayloadRows.length === 0}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              Lancer l'import
            </button>
          )}
          {step === 'done' && (
            <button type="button" onClick={onClose} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              Fermer
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

function StatTile({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'warn' }) {
  return (
    <div className={`rounded-lg border px-4 py-3 ${tone === 'warn' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-semibold ${tone === 'warn' ? 'text-amber-700' : 'text-slate-900'}`}>{value}</p>
    </div>
  )
}
