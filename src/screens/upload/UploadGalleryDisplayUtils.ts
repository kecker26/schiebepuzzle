import { ChallengeMedal, PuzzleConfig, SolvedGalleryEntry } from '../../types/index'
import {
  getBestChallengeMedal,
  getChallengeGoldTargets,
  getChallengeMedalProgress,
  getChallengeMedalRank,
  isChallengeCleanRun,
} from '../../utils/galleryChallenge.ts'
import { isGalleryChallengeTargetEligible } from '../../utils/galleryReplaySetup.ts'
import {
  GalleryAssistanceFilter,
  GalleryDifficultyFilter,
  GalleryMedalHuntFilter,
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
  bestChallengeMedal: ChallengeMedal | null
  challengeSolveCount: number
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

export type GalleryMedalFilter = 'all' | ChallengeMedal

export interface GalleryMedalHuntStatus {
  bestMedal: ChallengeMedal | null
  nextMedal: ChallengeMedal | null
  hasStarted: boolean
  upgradeable: boolean
  nearUpgrade: boolean
  proximityScore: number | null
}

export interface GalleryMedalHuntRecommendation {
  label: string
  detail: string
  tone: 'new' | 'near' | 'reachable' | 'open' | 'complete'
}

export interface GalleryMedalCollectionItem {
  medal: ChallengeMedal
  count: number
}

const CHALLENGE_MEDALS_DESCENDING: ChallengeMedal[] = ['diamond', 'gold', 'silver', 'bronze']

export function buildGalleryMedalCollection(
  entries: Pick<GalleryDisplayEntry, 'motifReplaySummary'>[]
): GalleryMedalCollectionItem[] {
  const counts = new Map<ChallengeMedal, number>(
    CHALLENGE_MEDALS_DESCENDING.map((medal) => [medal, 0])
  )

  for (const entry of entries) {
    const medal = entry.motifReplaySummary.bestChallengeMedal
    if (medal) {
      counts.set(medal, (counts.get(medal) ?? 0) + 1)
    }
  }

  return CHALLENGE_MEDALS_DESCENDING.map((medal) => ({
    medal,
    count: counts.get(medal) ?? 0,
  }))
}

export function matchesGalleryMedalFilter(
  entry: Pick<GalleryDisplayEntry, 'motifReplaySummary'>,
  filter: GalleryMedalFilter
): boolean {
  return filter === 'all' || entry.motifReplaySummary.bestChallengeMedal === filter
}

function normalizedGap(value: number, target: number): number {
  return Math.max(0, value) / Math.max(1, target)
}

function getAttemptUpgradeProximity(
  attempt: SolvedGalleryEntry,
  target: SolvedGalleryEntry,
  nextMedal: ChallengeMedal
): number | null {
  const cleanPenalty = isChallengeCleanRun(attempt) ? 0 : 0.2

  if (nextMedal === 'silver') {
    return normalizedGap(attempt.time - target.time + 1, target.time)
      + normalizedGap(attempt.moves - target.moves + 1, target.moves)
      + cleanPenalty
  }

  const goldTargets = getChallengeGoldTargets(target)
  const goldTimeGap = normalizedGap(attempt.time - goldTargets.time, target.time)

  if (nextMedal === 'gold') {
    return goldTimeGap
      + normalizedGap(attempt.moves - goldTargets.moves, target.moves)
      + cleanPenalty
  }

  if (
    nextMedal === 'diamond'
    && target.replaySetup?.optimalStartMoveCountKind === 'exact'
    && typeof target.replaySetup.optimalStartMoveCount === 'number'
  ) {
    return goldTimeGap
      + normalizedGap(
        attempt.moves - target.replaySetup.optimalStartMoveCount,
        target.replaySetup.optimalStartMoveCount
      )
      + cleanPenalty
  }

  return null
}

export function getGalleryMedalHuntStatus(
  entry: Pick<GalleryDisplayEntry, 'motifReplaySummary'>
): GalleryMedalHuntStatus {
  const allEntries = entry.motifReplaySummary.allEntries
  const progress = getChallengeMedalProgress(allEntries)
  const bestMedal = progress.currentMedal
  const nextMedal = progress.nextMedal
  const hasStarted = bestMedal !== null
  const upgradeable = nextMedal !== null
  let proximityScore: number | null = null

  if (bestMedal && nextMedal) {
    for (const attempt of allEntries) {
      if (attempt.challengeMedal !== bestMedal || !attempt.challengeTargetId) continue
      const target = allEntries.find((candidate) => candidate.id === attempt.challengeTargetId)
      if (!target) continue

      const score = getAttemptUpgradeProximity(attempt, target, nextMedal)
      if (score !== null && (proximityScore === null || score < proximityScore)) {
        proximityScore = score
      }
    }
  }

  return {
    bestMedal,
    nextMedal,
    hasStarted,
    upgradeable,
    nearUpgrade: proximityScore !== null && proximityScore <= 0.2,
    proximityScore,
  }
}

export function matchesGalleryMedalHuntFilter(
  entry: Pick<GalleryDisplayEntry, 'motifReplaySummary'>,
  filter: GalleryMedalHuntFilter
): boolean {
  if (filter === 'all') return true

  const status = getGalleryMedalHuntStatus(entry)
  if (filter === 'no-medal') return !status.hasStarted
  if (filter === 'no-gold') return status.bestMedal === null
    || getChallengeMedalRank(status.bestMedal) < getChallengeMedalRank('gold')
  if (filter === 'near-upgrade') return status.nearUpgrade
  return !status.hasStarted || status.upgradeable
}

export function getGalleryMedalHuntRecommendation(
  status: GalleryMedalHuntStatus
): GalleryMedalHuntRecommendation {
  if (!status.nextMedal) {
    return {
      label: 'Hoechste verfuegbare Stufe',
      detail: 'Fuer dieses Motiv ist aktuell kein weiteres Medaillen-Upgrade verfuegbar.',
      tone: 'complete',
    }
  }

  if (!status.hasStarted) {
    return {
      label: 'Erste Medaille holen',
      detail: 'Unterbiete in einem absolut cleanen Lauf Zeit oder Zuege einer Vorlage strikt, um Bronze zu sichern.',
      tone: 'new',
    }
  }

  if (status.proximityScore === null) {
    return {
      label: 'Neues Upgrade-Ziel',
      detail: 'Starte einen weiteren Challenge-Lauf, um dich der naechsten Stufe zu naehern.',
      tone: 'open',
    }
  }

  if (status.proximityScore <= 0.05) {
    return {
      label: 'Sehr nah am Upgrade',
      detail: 'Nur eine kleine Verbesserung trennt dieses Motiv von der naechsten Medaille.',
      tone: 'near',
    }
  }

  if (status.proximityScore <= 0.2) {
    return {
      label: 'Nah am Upgrade',
      detail: 'Dieses Motiv gehoert zu deinen aussichtsreichsten Medaillen-Jagden.',
      tone: 'near',
    }
  }

  if (status.proximityScore <= 0.5) {
    return {
      label: 'Upgrade in Reichweite',
      detail: 'Mit einem verbesserten Challenge-Lauf ist die naechste Stufe realistisch.',
      tone: 'reachable',
    }
  }

  return {
    label: 'Upgrade offen',
    detail: 'Die naechste Medaille braucht noch einen deutlich staerkeren Challenge-Lauf.',
    tone: 'open',
  }
}

export interface GalleryChallengeSeries {
  targetId: string
  targetEntry: SolvedGalleryEntry | null
  estimatedTarget: SolvedGalleryEntry['estimatedChallengeTarget'] | null
  templateEntry: SolvedGalleryEntry | null
  preTemplateEntries: SolvedGalleryEntry[]
  attempts: SolvedGalleryEntry[]
  relatedStartStateEntries: SolvedGalleryEntry[]
  medalHistory: GalleryChallengeMedalHistoryItem[]
  bestAttempt: SolvedGalleryEntry | null
  bestMedal: ChallengeMedal | null
  improvedAttemptCount: number
}

export interface GalleryChallengeMedalHistoryItem {
  attempt: SolvedGalleryEntry
  attemptNumber: number
  medal: ChallengeMedal
  trend: 'start' | 'upgrade' | 'confirmed' | 'downgrade'
}

export interface GalleryTimelineChallengeRelation {
  seriesNumber: number
  series: GalleryChallengeSeries
  attemptNumber?: number
}

export interface GalleryTimelineRelations {
  attemptsByEntryId: Map<string, GalleryTimelineChallengeRelation>
  targetsByEntryId: Map<string, GalleryTimelineChallengeRelation>
}

export interface GalleryStartStateSeries {
  seriesId: string
  startStateKey: string
  entries: SolvedGalleryEntry[]
  chronologicalEntries: SolvedGalleryEntry[]
  originEntry: SolvedGalleryEntry
  latestEntry: SolvedGalleryEntry
  cleanAnchorEntry: SolvedGalleryEntry | null
}

export interface GalleryTimelineStartStateRelation {
  seriesNumber: number
  series: GalleryStartStateSeries
  entryNumber: number
  isOrigin: boolean
}

export interface GalleryStartStateRelations {
  entriesByEntryId: Map<string, GalleryTimelineStartStateRelation>
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

function compareChallengeAttempts(a: SolvedGalleryEntry, b: SolvedGalleryEntry): number {
  const medalRankDelta = getChallengeMedalRank(b.challengeMedal ?? 'bronze')
    - getChallengeMedalRank(a.challengeMedal ?? 'bronze')
  if (medalRankDelta !== 0) return medalRankDelta
  if (a.time !== b.time) return a.time - b.time
  if (a.moves !== b.moves) return a.moves - b.moves
  return parseTimestamp(b.completedAt) - parseTimestamp(a.completedAt)
}

function getCropTransformKey(entry: SolvedGalleryEntry): string {
  const transform = entry.cropTransform
  if (!transform) return 'no-crop'

  return [
    `z:${transform.zoom}`,
    `r:${transform.rotationDeg}`,
    `x:${transform.offsetX}`,
    `y:${transform.offsetY}`,
  ].join(',')
}

function getGalleryStartStateKey(entry: SolvedGalleryEntry): string | null {
  const setup = entry.replaySetup
  if (
    !setup
    || !Array.isArray(setup.startBoard)
    || setup.startBoard.length !== entry.config.rows * entry.config.cols
  ) {
    return null
  }

  return [
    getGalleryMotifKey(entry),
    getPuzzleConfigKey(entry.config),
    entry.useFullImage ? 'full' : 'crop',
    getCropTransformKey(entry),
    `empty:${setup.emptyIndex}`,
    `board:${setup.startBoard.join(',')}`,
  ].join('|')
}

function getRelatedStartStateEntries(
  entries: SolvedGalleryEntry[],
  targetEntry: SolvedGalleryEntry | null,
  excludedEntryIds: ReadonlySet<string>
): SolvedGalleryEntry[] {
  if (!targetEntry) return []

  const targetStartStateKey = getGalleryStartStateKey(targetEntry)
  if (!targetStartStateKey) return []

  return sortEntriesByLatest(
    entries.filter((entry) => {
      if (excludedEntryIds.has(entry.id)) return false
      if (entry.challengeTargetId) {
        return entry.challengeTargetId === targetEntry.id && !entry.challengeMedal
      }
      return getGalleryStartStateKey(entry) === targetStartStateKey
    })
  )
}

export function buildGalleryStartStateSeries(
  entries: SolvedGalleryEntry[],
  excludedEntryIds: ReadonlySet<string> = new Set()
): GalleryStartStateSeries[] {
  const entriesByStartState = new Map<string, SolvedGalleryEntry[]>()

  for (const entry of entries) {
    if (excludedEntryIds.has(entry.id)) continue
    if (entry.challengeTargetId) continue

    const startStateKey = getGalleryStartStateKey(entry)
    if (!startStateKey) continue

    const startStateEntries = entriesByStartState.get(startStateKey)
    if (startStateEntries) {
      startStateEntries.push(entry)
    } else {
      entriesByStartState.set(startStateKey, [entry])
    }
  }

  return Array.from(entriesByStartState.entries())
    .flatMap(([startStateKey, startStateEntries]): GalleryStartStateSeries[] => {
      const chronologicalEntries = [...startStateEntries].sort(
        (a, b) => parseTimestamp(a.completedAt) - parseTimestamp(b.completedAt)
      )
      const entriesByLatest = sortEntriesByLatest(startStateEntries)
      const cleanAnchorEntry = entriesByLatest.find(isGalleryChallengeTargetEligible) ?? null
      if (startStateEntries.length < 2 && !cleanAnchorEntry) return []

      const displayEntries = cleanAnchorEntry
        ? [
            cleanAnchorEntry,
            ...entriesByLatest.filter((entry) => entry.id !== cleanAnchorEntry.id),
          ]
        : entriesByLatest

      return [{
        seriesId: startStateKey,
        startStateKey,
        entries: displayEntries,
        chronologicalEntries,
        originEntry: chronologicalEntries[0],
        latestEntry: entriesByLatest[0],
        cleanAnchorEntry,
      }]
    })
    .sort((a, b) => parseTimestamp(b.latestEntry.completedAt) - parseTimestamp(a.latestEntry.completedAt))
}

export function buildGalleryStartStateRelations(
  series: GalleryStartStateSeries[]
): GalleryStartStateRelations {
  const entriesByEntryId = new Map<string, GalleryTimelineStartStateRelation>()

  series.forEach((startStateSeries, index) => {
    const seriesNumber = index + 1

    startStateSeries.chronologicalEntries.forEach((entry, entryIndex) => {
      entriesByEntryId.set(entry.id, {
        seriesNumber,
        series: startStateSeries,
        entryNumber: entryIndex + 1,
        isOrigin: entry.id === startStateSeries.originEntry.id,
      })
    })
  })

  return { entriesByEntryId }
}

export function buildGalleryChallengeMedalHistory(
  attempts: SolvedGalleryEntry[]
): GalleryChallengeMedalHistoryItem[] {
  const chronologicalAttempts = [...attempts].sort(
    (a, b) => parseTimestamp(a.completedAt) - parseTimestamp(b.completedAt)
  )

  return chronologicalAttempts.map((attempt, index) => {
    const medal = attempt.challengeMedal ?? 'bronze'
    const previousMedal = chronologicalAttempts[index - 1]?.challengeMedal ?? null
    const trend =
      previousMedal === null
        ? 'start'
        : getChallengeMedalRank(medal) > getChallengeMedalRank(previousMedal)
          ? 'upgrade'
          : getChallengeMedalRank(medal) < getChallengeMedalRank(previousMedal)
            ? 'downgrade'
            : 'confirmed'

    return {
      attempt,
      attemptNumber: index + 1,
      medal,
      trend,
    }
  })
}

export function buildGalleryChallengeSeries(entries: SolvedGalleryEntry[]): GalleryChallengeSeries[] {
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]))
  const linkedEntriesByTarget = new Map<string, SolvedGalleryEntry[]>()

  for (const entry of entries) {
    if (!entry.challengeTargetId) continue
    const linkedEntries = linkedEntriesByTarget.get(entry.challengeTargetId)
    if (linkedEntries) {
      linkedEntries.push(entry)
    } else {
      linkedEntriesByTarget.set(entry.challengeTargetId, [entry])
    }
  }

  const allChallengeEntryIds = new Set<string>()
  linkedEntriesByTarget.forEach((linkedEntries, targetId) => {
    allChallengeEntryIds.add(targetId)
    linkedEntries.forEach((entry) => {
      if (entry.challengeMedal || entry.estimatedChallengeTarget?.entryId === targetId) allChallengeEntryIds.add(entry.id)
    })
  })

  return Array.from(linkedEntriesByTarget.entries(), ([targetId, linkedEntries]) => {
    const attempts = linkedEntries.filter((entry) => entry.challengeMedal)
    const sortedAttempts = [...attempts].sort(compareChallengeAttempts)
    const estimatedTarget = linkedEntries.find((entry) => entry.estimatedChallengeTarget?.entryId === targetId)
      ?.estimatedChallengeTarget ?? null
    const templateEntry = linkedEntries.find((entry) => entry.qualificationResult === 'created-template') ?? null
    const targetEntry = entriesById.get(targetId) ?? templateEntry ?? null
    const preTemplateEntries = sortEntriesByLatest(
      linkedEntries.filter((entry) => !entry.challengeMedal && entry.id !== templateEntry?.id)
    )
    const bestAttempt = sortedAttempts[0] ?? null

    return {
      targetId,
      targetEntry,
      estimatedTarget,
      templateEntry,
      preTemplateEntries,
      attempts: sortedAttempts,
      relatedStartStateEntries: getRelatedStartStateEntries(entries, targetEntry, allChallengeEntryIds),
      medalHistory: buildGalleryChallengeMedalHistory(attempts),
      bestAttempt,
      bestMedal: bestAttempt?.challengeMedal ?? null,
      improvedAttemptCount: targetEntry
        ? sortedAttempts.filter((attempt) => attempt.time < targetEntry.time || attempt.moves < targetEntry.moves).length
        : sortedAttempts.filter((attempt) => attempt.challengeMedal !== 'bronze').length,
    }
  }).sort((a, b) => {
    const medalRankDelta = (b.bestMedal ? getChallengeMedalRank(b.bestMedal) : 0)
      - (a.bestMedal ? getChallengeMedalRank(a.bestMedal) : 0)
    if (medalRankDelta !== 0) return medalRankDelta
    const latestA = a.bestAttempt ?? a.relatedStartStateEntries[0] ?? a.targetEntry
    const latestB = b.bestAttempt ?? b.relatedStartStateEntries[0] ?? b.targetEntry
    return parseTimestamp(latestB?.completedAt) - parseTimestamp(latestA?.completedAt)
  })
}

export function buildGalleryTimelineRelations(entries: SolvedGalleryEntry[]): GalleryTimelineRelations {
  const series = buildGalleryChallengeSeries(entries)
  const attemptsByEntryId = new Map<string, GalleryTimelineChallengeRelation>()
  const targetsByEntryId = new Map<string, GalleryTimelineChallengeRelation>()

  series.forEach((challengeSeries, index) => {
    const seriesNumber = index + 1
    targetsByEntryId.set(challengeSeries.targetId, {
      seriesNumber,
      series: challengeSeries,
    })
    if (challengeSeries.targetEntry && challengeSeries.targetEntry.id !== challengeSeries.targetId) {
      targetsByEntryId.set(challengeSeries.targetEntry.id, {
        seriesNumber,
        series: challengeSeries,
      })
    }

    const chronologicalAttempts = [...challengeSeries.attempts].sort(
      (a, b) => parseTimestamp(a.completedAt) - parseTimestamp(b.completedAt)
    )
    chronologicalAttempts.forEach((attempt, attemptIndex) => {
      attemptsByEntryId.set(attempt.id, {
        seriesNumber,
        series: challengeSeries,
        attemptNumber: attemptIndex + 1,
      })
    })
  })

  return {
    attemptsByEntryId,
    targetsByEntryId,
  }
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
    bestChallengeMedal: getBestChallengeMedal(allEntries),
    challengeSolveCount: allEntries.filter((entry) => entry.challengeMedal && entry.challengeTargetId).length,
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
      case 'upgrade-potential': {
        const statusA = getGalleryMedalHuntStatus(a)
        const statusB = getGalleryMedalHuntStatus(b)
        if (statusA.upgradeable !== statusB.upgradeable) return statusA.upgradeable ? -1 : 1
        if (statusA.hasStarted !== statusB.hasStarted) return statusA.hasStarted ? -1 : 1

        const rankA = statusA.bestMedal ? getChallengeMedalRank(statusA.bestMedal) : 0
        const rankB = statusB.bestMedal ? getChallengeMedalRank(statusB.bestMedal) : 0
        if (rankA !== rankB) return rankB - rankA

        const scoreA = statusA.proximityScore ?? Number.POSITIVE_INFINITY
        const scoreB = statusB.proximityScore ?? Number.POSITIVE_INFINITY
        return compareNumbersAscending(scoreA, scoreB, latestFallback)
      }
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
