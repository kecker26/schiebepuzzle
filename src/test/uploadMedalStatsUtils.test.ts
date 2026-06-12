import { describe, expect, it } from 'vitest'
import type { ChallengeMedal, SolvedGalleryEntry } from '../types/index.ts'
import {
  buildMedalDistribution,
  buildMedalTrend,
} from '../screens/upload/UploadMedalStatsUtils.ts'

function createEntry(
  id: string,
  sourceImage: string,
  completedAt: string,
  challengeMedal?: ChallengeMedal
): SolvedGalleryEntry {
  return {
    id,
    completedAt,
    previewImage: sourceImage,
    sourceImage,
    config: { rows: 3, cols: 3 },
    moves: 20,
    time: 60,
    actionMoves: 20,
    assistanceMode: 'clean',
    hasDetailedProfile: true,
    challengeMedal,
  }
}

describe('UploadMedalStatsUtils', () => {
  it('zaehlt pro Motiv ausschliesslich die beste Medaille', () => {
    const distribution = buildMedalDistribution([
      createEntry('a-bronze', 'motif-a', '2026-06-01T10:00:00.000Z', 'bronze'),
      createEntry('a-silver', 'motif-a', '2026-06-02T10:00:00.000Z', 'silver'),
      createEntry('b-gold', 'motif-b', '2026-06-03T10:00:00.000Z', 'gold'),
      createEntry('c-normal', 'motif-c', '2026-06-04T10:00:00.000Z'),
    ])

    expect(distribution.map(({ key, value }) => ({ key, value }))).toEqual([
      { key: 'diamond', value: 0 },
      { key: 'gold', value: 1 },
      { key: 'silver', value: 1 },
      { key: 'bronze', value: 0 },
    ])
  })

  it('verschiebt ein Motiv bei einem Upgrade in die hoehere Trend-Stufe', () => {
    const trend = buildMedalTrend([
      createEntry('a-bronze', 'motif-a', '2026-06-01T10:00:00.000Z', 'bronze'),
      createEntry('a-bronze-repeat', 'motif-a', '2026-06-02T10:00:00.000Z', 'bronze'),
      createEntry('b-silver', 'motif-b', '2026-06-03T10:00:00.000Z', 'silver'),
      createEntry('a-gold', 'motif-a', '2026-06-04T10:00:00.000Z', 'gold'),
    ])

    expect(trend).toHaveLength(3)
    expect(trend.map(({ previousMedal, medal }) => ({ previousMedal, medal }))).toEqual([
      { previousMedal: null, medal: 'bronze' },
      { previousMedal: null, medal: 'silver' },
      { previousMedal: 'bronze', medal: 'gold' },
    ])
    expect(trend.map(({ bronze, silver, gold, motifCount }) => ({
      bronze,
      silver,
      gold,
      motifCount,
    }))).toEqual([
      { bronze: 1, silver: 0, gold: 0, motifCount: 1 },
      { bronze: 1, silver: 1, gold: 0, motifCount: 2 },
      { bronze: 0, silver: 1, gold: 1, motifCount: 2 },
    ])
  })
})
