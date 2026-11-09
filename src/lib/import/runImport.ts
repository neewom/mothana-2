import { supabase } from '../supabaseClient'
import { activiteDbErrorMessage } from '../activiteDates'

const IMPORT_CHUNK_SIZE = 500

export interface ChunkError {
  chunkIndex: number
  rowRange: [number, number]
  message: string
}

export interface ImportSummary {
  created: number
  updated: number
  skipped: number
  chunkErrors: ChunkError[]
}

/**
 * Tri stable : lignes portant un id_externe d'abord, celles sans numéro ensuite
 * (ordre relatif conservé dans chaque groupe). Les donateurs sans numéro
 * reçoivent en base le prochain numéro libre (trigger
 * profils_participant_attribuer_id_externe) : envoyés avant une ligne qui
 * porte justement ce numéro, ils le prendraient et la contrainte d'unicité
 * rejetterait tout le lot de cette ligne. Sans effet pour les entités sans
 * attribution automatique.
 */
export function orderRowsWithIdExterneFirst(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const hasIdExterne = (row: Record<string, unknown>) =>
    typeof row.id_externe === 'string' ? row.id_externe.trim() !== '' : row.id_externe != null
  return [...rows.filter(hasIdExterne), ...rows.filter((row) => !hasIdExterne(row))]
}

interface RpcResult {
  created?: number
  updated?: number
  skipped?: number
}

export async function runImport(
  rpcName: string,
  payloadRows: Record<string, unknown>[],
  organisationId: string,
  onProgress?: (done: number, total: number) => void
): Promise<ImportSummary> {
  const summary: ImportSummary = { created: 0, updated: 0, skipped: 0, chunkErrors: [] }
  const orderedRows = orderRowsWithIdExterneFirst(payloadRows)
  const total = orderedRows.length

  for (let i = 0; i < orderedRows.length; i += IMPORT_CHUNK_SIZE) {
    const chunk = orderedRows.slice(i, i + IMPORT_CHUNK_SIZE)
    const chunkIndex = i / IMPORT_CHUNK_SIZE

    // p_organisation_id : ignoré côté serveur sauf pour un super-admin sans
    // profils_organisation (mode "Consulter"), cf. resolveOrganisationId /
    // is_current_user_super_admin.
    const { data, error } = await supabase.rpc(rpcName, { payload: chunk, p_organisation_id: organisationId })

    if (error) {
      summary.chunkErrors.push({ chunkIndex, rowRange: [i, i + chunk.length - 1], message: activiteDbErrorMessage(error.message) })
    } else {
      const result = data as RpcResult
      summary.created += result?.created ?? 0
      summary.updated += result?.updated ?? 0
      summary.skipped += result?.skipped ?? 0
    }

    onProgress?.(Math.min(i + chunk.length, total), total)
  }

  return summary
}
