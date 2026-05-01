import { PuzzleConfig } from '../types/index'

interface PreparedSolverConfig {
  key: string
  rows: number
  cols: number
  tileCount: number
  emptyValue: number
  adjacencyByPos: number[][]
  goalRows: number[]
  goalCols: number[]
  maxProgressHeuristic: number
}

interface SearchNode {
  board: number[]
  emptyPos: number
  g: number
  h: number
  f: number
  movedTileValue: number | null
  prev: SearchNode | null
}

export interface PuzzleProgressMetrics {
  correctTiles: number
  totalTiles: number
  heuristicScore: number
  progressPercent: number
}

const SUGGESTION_HEURISTIC_WEIGHT = 1.2
const preparedConfigCache = new Map<string, PreparedSolverConfig>()
const solutionCache = new Map<string, number[]>()

function getConfigKey(config: PuzzleConfig): string {
  return `${config.rows}x${config.cols}`
}

function getPreparedConfig(config: PuzzleConfig): PreparedSolverConfig {
  const key = getConfigKey(config)
  const cached = preparedConfigCache.get(key)
  if (cached) return cached

  const tileCount = config.rows * config.cols
  const emptyValue = tileCount - 1
  const goalRows = Array.from({ length: tileCount }, (_, value) => Math.floor(value / config.cols))
  const goalCols = Array.from({ length: tileCount }, (_, value) => value % config.cols)
  const adjacencyByPos = buildAdjacencyLookup(config)
  const prepared: PreparedSolverConfig = {
    key,
    rows: config.rows,
    cols: config.cols,
    tileCount,
    emptyValue,
    adjacencyByPos,
    goalRows,
    goalCols,
    maxProgressHeuristic: calculateMaxProgressHeuristic(config, goalRows, goalCols, emptyValue),
  }

  preparedConfigCache.set(key, prepared)
  return prepared
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

function calculateMaxProgressHeuristic(
  config: PuzzleConfig,
  goalRows: number[],
  goalCols: number[],
  emptyValue: number
): number {
  let maxManhattan = 0
  for (let value = 0; value < emptyValue; value++) {
    const furthestRow = goalRows[value] < config.rows / 2 ? config.rows - 1 : 0
    const furthestCol = goalCols[value] < config.cols / 2 ? config.cols - 1 : 0
    maxManhattan += Math.abs(furthestRow - goalRows[value]) + Math.abs(furthestCol - goalCols[value])
  }

  const maxRowConflict = config.rows * ((config.cols * (config.cols - 1)) / 2) * 2
  const maxColConflict = config.cols * ((config.rows * (config.rows - 1)) / 2) * 2
  return Math.max(1, maxManhattan + maxRowConflict + maxColConflict)
}

function calculateBoardManhattan(prepared: PreparedSolverConfig, board: number[]): number {
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

function calculateBoardLinearConflict(prepared: PreparedSolverConfig, board: number[]): number {
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

function calculateBoardHeuristic(prepared: PreparedSolverConfig, board: number[]): number {
  return calculateBoardManhattan(prepared, board) + calculateBoardLinearConflict(prepared, board)
}

function compareNodes(left: SearchNode, right: SearchNode): number {
  if (left.f !== right.f) return left.f - right.f
  if (left.h !== right.h) return left.h - right.h
  return right.g - left.g
}

function pushOpenNode(heap: SearchNode[], node: SearchNode): void {
  heap.push(node)
  let index = heap.length - 1

  while (index > 0) {
    const parent = Math.floor((index - 1) / 2)
    if (compareNodes(heap[parent], heap[index]) <= 0) break

    ;[heap[parent], heap[index]] = [heap[index], heap[parent]]
    index = parent
  }
}

function popOpenNode(heap: SearchNode[]): SearchNode | undefined {
  if (heap.length === 0) return undefined
  if (heap.length === 1) return heap.pop()

  const first = heap[0]
  const last = heap.pop()
  if (!last) return first

  heap[0] = last
  let index = 0

  for (;;) {
    const left = index * 2 + 1
    const right = index * 2 + 2
    let smallest = index

    if (left < heap.length && compareNodes(heap[left], heap[smallest]) < 0) {
      smallest = left
    }
    if (right < heap.length && compareNodes(heap[right], heap[smallest]) < 0) {
      smallest = right
    }
    if (smallest === index) break

    ;[heap[index], heap[smallest]] = [heap[smallest], heap[index]]
    index = smallest
  }

  return first
}

function hashBoard(board: number[]): string {
  return board.join(',')
}

function getSolutionCacheKey(prepared: PreparedSolverConfig, board: number[]): string {
  return `${prepared.key}:${hashBoard(board)}`
}

function reconstructMovedValues(node: SearchNode): number[] {
  const values: number[] = []
  let current: SearchNode | null = node

  while (current?.prev) {
    if (current.movedTileValue !== null) {
      values.push(current.movedTileValue)
    }
    current = current.prev
  }

  values.reverse()
  return values
}

function storeCachedSolution(cacheKey: string, values: number[]): void {
  if (solutionCache.size > 80) {
    solutionCache.clear()
  }
  solutionCache.set(cacheKey, [...values])
}

function swapBoardPositions(board: number[], fromPos: number, toPos: number): number[] {
  const nextBoard = board.slice()
  ;[nextBoard[fromPos], nextBoard[toPos]] = [nextBoard[toPos], nextBoard[fromPos]]
  return nextBoard
}

export function getStateHashFromBoard(board: number[]): string {
  return hashBoard(board)
}

export function getMovableTileValues(config: PuzzleConfig, board: number[], emptyPos: number): number[] {
  const prepared = getPreparedConfig(config)
  return prepared.adjacencyByPos[emptyPos]
    .map((position) => board[position])
    .filter((value) => value !== prepared.emptyValue)
}

export function getBoardHeuristic(config: PuzzleConfig, board: number[]): number {
  const prepared = getPreparedConfig(config)
  return calculateBoardHeuristic(prepared, board)
}

export function getBoardProgressMetrics(
  config: PuzzleConfig,
  board: number[],
  referenceHeuristic?: number | null
): PuzzleProgressMetrics {
  const prepared = getPreparedConfig(config)
  const totalTiles = Math.max(0, prepared.tileCount - 1)
  let correctTiles = 0

  for (let position = 0; position < board.length; position++) {
    const value = board[position]
    if (value === prepared.emptyValue) continue
    if (value === position) {
      correctTiles += 1
    }
  }

  const heuristicScore = calculateBoardHeuristic(prepared, board)
  const hasReferenceHeuristic = typeof referenceHeuristic === 'number' && referenceHeuristic > 0
  const fallbackReference = Math.max(1, prepared.maxProgressHeuristic)
  const effectiveReference = Math.max(
    heuristicScore,
    hasReferenceHeuristic ? referenceHeuristic : fallbackReference
  )
  const heuristicRatio = 1 - Math.min(1, heuristicScore / effectiveReference)
  const correctRatio = totalTiles > 0 ? correctTiles / totalTiles : 1

  if (correctTiles >= totalTiles) {
    return {
      correctTiles,
      totalTiles,
      heuristicScore,
      progressPercent: 100,
    }
  }

  const weightedRatio = hasReferenceHeuristic
    ? heuristicRatio * 0.56 + correctRatio * 0.44
    : heuristicRatio * 0.18 + correctRatio * 0.82
  const cappedStartRatio = hasReferenceHeuristic
    ? weightedRatio
    : Math.min(correctRatio + 0.18, weightedRatio)
  const combinedRatio = Math.max(correctRatio, cappedStartRatio)

  return {
    correctTiles,
    totalTiles,
    heuristicScore,
    progressPercent: Math.max(0, Math.min(99, Math.round(combinedRatio * 100))),
  }
}

export function findSolutionValues(
  config: PuzzleConfig,
  board: number[],
  emptyPos: number,
  maxVisitedNodes: number = 350000
): number[] | null {
  const prepared = getPreparedConfig(config)
  const cacheKey = getSolutionCacheKey(prepared, board)
  const cached = solutionCache.get(cacheKey)
  if (cached) return [...cached]

  const startH = calculateBoardHeuristic(prepared, board)
  if (startH === 0) return []

  const startNode: SearchNode = {
    board: board.slice(),
    emptyPos,
    g: 0,
    h: startH,
    f: startH,
    movedTileValue: null,
    prev: null,
  }

  const openHeap: SearchNode[] = []
  pushOpenNode(openHeap, startNode)

  const bestCostByHash = new Map<string, number>([[cacheKey, 0]])
  let visitedNodes = 0

  while (openHeap.length > 0) {
    const current = popOpenNode(openHeap)
    if (!current) break

    const currentHash = hashBoard(current.board)
    const bestKnownCost = bestCostByHash.get(currentHash)
    if (bestKnownCost !== undefined && current.g > bestKnownCost) {
      continue
    }

    visitedNodes += 1
    if (visitedNodes > maxVisitedNodes) {
      return null
    }

    if (current.h === 0) {
      const solution = reconstructMovedValues(current)
      storeCachedSolution(cacheKey, solution)
      return solution
    }

    const neighborPositions = prepared.adjacencyByPos[current.emptyPos]
    for (const nextEmptyPos of neighborPositions) {
      const movedTileValue = current.board[nextEmptyPos]
      if (movedTileValue === prepared.emptyValue) continue
      if (current.movedTileValue === movedTileValue) continue

      const nextBoard = swapBoardPositions(current.board, current.emptyPos, nextEmptyPos)
      const nextHash = hashBoard(nextBoard)
      const nextG = current.g + 1
      const knownCost = bestCostByHash.get(nextHash)
      if (knownCost !== undefined && knownCost <= nextG) {
        continue
      }

      const nextH = calculateBoardHeuristic(prepared, nextBoard)
      bestCostByHash.set(nextHash, nextG)
      pushOpenNode(openHeap, {
        board: nextBoard,
        emptyPos: nextEmptyPos,
        g: nextG,
        h: nextH,
        f: nextG + nextH * SUGGESTION_HEURISTIC_WEIGHT,
        movedTileValue,
        prev: current,
      })
    }
  }

  return null
}

export function getGreedySuggestedValue(
  config: PuzzleConfig,
  board: number[],
  emptyPos: number,
  previousTileValue: number | null = null
): number | null {
  const prepared = getPreparedConfig(config)
  const movableValues = getMovableTileValues(config, board, emptyPos)
  if (movableValues.length === 0) return null

  let candidates = movableValues
  if (previousTileValue !== null) {
    const filtered = movableValues.filter((value) => value !== previousTileValue)
    if (filtered.length > 0) {
      candidates = filtered
    }
  }

  let bestValue: number | null = null
  let bestScore = Number.POSITIVE_INFINITY

  for (const value of candidates) {
    const tilePos = board.findIndex((entry) => entry === value)
    if (tilePos < 0) continue

    const nextBoard = swapBoardPositions(board, tilePos, emptyPos)
    const nextScore = calculateBoardHeuristic(prepared, nextBoard)
    if (nextScore < bestScore) {
      bestScore = nextScore
      bestValue = value
    }
  }

  return bestValue
}
