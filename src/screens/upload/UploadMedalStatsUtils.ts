import type { ChallengeMedal, PuzzleConfig, SolvedGalleryEntry } from '../../types/index.ts'
import {
  formatChallengeMedalLabel,
  getChallengeMedalRank,
} from '../../utils/galleryChallenge.ts'
import { formatDifficultyLabel } from '../../utils/puzzleDifficulty.ts'
import { buildGalleryChallengeSeries, getGalleryMotifKey } from './UploadGalleryDisplayUtils.ts'

export const MEDAL_STATS_ORDER: ChallengeMedal[] = ['diamond', 'gold', 'silver', 'bronze']

export const MEDAL_STATS_COLORS: Record<ChallengeMedal, string> = {
  diamond: '#67e8f9',
  gold: '#fbbf24',
  silver: '#cbd5e1',
  bronze: '#fb923c',
}

export interface MedalDistributionDatum {
  key: ChallengeMedal
  label: string
  value: number
  color: string
}

export interface MedalTrendPoint {
  id: string
  index: number
  date: string
  label: string
  previewImage: string | null
  previousMedal: ChallengeMedal | null
  medal: ChallengeMedal
  medalLabel: string
  moves: number
  time: number
  motifCount: number
  diamond: number
  gold: number
  silver: number
  bronze: number
}

export interface MotifAscent {
  medal: ChallengeMedal
  time: number
  moves: number
  date: string
  config: PuzzleConfig
}

export interface MotifChallengeSeries {
  targetId: string
  targetTime: number | null
  targetMoves: number | null
  targetConfig: string | null
  targetDifficultyLabel: string | null
  bestAttemptId: string
  bestAttemptTime: number
  bestAttemptMoves: number
  bestMedal: ChallengeMedal
  attemptCount: number
  timeDeltaToTarget: number | null
  movesDeltaToTarget: number | null
}

export interface GroupedMotifCard {
  motifKey: string
  previewImage: string | null
  bestEntryId: string
  bestMedal: ChallengeMedal
  bestMedalLabel: string
  ascents: MotifAscent[]
  latestAscentDate: string
  configs: string[]
  series: MotifChallengeSeries[]
}

function getTimestamp(entry: Pick<SolvedGalleryEntry, 'completedAt'>): number {
  const parsed = Date.parse(entry.completedAt)
  return Number.isNaN(parsed) ? 0 : parsed
}

function formatConfig(config: PuzzleConfig): string {
  return `${config.rows}\u00d7${config.cols}`
}

function compareConfigs(left: PuzzleConfig, right: PuzzleConfig): number {
  return (
    left.rows * left.cols - right.rows * right.cols
    || left.rows - right.rows
    || left.cols - right.cols
  )
}

function getChronologicalChallengeEntries(
  entries: SolvedGalleryEntry[]
): Array<SolvedGalleryEntry & { challengeMedal: ChallengeMedal }> {
  return entries
    .map((entry, index) => ({ entry, index }))
    .filter(
      (item): item is { entry: SolvedGalleryEntry & { challengeMedal: ChallengeMedal }; index: number } =>
        Boolean(item.entry.challengeMedal)
    )
    .sort((left, right) => getTimestamp(left.entry) - getTimestamp(right.entry) || left.index - right.index)
    .map(({ entry }) => entry)
}

function formatShortDate(isoDate: string): string {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return '--'
  return parsed.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

export function buildMedalDistribution(entries: SolvedGalleryEntry[]): MedalDistributionDatum[] {
  const bestMedalByMotif = new Map<string, ChallengeMedal>()

  for (const entry of entries) {
    const medal = entry.challengeMedal
    if (!medal) continue

    const motifKey = getGalleryMotifKey(entry)
    const currentMedal = bestMedalByMotif.get(motifKey)
    if (!currentMedal || getChallengeMedalRank(medal) > getChallengeMedalRank(currentMedal)) {
      bestMedalByMotif.set(motifKey, medal)
    }
  }

  return MEDAL_STATS_ORDER.map((medal) => ({
    key: medal,
    label: formatChallengeMedalLabel(medal),
    value: Array.from(bestMedalByMotif.values()).filter((bestMedal) => bestMedal === medal).length,
    color: MEDAL_STATS_COLORS[medal],
  }))
}

export function buildMedalTrend(entries: SolvedGalleryEntry[]): MedalTrendPoint[] {
  const challengeEntries = getChronologicalChallengeEntries(entries)
  const bestMedalByMotif = new Map<string, ChallengeMedal>()
  const counts: Record<ChallengeMedal, number> = {
    diamond: 0,
    gold: 0,
    silver: 0,
    bronze: 0,
  }
  const points: MedalTrendPoint[] = []

  for (const entry of challengeEntries) {
    const medal = entry.challengeMedal
    const motifKey = getGalleryMotifKey(entry)
    const previousMedal = bestMedalByMotif.get(motifKey)
    if (previousMedal && getChallengeMedalRank(medal) <= getChallengeMedalRank(previousMedal)) {
      continue
    }

    if (previousMedal) {
      counts[previousMedal] = Math.max(0, counts[previousMedal] - 1)
    }
    counts[medal] += 1
    bestMedalByMotif.set(motifKey, medal)

    points.push({
      id: entry.id,
      index: points.length + 1,
      date: entry.completedAt,
      label: formatShortDate(entry.completedAt),
      previewImage: entry.previewImage ?? entry.sourceImage,
      previousMedal: previousMedal ?? null,
      medal,
      medalLabel: formatChallengeMedalLabel(medal),
      moves: entry.moves,
      time: entry.time,
      motifCount: bestMedalByMotif.size,
      diamond: counts.diamond,
      gold: counts.gold,
      silver: counts.silver,
      bronze: counts.bronze,
    })
  }

  return points
}

export function buildGroupedMotifCards(entries: SolvedGalleryEntry[]): GroupedMotifCard[] {
  const challengeEntries = getChronologicalChallengeEntries(entries)
  const challengeSeries = buildGalleryChallengeSeries(entries)
  const entriesByMotif = new Map<string, Array<SolvedGalleryEntry & { challengeMedal: ChallengeMedal }>>()

  for (const entry of challengeEntries) {
    const motifKey = getGalleryMotifKey(entry)
    const motifEntries = entriesByMotif.get(motifKey)
    if (motifEntries) {
      motifEntries.push(entry)
    } else {
      entriesByMotif.set(motifKey, [entry])
    }
  }

  return Array.from(entriesByMotif.entries(), ([motifKey, motifEntries]) => {
    const configs = Array.from(
      motifEntries.reduce((configByKey, entry) => {
        configByKey.set(`${entry.config.rows}x${entry.config.cols}`, entry.config)
        return configByKey
      }, new Map<string, PuzzleConfig>()).values()
    ).sort(compareConfigs)

    const ascents: MotifAscent[] = []
    let bestEntry = motifEntries[0]

    for (const entry of motifEntries) {
      if (
        ascents.length > 0
        && getChallengeMedalRank(entry.challengeMedal) <= getChallengeMedalRank(ascents[ascents.length - 1].medal)
      ) {
        continue
      }

      bestEntry = entry
      ascents.push({
        medal: entry.challengeMedal,
        time: entry.time,
        moves: entry.moves,
        date: entry.completedAt,
        config: entry.config,
      })
    }
    const motifSeries = challengeSeries
      .flatMap((series): MotifChallengeSeries[] => {
        const bestAttempt = series.bestAttempt
        const bestMedal = series.bestMedal
        if (!bestAttempt || !bestMedal || getGalleryMotifKey(bestAttempt) !== motifKey) return []

        return [{
          targetId: series.targetId,
          targetTime: series.targetEntry?.time ?? null,
          targetMoves: series.targetEntry?.moves ?? null,
          targetConfig: series.targetEntry ? formatConfig(series.targetEntry.config) : null,
          targetDifficultyLabel: series.targetEntry ? formatDifficultyLabel(series.targetEntry.config) : null,
          bestAttemptId: bestAttempt.id,
          bestAttemptTime: bestAttempt.time,
          bestAttemptMoves: bestAttempt.moves,
          bestMedal,
          attemptCount: series.attempts.length,
          timeDeltaToTarget: series.targetEntry ? bestAttempt.time - series.targetEntry.time : null,
          movesDeltaToTarget: series.targetEntry ? bestAttempt.moves - series.targetEntry.moves : null,
        }]
      })

    return {
      motifKey,
      previewImage: bestEntry.previewImage ?? bestEntry.sourceImage,
      bestEntryId: motifSeries[0]?.bestAttemptId ?? bestEntry.id,
      bestMedal: bestEntry.challengeMedal,
      bestMedalLabel: formatChallengeMedalLabel(bestEntry.challengeMedal),
      ascents,
      latestAscentDate: bestEntry.completedAt,
      configs: configs.map(formatConfig),
      series: motifSeries,
    }
  })
}
