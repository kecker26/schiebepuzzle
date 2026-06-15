import { describe, expect, it } from 'vitest'
import {
  buildHintPathObjective,
  buildHintPreview,
  buildHeatmapDeltaAnalysis,
  buildHeatmapMovePotentialAnalysis,
  buildHeatmapTargetPath,
  buildPuzzleMoveFeedback,
  normalizeHeatmapIntensity,
  normalizeHeatmapMode,
  registerHintForState,
  selectHeatmapMode,
  toggleHeatmapDistances,
} from '../screens/puzzle/puzzleScreenUtils.ts'
import { buildPuzzleContextHint } from '../services/PuzzleEngine.ts'
import type { PuzzleState, Tile } from '../types/index.ts'

const config = { rows: 3, cols: 3 }

function createTile(correctIndex: number, row: number, col: number, isEmpty = false): Tile {
  return {
    id: `tile-${correctIndex}`,
    row,
    col,
    index: correctIndex,
    correctRow: Math.floor(correctIndex / config.cols),
    correctCol: correctIndex % config.cols,
    correctIndex,
    imageSliceRef: {
      sourceX: 0,
      sourceY: 0,
      sourceWidth: 1,
      sourceHeight: 1,
    },
    isEmpty,
  }
}

function createState(tiles: Tile[], emptyRow: number, emptyCol: number): PuzzleState {
  return {
    tiles,
    board: tiles.map((tile) => tile.correctIndex),
    emptyIndex: emptyRow * config.cols + emptyCol,
    emptyRow,
    emptyCol,
    moveCount: 0,
    startTime: 0,
    isSolved: false,
    isAnimating: false,
    dragState: null,
  }
}

describe('puzzle hints', () => {
  it('describes a concrete move with current and target position', () => {
    const state = createState([
      createTile(0, 0, 0),
      createTile(1, 1, 1),
      createTile(2, 0, 2),
      createTile(3, 1, 0),
      createTile(4, 1, 2),
      createTile(5, 2, 0),
      createTile(6, 2, 1),
      createTile(7, 2, 2),
      createTile(8, 0, 1, true),
    ], 0, 1)

    expect(buildHintPreview(state, 'tile-1', 'exact')).toMatchObject({
      actionLabel: 'Schiebe Kachel 2 nach oben.',
      description: 'Damit sitzt die Kachel direkt an ihrer Zielposition.',
      currentPositionLabel: 'in der Mitte',
      targetPositionLabel: 'oben mittig',
      distance: 1,
      targetRow: 0,
      targetCol: 1,
      strategyLabel: 'Dieser Zug arbeitet direkt am aktuellen Fokusbereich.',
    })
  })

  it('keeps the strategic focus on the first incomplete target row', () => {
    const state = createState([
      createTile(0, 0, 0),
      createTile(1, 1, 1),
      createTile(2, 0, 2),
      createTile(3, 1, 0),
      createTile(4, 0, 1),
      createTile(5, 1, 2),
      createTile(6, 2, 0),
      createTile(7, 2, 2),
      createTile(8, 2, 1, true),
    ], 2, 1)

    expect(buildPuzzleContextHint(state, config)).toMatchObject({
      focusRow: 0,
      title: 'Obere Reihe ordnen',
      progressCurrent: 2,
      progressTotal: 3,
      focusTargetIndexes: [0, 1, 2],
    })
  })

  it('keeps an incomplete preferred focus row active', () => {
    const state = createState([
      createTile(0, 1, 0),
      createTile(1, 0, 1),
      createTile(2, 0, 2),
      createTile(3, 2, 0),
      createTile(4, 1, 1),
      createTile(5, 1, 2),
      createTile(6, 0, 0),
      createTile(7, 2, 2),
      createTile(8, 2, 1, true),
    ], 2, 1)

    expect(buildPuzzleContextHint(state, config, 1)).toMatchObject({
      focusRow: 1,
      title: 'Reihe 2 ordnen',
      progressCurrent: 2,
      progressTotal: 3,
      focusTargetIndexes: [3, 4, 5],
    })
  })

  it('explains moves outside the current focus as preparation', () => {
    const state = createState([
      createTile(0, 0, 0),
      createTile(1, 0, 1),
      createTile(2, 0, 2),
      createTile(3, 1, 0),
      createTile(4, 2, 1),
      createTile(5, 1, 2),
      createTile(6, 2, 0),
      createTile(7, 2, 2),
      createTile(8, 1, 1, true),
    ], 1, 1)

    expect(buildHintPreview(state, 'tile-4', 'tracked', 0)).toMatchObject({
      strategyLabel: 'Dieser Zwischenschritt bereitet den aktuellen Fokusbereich vor.',
    })
  })

  it('derives a concrete partial objective from a known path', () => {
    const state = createState([
      createTile(0, 0, 0),
      createTile(1, 1, 1),
      createTile(2, 0, 2),
      createTile(3, 1, 0),
      createTile(4, 1, 2),
      createTile(5, 2, 0),
      createTile(6, 2, 1),
      createTile(7, 2, 2),
      createTile(8, 0, 1, true),
    ], 0, 1)

    const objective = buildHintPathObjective(state, ['tile-1'], 0, (current, tileId) => {
      const movedTile = current.tiles.find((tile) => tile.id === tileId)
      if (!movedTile) return current
      return createState(
        current.tiles.map((tile) => {
          if (tile.id === tileId) return { ...tile, row: current.emptyRow, col: current.emptyCol }
          if (tile.isEmpty) return { ...tile, row: movedTile.row, col: movedTile.col }
          return tile
        }),
        movedTile.row,
        movedTile.col
      )
    })

    expect(objective).toMatchObject({
      tileLabel: 'Kachel 2',
      preparationMoveCount: 0,
      label: 'Kachel 2 an die Zielposition setzen',
    })
  })

  it('counts a concrete hint only once per board state', () => {
    const hashes = new Set<string>()
    expect(registerHintForState(hashes, 'state-a')).toBe(true)
    expect(registerHintForState(hashes, 'state-a')).toBe(false)
    expect(registerHintForState(hashes, 'state-b')).toBe(true)
  })

  it('normalizes persisted heatmap settings defensively', () => {
    expect(normalizeHeatmapMode('arrows')).toBe('arrows')
    expect(normalizeHeatmapMode('delta')).toBe('delta')
    expect(normalizeHeatmapMode('unknown')).toBe('classic')
    expect(normalizeHeatmapIntensity(12)).toBe(25)
    expect(normalizeHeatmapIntensity(140)).toBe(100)
    expect(normalizeHeatmapIntensity(undefined)).toBe(100)
  })

  it('keeps heatmap distance numbers exclusive to the classic mode', () => {
    expect(toggleHeatmapDistances('arrows', false)).toEqual({
      mode: 'classic',
      distancesVisible: true,
    })
    expect(toggleHeatmapDistances('classic', true)).toEqual({
      mode: 'classic',
      distancesVisible: false,
    })
    expect(selectHeatmapMode('delta', true)).toEqual({
      mode: 'delta',
      distancesVisible: false,
    })
    expect(selectHeatmapMode('classic', true)).toEqual({
      mode: 'classic',
      distancesVisible: true,
    })
  })

  it('compares heatmap progress against the requested recent move window', () => {
    const referenceState = createState([
      createTile(0, 0, 0),
      createTile(1, 2, 2),
      createTile(2, 0, 2),
      createTile(3, 1, 0),
      createTile(4, 1, 1),
      createTile(5, 1, 2),
      createTile(6, 2, 0),
      createTile(7, 2, 1),
      createTile(8, 2, 1, true),
    ], 2, 1)
    const currentState = createState([
      createTile(0, 0, 0),
      createTile(1, 1, 1),
      createTile(2, 0, 2),
      createTile(3, 1, 0),
      createTile(4, 1, 2),
      createTile(5, 1, 2),
      createTile(6, 2, 0),
      createTile(7, 0, 1),
      createTile(8, 2, 1, true),
    ], 2, 1)

    expect(buildHeatmapDeltaAnalysis(currentState, [referenceState], 5)).toMatchObject({
      lookback: 1,
      improvedTiles: 1,
      worsenedTiles: 2,
      unchangedTiles: 5,
      tileDeltas: {
        'tile-1': 2,
        'tile-4': -1,
        'tile-7': -2,
      },
    })
  })

  it('ranks movable heatmap tiles by immediate distance gain and focus', () => {
    const state = createState([
      createTile(0, 0, 0),
      createTile(1, 0, 1),
      createTile(2, 0, 2),
      createTile(3, 1, 0),
      createTile(4, 2, 2),
      createTile(5, 1, 2),
      createTile(6, 2, 0),
      createTile(7, 1, 1),
      createTile(8, 2, 1, true),
    ], 2, 1)
    const analysis = buildHeatmapMovePotentialAnalysis(state, 1)

    expect(analysis.bestMove).toMatchObject({
      tileId: 'tile-4',
      tileLabel: 'Kachel 5',
      direction: 'left',
      distanceChange: 1,
      tone: 'positive',
      worksOnFocus: true,
      isBest: true,
    })
    expect(analysis.tilePotentials).toEqual({
      'tile-4': 1,
      'tile-7': 1,
      'tile-6': -1,
    })
  })

  it('prefers a focus-row improvement when movable options improve equally', () => {
    const state = createState([
      createTile(0, 0, 0),
      createTile(1, 0, 1),
      createTile(2, 0, 2),
      createTile(3, 2, 1),
      createTile(4, 1, 2),
      createTile(5, 2, 2),
      createTile(6, 2, 0),
      createTile(7, 1, 0),
      createTile(8, 1, 1, true),
    ], 1, 1)

    expect(buildHeatmapMovePotentialAnalysis(state, 1).bestMove).toMatchObject({
      tileId: 'tile-3',
      distanceChange: 1,
      worksOnFocus: true,
      isBest: true,
    })
  })

  it('uses the resolved hint move as the heatmap best option', () => {
    const state = createState([
      createTile(0, 0, 0),
      createTile(1, 0, 1),
      createTile(2, 0, 2),
      createTile(3, 1, 0),
      createTile(4, 2, 2),
      createTile(5, 1, 2),
      createTile(6, 2, 0),
      createTile(7, 1, 1),
      createTile(8, 2, 1, true),
    ], 2, 1)

    expect(buildHeatmapMovePotentialAnalysis(state, 1, 'tile-6').bestMove).toMatchObject({
      tileId: 'tile-6',
      distanceChange: -1,
      tone: 'neutral',
      isBest: true,
    })
    expect(buildHeatmapMovePotentialAnalysis(state, 1, null).bestMove).toBeNull()
  })

  it('marks the least harmful move as a yellow preparation when every move worsens distance', () => {
    const state = createState([
      createTile(0, 0, 0),
      createTile(1, 0, 1),
      createTile(2, 0, 2),
      createTile(3, 1, 0),
      createTile(4, 1, 1),
      createTile(5, 1, 2),
      createTile(6, 2, 0),
      createTile(7, 2, 1),
      createTile(8, 2, 2, true),
    ], 2, 2)
    const analysis = buildHeatmapMovePotentialAnalysis(state, 2)

    expect(analysis.bestMove).toMatchObject({
      tileId: 'tile-5',
      distanceChange: -1,
      tone: 'neutral',
      isBest: true,
    })
    expect(analysis.tilePotentials).toEqual({
      'tile-5': 0,
      'tile-7': -1,
    })
  })

  it('builds a short numbered heatmap target path from a solver queue', () => {
    const state = createState([
      createTile(0, 1, 0),
      createTile(1, 0, 1),
      createTile(2, 0, 2),
      createTile(3, 0, 0),
      createTile(4, 1, 1),
      createTile(5, 1, 2),
      createTile(6, 2, 0),
      createTile(7, 2, 1),
      createTile(8, 2, 2, true),
    ], 2, 2)
    const applyMove = (current: PuzzleState, tileId: string) => {
      const tile = current.tiles.find((entry) => entry.id === tileId)
      if (!tile) return current
      const nextTiles = current.tiles.map((entry) => {
        if (entry.id === tileId) return { ...entry, row: current.emptyRow, col: current.emptyCol }
        if (entry.isEmpty) return { ...entry, row: tile.row, col: tile.col }
        return entry
      })
      return createState(nextTiles, tile.row, tile.col)
    }
    const path = buildHeatmapTargetPath(state, ['tile-5', 'tile-2', 'tile-0'], 0, applyMove)

    expect(path.steps.map((step) => step.step)).toEqual([1, 2, 3])
    expect(path.steps.map((step) => step.tileId)).toEqual(['tile-5', 'tile-2', 'tile-0'])
    expect(path.steps.map((step) => ({
      move: `${step.compactTileLabel} ${step.directionSymbol}`,
      reason: step.reasonLabel,
    }))).toEqual([
      { move: 'K6 ↓', reason: 'Weg oeffnen' },
      { move: 'K3 ↓', reason: 'Fokus vorbereiten' },
      { move: 'K1 ↑', reason: 'Fokus vorbereiten' },
    ])
    expect(path.objective).toBeNull()
    expect(path.targetTileId).toBeNull()
  })

  it('stops the visible heatmap path before a tile would receive two numbers', () => {
    const state = createState([
      createTile(0, 0, 0),
      createTile(1, 0, 1),
      createTile(2, 0, 2),
      createTile(3, 1, 0),
      createTile(4, 1, 1),
      createTile(5, 1, 2),
      createTile(6, 2, 0),
      createTile(7, 2, 1),
      createTile(8, 2, 2, true),
    ], 2, 2)

    const path = buildHeatmapTargetPath(state, ['tile-5', 'tile-2', 'tile-5'], null, (current) => ({
      ...current,
      tiles: [...current.tiles],
    }))

    expect(path.steps.map((step) => step.tileId)).toEqual(['tile-5', 'tile-2'])
  })

  it('labels a target-path step that places a tile correctly', () => {
    const state = createState([
      createTile(0, 0, 0),
      createTile(1, 1, 1),
      createTile(2, 0, 2),
      createTile(3, 1, 0),
      createTile(4, 1, 2),
      createTile(5, 2, 0),
      createTile(6, 2, 1),
      createTile(7, 2, 2),
      createTile(8, 0, 1, true),
    ], 0, 1)
    const path = buildHeatmapTargetPath(state, ['tile-1'], 0, (current, tileId) => {
      const movedTile = current.tiles.find((tile) => tile.id === tileId)
      if (!movedTile) return current
      return createState(current.tiles.map((tile) => {
        if (tile.id === tileId) return { ...tile, row: current.emptyRow, col: current.emptyCol }
        if (tile.isEmpty) return { ...tile, row: movedTile.row, col: movedTile.col }
        return tile
      }), movedTile.row, movedTile.col)
    })

    expect(path.steps[0]).toMatchObject({
      compactTileLabel: 'K2',
      directionSymbol: '↑',
      reasonLabel: 'Zielposition',
      reasonTone: 'positive',
    })
  })

  it('keeps routine manual moves quiet but reports meaningful improvements', () => {
    expect(buildPuzzleMoveFeedback({
      previousFocusTitle: 'Obere Reihe ordnen',
      nextFocusTitle: 'Obere Reihe ordnen',
      previousFocusRow: 0,
      nextFocusRow: 0,
      previousFocusProgress: 0,
      nextFocusProgress: 0,
      nextFocusTotal: 3,
      tileLabel: 'Kachel 2',
      tileDistanceBefore: 2,
      tileDistanceAfter: 2,
      heuristicBefore: 8,
      heuristicAfter: 8,
      isSuggested: false,
    })).toBeNull()

    expect(buildPuzzleMoveFeedback({
      previousFocusTitle: 'Obere Reihe ordnen',
      nextFocusTitle: 'Obere Reihe ordnen',
      previousFocusRow: 0,
      nextFocusRow: 0,
      previousFocusProgress: 0,
      nextFocusProgress: 0,
      nextFocusTotal: 3,
      tileLabel: 'Kachel 2',
      tileDistanceBefore: 2,
      tileDistanceAfter: 1,
      heuristicBefore: 8,
      heuristicAfter: 7,
      isSuggested: false,
    })).toMatchObject({
      message: 'Kachel 2 ist jetzt naeher an ihrer Zielposition.',
      tone: 'positive',
    })
  })
})
