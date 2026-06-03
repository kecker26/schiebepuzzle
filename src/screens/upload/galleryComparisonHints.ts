import type { SolvedGalleryEntry } from '../../types/index.ts'
import type { GalleryMotifReplaySummary } from './UploadGalleryDisplayUtils.ts'
import { formatTime } from './uploadUtils.ts'

type GalleryComparisonHintTone = 'positive' | 'negative' | 'neutral' | 'info'

interface GalleryComparisonHint {
  label: string
  tone: GalleryComparisonHintTone
}

function formatSignedDuration(deltaSeconds: number): string {
  const prefix = deltaSeconds > 0 ? '+' : deltaSeconds < 0 ? '-' : ''
  return `${prefix}${formatTime(Math.abs(deltaSeconds))}`
}

function formatSignedNumber(delta: number): string {
  const prefix = delta > 0 ? '+' : delta < 0 ? '-' : ''
  return `${prefix}${Math.abs(delta)}`
}

function findPreviousMotifEntry(
  currentEntry: SolvedGalleryEntry,
  timelineEntries: SolvedGalleryEntry[]
): SolvedGalleryEntry | null {
  const currentIndex = timelineEntries.findIndex((entry) => entry.id === currentEntry.id)
  if (currentIndex < 0) return null

  return timelineEntries[currentIndex + 1] ?? null
}

function getBestTimeHint(
  currentEntry: SolvedGalleryEntry,
  motifReplaySummary: GalleryMotifReplaySummary
): GalleryComparisonHint | null {
  const bestTimeEntry = motifReplaySummary.bestTimeEntry
  if (!bestTimeEntry) return null

  if (bestTimeEntry.id === currentEntry.id || currentEntry.time <= bestTimeEntry.time) {
    return { label: 'Motiv-Bestzeit', tone: 'positive' }
  }

  return {
    label: `${formatSignedDuration(currentEntry.time - bestTimeEntry.time)} zur Bestzeit`,
    tone: 'neutral',
  }
}

function getPreviousTimeHint(
  currentEntry: SolvedGalleryEntry,
  previousEntry: SolvedGalleryEntry | null
): GalleryComparisonHint | null {
  if (!previousEntry) return null

  const timeDelta = currentEntry.time - previousEntry.time
  if (timeDelta === 0) {
    return { label: 'gleich schnell wie vorher', tone: 'neutral' }
  }

  return {
    label: `${formatSignedDuration(timeDelta)} vs. vorher`,
    tone: timeDelta < 0 ? 'positive' : 'negative',
  }
}

function getPreviousMovesHint(
  currentEntry: SolvedGalleryEntry,
  previousEntry: SolvedGalleryEntry | null
): GalleryComparisonHint | null {
  if (!previousEntry) return null

  const moveDelta = currentEntry.moves - previousEntry.moves
  if (moveDelta === 0) {
    return { label: 'gleich viele Netto', tone: 'neutral' }
  }

  return {
    label: `${formatSignedNumber(moveDelta)} Netto vs. vorher`,
    tone: moveDelta < 0 ? 'positive' : 'negative',
  }
}

function getDifficultyHint(
  currentEntry: SolvedGalleryEntry,
  representativeEntry: SolvedGalleryEntry
): GalleryComparisonHint {
  const isSameDifficulty =
    currentEntry.config.rows === representativeEntry.config.rows
    && currentEntry.config.cols === representativeEntry.config.cols

  return {
    label: isSameDifficulty ? 'gleiche Stufe' : 'andere Stufe',
    tone: isSameDifficulty ? 'neutral' : 'info',
  }
}

export function getGalleryTimelineComparisonHints(
  currentEntry: SolvedGalleryEntry,
  timelineEntries: SolvedGalleryEntry[],
  motifReplaySummary: GalleryMotifReplaySummary,
  representativeEntry: SolvedGalleryEntry
): GalleryComparisonHint[] {
  const previousEntry = findPreviousMotifEntry(currentEntry, timelineEntries)

  return [
    getBestTimeHint(currentEntry, motifReplaySummary),
    getPreviousTimeHint(currentEntry, previousEntry),
    getPreviousMovesHint(currentEntry, previousEntry),
    getDifficultyHint(currentEntry, representativeEntry),
  ].filter((hint): hint is GalleryComparisonHint => Boolean(hint))
}

