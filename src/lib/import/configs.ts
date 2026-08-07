import type { FieldDef, ImportEntityKey, ParsedRow } from './types'
import { participantsFieldDefs, activitesFieldDefs, donsFieldDefs, adherentsFieldDefs } from './fieldDefs'
import { fetchExistingParticipants, fetchExistingActivites, fetchExistingDons, fetchExistingAdherents } from './prefetch'
import { buildParticipantsBatch, buildActivitesBatch, buildDonsBatch, buildAdherentsBatch, type BuildBatchResult } from './buildBatch'

export type PreparedBatch = BuildBatchResult

export interface ImportConfig {
  entity: ImportEntityKey
  title: string
  fieldDefs: FieldDef[]
  rpcName: string
  prepareBatch: (rows: ParsedRow[], mapping: Record<string, number | null>, organisationId: string) => Promise<PreparedBatch>
  /**
   * Ajustement optionnel post-parsing, pour une dépendance entre deux
   * colonnes que le parsing champ par champ ne peut pas exprimer (chaque
   * FieldDef.parse ne voit que sa propre cellule). Appelé sur chaque ligne
   * juste après buildParsedRows.
   */
  postProcessRow?: (row: ParsedRow) => ParsedRow
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

export const adherentsImportConfig: ImportConfig = {
  entity: 'adherents',
  title: 'Adhérents',
  fieldDefs: adherentsFieldDefs,
  rpcName: 'import_upsert_adherents',
  prepareBatch: async (rows, mapping, organisationId) => {
    const { byIdExterne, all } = await fetchExistingAdherents(organisationId)
    return buildAdherentsBatch(rows, mapping, byIdExterne, all)
  },
  // Sans cotisation (montant nul ou à 0), le mode de paiement n'a pas de
  // sens — on ignore toute erreur de parsing dessus plutôt que de bloquer
  // la ligne pour une colonne devenue non pertinente.
  postProcessRow: (row) => {
    if (row.values.montant_cotisation) return row
    if (!('mode_paiement' in row.errors)) return row
    const restErrors = { ...row.errors }
    delete restErrors.mode_paiement
    return { ...row, errors: restErrors, values: { ...row.values, mode_paiement: null } }
  },
}
