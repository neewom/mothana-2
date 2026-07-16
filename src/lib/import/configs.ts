import type { FieldDef, ImportEntityKey, ParsedRow } from './types'
import { participantsFieldDefs, activitesFieldDefs, donsFieldDefs } from './fieldDefs'
import { fetchExistingParticipants, fetchExistingActivites, fetchExistingDons } from './prefetch'
import { buildParticipantsBatch, buildActivitesBatch, buildDonsBatch, type BuildBatchResult } from './buildBatch'

export type PreparedBatch = BuildBatchResult

export interface ImportConfig {
  entity: ImportEntityKey
  title: string
  fieldDefs: FieldDef[]
  rpcName: string
  prepareBatch: (rows: ParsedRow[], mapping: Record<string, number | null>, organisationId: string) => Promise<PreparedBatch>
}

export const participantsImportConfig: ImportConfig = {
  entity: 'participants',
  title: 'Participants',
  fieldDefs: participantsFieldDefs,
  rpcName: 'import_upsert_participants',
  prepareBatch: async (rows, mapping, organisationId) => {
    const existing = await fetchExistingParticipants(organisationId)
    return buildParticipantsBatch(rows, mapping, existing)
  },
}

export const activitesImportConfig: ImportConfig = {
  entity: 'activites',
  title: 'Activités',
  fieldDefs: activitesFieldDefs,
  rpcName: 'import_upsert_activites',
  prepareBatch: async (rows, mapping, organisationId) => {
    const existing = await fetchExistingActivites(organisationId)
    return buildActivitesBatch(rows, mapping, existing)
  },
}

export const donsImportConfig: ImportConfig = {
  entity: 'dons',
  title: 'Dons',
  fieldDefs: donsFieldDefs,
  rpcName: 'import_upsert_dons',
  prepareBatch: async (rows, mapping, organisationId) => {
    const [existingDons, existingParticipants, existingActivites] = await Promise.all([
      fetchExistingDons(organisationId),
      fetchExistingParticipants(organisationId),
      fetchExistingActivites(organisationId),
    ])
    return buildDonsBatch(rows, mapping, existingDons, existingParticipants, existingActivites)
  },
}
