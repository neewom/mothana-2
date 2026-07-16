import { generateUUID } from '../uuid'
import type { ConflictRow, ExcludedRow, FieldDef, ParsedRow } from './types'
import type { ExistingRef } from './prefetch'
import { participantsFieldDefs, activitesFieldDefs, donsFieldDefs } from './fieldDefs'

export interface BuildBatchResult {
  /** Nouvelles lignes, prêtes à envoyer telles quelles. */
  inserts: Record<string, unknown>[]
  /** Lignes correspondant à un id_externe existant, avec des champs différents : nécessitent une résolution. */
  conflicts: ConflictRow[]
  /** Lignes correspondant à un id_externe existant, strictement identiques (sur les champs mappés) : ignorées. */
  identicalCount: number
  /** Lignes non envoyées du tout (ex : don dont le participant ne résout pas). */
  excluded: ExcludedRow[]
  /** Lignes envoyées mais avec une particularité à signaler (ex : don sans activité résolue). */
  warnings: ExcludedRow[]
}

function mappedKeySet(mapping: Record<string, number | null>): Set<string> {
  return new Set(Object.keys(mapping).filter((k) => mapping[k] !== null && mapping[k] !== undefined))
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return (a ?? null) === (b ?? null)
}

/** Compare les champs mappés (hors id_externe) entre les valeurs actuelles et importées. */
function diffMappedFields(
  fieldDefs: FieldDef[],
  mappedKeys: Set<string>,
  currentValues: Record<string, unknown>,
  importedValues: Record<string, unknown>
) {
  const diffs: ConflictRow['diffs'] = []
  for (const field of fieldDefs) {
    if (field.key === 'id_externe' || !mappedKeys.has(field.key)) continue
    const current = currentValues[field.key] ?? null
    const imported = importedValues[field.key] ?? null
    if (!valuesEqual(current, imported)) {
      diffs.push({
        key: field.key,
        label: field.label,
        current,
        imported,
        format: field.formatValue ?? ((v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v))),
      })
    }
  }
  return diffs
}

const PARTICIPANT_FIELD_KEYS = [
  'nom', 'prenom', 'civilite', 'email', 'telephone',
  'adresse', 'code_postal', 'ville', 'pays', 'nom2', 'prenom2', 'notes',
]

export function buildParticipantsBatch(
  rows: ParsedRow[],
  mapping: Record<string, number | null>,
  existing: Map<string, ExistingRef>
): BuildBatchResult {
  const mappedKeys = mappedKeySet(mapping)
  const inserts: Record<string, unknown>[] = []
  const conflicts: ConflictRow[] = []
  let identicalCount = 0

  for (const row of rows) {
    const idExterne = (row.values.id_externe as string | null) ?? null
    const match = idExterne ? existing.get(idExterne) : undefined
    const personneId = match?.personneId ?? generateUUID()
    const profilId = match?.id ?? generateUUID()

    const payloadBase: Record<string, unknown> = { personne_id: personneId, profil_id: profilId, id_externe: idExterne }
    for (const key of PARTICIPANT_FIELD_KEYS) {
      payloadBase[key] = mappedKeys.has(key) ? (row.values[key] ?? null) : (match ? (match.values[key] ?? null) : null)
    }

    if (!match) {
      inserts.push(payloadBase)
      continue
    }

    const diffs = diffMappedFields(participantsFieldDefs, mappedKeys, match.values, row.values)
    if (diffs.length === 0) {
      identicalCount++
    } else {
      conflicts.push({ index: row.index, idExterne, payloadBase, diffs })
    }
  }

  return { inserts, conflicts, identicalCount, excluded: [], warnings: [] }
}

const ACTIVITE_FIELD_KEYS = ['nom', 'date_debut', 'date_fin']

export function buildActivitesBatch(
  rows: ParsedRow[],
  mapping: Record<string, number | null>,
  existing: Map<string, ExistingRef>
): BuildBatchResult {
  const mappedKeys = mappedKeySet(mapping)
  const inserts: Record<string, unknown>[] = []
  const conflicts: ConflictRow[] = []
  let identicalCount = 0

  for (const row of rows) {
    const idExterne = (row.values.id_externe as string | null) ?? null
    const match = idExterne ? existing.get(idExterne) : undefined
    const id = match?.id ?? generateUUID()

    const payloadBase: Record<string, unknown> = { id, id_externe: idExterne }
    for (const key of ACTIVITE_FIELD_KEYS) {
      payloadBase[key] = mappedKeys.has(key) ? (row.values[key] ?? null) : (match ? (match.values[key] ?? null) : null)
    }

    if (!match) {
      inserts.push(payloadBase)
      continue
    }

    const diffs = diffMappedFields(activitesFieldDefs, mappedKeys, match.values, row.values)
    if (diffs.length === 0) {
      identicalCount++
    } else {
      conflicts.push({ index: row.index, idExterne, payloadBase, diffs })
    }
  }

  return { inserts, conflicts, identicalCount, excluded: [], warnings: [] }
}

// Seuls ces champs participent à la détection de conflit pour les dons
// (les identifiants externes participant/activité ont leur propre résolution FK ci-dessus).
const DON_COMPARABLE_KEYS = new Set(['montant', 'date', 'mode_paiement'])
const DON_COMPARABLE_FIELD_DEFS: FieldDef[] = donsFieldDefs.filter((f) => DON_COMPARABLE_KEYS.has(f.key))

export function buildDonsBatch(
  rows: ParsedRow[],
  mapping: Record<string, number | null>,
  existingDons: Map<string, ExistingRef>,
  existingParticipants: Map<string, ExistingRef>,
  existingActivites: Map<string, ExistingRef>
): BuildBatchResult {
  const mappedKeys = mappedKeySet(mapping)
  const inserts: Record<string, unknown>[] = []
  const conflicts: ConflictRow[] = []
  const excluded: ExcludedRow[] = []
  const warnings: ExcludedRow[] = []
  let identicalCount = 0

  for (const row of rows) {
    const idExterne = (row.values.id_externe as string | null) ?? null
    const participantIdExterne = row.values.participant_id_externe as string
    const activiteIdExterne = (row.values.activite_id_externe as string | null) ?? null

    const participant = existingParticipants.get(participantIdExterne)
    if (!participant) {
      excluded.push({
        index: row.index,
        reason: `Participant introuvable pour l'identifiant externe "${participantIdExterne}"`,
      })
      continue
    }

    const match = idExterne ? existingDons.get(idExterne) : undefined
    const id = match?.id ?? generateUUID()

    let activiteId: string | null = match ? (match.values.activite_id as string | null) ?? null : null
    if (mappedKeys.has('activite_id_externe')) {
      if (activiteIdExterne) {
        const activite = existingActivites.get(activiteIdExterne)
        if (!activite) {
          warnings.push({
            index: row.index,
            reason: `Activité introuvable pour l'identifiant externe "${activiteIdExterne}" — don importé sans activité rattachée`,
          })
          activiteId = null
        } else {
          activiteId = activite.id
        }
      } else {
        activiteId = null
      }
    }

    const payloadBase: Record<string, unknown> = {
      id,
      id_externe: idExterne,
      profil_participant_id: participant.id,
      activite_id: activiteId,
      montant: mappedKeys.has('montant') ? row.values.montant : (match ? match.values.montant : null),
      date: mappedKeys.has('date') ? row.values.date : (match ? match.values.date : null),
      mode_paiement: mappedKeys.has('mode_paiement') ? row.values.mode_paiement : (match ? match.values.mode_paiement : null),
    }

    if (!match) {
      inserts.push(payloadBase)
      continue
    }

    const diffs = diffMappedFields(DON_COMPARABLE_FIELD_DEFS, mappedKeys, match.values, row.values)
    if (diffs.length === 0) {
      identicalCount++
    } else {
      conflicts.push({ index: row.index, idExterne, payloadBase, diffs })
    }
  }

  return { inserts, conflicts, identicalCount, excluded, warnings }
}
