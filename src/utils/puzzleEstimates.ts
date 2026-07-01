import type {
  GalleryChallengeTarget,
  GalleryReplaySetup,
  PuzzleConfig,
  SolvedGalleryEntry,
} from '../types/index.ts'
import { isChallengeCleanRun } from './galleryChallenge.ts'

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

const ESTIMATE_FLOORS: Record<string, PuzzleEstimateFloor> = {
  '3x3': { moves: 66, time: 99 },
  '4x4': { moves: 132, time: 220 },
  '5x5': { moves: 234, time: 434 },
  '6x6': { moves: 391, time: 720 },
}

function getConfigKey(config: PuzzleConfig): string {
  return `${config.rows}x${config.cols}`
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

function getPersonalCleanRuns(entries: SolvedGalleryEntry[], config: PuzzleConfig): SolvedGalleryEntry[] {
  return entries.filter((entry) =>
    entry.config.rows === config.rows
    && entry.config.cols === config.cols
    && entry.assistanceMode === 'clean'
    && entry.hasDetailedProfile
  )
}

function createSyntheticChallengeTargetIdForEntry(entry: SolvedGalleryEntry): string | null {
  if (!entry.replaySetup) return null

  const motifKey = entry.sourceImage ?? entry.previewImage ?? ''
  if (!motifKey) return null

  return createSyntheticChallengeTargetId({
    motifKey,
    config: entry.config,
    cropKey: createCropKey({
      cropTransform: entry.cropTransform ?? null,
      useFullImage: entry.useFullImage ?? false,
    }),
    replaySetup: entry.replaySetup,
  })
}

export function isCleanGalleryRunBeatingEstimatedTarget(
  entry: SolvedGalleryEntry,
  target: GalleryChallengeTarget
): boolean {
  if (!target.synthetic || !entry.hasDetailedProfile) return false
  if (createSyntheticChallengeTargetIdForEntry(entry) !== target.entryId) return false

  return isCleanRunBeatingEstimatedTarget({
    moves: entry.moves,
    time: entry.time,
    assistanceMode: entry.assistanceMode,
  }, target)
}

export function isCleanRunBeatingEstimatedTarget(
  metrics: {
    moves: number
    time: number
    assistanceMode: SolvedGalleryEntry['assistanceMode']
    ghostUsageCount?: number
    heatmapUsageCount?: number
  },
  target: GalleryChallengeTarget
): boolean {
  return Boolean(
    target.synthetic
    && isChallengeCleanRun(metrics)
    && metrics.time < target.time
    && metrics.moves < target.moves
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
  const heuristicMoves = floor.moves
  const heuristicTime = floor.time

  const personalRuns = getPersonalCleanRuns(galleryEntries, config)
  const medianMoves = median(personalRuns.map((entry) => entry.moves))
  const medianTime = median(personalRuns.map((entry) => entry.time))
  const personalMedianApplied =
    personalRuns.length >= PERSONAL_MEDIAN_MIN_RUNS
    && medianMoves !== null
    && medianTime !== null

  const moves = personalMedianApplied
    ? Math.max(1, Math.round(clampPersonalBlend(
      heuristicMoves * HEURISTIC_WEIGHT + medianMoves * PERSONAL_MEDIAN_WEIGHT,
      heuristicMoves
    )))
    : heuristicMoves
  const time = personalMedianApplied
    ? Math.max(1, Math.round(clampPersonalBlend(
      heuristicTime * HEURISTIC_WEIGHT + medianTime * PERSONAL_MEDIAN_WEIGHT,
      heuristicTime
    )))
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
  estimatedTarget: string | GalleryChallengeTarget
): boolean {
  const syntheticTargetId = typeof estimatedTarget === 'string' ? estimatedTarget : estimatedTarget.entryId
  return entries.some((entry) =>
    entry.challengeTargetId === syntheticTargetId
    || entry.estimatedChallengeTarget?.entryId === syntheticTargetId
    || (typeof estimatedTarget !== 'string' && isCleanGalleryRunBeatingEstimatedTarget(entry, estimatedTarget))
  )
}
