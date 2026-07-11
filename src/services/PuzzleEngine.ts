import { PuzzleConfig, PuzzleState, Tile } from '../types/index'
import { clonePuzzleState, normalizePuzzleState } from './PuzzleStateService.ts'
import {
  findSolutionValues,
  getBoardHeuristic,
  getBoardProgressMetrics,
  getGreedySuggestedValue,
  getMovableTileValues,
  getStateHashFromBoard,
  type PuzzleProgressMetrics,
} from './PuzzleSolver.ts'

export interface PuzzleContextHint {
  focusRow: number | null
  title: string
  body: string
  progressCurrent: number
  progressTotal: number
  focusTargetIndexes: number[]
  correctTargetIndexes: number[]
}

export function buildPuzzleContextHint(
  state: PuzzleState,
  config: PuzzleConfig,
  preferredFocusRow: number | null = null
): PuzzleContextHint {
  const playableTiles = state.tiles.filter((tile) => !tile.isEmpty)
  const correctTargetIndexes = playableTiles
    .filter((tile) => tile.row === tile.correctRow && tile.col === tile.correctCol)
    .map((tile) => tile.correctIndex)
  const firstOpenTile = playableTiles.find(
    (tile) => tile.row !== tile.correctRow || tile.col !== tile.correctCol
  )

  if (!firstOpenTile) {
    return {
      title: 'Zielbild vollständig',
      focusRow: null,
      body: 'Alle Kacheln liegen an ihrer Zielposition.',
      progressCurrent: playableTiles.length,
      progressTotal: playableTiles.length,
      focusTargetIndexes: playableTiles.map((tile) => tile.correctIndex),
      correctTargetIndexes,
    }
  }

  const preferredRowTiles = preferredFocusRow === null
    ? []
    : playableTiles.filter((tile) => tile.correctRow === preferredFocusRow)
  const preferredRowComplete =
    preferredRowTiles.length > 0
    && preferredRowTiles.every((tile) => tile.row === tile.correctRow && tile.col === tile.correctCol)
  const focusRow =
    preferredFocusRow !== null && !preferredRowComplete
      ? preferredFocusRow
      : firstOpenTile.correctRow
  const focusTiles = playableTiles.filter((tile) => tile.correctRow === focusRow)
  const progressCurrent = focusTiles.filter(
    (tile) => tile.row === tile.correctRow && tile.col === tile.correctCol
  ).length
  const title =
    focusRow === 0
      ? 'Obere Reihe ordnen'
      : focusRow === config.rows - 1
        ? 'Untere Reihe ordnen'
        : `Reihe ${focusRow + 1} ordnen`

  return {
    focusRow,
    title,
    body: `Konzentriere dich auf die markierte Zielreihe. Noch ${focusTiles.length - progressCurrent} Positionen fehlen.`,
    progressCurrent,
    progressTotal: focusTiles.length,
    focusTargetIndexes: focusTiles.map((tile) => tile.correctIndex),
    correctTargetIndexes,
  }
}

export default class PuzzleEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private readonly tileCount: number
  private readonly emptyValue: number

  constructor(private imageSrc: string, private config: PuzzleConfig) {
    this.canvas = document.createElement('canvas')
    const ctx = this.canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas context not available')
    this.ctx = ctx

    this.tileCount = this.config.rows * this.config.cols
    this.emptyValue = this.tileCount - 1
  }

  async generateInitialState(): Promise<PuzzleState> {
    const img = await this.loadImage(this.imageSrc)

    const maxDimension = 2000
    const intrinsicRatio = img.width / img.height

    let targetWidth: number
    let targetHeight: number

    if (intrinsicRatio > 1) {
      targetWidth = Math.min(img.width, maxDimension)
      targetHeight = targetWidth / intrinsicRatio
    } else {
      targetHeight = Math.min(img.height, maxDimension)
      targetWidth = targetHeight * intrinsicRatio
    }

    this.canvas.width = Math.max(1, Math.round(targetWidth))
    this.canvas.height = Math.max(1, Math.round(targetHeight))
    this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height)

    const tiles: Tile[] = []
    const tileWidth = this.canvas.width / this.config.cols
    const tileHeight = this.canvas.height / this.config.rows

    for (let row = 0; row < this.config.rows; row++) {
      for (let col = 0; col < this.config.cols; col++) {
        const index = row * this.config.cols + col
        const isEmpty = index === this.tileCount - 1

        tiles.push({
          id: `tile-${index}`,
          row,
          col,
          index,
          correctRow: row,
          correctCol: col,
          correctIndex: index,
          imageSliceRef: {
            sourceX: col * tileWidth,
            sourceY: row * tileHeight,
            sourceWidth: tileWidth,
            sourceHeight: tileHeight,
          },
          isEmpty,
        })
      }
    }

    const board = tiles.map((_, index) => index)

    return {
      tiles,
      board,
      emptyIndex: this.tileCount - 1,
      emptyRow: this.config.rows - 1,
      emptyCol: this.config.cols - 1,
      moveCount: 0,
      startTime: Date.now(),
      isSolved: false,
      isAnimating: false,
      dragState: null,
    }
  }


  shuffleWithMoves(state: PuzzleState, moves: number = 100): { state: PuzzleState; moves: string[] } {
    let current = normalizePuzzleState(state, this.config)
    let lastMovedValue: number | null = null
    const reducedMoves: string[] = []
    const pathHashes: string[] = [this.getStateHash(current)]
    const pathIndexByHash = new Map<string, number>([[pathHashes[0], 0]])

    for (let index = 0; index < moves; index++) {
      let validMoveValues = getMovableTileValues(this.config, current.board, current.emptyIndex)
      if (validMoveValues.length === 0) break

      if (lastMovedValue !== null) {
        validMoveValues = validMoveValues.filter((value) => value !== lastMovedValue)
        if (validMoveValues.length === 0) {
          validMoveValues = getMovableTileValues(this.config, current.board, current.emptyIndex)
        }
      }

      const randomValue = validMoveValues[Math.floor(Math.random() * validMoveValues.length)]
      const randomMove = this.getTileIdByValue(current, randomValue)
      if (!randomMove) break

      const nextState = this.makeMove(current, randomMove)
      if (nextState === current) break

      current = normalizePuzzleState(nextState, this.config)
      lastMovedValue = randomValue
      const nextHash = this.getStateHash(current)
      const existingIndex = pathIndexByHash.get(nextHash)

      if (existingIndex !== undefined) {
        const removedHashes = pathHashes.slice(existingIndex + 1)
        for (const hash of removedHashes) {
          pathIndexByHash.delete(hash)
        }
        pathHashes.length = existingIndex + 1
        reducedMoves.length = existingIndex
      } else {
        reducedMoves.push(randomMove)
        pathHashes.push(nextHash)
        pathIndexByHash.set(nextHash, pathHashes.length - 1)
      }
    }

    if (this.isSolved(current)) {
      return this.shuffleWithMoves(state, moves)
    }

    const normalizedStartState = normalizePuzzleState(current, this.config)
    return {
      state: {
        ...normalizedStartState,
        moveCount: 0,
        startTime: Date.now(),
        isAnimating: false,
        dragState: null,
      },
      moves: reducedMoves,
    }
  }

  createStateFromBoard(baseState: PuzzleState, board: number[], emptyIndex: number): PuzzleState | null {
    if (board.length !== this.tileCount || emptyIndex < 0 || emptyIndex >= this.tileCount) {
      return null
    }

    const seen = new Set<number>()
    for (const value of board) {
      if (!Number.isInteger(value) || value < 0 || value >= this.tileCount || seen.has(value)) {
        return null
      }
      seen.add(value)
    }

    if (board[emptyIndex] !== this.emptyValue) {
      return null
    }

    const sourceTilesByValue = new Map(baseState.tiles.map((tile) => [tile.correctIndex, tile]))
    const tiles: Tile[] = []

    for (let position = 0; position < board.length; position++) {
      const value = board[position]
      const sourceTile = sourceTilesByValue.get(value)
      if (!sourceTile) {
        return null
      }

      const row = Math.floor(position / this.config.cols)
      const col = position % this.config.cols
      tiles.push({
        ...sourceTile,
        row,
        col,
        index: position,
        isDragging: false,
        canMove: undefined,
      })
    }

    const normalizedState = normalizePuzzleState({
      tiles,
      board: [...board],
      emptyIndex,
      emptyRow: Math.floor(emptyIndex / this.config.cols),
      emptyCol: emptyIndex % this.config.cols,
      moveCount: 0,
      startTime: Date.now(),
      isSolved: false,
      isAnimating: false,
      dragState: null,
    }, this.config)

    return this.isSolved(normalizedState) ? null : normalizedState
  }

  getValidMoves(state: PuzzleState): string[] {
    return getMovableTileValues(this.config, state.board, state.emptyIndex)
      .map((value) => this.getTileIdByValue(state, value))
      .filter((tileId): tileId is string => tileId !== null)
  }

  canMoveTile(state: PuzzleState, tileId: string): boolean {
    const tile = this.getTileById(state, tileId)
    if (!tile || tile.isEmpty) return false

    return getMovableTileValues(this.config, state.board, state.emptyIndex).includes(tile.correctIndex)
  }

  getStateHash(state: PuzzleState): string {
    return getStateHashFromBoard(state.board)
  }

  getHeuristicScore(state: PuzzleState): number {
    return getBoardHeuristic(this.config, state.board)
  }

  getProgressMetrics(state: PuzzleState, referenceHeuristic?: number | null): PuzzleProgressMetrics {
    return getBoardProgressMetrics(this.config, state.board, referenceHeuristic)
  }

  getContextHint(state: PuzzleState, preferredFocusRow: number | null = null): PuzzleContextHint {
    return buildPuzzleContextHint(state, this.config, preferredFocusRow)
  }

  findSolutionMoves(state: PuzzleState, maxVisitedNodes: number = 350000): string[] | null {
    const solutionValues = findSolutionValues(this.config, state.board, state.emptyIndex, maxVisitedNodes)
    if (!solutionValues) return null

    const solutionIds: string[] = []
    for (const value of solutionValues) {
      const tileId = this.getTileIdByValue(state, value)
      if (!tileId) return null
      solutionIds.push(tileId)
    }

    return solutionIds
  }

  getGreedySuggestedMove(state: PuzzleState, previousTileId: string | null = null): string | null {
    const previousValue = previousTileId ? this.getTileById(state, previousTileId)?.correctIndex ?? null : null
    const suggestedValue = getGreedySuggestedValue(this.config, state.board, state.emptyIndex, previousValue)
    if (suggestedValue === null) return null

    return this.getTileIdByValue(state, suggestedValue)
  }

  makeMove(state: PuzzleState, tileId: string): PuzzleState {
    const tileIndex = state.tiles.findIndex((tile) => tile.id === tileId)
    if (tileIndex < 0) return state

    const sourceTile = state.tiles[tileIndex]
    if (sourceTile.isEmpty) return state
    if (!getMovableTileValues(this.config, state.board, state.emptyIndex).includes(sourceTile.correctIndex)) {
      return state
    }

    const emptyTileIndex = state.tiles.findIndex((tile) => tile.isEmpty)
    if (emptyTileIndex < 0) return state

    const nextState = clonePuzzleState(state)
    const tileToMove = nextState.tiles[tileIndex]
    const emptyTile = nextState.tiles[emptyTileIndex]
    const tilePosition = sourceTile.row * this.config.cols + sourceTile.col

    const tempRow = tileToMove.row
    const tempCol = tileToMove.col

    tileToMove.row = emptyTile.row
    tileToMove.col = emptyTile.col
    emptyTile.row = tempRow
    emptyTile.col = tempCol

    nextState.board = state.board.slice()
    nextState.board[state.emptyIndex] = tileToMove.correctIndex
    nextState.board[tilePosition] = this.emptyValue
    nextState.emptyIndex = tilePosition
    nextState.emptyRow = tempRow
    nextState.emptyCol = tempCol
    nextState.moveCount += 1
    nextState.isSolved = this.isSolved(nextState)

    return nextState
  }

  isSolved(state: PuzzleState): boolean {
    for (let index = 0; index < this.tileCount - 1; index++) {
      if (state.board[index] !== index) return false
    }

    return state.board[this.tileCount - 1] === this.emptyValue
  }

  getTileAtPosition(state: PuzzleState, canvasX: number, canvasY: number): string | null {
    const tileWidth = this.canvas.width / this.config.cols
    const tileHeight = this.canvas.height / this.config.rows

    const col = Math.floor(canvasX / tileWidth)
    const row = Math.floor(canvasY / tileHeight)
    if (row < 0 || row >= this.config.rows || col < 0 || col >= this.config.cols) {
      return null
    }

    return this.getTileByPosition(state, row, col)?.id ?? null
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas
  }

  private async loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = src
    })
  }

  private getTileById(state: PuzzleState, tileId: string): Tile | null {
    return state.tiles.find((tile) => tile.id === tileId) ?? null
  }

  private getTileByPosition(state: PuzzleState, row: number, col: number): Tile | null {
    return state.tiles.find((tile) => tile.row === row && tile.col === col) ?? null
  }

  private getTileIdByValue(state: PuzzleState, value: number): string | null {
    const directTile = state.tiles[value]
    if (directTile && directTile.correctIndex === value) {
      return directTile.id
    }

    return state.tiles.find((tile) => tile.correctIndex === value)?.id ?? null
  }

}

