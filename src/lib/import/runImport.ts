import { supabase } from '../supabaseClient'

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

interface RpcResult {
  created?: number
  updated?: number
  skipped?: number
}

export async function runImport(
  rpcName: string,
  payloadRows: Record<string, unknown>[],
  onProgress?: (done: number, total: number) => void
): Promise<ImportSummary> {
  const summary: ImportSummary = { created: 0, updated: 0, skipped: 0, chunkErrors: [] }
  const total = payloadRows.length

  for (let i = 0; i < payloadRows.length; i += IMPORT_CHUNK_SIZE) {
    const chunk = payloadRows.slice(i, i + IMPORT_CHUNK_SIZE)
    const chunkIndex = i / IMPORT_CHUNK_SIZE

    const { data, error } = await supabase.rpc(rpcName, { payload: chunk })

    if (error) {
      summary.chunkErrors.push({ chunkIndex, rowRange: [i, i + chunk.length - 1], message: error.message })
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
