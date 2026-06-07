import {
  type GhostPreviewMode,
  OptimalStartMoveCountKind,
  PersistedPuzzleProgress,
  PuzzleConfig,
  PuzzleRunMetrics,
  PuzzleState,
  SolverProgress,
  Tile,
} from '../types/index'

const DEFAULT_PERSISTED_HISTORY_LIMIT = 12

function cloneTile(tile: Tile): Tile {
  return {
    ...tile,
    imageSliceRef: {
      ...tile.imageSliceRef,
    },
  }
}

function cloneRunMetrics(runMetrics: PuzzleRunMetrics): PuzzleRunMetrics {
  return {
    ...runMetrics,
  }
}

export function rebuildBoardFromTiles(tiles: Tile[], config: PuzzleConfig): number[] {
  const board = new Array<number>(config.rows * config.cols).fill(-1)

  for (const tile of tiles) {
    const position = tile.row * config.cols + tile.col
    if (position < 0 || position >= board.length) continue
    board[position] = tile.correctIndex
  }

  return board.map((value, index) => (value >= 0 ? value : index))
}

export function clonePuzzleState(state: PuzzleState): PuzzleState {
  return {
    ...state,
    board: [...state.board],
    dragState: state.dragState ? { ...state.dragState } : null,
    tiles: state.tiles.map((tile) => cloneTile(tile)),
  }
}

export function normalizePuzzleState(state: PuzzleState, config: PuzzleConfig): PuzzleState {
  const normalized = clonePuzzleState(state)
  const emptyTile = normalized.tiles.find((tile) => tile.isEmpty) ?? null

  normalized.tiles = normalized.tiles.map((tile) => ({
    ...tile,
    isDragging: false,
    canMove: undefined,
  }))
  normalized.board = rebuildBoardFromTiles(normalized.tiles, config)
  normalized.dragState = null
  normalized.isAnimating = false
  normalized.emptyIndex = emptyTile ? emptyTile.row * config.cols + emptyTile.col : normalized.emptyIndex
  normalized.emptyRow = emptyTile ? emptyTile.row : normalized.emptyRow
  normalized.emptyCol = emptyTile ? emptyTile.col : normalized.emptyCol
  normalized.isSolved = normalized.tiles.every(
    (tile) => tile.isEmpty || (tile.row === tile.correctRow && tile.col === tile.correctCol)
  )

  return normalized
}

export function createPersistedPuzzleProgress({
  state,
  config,
  moveCount,
  elapsedTime,
  isPaused = false,
  optimalStartMoveCount,
  optimalStartMoveCountKind,
  optimalStartMoveCountSolverVersion,
  runMetrics,
  moveHistory,
  redoHistory = [],
  previewVisible,
  ghostPreviewVisible,
  ghostPreviewWeight,
  ghostPreviewMode,
  heatmapOverlayVisible,
  solverProgress,
  historyLimit = DEFAULT_PERSISTED_HISTORY_LIMIT,
}: {
  state: PuzzleState
  config: PuzzleConfig
  moveCount: number
  elapsedTime: number
  isPaused?: boolean
  optimalStartMoveCount?: number | null
  optimalStartMoveCountKind?: OptimalStartMoveCountKind
  optimalStartMoveCountSolverVersion?: string
  runMetrics?: PuzzleRunMetrics
  moveHistory: PuzzleState[]
  redoHistory?: PuzzleState[]
  previewVisible: boolean
  ghostPreviewVisible: boolean
  ghostPreviewWeight: number
  ghostPreviewMode: GhostPreviewMode
  heatmapOverlayVisible: boolean
  solverProgress?: SolverProgress
  historyLimit?: number
}): PersistedPuzzleProgress {
  return {
    puzzleState: normalizePuzzleState(state, config),
    moveCount,
    elapsedTime,
    isPaused,
    optimalStartMoveCount,
    optimalStartMoveCountKind,
    optimalStartMoveCountSolverVersion:
      typeof optimalStartMoveCountSolverVersion === 'string' && optimalStartMoveCountSolverVersion.trim().length > 0
        ? optimalStartMoveCountSolverVersion.trim()
        : undefined,
    runMetrics: runMetrics ? cloneRunMetrics(runMetrics) : undefined,
    moveHistory: moveHistory.slice(-historyLimit).map((entry) => normalizePuzzleState(entry, config)),
    redoHistory: redoHistory.slice(-historyLimit).map((entry) => normalizePuzzleState(entry, config)),
    previewVisible,
    ghostPreviewVisible,
    ghostPreviewWeight,
    ghostPreviewMode,
    heatmapOverlayVisible,
    solverProgress: solverProgress
      ? {
          shuffleMoves: [...solverProgress.shuffleMoves],
          reducedMovePath: [...solverProgress.reducedMovePath],
        }
      : undefined,
  }
}
