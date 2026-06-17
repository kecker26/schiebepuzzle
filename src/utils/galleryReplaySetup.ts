import type {
  GalleryChallengeTarget,
  GalleryReplaySetup,
  PuzzleConfig,
  SolvedGalleryEntry,
} from '../types/index'

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && typeof value === 'number' && value >= min && value <= max
}

function hasValidBoardPermutation(board: unknown, tileCount: number): board is number[] {
  if (!Array.isArray(board) || board.length !== tileCount) return false

  const seen = new Set<number>()
  for (const value of board) {
    if (!isIntegerInRange(value, 0, tileCount - 1) || seen.has(value)) {
      return false
    }

    seen.add(value)
  }

  return seen.size === tileCount
}

export function isGalleryReplaySetupCompatible(
  setup: GalleryReplaySetup | null | undefined,
  config: PuzzleConfig
): setup is GalleryReplaySetup {
  if (!setup || setup.version !== 1) return false

  const tileCount = config.rows * config.cols
  if (!hasValidBoardPermutation(setup.startBoard, tileCount)) return false
  if (!isIntegerInRange(setup.emptyIndex, 0, tileCount - 1)) return false
  if (setup.startBoard[setup.emptyIndex] !== tileCount - 1) return false

  return Array.isArray(setup.shuffleMoves)
    && setup.shuffleMoves.every((move) => typeof move === 'string' && move.length > 0)
}

export function hasGalleryChallengeSetup(entry: SolvedGalleryEntry): boolean {
  return isGalleryReplaySetupCompatible(entry.replaySetup, entry.config)
}

export function isGalleryChallengeTargetEligible(entry: SolvedGalleryEntry): boolean {
  return hasGalleryChallengeSetup(entry)
    && entry.hasDetailedProfile
    && entry.assistanceMode === 'clean'
}

export function createGalleryChallengeTarget(entry: SolvedGalleryEntry): GalleryChallengeTarget {
  return {
    entryId: entry.id,
    completedAt: entry.completedAt,
    time: entry.time,
    moves: entry.moves,
    actionMoves: entry.actionMoves,
    assistanceMode: entry.assistanceMode,
    optimalStartMoveCount: entry.replaySetup?.optimalStartMoveCount,
    optimalStartMoveCountKind: entry.replaySetup?.optimalStartMoveCountKind,
  }
}
