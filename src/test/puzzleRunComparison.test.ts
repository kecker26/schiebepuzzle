import { describe, expect, it } from 'vitest'
import type { PuzzleCompletionRecord, WinStats } from '../types/index.ts'
import {
  compareAssistance,
  compareGapToBest,
  compareLowerIsBetterMetric,
  countExtraMoves,
  isSamePuzzleConfig,
  resolveComparisonTone,
  toComparableRun,
} from '../utils/puzzleRunComparison.ts'

function createWinStats(overrides: Partial<WinStats> = {}): WinStats {
  return {
    moves: 40,
    time: 120,
    actionMoves: 46,
    undoCount: 0,
    redoCount: 0,
    hintCount: 1,
    suggestedMoveCount: 0,
    assistanceMode: 'hinted',
    ...overrides,
  }
}

function createCompletionRecord(
  overrides: Partial<PuzzleCompletionRecord> = {}
): PuzzleCompletionRecord {
  return {
    id: 'run-1',
    completedAt: '2026-04-23T12:00:00.000Z',
    previewImage: null,
    config: { rows: 4, cols: 4 },
    moves: 40,
    time: 120,
    actionMoves: 46,
    undoCount: 0,
    redoCount: 0,
    hintCount: 1,
    suggestedMoveCount: 0,
    assistanceMode: 'hinted',
    hasDetailedProfile: true,
    ...overrides,
  }
}

describe('puzzleRunComparison', () => {
  it('normalisiert WinStats mit detailliertem Profil als aktiv', () => {
    expect(toComparableRun(createWinStats())).toMatchObject({
      moves: 40,
      time: 120,
      actionMoves: 46,
      assistanceMode: 'hinted',
      hintCount: 1,
      suggestedMoveCount: 0,
      hasDetailedProfile: true,
    })
  })

  it('übernimmt das Profil-Flag aus persistierten Laufdaten', () => {
    expect(
      toComparableRun(
        createCompletionRecord({
          hasDetailedProfile: false,
        })
      ).hasDetailedProfile
    ).toBe(false)
  })

  it('berechnet Korrekturen aus Aktionszuegen und klemmt negative Werte auf null', () => {
    expect(countExtraMoves({ moves: 40, actionMoves: 46 })).toBe(6)
    expect(countExtraMoves({ moves: 40, actionMoves: 35 })).toBe(0)
  })

  it('erkennt identische Puzzle-Konfigurationen nur bei gleicher Groesse', () => {
    expect(isSamePuzzleConfig({ rows: 4, cols: 4 }, { rows: 4, cols: 4 })).toBe(true)
    expect(isSamePuzzleConfig({ rows: 4, cols: 4 }, { rows: 5, cols: 4 })).toBe(false)
  })

  it('ordnet Metriken mit niedrigerem Wert als besser ein', () => {
    expect(compareLowerIsBetterMetric(42, null)).toMatchObject({
      previous: null,
      deltaToPrevious: null,
      trend: 'unknown',
    })

    expect(compareLowerIsBetterMetric(40, 45)).toMatchObject({
      current: 40,
      previous: 45,
      deltaToPrevious: -5,
      trend: 'better',
    })

    expect(compareLowerIsBetterMetric(40, 40)).toMatchObject({
      deltaToPrevious: 0,
      trend: 'same',
    })

    expect(compareLowerIsBetterMetric(46, 40)).toMatchObject({
      deltaToPrevious: 6,
      trend: 'worse',
    })
  })

  it('vergleicht den Abstand zur Bestleistung', () => {
    expect(compareGapToBest(44, 46, null)).toMatchObject({
      best: null,
      currentGap: null,
      previousGap: null,
      deltaToPreviousGap: null,
      trend: 'unknown',
    })

    expect(compareGapToBest(44, 48, 40)).toMatchObject({
      best: 40,
      currentGap: 4,
      previousGap: 8,
      deltaToPreviousGap: -4,
      trend: 'better',
    })

    expect(compareGapToBest(47, 45, 40)).toMatchObject({
      currentGap: 7,
      previousGap: 5,
      deltaToPreviousGap: 2,
      trend: 'worse',
    })

    expect(compareGapToBest(40, 40, 40)).toMatchObject({
      currentGap: 0,
      previousGap: 0,
      deltaToPreviousGap: 0,
      trend: 'same',
    })
  })

  it('bewertet clean vor hinted vor auto-assisted und nutzt danach Detailwerte', () => {
    const cleanRun = toComparableRun(
      createCompletionRecord({
        assistanceMode: 'clean',
        hintCount: 0,
        suggestedMoveCount: 0,
      })
    )
    const hintedRun = toComparableRun(
      createCompletionRecord({
        assistanceMode: 'hinted',
        hintCount: 1,
        suggestedMoveCount: 0,
      })
    )
    const autoAssistedRun = toComparableRun(
      createCompletionRecord({
        assistanceMode: 'auto-assisted',
        hintCount: 1,
        suggestedMoveCount: 2,
      })
    )

    expect(compareAssistance(cleanRun, hintedRun)).toMatchObject({
      previousMode: 'hinted',
      hintDelta: -1,
      suggestedMoveDelta: 0,
      trend: 'better',
    })

    expect(compareAssistance(autoAssistedRun, cleanRun)).toMatchObject({
      previousMode: 'clean',
      hintDelta: 1,
      suggestedMoveDelta: 2,
      trend: 'worse',
    })

    expect(
      compareAssistance(
        toComparableRun(
          createCompletionRecord({
            assistanceMode: 'hinted',
            hintCount: 1,
            suggestedMoveCount: 0,
          })
        ),
        toComparableRun(
          createCompletionRecord({
            assistanceMode: 'hinted',
            hintCount: 3,
            suggestedMoveCount: 2,
          })
        )
      )
    ).toMatchObject({
      previousMode: 'hinted',
      hintDelta: -2,
      suggestedMoveDelta: -2,
      trend: 'better',
    })
  })

  it('gibt bei fehlendem Detailprofil keinen Assistance-Vergleich aus', () => {
    expect(
      compareAssistance(
        toComparableRun(
          createCompletionRecord({
            hasDetailedProfile: false,
          })
        ),
        toComparableRun(createCompletionRecord())
      )
    ).toMatchObject({
      previousMode: 'hinted',
      hintDelta: null,
      suggestedMoveDelta: null,
      trend: 'unknown',
    })
  })

  it('verdichtet Vergleichstrends zu einer neutralen, positiven oder negativen Tonalitaet', () => {
    expect(resolveComparisonTone('better', 'same', 'better')).toBe('positive')
    expect(resolveComparisonTone('worse', 'unknown', 'worse')).toBe('negative')
    expect(resolveComparisonTone('better', 'worse')).toBe('neutral')
    expect(resolveComparisonTone('same', 'unknown')).toBe('neutral')
  })
})
