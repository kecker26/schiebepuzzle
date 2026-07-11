import { describe, expect, it } from 'vitest'
import type { ChallengeMedal, SolvedGalleryEntry } from '../types/index.ts'
import {
  buildGroupedMotifCards,
  buildMedalDistribution,
  buildMedalTrend,
} from '../screens/upload/UploadMedalStatsUtils.ts'

function createEntry(
  id: string,
  sourceImage: string,
  completedAt: string,
  challengeMedal?: ChallengeMedal,
  config: SolvedGalleryEntry['config'] = { rows: 3, cols: 3 }
): SolvedGalleryEntry {
  return {
    id,
    completedAt,
    previewImage: sourceImage,
    sourceImage,
    config,
    moves: 20,
    time: 60,
    actionMoves: 20,
    assistanceMode: 'clean',
    hasDetailedProfile: true,
    challengeMedal,
  }
}

describe('UploadMedalStatsUtils', () => {
  it('zählt pro Motiv ausschließlich die beste Medaille', () => {
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

  it('gruppiert Medaillen-Aufstiege pro Motiv', () => {
    const cards = buildGroupedMotifCards([
      createEntry('a-bronze', 'motif-a', '2026-06-01T10:00:00.000Z', 'bronze'),
      createEntry('b-silver', 'motif-b', '2026-06-02T10:00:00.000Z', 'silver'),
      createEntry('a-gold', 'motif-a', '2026-06-03T10:00:00.000Z', 'gold'),
      createEntry('b-diamond', 'motif-b', '2026-06-04T10:00:00.000Z', 'diamond'),
    ])

    expect(cards).toHaveLength(2)
    expect(cards.map((card) => card.motifKey)).toEqual(['motif-a', 'motif-b'])
  })

  it('sammelt nur echte Aufstiege und verwendet den ersten besten Lauf', () => {
    const bronze = createEntry('bronze', 'motif-a', '2026-06-01T10:00:00.000Z', 'bronze')
    bronze.time = 90
    bronze.moves = 30
    const silver = createEntry('silver', 'motif-a', '2026-06-03T10:00:00.000Z', 'silver')
    silver.time = 60
    silver.moves = 20
    const cards = buildGroupedMotifCards([
      bronze,
      createEntry('bronze-repeat', 'motif-a', '2026-06-02T10:00:00.000Z', 'bronze'),
      silver,
      createEntry('silver-repeat', 'motif-a', '2026-06-04T10:00:00.000Z', 'silver'),
    ])

    expect(cards[0].ascents.map((ascent) => ascent.medal)).toEqual(['bronze', 'silver'])
    expect(cards[0].bestEntryId).toBe('silver')
    expect(cards[0].latestAscentDate).toBe('2026-06-03T10:00:00.000Z')
  })

  it('sammelt und sortiert alle Rastergroessen mit Medaille', () => {
    const cards = buildGroupedMotifCards([
      createEntry('large', 'motif-a', '2026-06-01T10:00:00.000Z', 'bronze', { rows: 4, cols: 4 }),
      createEntry('wide', 'motif-a', '2026-06-02T10:00:00.000Z', 'bronze', { rows: 3, cols: 4 }),
      createEntry('small', 'motif-a', '2026-06-03T10:00:00.000Z', 'silver', { rows: 3, cols: 3 }),
    ])

    expect(cards[0].configs).toEqual(['3\u00d73', '3\u00d74', '4\u00d74'])
  })

  it('liest die Kerndaten aus der Challenge-Vorlage des besten Aufstiegs', () => {
    const target = createEntry('target', 'motif-a', '2026-06-01T09:00:00.000Z', undefined, { rows: 4, cols: 4 })
    target.time = 75
    target.moves = 48
    const silver = createEntry('silver', 'motif-a', '2026-06-02T10:00:00.000Z', 'silver')
    silver.challengeTargetId = target.id
    silver.time = 60
    silver.moves = 40

    const cards = buildGroupedMotifCards([target, silver])

    expect(cards[0].series).toHaveLength(1)
    expect(cards[0].series[0]).toMatchObject({
      targetId: 'target',
      targetConfig: '4\u00d74',
      targetDifficultyLabel: 'Normal 4x4',
      targetTime: 75,
      targetMoves: 48,
      bestAttemptId: 'silver',
      bestAttemptTime: 60,
      bestAttemptMoves: 40,
      timeDeltaToTarget: -15,
      movesDeltaToTarget: -8,
      attemptCount: 1,
    })
  })

  it('trennt mehrere Challenge-Serien desselben Motivs', () => {
    const firstTarget = createEntry('target-a', 'motif-a', '2026-06-01T09:00:00.000Z')
    const firstAttempt = createEntry('attempt-a', 'motif-a', '2026-06-02T10:00:00.000Z', 'bronze')
    firstAttempt.challengeTargetId = firstTarget.id
    const secondTarget = createEntry('target-b', 'motif-a', '2026-06-03T09:00:00.000Z')
    const secondAttempt = createEntry('attempt-b', 'motif-a', '2026-06-04T10:00:00.000Z', 'silver')
    secondAttempt.challengeTargetId = secondTarget.id

    const cards = buildGroupedMotifCards([firstTarget, firstAttempt, secondTarget, secondAttempt])

    expect(cards).toHaveLength(1)
    expect(cards[0].series.map((series) => series.targetId)).toEqual(['target-b', 'target-a'])
  })

  it('setzt die beste Medaille und sortiert Aufstiege stabil chronologisch', () => {
    const cards = buildGroupedMotifCards([
      createEntry('gold', 'motif-a', '2026-06-03T10:00:00.000Z', 'gold'),
      createEntry('bronze', 'motif-a', 'ungueltig', 'bronze'),
      createEntry('silver', 'motif-a', '2026-06-02T10:00:00.000Z', 'silver'),
    ])

    expect(cards[0].bestMedal).toBe('gold')
    expect(cards[0].ascents.map((ascent) => ascent.medal)).toEqual(['bronze', 'silver', 'gold'])
  })
})
