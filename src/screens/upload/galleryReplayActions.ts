import { SolvedGalleryEntry } from '../../types/index'
import { formatDifficultyLabel } from '../../utils/puzzleDifficulty.ts'
import type { GalleryDisplayEntry } from './UploadGalleryDisplayUtils.ts'
import { formatDate, formatTime } from './uploadUtils.ts'

export interface GalleryReplayAction {
  id: 'current' | 'latest-replayable' | 'best-time' | 'best-clean-time' | 'best-moves'
  label: string
  entry: SolvedGalleryEntry
  summary: string
  description: string
}

function isReplayableEntry(entry: SolvedGalleryEntry | null | undefined): entry is SolvedGalleryEntry {
  return Boolean(entry && (entry.sourceImage ?? entry.previewImage))
}

function createReplaySummary(entry: SolvedGalleryEntry): string {
  return `${formatDifficultyLabel(entry.config)}, ${formatTime(entry.time)}, ${entry.moves} Netto`
}

export function getGalleryReplayActions(entry: GalleryDisplayEntry): GalleryReplayAction[] {
  const actions: GalleryReplayAction[] = []
  const seenEntryIds = new Set<string>()
  const representativeEntry = entry.representativeEntry
  const motifReplaySummary = entry.motifReplaySummary

  const pushAction = (
    id: GalleryReplayAction['id'],
    label: string,
    targetEntry: SolvedGalleryEntry | null | undefined,
    description: string
  ) => {
    if (!isReplayableEntry(targetEntry) || seenEntryIds.has(targetEntry.id)) {
      return
    }

    seenEntryIds.add(targetEntry.id)
    actions.push({
      id,
      label,
      entry: targetEntry,
      summary: createReplaySummary(targetEntry),
      description,
    })
  }

  if (isReplayableEntry(representativeEntry)) {
    pushAction(
      'current',
      'Nochmal spielen',
      representativeEntry,
      `Startet genau den angezeigten Lauf vom ${formatDate(representativeEntry.completedAt)} erneut.`
    )
  } else {
    pushAction(
      'latest-replayable',
      'Letzten Replay-Lauf',
      motifReplaySummary.lastReplayableEntry,
      motifReplaySummary.lastReplayableEntry
        ? `Startet den juengsten noch spielbaren Lauf vom ${formatDate(motifReplaySummary.lastReplayableEntry.completedAt)}.`
        : ''
    )
  }

  pushAction(
    'best-time',
    'Bestzeit spielen',
    motifReplaySummary.bestTimeEntry,
    motifReplaySummary.bestTimeEntry
      ? `Startet den Lauf vom ${formatDate(motifReplaySummary.bestTimeEntry.completedAt)} mit motivweiter Bestzeit ${formatTime(motifReplaySummary.bestTimeEntry.time)}.`
      : ''
  )

  pushAction(
    'best-clean-time',
    'Clean spielen',
    motifReplaySummary.bestCleanTimeEntry,
    motifReplaySummary.bestCleanTimeEntry
      ? `Startet den schnellsten cleanen Lauf vom ${formatDate(motifReplaySummary.bestCleanTimeEntry.completedAt)} auf ${formatDifficultyLabel(motifReplaySummary.bestCleanTimeEntry.config)}.`
      : ''
  )

  pushAction(
    'best-moves',
    'Bestweg spielen',
    motifReplaySummary.bestMovesEntry,
    motifReplaySummary.bestMovesEntry
      ? `Startet den Lauf vom ${formatDate(motifReplaySummary.bestMovesEntry.completedAt)} mit ${motifReplaySummary.bestMovesEntry.moves} Netto-Zuegen.`
      : ''
  )

  return actions
}
