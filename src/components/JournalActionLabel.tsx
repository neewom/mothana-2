import type { JournalModification } from '../types'
import {
  ACTION_LABELS,
  TABLE_CIBLE_LABELS,
  describeJournalEntry,
  formatDiffLines,
  type ActionJournal,
  type TableCibleJournal,
  type ChampsModifies,
} from '../lib/journalModifications'
import Tooltip from './Tooltip'

interface JournalActionLabelProps {
  entry: JournalModification
}

export default function JournalActionLabel({ entry }: JournalActionLabelProps) {
  const actionLabel = ACTION_LABELS[entry.action as ActionJournal] ?? entry.action
  const champsModifies = entry.details?.champs_modifies as ChampsModifies | undefined
  const diffLines = entry.action === 'modification' && champsModifies ? formatDiffLines(champsModifies) : []

  return (
    <>
      {diffLines.length > 0 ? (
        <Tooltip triggerClassName="font-medium text-slate-900" content={diffLines.join('\n')}>
          {actionLabel}
        </Tooltip>
      ) : (
        <span className="font-medium text-slate-900">{actionLabel}</span>
      )}
      <span className="text-slate-400"> · {TABLE_CIBLE_LABELS[entry.table_cible as TableCibleJournal] ?? entry.table_cible}</span>
      <span className="text-slate-500"> — {describeJournalEntry(entry)}</span>
    </>
  )
}
