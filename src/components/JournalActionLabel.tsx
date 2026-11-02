import type { JournalModification } from '../types'
import {
  ACTION_LABELS,
  describeJournalEntry,
  libelleTableCible,
  formatDiffLines,
  type ActionJournal,
  type ChampsModifies,
} from '../lib/journalModifications'
import Tooltip from './Tooltip'

interface JournalActionLabelProps {
  entry: JournalModification
  // Masquables quand le contexte identifie déjà la ligne concernée (ex : historique d'un adhérent précis).
  showTable?: boolean
  showName?: boolean
}

export default function JournalActionLabel({ entry, showTable = true, showName = true }: JournalActionLabelProps) {
  const actionLabel = ACTION_LABELS[entry.action as ActionJournal] ?? entry.action
  const champsModifies = entry.details?.champs_modifies as ChampsModifies | undefined
  const diffLines = entry.action === 'modification' && champsModifies ? formatDiffLines(champsModifies) : []

  return (
    <>
      {diffLines.length > 0 ? (
        <Tooltip triggerClassName="font-medium text-ink" content={diffLines.join('\n')}>
          {actionLabel}
        </Tooltip>
      ) : (
        <span className="font-medium text-ink">{actionLabel}</span>
      )}
      {showTable && (
        <span className="text-ink-faint"> · {libelleTableCible(entry)}</span>
      )}
      {showName && <span className="text-ink-faint"> — {describeJournalEntry(entry)}</span>}
    </>
  )
}
