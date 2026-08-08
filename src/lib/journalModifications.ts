import { supabase } from './supabaseClient'
import type { JournalModification } from '../types'

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
