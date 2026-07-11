import { describe, expect, it } from 'vitest'
import type { SolvedGalleryEntry } from '../types/index.ts'
import {
  buildGalleryDisplayEntries,
  buildGalleryChallengeSeries,
  buildGalleryChallengeMedalHistory,
  buildGalleryMedalCollection,
  buildGalleryStartStateRelations,
  buildGalleryStartStateSeries,
  buildGalleryTimelineRelations,
  getGalleryMedalHuntSortRank,
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

const replaySetup = {
  version: 1,
  startBoard: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  emptyIndex: 15,
  shuffleMoves: ['tile-14'],
  optimalStartMoveCount: 1,
  optimalStartMoveCountKind: 'exact',
} satisfies NonNullable<SolvedGalleryEntry['replaySetup']>

describe('UploadGalleryDisplayUtils', () => {
  it('verknuepft gleiche Motive über mehrere Schwierigkeitsstufen für Replay-Metadaten', () => {
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

  it('zählt jedes Motiv genau einmal nach seiner besten Challenge-Medaille', () => {
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
          moves: 33,
          time: 81,
        }),
        createGalleryEntry('bronze-fast-target', {
          sourceImage: 'source-bronze-fast',
          previewImage: 'preview-bronze-fast',
          moves: 40,
          time: 100,
        }),
        createGalleryEntry('bronze-fast-attempt', {
          sourceImage: 'source-bronze-fast',
          previewImage: 'preview-bronze-fast',
          challengeTargetId: 'bronze-fast-target',
          challengeMedal: 'bronze',
          assistanceMode: 'clean',
          moves: 60,
          time: 130,
        }),
        createGalleryEntry('bronze-slow-target', {
          sourceImage: 'source-bronze-slow',
          previewImage: 'preview-bronze-slow',
          moves: 40,
          time: 100,
        }),
        createGalleryEntry('bronze-slow-attempt', {
          sourceImage: 'source-bronze-slow',
          previewImage: 'preview-bronze-slow',
          challengeTargetId: 'bronze-slow-target',
          challengeMedal: 'bronze',
          assistanceMode: 'clean',
          moves: 50,
          time: 135,
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
        createGalleryEntry('bronze-candidate', {
          sourceImage: 'source-bronze-candidate',
          previewImage: 'preview-bronze-candidate',
          assistanceMode: 'clean',
          replaySetup,
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
      label: 'Zeit: 1 Sek. schneller',
      detail: 'Züge: 1 Zug weniger',
      tone: 'near',
    })
    const bronzeCandidate = entries.find((entry) => entry.motifId === 'source-bronze-candidate')
    expect(bronzeCandidate).toBeDefined()
    expect(bronzeCandidate ? getGalleryMedalHuntStatus(bronzeCandidate) : null).toMatchObject({
      bestMedal: null,
      nextMedal: 'bronze',
      upgradeable: true,
      nearUpgrade: true,
    })
    expect(entries.filter((entry) => matchesGalleryMedalHuntFilter(entry, 'no-medal'))).toHaveLength(2)
    expect(entries.filter((entry) => matchesGalleryMedalHuntFilter(entry, 'no-gold'))).toHaveLength(5)
    expect(entries.filter((entry) => matchesGalleryMedalHuntFilter(entry, 'upgradeable'))).toHaveLength(5)
    expect(sortGalleryDisplayEntries(entries, 'upgrade-potential').map((entry) => entry.motifId)).toEqual([
      'source-bronze-candidate',
      'source-bronze-fast',
      'source-bronze-slow',
      'source-silver',
      'source-gold',
      'source-normal',
    ])
    expect(getGalleryMedalHuntSortRank('bronze')).toBe(0)
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
      label: 'Höchste verfügbare Stufe',
      tone: 'complete',
    })
  })

  it('markiert die beste Medaille und das nächste erreichbare Motiv-Ziel', () => {
    const target = createGalleryEntry('target', {
      moves: 100,
      replaySetup: {
        version: 1,
        startBoard: [],
        emptyIndex: 0,
        shuffleMoves: [],
        optimalStartMoveCount: 70,
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
      nextMedal: 'gold',
      stages: [
        { medal: 'bronze', status: 'completed' },
        { medal: 'silver', status: 'current' },
        { medal: 'gold', status: 'next' },
        { medal: 'diamond', status: 'locked' },
      ],
    })
    expect(progress?.label).toContain('Nächstes Ziel: Gold')
  })

  it('laesst Diamant ohne exaktes Solver-Optimum als nächstes Ziel offen', () => {
    const target = createGalleryEntry('target')
    const progress = getChallengeMedalProgress([
      target,
      createGalleryEntry('gold-attempt', {
        challengeTargetId: target.id,
        challengeMedal: 'gold',
      }),
    ])

    expect(progress?.nextMedal).toBe('diamond')
    expect(progress?.stages[progress.stages.length - 1]).toEqual({ medal: 'diamond', status: 'next' })
  })

  it('bewahrt historische Goldmedaillen unter der neuen 20-Prozent-Regel', () => {
    const target = createGalleryEntry('target', {
      moves: 100,
      replaySetup: {
        version: 1,
        startBoard: [],
        emptyIndex: 0,
        shuffleMoves: [],
        optimalStartMoveCount: 81,
        optimalStartMoveCountKind: 'exact',
      },
    })
    const progress = getChallengeMedalProgress([
      target,
      createGalleryEntry('historical-gold', {
        challengeTargetId: target.id,
        challengeMedal: 'gold',
      }),
    ])

    expect(progress.currentMedal).toBe('gold')
    expect(progress.stages).toContainEqual({ medal: 'gold', status: 'current' })
    expect(progress.stages).toContainEqual({ medal: 'diamond', status: 'next' })
    expect(progress.label).not.toContain('Gold ist für die beste Vorlage nicht erreichbar')
  })

  it('markiert nicht erreichbare hoehere Medaillen im Fortschritt', () => {
    const target = createGalleryEntry('target', {
      moves: 1,
    })
    const progress = getChallengeMedalProgress([
      target,
      createGalleryEntry('bronze-attempt', {
        challengeTargetId: target.id,
        challengeMedal: 'bronze',
        moves: 1,
        time: 90,
      }),
    ])

    expect(progress.currentMedal).toBe('bronze')
    expect(progress.nextMedal).toBeNull()
    expect(progress.stages).toContainEqual({ medal: 'silver', status: 'unavailable' })
    expect(progress.stages).toContainEqual({ medal: 'gold', status: 'unavailable' })
    expect(progress.stages).toContainEqual({ medal: 'diamond', status: 'unavailable' })
    expect(progress.label).toContain('nicht erreichbar')
  })

  it('zeigt für Motive ohne Challenge-Medaille Bronze als erstes Ziel', () => {
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

  it('ordnet verwandte Startzustandslaeufe der passenden Challenge-Serie zu', () => {
    const replaySetup = {
      version: 1,
      startBoard: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 0, 15],
      emptyIndex: 15,
      shuffleMoves: ['tile-15'],
    } satisfies NonNullable<SolvedGalleryEntry['replaySetup']>
    const target = createGalleryEntry('target', {
      replaySetup,
      assistanceMode: 'clean',
    })
    const challengeAttempt = createGalleryEntry('challenge-attempt', {
      replaySetup,
      challengeTargetId: target.id,
      challengeMedal: 'silver',
    })
    const origin = createGalleryEntry('origin', {
      completedAt: '2026-04-20T12:00:00.000Z',
      replaySetup,
      assistanceMode: 'auto-assisted',
    })
    const unrelated = createGalleryEntry('unrelated', {
      replaySetup: {
        ...replaySetup,
        startBoard: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 0, 14, 15],
      },
    })

    const [series] = buildGalleryChallengeSeries([unrelated, challengeAttempt, origin, target])

    expect(series.relatedStartStateEntries.map((entry) => entry.id)).toEqual(['origin'])
  })

  it('ordnet assistierte medaillenlose Challenge-Abschluesse als verwandte Startzustandslaeufe ein', () => {
    const replaySetup = {
      version: 1,
      startBoard: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 0, 15],
      emptyIndex: 15,
      shuffleMoves: ['tile-15'],
    } satisfies NonNullable<SolvedGalleryEntry['replaySetup']>
    const target = createGalleryEntry('target', {
      replaySetup,
      assistanceMode: 'clean',
    })
    const cleanMedalAttempt = createGalleryEntry('clean-medal-attempt', {
      replaySetup,
      assistanceMode: 'clean',
      challengeTargetId: target.id,
      challengeMedal: 'bronze',
    })
    const assistedChallengeRun = createGalleryEntry('assisted-challenge-run', {
      replaySetup,
      assistanceMode: 'hinted',
      challengeTargetId: target.id,
    })

    const [series] = buildGalleryChallengeSeries([assistedChallengeRun, cleanMedalAttempt, target])

    expect(series.attempts.map((entry) => entry.id)).toEqual(['clean-medal-attempt'])
    expect(series.preTemplateEntries).toEqual([])
    expect(series.relatedStartStateEntries.map((entry) => entry.id)).toEqual(['assisted-challenge-run'])
  })

  it('erstellt bereits für den ersten assistierten Versuch eine medaillenlose Challenge-Serie', () => {
    const replaySetup = {
      version: 1,
      startBoard: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 0, 15],
      emptyIndex: 15,
      shuffleMoves: ['tile-15'],
    } satisfies NonNullable<SolvedGalleryEntry['replaySetup']>
    const target = createGalleryEntry('target', {
      replaySetup,
      assistanceMode: 'clean',
    })
    const assistedChallengeRun = createGalleryEntry('assisted-challenge-run', {
      replaySetup,
      assistanceMode: 'auto-assisted',
      challengeTargetId: target.id,
    })

    const series = buildGalleryChallengeSeries([assistedChallengeRun, target])

    expect(series).toHaveLength(1)
    expect(series[0]).toMatchObject({
      targetId: target.id,
      bestAttempt: null,
      bestMedal: null,
      attempts: [],
    })
    expect(series[0].relatedStartStateEntries.map((entry) => entry.id)).toEqual(['assisted-challenge-run'])
  })

  it('gruppiert Läufe mit gleicher synthetischer Ziel-ID als geschätzte Ursprungserie', () => {
    const estimatedChallengeTarget = {
      entryId: 'synthetic:source:4x4:crop:board:estimate-v1',
      completedAt: '2026-04-20T12:00:00.000Z',
      time: 360,
      moves: 180,
      actionMoves: 180,
      assistanceMode: 'clean' as const,
      synthetic: true,
      estimate: {
        version: 1 as const,
        method: 'heuristic-personal-v1' as const,
        heuristicScore: 24,
        createdAt: '2026-04-20T12:00:00.000Z',
        personalMedianApplied: false,
      },
    }
    const failedQualification = createGalleryEntry('failed-qualification', {
      challengeTargetId: estimatedChallengeTarget.entryId,
      estimatedChallengeTarget,
      challengeRunKind: 'qualification',
      qualificationResult: 'failed',
    })
    const template = createGalleryEntry('created-template', {
      completedAt: '2026-04-21T12:00:00.000Z',
      challengeTargetId: estimatedChallengeTarget.entryId,
      estimatedChallengeTarget,
      qualificationResult: 'created-template',
      assistanceMode: 'clean',
    })

    const [series] = buildGalleryChallengeSeries([failedQualification, template])

    expect(series).toMatchObject({
      targetId: estimatedChallengeTarget.entryId,
      estimatedTarget: { synthetic: true },
      templateEntry: { id: 'created-template' },
      targetEntry: { id: 'created-template' },
      attempts: [],
      bestMedal: null,
    })
    expect(series.preTemplateEntries.map((entry) => entry.id)).toEqual(['failed-qualification'])
  })

  it('haengt freie Läufe mit gleichem Startbrett an die synthetische Ursprungserie', () => {
    const replaySetup = {
      version: 1,
      startBoard: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 0, 15],
      emptyIndex: 15,
      shuffleMoves: ['tile-15'],
    } satisfies NonNullable<SolvedGalleryEntry['replaySetup']>
    const estimatedChallengeTarget = {
      entryId: 'synthetic:source:4x4:crop:board:estimate-v1',
      completedAt: '2026-04-20T12:00:00.000Z',
      time: 360,
      moves: 180,
      actionMoves: 180,
      assistanceMode: 'clean' as const,
      synthetic: true,
      estimate: {
        version: 1 as const,
        method: 'heuristic-personal-v1' as const,
        heuristicScore: 24,
        createdAt: '2026-04-20T12:00:00.000Z',
        personalMedianApplied: false,
      },
    }
    const softRun = createGalleryEntry('soft-run', {
      replaySetup,
      challengeTargetId: estimatedChallengeTarget.entryId,
      estimatedChallengeTarget,
    })
    const sameStartPractice = createGalleryEntry('same-start-practice', {
      completedAt: '2026-04-22T12:00:00.000Z',
      replaySetup,
      assistanceMode: 'hinted',
    })

    const [series] = buildGalleryChallengeSeries([sameStartPractice, softRun])

    expect(series.targetId).toBe(estimatedChallengeTarget.entryId)
    expect(series.preTemplateEntries.map((entry) => entry.id)).toEqual(['soft-run'])
    expect(series.relatedStartStateEntries.map((entry) => entry.id)).toEqual(['same-start-practice'])

    const excluded = new Set([
      series.targetId,
      ...series.preTemplateEntries.map((entry) => entry.id),
      ...series.relatedStartStateEntries.map((entry) => entry.id),
    ])
    expect(buildGalleryStartStateSeries([sameStartPractice, softRun], excluded)).toEqual([])
  })

  it('fasst synthetischen Ursprung und echte Medaillenläufe desselben Startbretts zusammen', () => {
    const replaySetup = {
      version: 1,
      startBoard: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 0, 15],
      emptyIndex: 15,
      shuffleMoves: ['tile-15'],
    } satisfies NonNullable<SolvedGalleryEntry['replaySetup']>
    const estimatedChallengeTarget = {
      entryId: 'synthetic:source:4x4:crop:board:estimate-v1',
      completedAt: '2026-04-20T12:00:00.000Z',
      time: 360,
      moves: 180,
      actionMoves: 180,
      assistanceMode: 'clean' as const,
      synthetic: true,
      estimate: {
        version: 1 as const,
        method: 'heuristic-personal-v1' as const,
        heuristicScore: 24,
        createdAt: '2026-04-20T12:00:00.000Z',
        personalMedianApplied: false,
      },
    }
    const softRun = createGalleryEntry('soft-run', {
      completedAt: '2026-04-20T12:00:00.000Z',
      replaySetup,
      challengeTargetId: estimatedChallengeTarget.entryId,
      estimatedChallengeTarget,
    })
    const template = createGalleryEntry('created-template', {
      completedAt: '2026-04-21T12:00:00.000Z',
      replaySetup,
      challengeTargetId: estimatedChallengeTarget.entryId,
      estimatedChallengeTarget,
      qualificationResult: 'created-template',
      assistanceMode: 'clean',
    })
    const medalRun = createGalleryEntry('gold-run', {
      completedAt: '2026-04-22T12:00:00.000Z',
      replaySetup,
      challengeTargetId: template.id,
      challengeMedal: 'gold',
      time: 90,
      moves: 80,
    })

    const series = buildGalleryChallengeSeries([medalRun, softRun, template])

    expect(series).toHaveLength(1)
    expect(series[0]).toMatchObject({
      targetId: template.id,
      targetEntry: { id: template.id },
      estimatedTarget: { entryId: estimatedChallengeTarget.entryId },
      templateEntry: { id: template.id },
      bestAttempt: { id: medalRun.id },
      bestMedal: 'gold',
    })
    expect(series[0].preTemplateEntries.map((entry) => entry.id)).toEqual(['soft-run'])
    expect(series[0].attempts.map((entry) => entry.id)).toEqual(['gold-run'])

    const relations = buildGalleryTimelineRelations([medalRun, softRun, template])
    const excluded = new Set([
      ...Array.from(relations.attemptsByEntryId.keys()),
      ...Array.from(relations.targetsByEntryId.keys()),
      ...series[0].preTemplateEntries.map((entry) => entry.id),
      ...series[0].relatedStartStateEntries.map((entry) => entry.id),
    ])

    expect(buildGalleryStartStateSeries([medalRun, softRun, template], excluded)).toEqual([])
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

  it('gruppiert nicht-medaillebezogene Läufe mit gleichem Startzustand separat', () => {
    const replaySetup = {
      version: 1,
      startBoard: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 0, 15],
      emptyIndex: 15,
      shuffleMoves: ['tile-15'],
    } satisfies NonNullable<SolvedGalleryEntry['replaySetup']>
    const origin = createGalleryEntry('origin', {
      completedAt: '2026-04-20T12:00:00.000Z',
      replaySetup,
    })
    const practice = createGalleryEntry('practice', {
      completedAt: '2026-04-24T12:00:00.000Z',
      replaySetup,
    })
    const unrelated = createGalleryEntry('unrelated', {
      replaySetup: {
        ...replaySetup,
        startBoard: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 0, 14, 15],
      },
    })

    const [series] = buildGalleryStartStateSeries([practice, unrelated, origin])
    const relations = buildGalleryStartStateRelations([series])

    expect(series).toMatchObject({
      originEntry: { id: 'origin' },
      latestEntry: { id: 'practice' },
    })
    expect(series.entries.map((entry) => entry.id)).toEqual(['practice', 'origin'])
    expect(relations.entriesByEntryId.get(origin.id)).toMatchObject({
      seriesNumber: 1,
      entryNumber: 1,
      isOrigin: true,
    })
    expect(relations.entriesByEntryId.get(practice.id)).toMatchObject({
      seriesNumber: 1,
      entryNumber: 2,
      isOrigin: false,
    })
    expect(relations.entriesByEntryId.has(unrelated.id)).toBe(false)
  })

  it('erstellt für eine einzelne cleane Vorlage bereits eine Startzustand-Serie', () => {
    const cleanTemplate = createGalleryEntry('clean-template', {
      assistanceMode: 'clean',
      replaySetup: {
        version: 1,
        startBoard: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 0, 15],
        emptyIndex: 15,
        shuffleMoves: ['tile-15'],
      },
    })

    const series = buildGalleryStartStateSeries([cleanTemplate])

    expect(series).toHaveLength(1)
    expect(series[0]).toMatchObject({
      entries: [{ id: cleanTemplate.id }],
      cleanAnchorEntry: { id: cleanTemplate.id },
    })
  })

  it('zieht eine cleane Vorlage in Startzustand-Serien nach vorne', () => {
    const replaySetup = {
      version: 1,
      startBoard: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 0, 15],
      emptyIndex: 15,
      shuffleMoves: ['tile-15'],
    } satisfies NonNullable<SolvedGalleryEntry['replaySetup']>
    const origin = createGalleryEntry('origin', {
      completedAt: '2026-04-20T12:00:00.000Z',
      replaySetup,
      assistanceMode: 'auto-assisted',
    })
    const cleanPractice = createGalleryEntry('clean-practice', {
      completedAt: '2026-04-21T12:00:00.000Z',
      replaySetup,
      assistanceMode: 'clean',
    })
    const hintedPractice = createGalleryEntry('hinted-practice', {
      completedAt: '2026-04-24T12:00:00.000Z',
      replaySetup,
      assistanceMode: 'hinted',
    })

    const [series] = buildGalleryStartStateSeries([origin, cleanPractice, hintedPractice])

    expect(series.cleanAnchorEntry?.id).toBe(cleanPractice.id)
    expect(series.latestEntry.id).toBe(hintedPractice.id)
    expect(series.entries.map((entry) => entry.id)).toEqual([
      cleanPractice.id,
      hintedPractice.id,
      origin.id,
    ])
  })

  it('laesst Challenge-Relationen aus Startzustand-Serien heraus', () => {
    const replaySetup = {
      version: 1,
      startBoard: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 0, 15],
      emptyIndex: 15,
      shuffleMoves: ['tile-15'],
    } satisfies NonNullable<SolvedGalleryEntry['replaySetup']>
    const target = createGalleryEntry('target', { replaySetup })
    const challengeAttempt = createGalleryEntry('challenge-attempt', {
      replaySetup,
      challengeTargetId: target.id,
      challengeMedal: 'silver',
    })

    const relations = buildGalleryTimelineRelations([target, challengeAttempt])
    const excluded = new Set([
      ...Array.from(relations.attemptsByEntryId.keys()),
      ...Array.from(relations.targetsByEntryId.keys()),
    ])

    expect(buildGalleryStartStateSeries([target, challengeAttempt], excluded)).toEqual([])
  })

  it('erstellt für gescheiterte Qualifikationen keine neutrale Startzustand-Serie', () => {
    const replaySetup = {
      version: 1,
      startBoard: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 0, 15],
      emptyIndex: 15,
      shuffleMoves: ['tile-15'],
    } satisfies NonNullable<SolvedGalleryEntry['replaySetup']>
    const failedQualification = createGalleryEntry('failed-qualification', {
      replaySetup,
      assistanceMode: 'clean',
      challengeTargetId: 'synthetic:source:4x4:crop:board:estimate-v1',
      challengeRunKind: 'qualification',
      qualificationResult: 'failed',
    })

    expect(buildGalleryStartStateSeries([failedQualification])).toEqual([])
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

  it('dedupliziert Galerie-Eintraege motivweit für Sammlungen', () => {
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

  it('filtert Galerie-Karten nur, wenn alle ausgewählten Tags am Motiv vorhanden sind', () => {
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

  it('sortiert ähnliche Galerie-Motive nach Tag-Überschneidung und Lösungshäufigkeit', () => {
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
