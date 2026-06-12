import type { ChallengeMedal, SolvedGalleryEntry } from '../../types/index.ts'
import {
  formatChallengeMedalLabel,
  getChallengeMedalRank,
} from '../../utils/galleryChallenge.ts'
import { getGalleryMotifKey } from './UploadGalleryDisplayUtils.ts'

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

function getTimestamp(entry: Pick<SolvedGalleryEntry, 'completedAt'>): number {
  const parsed = Date.parse(entry.completedAt)
  return Number.isNaN(parsed) ? 0 : parsed
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
  const challengeEntries = entries
    .filter((entry): entry is SolvedGalleryEntry & { challengeMedal: ChallengeMedal } => Boolean(entry.challengeMedal))
    .sort((left, right) => getTimestamp(left) - getTimestamp(right))
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
