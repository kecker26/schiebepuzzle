import { describe, expect, it } from 'vitest'
import type { SolvedGalleryEntry } from '../types/index.ts'
import {
  buildGalleryDisplayEntries,
  buildGalleryChallengeSeries,
  buildGalleryChallengeMedalHistory,
  buildGalleryMedalCollection,
  buildGalleryTimelineRelations,
  getGalleryMedalHuntStatus,
  getGalleryMedalHuntRecommendation,
  getSimilarGalleryEntries,
  getUniqueGalleryMotifEntryIds,
  matchesGalleryMedalHuntFilter,
  matchesGalleryMedalFilter,
  sortGalleryDisplayEntries,
} from '../screens/upload/UploadGalleryDisplayUtils.ts'
import { galleryDisplayEntryMatchesAllTagKeys, getGalleryTagKey } from '../screens/upload/UploadGalleryPanel.tsx'
import { getChallengeMedalProgress } from '../utils/galleryChallenge.ts'

function createGalleryEntry(
  id: string,
  overrides: Partial<SolvedGalleryEntry> = {}
): SolvedGalleryEntry {
  return {
    id,
    completedAt: '2026-04-24T12:00:00.000Z',
    previewImage: 'preview-a',
    sourceImage: 'source-a',
    config: { rows: 4, cols: 4 },
    moves: 40,
    time: 120,
    actionMoves: 46,
    assistanceMode: 'hinted',
    hasDetailedProfile: true,
    ...overrides,
  }
}

describe('UploadGalleryDisplayUtils', () => {
  it('verknuepft gleiche Motive ueber mehrere Schwierigkeitsstufen fuer Replay-Metadaten', () => {
    const entries = buildGalleryDisplayEntries(
      [
        createGalleryEntry('motif-a-4x4-latest', {
          completedAt: '2026-04-24T12:00:00.000Z',
          config: { rows: 4, cols: 4 },
          time: 132,
          moves: 44,
          assistanceMode: 'hinted',
        }),
        createGalleryEntry('motif-a-4x4-best', {
          completedAt: '2026-04-20T12:00:00.000Z',
          config: { rows: 4, cols: 4 },
          time: 110,
          moves: 38,
          assistanceMode: 'auto-assisted',
        }),
        createGalleryEntry('motif-a-5x5-clean', {
          completedAt: '2026-04-22T12:00:00.000Z',
          config: { rows: 5, cols: 5 },
          time: 205,
          moves: 70,
          assistanceMode: 'clean',
        }),
        createGalleryEntry('motif-b-4x4', {
          completedAt: '2026-04-23T12:00:00.000Z',
          previewImage: 'preview-b',
          sourceImage: 'source-b',
          config: { rows: 4, cols: 4 },
          time: 95,
          moves: 35,
          assistanceMode: 'clean',
        }),
      ],
      {
        difficultyFilter: 'all',
        assistanceFilter: 'all',
      }
    )

    const targetEntry = entries.find(
      (entry) =>
        entry.representativeEntry.id === 'motif-a-4x4-latest'
        && entry.representativeEntry.config.rows === 4
        && entry.representativeEntry.config.cols === 4
    )

    expect(targetEntry).toBeDefined()
    expect(targetEntry).toMatchObject({
      totalSolveCount: 3,
      visibleSolveCount: 3,
      motifReplaySummary: {
        totalSolveCount: 3,
        replayableSolveCount: 3,
        difficultyVariants: [
          { rows: 4, cols: 4 },
          { rows: 5, cols: 5 },
        ],
      },
    })
    expect(targetEntry?.motifReplaySummary.lastReplayableEntry?.id).toBe('motif-a-4x4-latest')
    expect(targetEntry?.motifReplaySummary.bestTimeEntry?.id).toBe('motif-a-4x4-best')
    expect(targetEntry?.motifReplaySummary.bestMovesEntry?.id).toBe('motif-a-4x4-best')
    expect(targetEntry?.motifReplaySummary.bestCleanTimeEntry?.id).toBe('motif-a-5x5-clean')
    expect(targetEntry?.motifReplaySummary.allEntries.map((entry) => entry.id)).toEqual([
      'motif-a-4x4-latest',
      'motif-a-5x5-clean',
      'motif-a-4x4-best',
    ])
  })

  it('behaelt motivweite Replay-Daten auch dann, wenn die sichtbare Karte gefiltert ist', () => {
    const entries = buildGalleryDisplayEntries(
      [
        createGalleryEntry('motif-a-4x4-hinted', {
          completedAt: '2026-04-24T12:00:00.000Z',
          config: { rows: 4, cols: 4 },
          assistanceMode: 'hinted',
        }),
        createGalleryEntry('motif-a-5x5-clean', {
          completedAt: '2026-04-22T12:00:00.000Z',
          config: { rows: 5, cols: 5 },
          assistanceMode: 'clean',
          time: 210,
        }),
      ],
      {
        difficultyFilter: 'all',
        assistanceFilter: 'clean',
      }
    )

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      totalSolveCount: 2,
      visibleSolveCount: 1,
      motifReplaySummary: {
        totalSolveCount: 2,
        replayableSolveCount: 2,
        difficultyVariants: [
          { rows: 4, cols: 4 },
          { rows: 5, cols: 5 },
        ],
      },
    })
  })

  it('ermittelt die beste Challenge-Medaille motivweit', () => {
    const [entry] = buildGalleryDisplayEntries(
      [
        createGalleryEntry('challenge-bronze', {
          challengeTargetId: 'target-a',
          challengeMedal: 'bronze',
        }),
        createGalleryEntry('challenge-gold', {
          completedAt: '2026-04-23T12:00:00.000Z',
          challengeTargetId: 'target-b',
          challengeMedal: 'gold',
        }),
        createGalleryEntry('normal-run', {
          completedAt: '2026-04-22T12:00:00.000Z',
        }),
      ],
      {
        difficultyFilter: 'all',
        assistanceFilter: 'all',
      }
    )

    expect(entry.motifReplaySummary).toMatchObject({
      bestChallengeMedal: 'gold',
      challengeSolveCount: 2,
    })
  })

  it('zaehlt jedes Motiv genau einmal nach seiner besten Challenge-Medaille', () => {
    const entries = buildGalleryDisplayEntries(
      [
        createGalleryEntry('motif-a-silver', {
          challengeTargetId: 'target-a',
          challengeMedal: 'silver',
        }),
        createGalleryEntry('motif-a-gold', {
          completedAt: '2026-04-23T12:00:00.000Z',
          challengeTargetId: 'target-a',
          challengeMedal: 'gold',
        }),
        createGalleryEntry('motif-b-bronze', {
          sourceImage: 'source-b',
          previewImage: 'preview-b',
          challengeTargetId: 'target-b',
          challengeMedal: 'bronze',
        }),
        createGalleryEntry('motif-c-normal', {
          sourceImage: 'source-c',
          previewImage: 'preview-c',
        }),
      ],
      {
        difficultyFilter: 'all',
        assistanceFilter: 'all',
      }
    )

    expect(buildGalleryMedalCollection(entries)).toEqual([
      { medal: 'diamond', count: 0 },
      { medal: 'gold', count: 1 },
      { medal: 'silver', count: 0 },
      { medal: 'bronze', count: 1 },
    ])
    expect(entries.filter((entry) => matchesGalleryMedalFilter(entry, 'gold'))).toHaveLength(1)
    expect(entries.filter((entry) => matchesGalleryMedalFilter(entry, 'all'))).toHaveLength(3)
  })

  it('filtert Medaillen-Jagden und sortiert nach Upgrade-Potenzial', () => {
    const entries = buildGalleryDisplayEntries(
      [
        createGalleryEntry('silver-target', {
          sourceImage: 'source-silver',
          previewImage: 'preview-silver',
          moves: 40,
          time: 100,
        }),
        createGalleryEntry('silver-attempt', {
          sourceImage: 'source-silver',
          previewImage: 'preview-silver',
          challengeTargetId: 'silver-target',
          challengeMedal: 'silver',
          assistanceMode: 'clean',
          moves: 41,
          time: 101,
        }),
        createGalleryEntry('gold-target', {
          sourceImage: 'source-gold',
          previewImage: 'preview-gold',
        }),
        createGalleryEntry('gold-attempt', {
          sourceImage: 'source-gold',
          previewImage: 'preview-gold',
          challengeTargetId: 'gold-target',
          challengeMedal: 'gold',
        }),
        createGalleryEntry('normal-run', {
          sourceImage: 'source-normal',
          previewImage: 'preview-normal',
        }),
      ],
      {
        difficultyFilter: 'all',
        assistanceFilter: 'all',
      }
    )

    const silverEntry = entries.find((entry) => entry.motifId === 'source-silver')
    expect(silverEntry).toBeDefined()
    expect(silverEntry ? getGalleryMedalHuntStatus(silverEntry) : null).toMatchObject({
      bestMedal: 'silver',
      nextMedal: 'gold',
      upgradeable: true,
      nearUpgrade: true,
    })
    expect(silverEntry
      ? getGalleryMedalHuntRecommendation(getGalleryMedalHuntStatus(silverEntry))
      : null
    ).toMatchObject({
      label: 'Nah am Upgrade',
      tone: 'near',
    })
    expect(entries.filter((entry) => matchesGalleryMedalHuntFilter(entry, 'no-medal'))).toHaveLength(1)
    expect(entries.filter((entry) => matchesGalleryMedalHuntFilter(entry, 'no-gold'))).toHaveLength(2)
    expect(entries.filter((entry) => matchesGalleryMedalHuntFilter(entry, 'upgradeable'))).toHaveLength(2)
    expect(entries.filter((entry) => matchesGalleryMedalHuntFilter(entry, 'near-upgrade'))).toEqual([silverEntry])
    expect(sortGalleryDisplayEntries(entries, 'upgrade-potential').map((entry) => entry.motifId)).toEqual([
      'source-silver',
      'source-normal',
      'source-gold',
    ])
  })

  it('beschreibt neue, offene und abgeschlossene Medaillen-Jagden verstaendlich', () => {
    expect(getGalleryMedalHuntRecommendation({
      bestMedal: null,
      nextMedal: 'bronze',
      hasStarted: false,
      upgradeable: true,
      nearUpgrade: false,
      proximityScore: null,
    })).toMatchObject({
      label: 'Erste Medaille holen',
      tone: 'new',
    })

    expect(getGalleryMedalHuntRecommendation({
      bestMedal: 'silver',
      nextMedal: 'gold',
      hasStarted: true,
      upgradeable: true,
      nearUpgrade: false,
      proximityScore: 0.35,
    })).toMatchObject({
      label: 'Upgrade in Reichweite',
      tone: 'reachable',
    })

    expect(getGalleryMedalHuntRecommendation({
      bestMedal: 'gold',
      nextMedal: null,
      hasStarted: true,
      upgradeable: false,
      nearUpgrade: false,
      proximityScore: null,
    })).toMatchObject({
      label: 'Hoechste verfuegbare Stufe',
      tone: 'complete',
    })
  })

  it('markiert die beste Medaille und das naechste erreichbare Motiv-Ziel', () => {
    const target = createGalleryEntry('target', {
      moves: 20,
      replaySetup: {
        version: 1,
        startBoard: [],
        emptyIndex: 0,
        shuffleMoves: [],
        optimalStartMoveCount: 20,
        optimalStartMoveCountKind: 'exact',
      },
    })
    const progress = getChallengeMedalProgress([
      target,
      createGalleryEntry('silver-attempt', {
        challengeTargetId: target.id,
        challengeMedal: 'silver',
      }),
    ])

    expect(progress).toMatchObject({
      currentMedal: 'silver',
      nextMedal: 'diamond',
      stages: [
        { medal: 'bronze', status: 'completed' },
        { medal: 'silver', status: 'current' },
        { medal: 'gold', status: 'unavailable' },
        { medal: 'diamond', status: 'next' },
      ],
    })
    expect(progress?.label).toContain('Gold ist fuer die beste Vorlage nicht erreichbar')
  })

  it('markiert Diamant ohne exaktes Solver-Optimum als nicht verfuegbar', () => {
    const target = createGalleryEntry('target')
    const progress = getChallengeMedalProgress([
      target,
      createGalleryEntry('gold-attempt', {
        challengeTargetId: target.id,
        challengeMedal: 'gold',
      }),
    ])

    expect(progress?.nextMedal).toBeNull()
    expect(progress?.stages[progress.stages.length - 1]).toEqual({ medal: 'diamond', status: 'unavailable' })
  })

  it('zeigt fuer Motive ohne Challenge-Medaille Bronze als erstes Ziel', () => {
    const progress = getChallengeMedalProgress([createGalleryEntry('normal-run')])

    expect(progress).toMatchObject({
      currentMedal: null,
      nextMedal: 'bronze',
      stages: [
        { medal: 'bronze', status: 'next' },
        { medal: 'silver', status: 'locked' },
        { medal: 'gold', status: 'locked' },
        { medal: 'diamond', status: 'locked' },
      ],
    })
    expect(progress.label).toContain('Noch keine Challenge-Medaille')
  })

  it('gruppiert Challenge-Versuche nach Vorlage und ermittelt den besten Versuch', () => {
    const target = createGalleryEntry('target', { time: 120, moves: 40 })
    const series = buildGalleryChallengeSeries([
      target,
      createGalleryEntry('bronze-attempt', {
        completedAt: '2026-04-23T12:00:00.000Z',
        time: 130,
        moves: 43,
        challengeTargetId: target.id,
        challengeMedal: 'bronze',
      }),
      createGalleryEntry('silver-attempt', {
        completedAt: '2026-04-24T12:00:00.000Z',
        time: 110,
        moves: 42,
        challengeTargetId: target.id,
        challengeMedal: 'silver',
      }),
      createGalleryEntry('gold-attempt', {
        completedAt: '2026-04-22T12:00:00.000Z',
        time: 115,
        moves: 38,
        challengeTargetId: target.id,
        challengeMedal: 'gold',
      }),
    ])

    expect(series).toHaveLength(1)
    expect(series[0]).toMatchObject({
      targetId: 'target',
      targetEntry: { id: 'target' },
      bestAttempt: { id: 'gold-attempt' },
      bestMedal: 'gold',
      improvedAttemptCount: 2,
    })
    expect(series[0].attempts.map((attempt) => attempt.id)).toEqual([
      'gold-attempt',
      'silver-attempt',
      'bronze-attempt',
    ])
    expect(series[0].medalHistory.map(({ attempt, medal, trend }) => ({
      attemptId: attempt.id,
      medal,
      trend,
    }))).toEqual([
      { attemptId: 'gold-attempt', medal: 'gold', trend: 'start' },
      { attemptId: 'bronze-attempt', medal: 'bronze', trend: 'downgrade' },
      { attemptId: 'silver-attempt', medal: 'silver', trend: 'upgrade' },
    ])
  })

  it('erkennt bestaetigte Medaillen und Aufstiege chronologisch', () => {
    const history = buildGalleryChallengeMedalHistory([
      createGalleryEntry('silver-later', {
        completedAt: '2026-04-24T12:00:00.000Z',
        challengeMedal: 'silver',
      }),
      createGalleryEntry('bronze-first', {
        completedAt: '2026-04-21T12:00:00.000Z',
        challengeMedal: 'bronze',
      }),
      createGalleryEntry('bronze-confirmed', {
        completedAt: '2026-04-22T12:00:00.000Z',
        challengeMedal: 'bronze',
      }),
    ])

    expect(history.map(({ medal, trend }) => ({ medal, trend }))).toEqual([
      { medal: 'bronze', trend: 'start' },
      { medal: 'bronze', trend: 'confirmed' },
      { medal: 'silver', trend: 'upgrade' },
    ])
  })

  it('behaelt Challenge-Serien bei fehlender Vorlage darstellbar', () => {
    const [series] = buildGalleryChallengeSeries([
      createGalleryEntry('orphan-attempt', {
        challengeTargetId: 'deleted-target',
        challengeMedal: 'silver',
      }),
    ])

    expect(series).toMatchObject({
      targetId: 'deleted-target',
      targetEntry: null,
      bestMedal: 'silver',
      improvedAttemptCount: 1,
    })
  })

  it('ordnet Vorlagen und auch spaetere Challenge-Versuche derselben Serie zu', () => {
    const target = createGalleryEntry('target')
    const firstAttempt = createGalleryEntry('first-attempt', {
      completedAt: '2026-04-22T12:00:00.000Z',
      challengeTargetId: target.id,
      challengeMedal: 'silver',
    })
    const laterAttempt = createGalleryEntry('later-attempt', {
      completedAt: '2026-04-24T12:00:00.000Z',
      challengeTargetId: target.id,
      challengeMedal: 'gold',
    })
    const relations = buildGalleryTimelineRelations([laterAttempt, target, firstAttempt])

    expect(relations.targetsByEntryId.get(target.id)).toMatchObject({
      seriesNumber: 1,
      series: { targetId: target.id },
    })
    expect(relations.attemptsByEntryId.get(firstAttempt.id)).toMatchObject({
      seriesNumber: 1,
      attemptNumber: 1,
    })
    expect(relations.attemptsByEntryId.get(laterAttempt.id)).toMatchObject({
      seriesNumber: 1,
      attemptNumber: 2,
    })
  })

  it('kann einen Challenge-Versuch zugleich als Vorlage einer spaeteren Serie markieren', () => {
    const originalTarget = createGalleryEntry('original-target')
    const firstAttempt = createGalleryEntry('first-attempt', {
      challengeTargetId: originalTarget.id,
      challengeMedal: 'silver',
    })
    const followUpAttempt = createGalleryEntry('follow-up-attempt', {
      challengeTargetId: firstAttempt.id,
      challengeMedal: 'gold',
    })
    const relations = buildGalleryTimelineRelations([followUpAttempt, firstAttempt, originalTarget])

    expect(relations.attemptsByEntryId.has(firstAttempt.id)).toBe(true)
    expect(relations.targetsByEntryId.has(firstAttempt.id)).toBe(true)
    expect(relations.attemptsByEntryId.get(followUpAttempt.id)?.series.targetId).toBe(firstAttempt.id)
  })

  it('markiert Motive ohne gespeichertes Bild defensiv als nicht replaybar', () => {
    const entries = buildGalleryDisplayEntries(
      [
        createGalleryEntry('missing-image', {
          previewImage: null,
          sourceImage: null,
          hasDetailedProfile: false,
        }),
      ],
      {
        difficultyFilter: 'all',
        assistanceFilter: 'all',
      }
    )

    expect(entries).toHaveLength(1)
    expect(entries[0].motifReplaySummary).toMatchObject({
      totalSolveCount: 1,
      replayableSolveCount: 0,
      lastReplayableEntry: null,
      bestTimeEntry: null,
      bestMovesEntry: null,
      bestCleanTimeEntry: null,
    })
  })

  it('dedupliziert Galerie-Eintraege motivweit fuer Sammlungen', () => {
    const ids = getUniqueGalleryMotifEntryIds([
      createGalleryEntry('motif-a-latest', {
        completedAt: '2026-04-24T12:00:00.000Z',
        previewImage: 'preview-a',
        sourceImage: 'source-a',
        config: { rows: 4, cols: 4 },
      }),
      createGalleryEntry('motif-a-other-run', {
        completedAt: '2026-04-23T12:00:00.000Z',
        previewImage: 'preview-a',
        sourceImage: 'source-a',
        config: { rows: 5, cols: 5 },
      }),
      createGalleryEntry('motif-b', {
        completedAt: '2026-04-22T12:00:00.000Z',
        previewImage: 'preview-b',
        sourceImage: 'source-b',
      }),
    ])

    expect(ids).toEqual(['motif-a-latest', 'motif-b'])
  })

  it('filtert Galerie-Karten nur, wenn alle ausgewaehlten Tags am Motiv vorhanden sind', () => {
    const entry = {
      visibleEntries: [
        createGalleryEntry('motif-a-latest', {
          tags: [
            { label: 'Wald', confidence: 0.92, source: 'gemini' },
            { label: 'See', confidence: 0.88, source: 'gemini' },
          ],
        }),
      ],
    }

    expect(galleryDisplayEntryMatchesAllTagKeys(entry, [getGalleryTagKey('wald'), getGalleryTagKey('see')])).toBe(true)
    expect(galleryDisplayEntryMatchesAllTagKeys(entry, [getGalleryTagKey('wald'), getGalleryTagKey('stadt')])).toBe(false)
  })

  it('sortiert aehnliche Galerie-Motive nach Tag-Ueberschneidung und Loesungshaeufigkeit', () => {
    const entries = buildGalleryDisplayEntries(
      [
        createGalleryEntry('motif-a', {
          previewImage: 'preview-a',
          sourceImage: 'source-a',
          tags: [
            { label: 'Wald', confidence: 0.9, source: 'gemini' },
            { label: 'See', confidence: 0.8, source: 'gemini' },
            { label: 'Berge', confidence: 0.7, source: 'gemini' },
          ],
        }),
        createGalleryEntry('motif-b-run-1', {
          previewImage: 'preview-b',
          sourceImage: 'source-b',
          tags: [
            { label: 'Wald', confidence: 0.9, source: 'gemini' },
            { label: 'See', confidence: 0.8, source: 'gemini' },
          ],
        }),
        createGalleryEntry('motif-b-run-2', {
          previewImage: 'preview-b',
          sourceImage: 'source-b',
          completedAt: '2026-04-23T12:00:00.000Z',
          tags: [
            { label: 'Wald', confidence: 0.9, source: 'gemini' },
          ],
        }),
        createGalleryEntry('motif-c', {
          previewImage: 'preview-c',
          sourceImage: 'source-c',
          tags: [
            { label: 'Berge', confidence: 0.7, source: 'gemini' },
            { label: 'Stadt', confidence: 0.6, source: 'gemini' },
          ],
        }),
        createGalleryEntry('motif-d', {
          previewImage: 'preview-d',
          sourceImage: 'source-d',
          tags: [
            { label: 'Architektur', confidence: 0.8, source: 'gemini' },
          ],
        }),
      ],
      {
        difficultyFilter: 'all',
        assistanceFilter: 'all',
      }
    )
    const current = entries.find((entry) => entry.representativeEntry.id === 'motif-a')

    expect(current).toBeDefined()
    expect(getSimilarGalleryEntries(current as NonNullable<typeof current>, entries).map((entry) => entry.representativeEntry.id)).toEqual([
      'motif-b-run-1',
      'motif-c',
    ])
  })
})
