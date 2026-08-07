import { generateUUID } from '../uuid'
import type { ConflictRow, ExcludedRow, FieldDef, ParsedRow } from './types'
import type { ExistingRef, ExistingAdherentRef } from './prefetch'
import { participantsFieldDefs, activitesFieldDefs, donsFieldDefs, adherentsFieldDefs } from './fieldDefs'

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

// Champs stables (adherents) — seuls ceux-ci participent à la détection de
// conflit classique (garder l'actuel / garder l'import). Les champs de cycle
// (adhesions) ne sont jamais un conflit : les deux valeurs sont légitimes à
// des dates différentes, voir ADHESION_CYCLE_KEYS ci-dessous.
const ADHERENT_IDENTITY_KEYS = [
  'civilite', 'nom', 'prenom', 'date_naissance',
  'adresse', 'code_postal', 'ville', 'telephone', 'courriel',
]
const ADHERENT_IDENTITY_FIELD_DEFS: FieldDef[] = adherentsFieldDefs.filter((f) => ADHERENT_IDENTITY_KEYS.includes(f.key))

const ADHESION_CYCLE_KEYS = [
  'date_debut', 'montant_cotisation', 'date_paiement_cotisation',
  'mode_paiement', 'droit_vote_ag', 'bulletin_signe',
] as const

function cycleFieldsEqual(latest: Record<string, unknown> | null, imported: Record<string, unknown>): boolean {
  if (!latest) return false
  return ADHESION_CYCLE_KEYS.every((key) => valuesEqual(latest[key], imported[key]))
}

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function sameNormalized(a: unknown, b: unknown): boolean {
  return normalize(a) === normalize(b)
}

// Index de recherche de doublon (nom+prénom / email / téléphone), même
// sémantique que src/lib/adherentDuplicateCheck.ts (réutilisée à la
// ratification des demandes d'adhésion) : n'importe lequel des 3 signaux
// suffit à remonter un candidat, avec sa raison pour l'affichage.
interface AdherentDuplicateIndex {
  byNamePrenom: Map<string, ExistingAdherentRef[]>
  byEmail: Map<string, ExistingAdherentRef[]>
  byTelephone: Map<string, ExistingAdherentRef[]>
}

function pushIndexed<K>(map: Map<K, ExistingAdherentRef[]>, key: K, ref: ExistingAdherentRef) {
  const list = map.get(key)
  if (list) list.push(ref)
  else map.set(key, [ref])
}

function buildAdherentDuplicateIndex(all: ExistingAdherentRef[]): AdherentDuplicateIndex {
  const byNamePrenom = new Map<string, ExistingAdherentRef[]>()
  const byEmail = new Map<string, ExistingAdherentRef[]>()
  const byTelephone = new Map<string, ExistingAdherentRef[]>()
  for (const ref of all) {
    const nom = normalize(ref.values.nom)
    const prenom = normalize(ref.values.prenom)
    if (nom && prenom) pushIndexed(byNamePrenom, `${nom}|${prenom}`, ref)
    const email = normalize(ref.values.courriel)
    if (email) pushIndexed(byEmail, email, ref)
    const telephone = normalize(ref.values.telephone)
    if (telephone) pushIndexed(byTelephone, telephone, ref)
  }
  return { byNamePrenom, byEmail, byTelephone }
}

function findAdherentDuplicate(
  index: AdherentDuplicateIndex,
  values: Record<string, unknown>
): { ref: ExistingAdherentRef; raisons: string[] } | undefined {
  const found = new Map<string, { ref: ExistingAdherentRef; raisons: string[] }>()

  function record(ref: ExistingAdherentRef, raison: string) {
    const entry = found.get(ref.id) ?? { ref, raisons: [] }
    entry.raisons.push(raison)
    found.set(ref.id, entry)
  }

  const nom = normalize(values.nom)
  const prenom = normalize(values.prenom)
  if (nom && prenom) {
    for (const ref of index.byNamePrenom.get(`${nom}|${prenom}`) ?? []) record(ref, 'nom et prénom identiques')
  }
  const email = normalize(values.courriel)
  if (email) {
    for (const ref of index.byEmail.get(email) ?? []) record(ref, 'email identique')
  }
  const telephone = normalize(values.telephone)
  if (telephone) {
    for (const ref of index.byTelephone.get(telephone) ?? []) record(ref, 'téléphone identique')
  }

  return found.values().next().value
}

export function buildAdherentsBatch(
  rows: ParsedRow[],
  mapping: Record<string, number | null>,
  existingByIdExterne: Map<string, ExistingAdherentRef>,
  existingAll: ExistingAdherentRef[]
): BuildBatchResult {
  const mappedKeys = mappedKeySet(mapping)
  const inserts: Record<string, unknown>[] = []
  const conflicts: ConflictRow[] = []
  const warnings: ExcludedRow[] = []
  let identicalCount = 0
  const duplicateIndex = buildAdherentDuplicateIndex(existingAll)

  for (const row of rows) {
    const idExterne = (row.values.id_externe as string | null) ?? null
    const idExterneMatch = idExterne ? existingByIdExterne.get(idExterne) : undefined

    let match: ExistingAdherentRef | undefined = idExterneMatch
    let sensitive: ConflictRow['sensitive']

    if (idExterneMatch) {
      // Même id_externe, mais nom ET prénom différents : probable collision
      // entre deux personnes plutôt qu'une simple correction de données.
      const nomDiffers = !sameNormalized(row.values.nom, idExterneMatch.values.nom)
      const prenomDiffers = !sameNormalized(row.values.prenom, idExterneMatch.values.prenom)
      if (nomDiffers && prenomDiffers) {
        const importedName = [row.values.prenom, row.values.nom].filter(Boolean).join(' ') || '—'
        const existingName = [idExterneMatch.values.prenom, idExterneMatch.values.nom].filter(Boolean).join(' ') || '—'
        sensitive = {
          kind: 'collision',
          reason: `id_externe "${idExterne}" déjà utilisé par ${existingName}, mais cette ligne importée concerne apparemment ${importedName} — collision possible entre deux personnes différentes.`,
        }
      }
    } else {
      // Pas de match par id_externe : cherche un doublon probable (même
      // personne saisie à la main puis réimportée sous un autre numéro).
      const dup = findAdherentDuplicate(duplicateIndex, row.values)
      if (dup) {
        match = dup.ref
        sensitive = {
          kind: 'duplicate',
          reason: `Un adhérent existant (id_externe ${dup.ref.idExterne ?? '—'}) partage : ${dup.raisons.join(', ')} — probable doublon de la même personne plutôt qu'une nouvelle fiche.`,
        }
      }
    }

    const adherentId = match?.id ?? generateUUID()

    const payloadBase: Record<string, unknown> = { adherent_id: adherentId, id_externe: idExterne }
    for (const key of ADHERENT_IDENTITY_KEYS) {
      payloadBase[key] = mappedKeys.has(key) ? (row.values[key] ?? null) : (match ? (match.values[key] ?? null) : null)
    }

    const importedCycle: Record<string, unknown> = {}
    for (const key of ADHESION_CYCLE_KEYS) importedCycle[key] = row.values[key] ?? null

    const isNewCycle = !match || !cycleFieldsEqual(match.latestAdhesion, importedCycle)
    if (isNewCycle) {
      payloadBase.adhesion_id = generateUUID()
      payloadBase.renouvellement = !!match
      Object.assign(payloadBase, importedCycle)
    } else {
      payloadBase.adhesion_id = null
      payloadBase.renouvellement = false
      payloadBase.date_debut = null
      payloadBase.montant_cotisation = null
      payloadBase.date_paiement_cotisation = null
      payloadBase.mode_paiement = null
      payloadBase.droit_vote_ag = null
      payloadBase.bulletin_signe = null
      if (!sensitive) warnings.push({ index: row.index, reason: 'Adhésion déjà à jour — aucun nouveau cycle créé' })
    }

    if (!match) {
      inserts.push(payloadBase)
      continue
    }

    const diffs = diffMappedFields(ADHERENT_IDENTITY_FIELD_DEFS, mappedKeys, match.values, row.values)

    if (diffs.length === 0 && !sensitive) {
      identicalCount++
      continue
    }

    let createNewPayload: Record<string, unknown> | undefined
    if (sensitive) {
      // Payload alternatif prêt à insérer comme adhérent distinct, si l'admin
      // choisit "Créer un nouvel adhérent" plutôt que de fusionner avec `match`.
      // Cycle toujours traité comme un premier cycle (jamais un renouvellement),
      // vu que `match` n'a en réalité aucun lien avec cette ligne importée.
      const altId = generateUUID()
      const alt: Record<string, unknown> = {
        adherent_id: altId,
        // collision : l'id_externe importé est déjà pris par `match`, un
        // nouveau sera généré (next_adherent_id_externe) au moment du choix.
        // duplicate : rien ne le retient, l'id_externe importé est libre.
        id_externe: sensitive.kind === 'collision' ? null : idExterne,
      }
      for (const key of ADHERENT_IDENTITY_KEYS) {
        alt[key] = mappedKeys.has(key) ? (row.values[key] ?? null) : null
      }
      alt.adhesion_id = generateUUID()
      alt.renouvellement = false
      Object.assign(alt, importedCycle)
      createNewPayload = alt
    }

    conflicts.push({ index: row.index, idExterne, payloadBase, diffs, sensitive, createNewPayload })
  }

  return { inserts, conflicts, identicalCount, excluded: [], warnings }
}
