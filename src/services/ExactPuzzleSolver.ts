import type { PuzzleConfig } from '../types/index'
import type { ExactStartMoveCountResult } from './ExactPuzzleSolverProtocol.ts'

const EXACT_START_MOVE_COUNT_SOLVER_VERSION = 'exact-start-v2'

const IDA_FOUND = Number.MIN_SAFE_INTEGER
const IDA_ABORTED = Number.MIN_SAFE_INTEGER + 1

interface ExactPreparedSolverConfig {
  key: string
  rows: number
  cols: number
  tileCount: number
  emptyValue: number
  adjacencyByPos: number[][]
  goalRows: number[]
  goalCols: number[]
}

interface ExactMoveCandidate {
  nextEmptyPos: number
  nextHeuristic: number
  nextStateKey: string
  nextBound: number
}

const preparedConfigCache = new Map<string, ExactPreparedSolverConfig>()
const exactMoveCountCache = new Map<string, number>()

function normalizeMoveCount(moveCount: number): number {
  if (!Number.isFinite(moveCount)) return 0
  return Math.max(0, Math.round(moveCount))
}

function getConfigKey(config: PuzzleConfig): string {
  return `${config.rows}x${config.cols}`
}

function buildAdjacencyLookup(config: PuzzleConfig): number[][] {
  const tileCount = config.rows * config.cols
  const lookup: number[][] = Array.from({ length: tileCount }, () => [])

  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.cols; col++) {
      const pos = row * config.cols + col
      if (row > 0) lookup[pos].push((row - 1) * config.cols + col)
      if (row < config.rows - 1) lookup[pos].push((row + 1) * config.cols + col)
      if (col > 0) lookup[pos].push(row * config.cols + (col - 1))
      if (col < config.cols - 1) lookup[pos].push(row * config.cols + (col + 1))
    }
  }

  return lookup
}

function getPreparedConfig(config: PuzzleConfig): ExactPreparedSolverConfig {
  const key = getConfigKey(config)
  const cached = preparedConfigCache.get(key)
  if (cached) return cached

  const tileCount = config.rows * config.cols
  const emptyValue = tileCount - 1
  const goalRows = Array.from({ length: tileCount }, (_, value) => Math.floor(value / config.cols))
  const goalCols = Array.from({ length: tileCount }, (_, value) => value % config.cols)
  const prepared: ExactPreparedSolverConfig = {
    key,
    rows: config.rows,
    cols: config.cols,
    tileCount,
    emptyValue,
    adjacencyByPos: buildAdjacencyLookup(config),
    goalRows,
    goalCols,
  }

  preparedConfigCache.set(key, prepared)
  return prepared
}

function encodeBoard(board: number[]): string {
  return String.fromCharCode(...board)
}

function getExactMoveCountCacheKey(prepared: ExactPreparedSolverConfig, board: number[]): string {
  return `${prepared.key}:${encodeBoard(board)}`
}

function calculateBoardManhattan(prepared: ExactPreparedSolverConfig, board: number[]): number {
  let score = 0

  for (let position = 0; position < board.length; position++) {
    const value = board[position]
    if (value === prepared.emptyValue) continue

    const row = Math.floor(position / prepared.cols)
    const col = position % prepared.cols
    score += Math.abs(row - prepared.goalRows[value]) + Math.abs(col - prepared.goalCols[value])
  }

  return score
}

function calculateBoardLinearConflict(prepared: ExactPreparedSolverConfig, board: number[]): number {
  let score = 0

  for (let row = 0; row < prepared.rows; row++) {
    for (let leftCol = 0; leftCol < prepared.cols; leftCol++) {
      const leftValue = board[row * prepared.cols + leftCol]
      if (leftValue === prepared.emptyValue || prepared.goalRows[leftValue] !== row) continue

      for (let rightCol = leftCol + 1; rightCol < prepared.cols; rightCol++) {
        const rightValue = board[row * prepared.cols + rightCol]
        if (rightValue === prepared.emptyValue || prepared.goalRows[rightValue] !== row) continue
        if (prepared.goalCols[leftValue] > prepared.goalCols[rightValue]) {
          score += 2
        }
      }
    }
  }

  for (let col = 0; col < prepared.cols; col++) {
    for (let topRow = 0; topRow < prepared.rows; topRow++) {
      const topValue = board[topRow * prepared.cols + col]
      if (topValue === prepared.emptyValue || prepared.goalCols[topValue] !== col) continue

      for (let bottomRow = topRow + 1; bottomRow < prepared.rows; bottomRow++) {
        const bottomValue = board[bottomRow * prepared.cols + col]
        if (bottomValue === prepared.emptyValue || prepared.goalCols[bottomValue] !== col) continue
        if (prepared.goalRows[topValue] > prepared.goalRows[bottomValue]) {
          score += 2
        }
      }
    }
  }

  return score
}

function calculateBoardHeuristic(prepared: ExactPreparedSolverConfig, board: number[]): number {
  return calculateBoardManhattan(prepared, board) + calculateBoardLinearConflict(prepared, board)
}

function countBoardInversions(prepared: ExactPreparedSolverConfig, board: number[]): number {
  let inversions = 0

  for (let left = 0; left < board.length; left++) {
    const leftValue = board[left]
    if (leftValue === prepared.emptyValue) continue

    for (let right = left + 1; right < board.length; right++) {
      const rightValue = board[right]
      if (rightValue === prepared.emptyValue) continue
      if (leftValue > rightValue) {
        inversions += 1
      }
    }
  }

  return inversions
}

function isBoardSolvable(prepared: ExactPreparedSolverConfig, board: number[], emptyPos: number): boolean {
  const inversions = countBoardInversions(prepared, board)
  if (prepared.cols % 2 === 1) {
    return inversions % 2 === 0
  }

  const emptyRowFromBottom = prepared.rows - Math.floor(emptyPos / prepared.cols)
  return (inversions + emptyRowFromBottom) % 2 === 1
}

function swapBoardPositions(board: number[], fromPos: number, toPos: number): void {
  const movedValue = board[fromPos]
  board[fromPos] = board[toPos]
  board[toPos] = movedValue
}

function createExactMoveCandidates(
  prepared: ExactPreparedSolverConfig,
  board: number[],
  emptyPos: number,
  currentDepth: number,
  previousEmptyPos: number
): ExactMoveCandidate[] {
  const candidates: ExactMoveCandidate[] = []

  for (const nextEmptyPos of prepared.adjacencyByPos[emptyPos]) {
    if (nextEmptyPos === previousEmptyPos) continue

    swapBoardPositions(board, emptyPos, nextEmptyPos)
    const nextHeuristic = calculateBoardHeuristic(prepared, board)
    const nextStateKey = encodeBoard(board)
    candidates.push({
      nextEmptyPos,
      nextHeuristic,
      nextStateKey,
      nextBound: currentDepth + 1 + nextHeuristic,
    })
    swapBoardPositions(board, emptyPos, nextEmptyPos)
  }

  candidates.sort((left, right) => {
    if (left.nextBound !== right.nextBound) {
      return left.nextBound - right.nextBound
    }
    return left.nextHeuristic - right.nextHeuristic
  })

  return candidates
}

function findExactMoveCountWithIdaStar(
  prepared: ExactPreparedSolverConfig,
  initialBoard: number[],
  initialEmptyPos: number,
  maxVisitedNodes: number,
  initialHeuristic: number
): number | null {
  if (maxVisitedNodes <= 0) return null

  let foundMoveCount: number | null = null
  let visitedNodes = 0
  let bound = initialHeuristic
  const board = [...initialBoard]
  const startStateKey = encodeBoard(board)

  const search = (
    emptyPos: number,
    currentDepth: number,
    currentHeuristic: number,
    currentBound: number,
    previousEmptyPos: number,
    stateKey: string,
    bestDepthByState: Map<string, number>
  ): number => {
    const estimatedTotalCost = currentDepth + currentHeuristic
    if (estimatedTotalCost > currentBound) {
      return estimatedTotalCost
    }

    if (currentHeuristic === 0) {
      foundMoveCount = currentDepth
      return IDA_FOUND
    }

    visitedNodes += 1
    if (visitedNodes > maxVisitedNodes) {
      return IDA_ABORTED
    }

    const bestKnownDepth = bestDepthByState.get(stateKey)
    if (bestKnownDepth !== undefined && bestKnownDepth <= currentDepth) {
      return Number.POSITIVE_INFINITY
    }
    bestDepthByState.set(stateKey, currentDepth)

    let nextBound = Number.POSITIVE_INFINITY
    const candidates = createExactMoveCandidates(
      prepared,
      board,
      emptyPos,
      currentDepth,
      previousEmptyPos
    )

    for (const candidate of candidates) {
      if (candidate.nextBound > currentBound) {
        if (candidate.nextBound < nextBound) {
          nextBound = candidate.nextBound
        }
        continue
      }

      swapBoardPositions(board, emptyPos, candidate.nextEmptyPos)
      const result = search(
        candidate.nextEmptyPos,
        currentDepth + 1,
        candidate.nextHeuristic,
        currentBound,
        emptyPos,
        candidate.nextStateKey,
        bestDepthByState
      )
      swapBoardPositions(board, emptyPos, candidate.nextEmptyPos)

      if (result === IDA_FOUND || result === IDA_ABORTED) {
        return result
      }
      if (result < nextBound) {
        nextBound = result
      }
    }

    return nextBound
  }

  while (Number.isFinite(bound)) {
    const bestDepthByState = new Map<string, number>()
    const searchResult = search(initialEmptyPos, 0, initialHeuristic, bound, -1, startStateKey, bestDepthByState)

    if (searchResult === IDA_FOUND) {
      return foundMoveCount
    }
    if (searchResult === IDA_ABORTED || !Number.isFinite(searchResult)) {
      return null
    }

    bound = searchResult
  }

  return null
}

function createExactStartMoveCountResult(moveCount: number): ExactStartMoveCountResult {
  return {
    status: 'exact',
    moveCount: normalizeMoveCount(moveCount),
    solverVersion: EXACT_START_MOVE_COUNT_SOLVER_VERSION,
  }
}

export function createLowerBoundStartMoveCountResult(moveCount: number): ExactStartMoveCountResult {
  return {
    status: 'lower-bound',
    moveCount: normalizeMoveCount(moveCount),
    solverVersion: EXACT_START_MOVE_COUNT_SOLVER_VERSION,
  }
}

export function createUnavailableStartMoveCountResult(): ExactStartMoveCountResult {
  return {
    status: 'unavailable',
    moveCount: null,
    solverVersion: EXACT_START_MOVE_COUNT_SOLVER_VERSION,
  }
}

export function resolveExactStartMoveCount(
  config: PuzzleConfig,
  board: number[],
  emptyPos: number,
  maxVisitedNodes: number
): ExactStartMoveCountResult {
  const prepared = getPreparedConfig(config)
  const lowerBound = normalizeMoveCount(calculateBoardHeuristic(prepared, board))
  if (lowerBound === 0) {
    return createExactStartMoveCountResult(0)
  }

  if (!isBoardSolvable(prepared, board, emptyPos)) {
    return createUnavailableStartMoveCountResult()
  }

  if (prepared.tileCount > 16) {
    return createLowerBoundStartMoveCountResult(lowerBound)
  }

  const exactCacheKey = getExactMoveCountCacheKey(prepared, board)
  const cachedMoveCount = exactMoveCountCache.get(exactCacheKey)
  if (cachedMoveCount !== undefined) {
    return createExactStartMoveCountResult(cachedMoveCount)
  }

  const exactMoveCount = findExactMoveCountWithIdaStar(
    prepared,
    board,
    emptyPos,
    maxVisitedNodes,
    lowerBound
  )
  if (exactMoveCount !== null) {
    exactMoveCountCache.set(exactCacheKey, exactMoveCount)
    return createExactStartMoveCountResult(exactMoveCount)
  }

  return createLowerBoundStartMoveCountResult(lowerBound)
}
