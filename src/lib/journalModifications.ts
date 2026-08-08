import { supabase } from './supabaseClient'
import type { CiviliteAdherent, JournalModification } from '../types'
import { CIVILITE_ADHERENT_LABELS } from './civiliteAdherent'

export type TableCibleJournal = 'adherents' | 'demandes_adhesion'
export type ActionJournal = 'creation' | 'modification' | 'archivage' | 'reactivation' | 'ratification' | 'refus'

export const TABLE_CIBLE_LABELS: Record<TableCibleJournal, string> = {
  adherents: 'Adhérent',
  demandes_adhesion: "Demande d'adhésion",
}

export const ACTION_LABELS: Record<ActionJournal, string> = {
  creation: 'Création',
  modification: 'Modification',
  archivage: 'Archivage',
  reactivation: 'Réactivation',
  ratification: 'Ratification',
  refus: 'Refus',
}

// N'interrompt jamais l'action métier principale en cas d'échec : le log est un aspect secondaire.
export async function logModification(params: {
  organisationId: string
  tableCible: TableCibleJournal
  ligneId: string
  action: ActionJournal
  details?: Record<string, unknown>
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('journal_modifications').insert({
    organisation_id: params.organisationId,
    table_cible: params.tableCible,
    ligne_id: params.ligneId,
    action: params.action,
    details: params.details ?? null,
    auteur_id: user?.id ?? null,
  })
  if (error) {
    console.error('Échec de journalisation', error)
  }
}

export function describeJournalEntry(entry: JournalModification): string {
  const nom = entry.details?.nom
  const prenom = entry.details?.prenom
  return [prenom, nom].filter(Boolean).join(' ') || '—'
}

// Diff des champs adhérent — comparé au moment de la modification dans AdherentModal,
// où l'objet avant (`adherent`) et après (`identite`) sont tous les deux déjà en mémoire.
export const ADHERENT_FIELD_LABELS: Record<string, string> = {
  civilite: 'Civilité',
  nom: 'Nom',
  prenom: 'Prénom',
  date_naissance: 'Date de naissance',
  adresse: 'Adresse',
  code_postal: 'Code postal',
  ville: 'Ville',
  pays: 'Pays',
  telephone: 'Téléphone',
  courriel: 'Courriel',
}

export type ChampsModifies = Record<string, { avant: unknown; apres: unknown }>

export function computeAdherentDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): ChampsModifies | undefined {
  const diff: ChampsModifies = {}
  for (const key of Object.keys(ADHERENT_FIELD_LABELS)) {
    const avant = before[key] ?? null
    const apres = after[key] ?? null
    if (avant !== apres) {
      diff[key] = { avant, apres }
    }
  }
  return Object.keys(diff).length > 0 ? diff : undefined
}

function formatDiffValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (field === 'civilite') return CIVILITE_ADHERENT_LABELS[value as CiviliteAdherent] ?? String(value)
  if (field === 'date_naissance' && typeof value === 'string') {
    return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  return String(value)
}

export function formatDiffLines(champsModifies: ChampsModifies): string[] {
  return Object.entries(champsModifies).map(([field, { avant, apres }]) => {
    const label = ADHERENT_FIELD_LABELS[field] ?? field
    return `${label} : ${formatDiffValue(field, avant)} → ${formatDiffValue(field, apres)}`
  })
}

export async function fetchJournalModifications(
  organisationId: string,
  limit: number,
  offset: number,
): Promise<{ entries: JournalModification[]; totalCount: number }> {
  const { data, error } = await supabase.rpc('list_journal_modifications', {
    p_organisation_id: organisationId,
    p_limit: limit,
    p_offset: offset,
  })

  if (error) throw error

  const rows = (data ?? []) as (JournalModification & { total_count: number })[]
  return {
    entries: rows,
    totalCount: rows[0]?.total_count ?? 0,
  }
}

// Historique d'une ligne précise (ex : un adhérent) — affiché dans sa modale de détail,
// pas de pagination nécessaire pour ce volume (une seule ligne source).
export async function fetchJournalModificationsForLigne(
  organisationId: string,
  tableCible: TableCibleJournal,
  ligneId: string,
): Promise<JournalModification[]> {
  const { data, error } = await supabase.rpc('list_journal_modifications', {
    p_organisation_id: organisationId,
    p_limit: 50,
    p_offset: 0,
    p_table_cible: tableCible,
    p_ligne_id: ligneId,
  })

  if (error) throw error

  return (data ?? []) as JournalModification[]
}
