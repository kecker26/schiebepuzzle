import { PuzzleConfig, SolvedGalleryEntry } from '../../types/index'
import {
  GalleryAssistanceFilter,
  GalleryDifficultyFilter,
  GallerySortOption,
  getCompletionExtraMoves,
  matchesGalleryAssistanceFilter,
  matchesGalleryDifficultyFilter,
} from './uploadUtils.ts'

export interface GalleryMotifReplaySummary {
  motifId: string
  allEntries: SolvedGalleryEntry[]
  totalSolveCount: number
  replayableSolveCount: number
  difficultyVariants: PuzzleConfig[]
  latestCompletedAt: string | null
  lastReplayableEntry: SolvedGalleryEntry | null
  bestTimeEntry: SolvedGalleryEntry | null
  bestMovesEntry: SolvedGalleryEntry | null
  bestCleanTimeEntry: SolvedGalleryEntry | null
}

export interface GalleryDisplayEntry {
  id: string
  motifId: string
  allEntries: SolvedGalleryEntry[]
  visibleEntries: SolvedGalleryEntry[]
  representativeEntry: SolvedGalleryEntry
  totalSolveCount: number
  visibleSolveCount: number
  latestCompletedAt: string | null
  earliestVisibleCompletedAt: string | null
  bestVisibleTime: number
  bestVisibleMoves: number
  bestVisibleActionMoves: number
  bestVisibleDetours: number
  motifReplaySummary: GalleryMotifReplaySummary
}

interface BuildGalleryDisplayEntriesOptions {
  difficultyFilter: GalleryDifficultyFilter
  assistanceFilter: GalleryAssistanceFilter
}

export interface GalleryDisplayGroup {
  id: string
  motifId: string
  allEntries: SolvedGalleryEntry[]
  totalSolveCount: number
  latestCompletedAt: string | null
  motifReplaySummary: GalleryMotifReplaySummary
}

function parseTimestamp(timestamp: string | null | undefined): number {
  if (!timestamp) return Number.NEGATIVE_INFINITY

  const parsed = Date.parse(timestamp)
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed
}

function compareNumbersAscending(a: number, b: number, fallback: number): number {
  if (a !== b) return a - b
  return fallback
}

function sortEntriesByLatest(entries: SolvedGalleryEntry[]): SolvedGalleryEntry[] {
  return [...entries].sort((a, b) => parseTimestamp(b.completedAt) - parseTimestamp(a.completedAt))
}

function isReplayableGalleryEntry(entry: Pick<SolvedGalleryEntry, 'sourceImage' | 'previewImage'>): boolean {
  return Boolean(entry.sourceImage ?? entry.previewImage)
}

export function getGalleryMotifKey(entry: SolvedGalleryEntry): string {
  return entry.sourceImage ?? entry.previewImage ?? `missing:${entry.id}`
}

export function getUniqueGalleryMotifEntryIds(entries: SolvedGalleryEntry[]): string[] {
  const seenMotifs = new Set<string>()
  const entryIds: string[] = []

  for (const entry of entries) {
    const motifKey = getGalleryMotifKey(entry)
    if (seenMotifs.has(motifKey)) continue

    seenMotifs.add(motifKey)
    entryIds.push(entry.id)
  }

  return entryIds
}

function getGalleryGroupKey(entry: SolvedGalleryEntry): string {
  return getGalleryMotifKey(entry)
}

function getPuzzleConfigKey(config: PuzzleConfig): string {
  return `${config.rows}x${config.cols}`
}

function comparePuzzleConfigs(a: PuzzleConfig, b: PuzzleConfig): number {
  const areaDelta = a.rows * a.cols - b.rows * b.cols
  if (areaDelta !== 0) return areaDelta
  if (a.rows !== b.rows) return a.rows - b.rows
  return a.cols - b.cols
}

function findBestGalleryEntry(
  entries: SolvedGalleryEntry[],
  metric: (entry: SolvedGalleryEntry) => number
): SolvedGalleryEntry | null {
  let bestEntry: SolvedGalleryEntry | null = null
  let bestMetric = Number.POSITIVE_INFINITY

  for (const entry of entries) {
    const metricValue = metric(entry)
    if (metricValue < bestMetric) {
      bestMetric = metricValue
      bestEntry = entry
    }
  }

  return bestEntry
}

function buildMotifReplaySummary(
  motifId: string,
  entries: SolvedGalleryEntry[]
): GalleryMotifReplaySummary {
  const allEntries = sortEntriesByLatest(entries)
  const replayableEntries = allEntries.filter((entry) => isReplayableGalleryEntry(entry))
  const cleanReplayableEntries = replayableEntries.filter(
    (entry) => entry.hasDetailedProfile && entry.assistanceMode === 'clean'
  )
  const difficultyVariants = Array.from(
    allEntries.reduce((variants, entry) => {
      variants.set(getPuzzleConfigKey(entry.config), entry.config)
      return variants
    }, new Map<string, PuzzleConfig>()).values()
  ).sort(comparePuzzleConfigs)

  return {
    motifId,
    allEntries,
    totalSolveCount: allEntries.length,
    replayableSolveCount: replayableEntries.length,
    difficultyVariants,
    latestCompletedAt: allEntries[0]?.completedAt ?? null,
    lastReplayableEntry: replayableEntries[0] ?? null,
    bestTimeEntry: findBestGalleryEntry(replayableEntries, (entry) => entry.time),
    bestMovesEntry: findBestGalleryEntry(replayableEntries, (entry) => entry.moves),
    bestCleanTimeEntry: findBestGalleryEntry(cleanReplayableEntries, (entry) => entry.time),
  }
}

function compareGalleryDisplayEntriesByLatest(a: GalleryDisplayEntry, b: GalleryDisplayEntry): number {
  const timestampA = parseTimestamp(a.representativeEntry.completedAt)
  const timestampB = parseTimestamp(b.representativeEntry.completedAt)

  if (timestampA === timestampB) return 0
  return timestampB > timestampA ? 1 : -1
}

export function buildGalleryDisplayEntries(
  entries: SolvedGalleryEntry[],
  options: BuildGalleryDisplayEntriesOptions
): GalleryDisplayEntry[] {
  return buildGalleryDisplayEntriesFromGroups(buildGalleryDisplayGroups(entries), options)
}

export function buildGalleryDisplayGroups(entries: SolvedGalleryEntry[]): GalleryDisplayGroup[] {
  const groups = new Map<string, SolvedGalleryEntry[]>()
  const motifs = new Map<string, SolvedGalleryEntry[]>()

  for (const entry of entries) {
    const groupKey = getGalleryGroupKey(entry)
    const motifKey = getGalleryMotifKey(entry)
    const groupedEntries = groups.get(groupKey)
    if (groupedEntries) {
      groupedEntries.push(entry)
    } else {
      groups.set(groupKey, [entry])
    }

    const motifEntries = motifs.get(motifKey)
    if (motifEntries) {
      motifEntries.push(entry)
    } else {
      motifs.set(motifKey, [entry])
    }
  }

  const motifReplaySummaries = new Map(
    Array.from(motifs.entries(), ([motifId, motifEntries]) => [motifId, buildMotifReplaySummary(motifId, motifEntries)])
  )

  return Array.from(groups.entries(), ([groupKey, groupEntries]) => {
    const allEntries = sortEntriesByLatest(groupEntries)
    const representativeEntry = allEntries[0]
    const motifId = representativeEntry ? getGalleryMotifKey(representativeEntry) : groupKey

    return {
      id: groupKey,
      motifId,
      allEntries,
      totalSolveCount: allEntries.length,
      latestCompletedAt: representativeEntry?.completedAt ?? null,
      motifReplaySummary:
        motifReplaySummaries.get(motifId)
        ?? buildMotifReplaySummary(motifId, groupEntries),
    }
  })
}

export function buildGalleryDisplayEntriesFromGroups(
  groups: GalleryDisplayGroup[],
  options: BuildGalleryDisplayEntriesOptions
): GalleryDisplayEntry[] {
  return groups.flatMap((group) => {
    const difficultyMatchedEntries = group.allEntries.filter((entry) =>
      matchesGalleryDifficultyFilter(entry, options.difficultyFilter)
    )
    const representativeEntry = difficultyMatchedEntries[0]
    if (!representativeEntry) {
      return []
    }

    const visibleEntries = difficultyMatchedEntries.filter((entry) =>
      matchesGalleryAssistanceFilter(entry, options.assistanceFilter)
    )

    if (visibleEntries.length === 0) {
      return []
    }

    let bestVisibleTime = Number.POSITIVE_INFINITY
    let bestVisibleMoves = Number.POSITIVE_INFINITY
    let bestVisibleActionMoves = Number.POSITIVE_INFINITY
    let bestVisibleDetours = Number.POSITIVE_INFINITY

    for (const entry of visibleEntries) {
      if (entry.time < bestVisibleTime) bestVisibleTime = entry.time
      if (entry.moves < bestVisibleMoves) bestVisibleMoves = entry.moves
      if (entry.actionMoves < bestVisibleActionMoves) bestVisibleActionMoves = entry.actionMoves

      const detours = getCompletionExtraMoves(entry)
      if (detours < bestVisibleDetours) bestVisibleDetours = detours
    }

    return [{
      id: group.id,
      motifId: group.motifId,
      allEntries: group.allEntries,
      visibleEntries,
      representativeEntry: visibleEntries[0],
      totalSolveCount: group.totalSolveCount,
      visibleSolveCount: visibleEntries.length,
      latestCompletedAt: group.latestCompletedAt,
      earliestVisibleCompletedAt: visibleEntries[visibleEntries.length - 1]?.completedAt ?? null,
      bestVisibleTime,
      bestVisibleMoves,
      bestVisibleActionMoves,
      bestVisibleDetours,
      motifReplaySummary: group.motifReplaySummary,
    }]
  })
}

export function sortGalleryDisplayEntries(
  entries: GalleryDisplayEntry[],
  sortOption: GallerySortOption
): GalleryDisplayEntry[] {
  const sortedEntries = [...entries]

  sortedEntries.sort((a, b) => {
    const latestFallback = compareGalleryDisplayEntriesByLatest(a, b)

    switch (sortOption) {
      case 'oldest': {
        const oldestA = parseTimestamp(a.earliestVisibleCompletedAt)
        const oldestB = parseTimestamp(b.earliestVisibleCompletedAt)
        if (oldestA !== oldestB) return oldestA - oldestB
        return -latestFallback
      }
      case 'fastest':
        return compareNumbersAscending(a.bestVisibleTime, b.bestVisibleTime, latestFallback)
      case 'fewest-moves':
        return compareNumbersAscending(a.bestVisibleMoves, b.bestVisibleMoves, latestFallback)
      case 'fewest-actions':
        return compareNumbersAscending(a.bestVisibleActionMoves, b.bestVisibleActionMoves, latestFallback)
      case 'fewest-detours':
        return compareNumbersAscending(a.bestVisibleDetours, b.bestVisibleDetours, latestFallback)
      case 'latest':
      default:
        return latestFallback
    }
  })

  return sortedEntries
}

export function countUniqueGalleryEntries(entries: SolvedGalleryEntry[]): number {
  return buildGalleryDisplayGroups(entries).length
}

function getGalleryDisplayTagKeys(entry: GalleryDisplayEntry): Set<string> {
  const tagKeys = new Set<string>()

  for (const galleryEntry of entry.allEntries) {
    for (const tag of galleryEntry.tags ?? []) {
      const tagKey = tag.label.trim().toLocaleLowerCase('de-DE')
      if (tagKey) {
        tagKeys.add(tagKey)
      }
    }
  }

  return tagKeys
}

export function getSimilarGalleryEntries(
  current: GalleryDisplayEntry,
  all: GalleryDisplayEntry[],
  limit: number = 4
): GalleryDisplayEntry[] {
  const currentTagKeys = getGalleryDisplayTagKeys(current)
  if (currentTagKeys.size === 0 || limit <= 0) {
    return []
  }

  return all
    .filter((entry) => entry.id !== current.id)
    .map((entry) => {
      const tagKeys = getGalleryDisplayTagKeys(entry)
      const overlapCount = Array.from(tagKeys).filter((tagKey) => currentTagKeys.has(tagKey)).length
      const unionCount = new Set([...Array.from(currentTagKeys), ...Array.from(tagKeys)]).size
      const overlapScore = unionCount > 0 ? overlapCount / unionCount : 0

      return {
        entry,
        overlapCount,
        overlapScore,
      }
    })
    .filter((candidate) => candidate.overlapCount > 0)
    .sort((a, b) =>
      b.overlapCount - a.overlapCount
      || b.overlapScore - a.overlapScore
      || b.entry.totalSolveCount - a.entry.totalSolveCount
      || parseTimestamp(b.entry.latestCompletedAt) - parseTimestamp(a.entry.latestCompletedAt)
    )
    .slice(0, limit)
    .map((candidate) => candidate.entry)
}

export function formatGallerySolveCount(totalSolveCount: number, visibleSolveCount: number = totalSolveCount): string {
  if (visibleSolveCount === totalSolveCount) {
    return `${totalSolveCount} ${totalSolveCount === 1 ? 'Loesung' : 'Loesungen'}`
  }

  return `${visibleSolveCount} von ${totalSolveCount} Loesungen`
}
