import type {
  GalleryChallengeTarget,
  GalleryReplaySetup,
  PuzzleConfig,
  SolvedGalleryEntry,
} from '../types/index.ts'

export interface PuzzleEstimateContext {
  config: PuzzleConfig
  motifKey: string
  cropKey: string
  replaySetup: GalleryReplaySetup
  galleryEntries?: SolvedGalleryEntry[]
  createdAt?: string
}

export interface PuzzleEstimateFloor {
  moves: number
  time: number
}

const ESTIMATE_VERSION = 1
const ESTIMATE_METHOD = 'heuristic-personal-v1'
const HEURISTIC_WEIGHT = 0.65
const PERSONAL_MEDIAN_WEIGHT = 0.35
const PERSONAL_MEDIAN_MIN_RUNS = 5
const PERSONAL_MEDIAN_CAP = 0.25
const DEFAULT_HEURISTIC_HEADROOM_CAP = 0.4

const ESTIMATE_FLOORS: Record<string, PuzzleEstimateFloor> = {
  '3x3': { moves: 60, time: 90 },
  '4x4': { moves: 180, time: 360 },
  '5x5': { moves: 360, time: 900 },
  '6x6': { moves: 600, time: 1800 },
}

function getConfigKey(config: PuzzleConfig): string {
  return `${config.rows}x${config.cols}`
}

function getHeuristicHeadroomCap(config: PuzzleConfig): number {
  const key = getConfigKey(config)
  if (key === '3x3') return 0.25
  if (key === '4x4') return 0.4
  if (key === '5x5') return 0.6
  if (key === '6x6') return 0.75
  return DEFAULT_HEURISTIC_HEADROOM_CAP
}

export function getPuzzleEstimateFloor(config: PuzzleConfig): PuzzleEstimateFloor {
  return ESTIMATE_FLOORS[getConfigKey(config)] ?? {
    moves: Math.max(40, config.rows * config.cols * 14),
    time: Math.max(60, config.rows * config.cols * 45),
  }
}

export function createCropKey(input: {
  useFullImage?: boolean
  cropTransform?: {
    zoom: number
    rotationDeg: number
    offsetX: number
    offsetY: number
  } | null
}): string {
  if (input.useFullImage) {
    return 'full'
  }

  const transform = input.cropTransform
  if (!transform) {
    return 'crop:no-transform'
  }

  return [
    'crop',
    `z:${Number(transform.zoom).toFixed(4)}`,
    `r:${Number(transform.rotationDeg).toFixed(4)}`,
    `x:${Number(transform.offsetX).toFixed(4)}`,
    `y:${Number(transform.offsetY).toFixed(4)}`,
  ].join(':')
}

export function createStartBoardFingerprint(setup: Pick<GalleryReplaySetup, 'startBoard' | 'emptyIndex'>): string {
  return `empty-${setup.emptyIndex}-board-${setup.startBoard.join('-')}`
}

function encodeSyntheticPart(value: string): string {
  return encodeURIComponent(value.trim() || 'unknown').replace(/%/g, '~')
}

export function createSyntheticChallengeTargetId(input: {
  motifKey: string
  config: PuzzleConfig
  cropKey: string
  replaySetup: Pick<GalleryReplaySetup, 'startBoard' | 'emptyIndex'>
}): string {
  return [
    'synthetic',
    encodeSyntheticPart(input.motifKey),
    `${input.config.rows}x${input.config.cols}`,
    encodeSyntheticPart(input.cropKey),
    createStartBoardFingerprint(input.replaySetup),
    'estimate-v1',
  ].join(':')
}

function median(values: number[]): number | null {
  if (values.length === 0) return null

  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

function clampPersonalBlend(value: number, heuristicValue: number): number {
  const min = heuristicValue * (1 - PERSONAL_MEDIAN_CAP)
  const max = heuristicValue * (1 + PERSONAL_MEDIAN_CAP)
  return Math.min(max, Math.max(min, value))
}

function getTileManhattanScore(board: number[], config: PuzzleConfig): number {
  const emptyTile = config.rows * config.cols - 1

  return board.reduce((score, tileValue, index) => {
    if (tileValue === emptyTile) return score

    const currentRow = Math.floor(index / config.cols)
    const currentCol = index % config.cols
    const targetRow = Math.floor(tileValue / config.cols)
    const targetCol = tileValue % config.cols
    return score + Math.abs(currentRow - targetRow) + Math.abs(currentCol - targetCol)
  }, 0)
}

function getMisplacedTileCount(board: number[], config: PuzzleConfig): number {
  const emptyTile = config.rows * config.cols - 1
  return board.filter((tileValue, index) => tileValue !== emptyTile && tileValue !== index).length
}

function getMaxHeuristicScore(config: PuzzleConfig): number {
  const playableTileCount = Math.max(0, config.rows * config.cols - 1)
  const maxTileDistance = Math.max(1, config.rows + config.cols - 2)
  return playableTileCount * maxTileDistance + playableTileCount * 1.5
}

function getPersonalCleanRuns(entries: SolvedGalleryEntry[], config: PuzzleConfig): SolvedGalleryEntry[] {
  return entries.filter((entry) =>
    entry.config.rows === config.rows
    && entry.config.cols === config.cols
    && entry.assistanceMode === 'clean'
    && entry.hasDetailedProfile
  )
}

export function estimateGalleryChallengeTarget({
  config,
  motifKey,
  cropKey,
  replaySetup,
  galleryEntries = [],
  createdAt = new Date().toISOString(),
}: PuzzleEstimateContext): GalleryChallengeTarget {
  const floor = getPuzzleEstimateFloor(config)
  const manhattanScore = getTileManhattanScore(replaySetup.startBoard, config)
  const misplacedTiles = getMisplacedTileCount(replaySetup.startBoard, config)
  const heuristicScore = manhattanScore + misplacedTiles * 1.5
  const heuristicRatio = Math.min(1, Math.max(0, heuristicScore / getMaxHeuristicScore(config)))
  const heuristicHeadroom = heuristicRatio * getHeuristicHeadroomCap(config)
  const heuristicMoves = Math.max(floor.moves, Math.round(floor.moves * (1 + heuristicHeadroom)))
  const heuristicTime = Math.max(floor.time, Math.round(floor.time * (1 + heuristicHeadroom)))

  const personalRuns = getPersonalCleanRuns(galleryEntries, config)
  const medianMoves = median(personalRuns.map((entry) => entry.moves))
  const medianTime = median(personalRuns.map((entry) => entry.time))
  const personalMedianApplied =
    personalRuns.length >= PERSONAL_MEDIAN_MIN_RUNS
    && medianMoves !== null
    && medianTime !== null

  const moves = personalMedianApplied
    ? Math.max(
        floor.moves,
        Math.round(clampPersonalBlend(
          heuristicMoves * HEURISTIC_WEIGHT + medianMoves * PERSONAL_MEDIAN_WEIGHT,
          heuristicMoves
        ))
      )
    : heuristicMoves
  const time = personalMedianApplied
    ? Math.max(
        floor.time,
        Math.round(clampPersonalBlend(
          heuristicTime * HEURISTIC_WEIGHT + medianTime * PERSONAL_MEDIAN_WEIGHT,
          heuristicTime
        ))
      )
    : heuristicTime

  return {
    entryId: createSyntheticChallengeTargetId({ motifKey, config, cropKey, replaySetup }),
    completedAt: createdAt,
    time,
    moves,
    actionMoves: moves,
    assistanceMode: 'clean',
    optimalStartMoveCount: replaySetup.optimalStartMoveCount,
    optimalStartMoveCountKind: replaySetup.optimalStartMoveCountKind,
    synthetic: true,
    estimate: {
      version: ESTIMATE_VERSION,
      method: ESTIMATE_METHOD,
      heuristicScore,
      createdAt,
      personalMedianApplied,
    },
  }
}

export function hasGallerySeriesForEstimatedTarget(
  entries: SolvedGalleryEntry[],
  syntheticTargetId: string
): boolean {
  return entries.some((entry) =>
    entry.challengeTargetId === syntheticTargetId
    || entry.estimatedChallengeTarget?.entryId === syntheticTargetId
  )
}
