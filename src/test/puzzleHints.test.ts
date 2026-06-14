import { describe, expect, it } from 'vitest'
import {
  buildHintPathObjective,
  buildHintPreview,
  buildPuzzleMoveFeedback,
  registerHintForState,
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
