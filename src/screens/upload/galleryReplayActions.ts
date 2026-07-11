import { SolvedGalleryEntry } from '../../types/index'
import {
  hasGalleryChallengeSetup,
  isGalleryChallengeTargetEligible,
} from '../../utils/galleryReplaySetup.ts'
import { formatDifficultyLabel } from '../../utils/puzzleDifficulty.ts'
import type { GalleryDisplayEntry } from './UploadGalleryDisplayUtils.ts'
import { formatDate, formatTime } from './uploadUtils.ts'

export interface GalleryReplayAction {
  id: 'current' | 'latest-replayable'
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

function createReplayDescription(entry: SolvedGalleryEntry, fallback: string): string {
  if (!hasGalleryChallengeSetup(entry)) return fallback

  return isGalleryChallengeTargetEligible(entry)
    ? `Startet die cleane Medaillen-Vorlage vom ${formatDate(entry.completedAt)} erneut.`
    : `Wiederholt den gespeicherten Startzustand vom ${formatDate(entry.completedAt)} als Übung ohne Medaille.`
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
      'Spielen',
      representativeEntry,
      createReplayDescription(
        representativeEntry,
        `Startet das Motiv vom ${formatDate(representativeEntry.completedAt)} mit gespeicherter Stufe${representativeEntry.cropTransform ? ' und gespeichertem Ausschnitt' : ''} neu.`
      )
    )
  } else {
    pushAction(
      'latest-replayable',
      'Spielen',
      motifReplaySummary.lastReplayableEntry,
      motifReplaySummary.lastReplayableEntry
        ? createReplayDescription(
          motifReplaySummary.lastReplayableEntry,
          `Startet den jüngsten noch spielbaren Galerie-Eintrag vom ${formatDate(motifReplaySummary.lastReplayableEntry.completedAt)} neu.`
        )
        : ''
    )
  }

  return actions
}
