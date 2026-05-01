import {
  type GhostPreviewMode,
  PuzzleMoveDirection,
  PuzzleMoveRecord,
  PuzzleState,
} from '../../types/index'

export const HISTORY_LIMIT = 150
export const PERSISTED_HISTORY_LIMIT = 12
export const MOVE_ANIMATION_DURATION_MS = 300
export const INVALID_TILE_FEEDBACK_DURATION_MS = 360
export const CORRECT_TILE_PULSE_DURATION_MS = 1040
export const TILE_NUMBER_CORRECTNESS_PULSE_DURATION_MS = 1400
export const WIN_CELEBRATION_DURATION_MS = 3000
export const TILE_NUMBER_PREVIEW_MS = 5000
export const HOTKEY_HINT_PREVIEW_MS = 5000
export const EXACT_SOLUTION_NODE_LIMIT = 350000
export const START_OPTIMAL_SOLUTION_NODE_LIMIT = 4000000
export const START_APPROXIMATE_SOLUTION_NODE_LIMIT = 900000
export const START_APPROXIMATE_SOLUTION_TIME_LIMIT_5X5_MS = 10000
export const START_APPROXIMATE_SOLUTION_TIME_LIMIT_6X6_MS = 15000
export const GHOST_PREVIEW_MODE_DEFAULT: GhostPreviewMode = 'image'
export const GHOST_PREVIEW_WEIGHT_DEFAULT = 56

export type HintResolutionSource = 'exact' | 'tracked' | 'greedy'
export type HintDirection = PuzzleMoveDirection
export type HintConfidenceTone = 'high' | 'medium'

export interface SuggestedHintPreview {
  tileId: string
  tileLabel: string
  direction: HintDirection
  directionLabel: string
  sourceLabel: string
  confidenceLabel: string
  confidenceTone: HintConfidenceTone
  description: string
}

const MOVE_DIRECTION_LABELS: Record<PuzzleMoveDirection, string> = {
  up: 'oben',
  down: 'unten',
  left: 'links',
  right: 'rechts',
}

const HINT_DIRECTION_LABELS: Record<PuzzleMoveDirection, string> = {
  up: 'nach oben',
  down: 'nach unten',
  left: 'nach links',
  right: 'nach rechts',
}

export function isMoveDirection(value: unknown): value is PuzzleMoveDirection {
  return value === 'up' || value === 'down' || value === 'left' || value === 'right'
}

export function normalizeGhostPreviewWeight(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return GHOST_PREVIEW_WEIGHT_DEFAULT
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function normalizeGhostPreviewMode(value: unknown): GhostPreviewMode {
  return value === 'contours' || value === 'edges' || value === 'image'
    ? value
    : GHOST_PREVIEW_MODE_DEFAULT
}

export function getMoveDirectionLabel(direction: PuzzleMoveDirection): string {
  return MOVE_DIRECTION_LABELS[direction]
}

function getDirectionFromDelta(deltaRow: number, deltaCol: number): PuzzleMoveDirection | null {
  if (deltaRow < 0) return 'up'
  if (deltaRow > 0) return 'down'
  if (deltaCol < 0) return 'left'
  if (deltaCol > 0) return 'right'
  return null
}

export function createMoveRecordForStates(
  previousState: PuzzleState,
  nextState: PuzzleState,
  moveNumber: number
): PuzzleMoveRecord | null {
  const movedTileAfter = nextState.tiles.find(
    (tile) => !tile.isEmpty && tile.row === previousState.emptyRow && tile.col === previousState.emptyCol
  )
  if (!movedTileAfter) return null

  const movedTileBefore = previousState.tiles.find((tile) => tile.id === movedTileAfter.id)
  if (!movedTileBefore || movedTileBefore.isEmpty) return null

  const direction = getDirectionFromDelta(
    movedTileAfter.row - movedTileBefore.row,
    movedTileAfter.col - movedTileBefore.col
  )
  if (!direction) return null

  return {
    tileId: movedTileAfter.id,
    tileValue: movedTileAfter.correctIndex + 1,
    direction,
    moveNumber: Math.max(1, Math.round(moveNumber)),
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false

  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  )
}

function isInteractiveControlTarget(
  target: EventTarget | null,
  options?: {
    allowMarkedButtons?: boolean
    key?: string
  }
): boolean {
  if (!(target instanceof HTMLElement)) return false

  if (target.closest('a[href], summary, [role="menu"], [role="menuitem"], [role="dialog"], [role="alertdialog"]')) {
    return true
  }

  const buttonLikeTarget = target.closest<HTMLElement>('button, [role="button"]')
  if (!buttonLikeTarget) {
    return false
  }

  if (!options?.allowMarkedButtons || buttonLikeTarget.dataset.puzzleAllowHotkeys !== 'true') {
    return true
  }

  const normalizedKey = options.key?.toLowerCase()
  return normalizedKey === 'enter'
    || normalizedKey === 'numpadenter'
    || normalizedKey === ' '
    || normalizedKey === 'spacebar'
    || normalizedKey?.startsWith('arrow') === true
}

export function isKeyboardShortcutBlockedTarget(
  target: EventTarget | null,
  options?: {
    allowMarkedButtons?: boolean
    key?: string
  }
): boolean {
  return isEditableTarget(target) || isInteractiveControlTarget(target, options)
}

export function getKeyboardMoveDirection(key: string): PuzzleMoveDirection | null {
  switch (key.toLowerCase()) {
    case 'arrowup':
    case 'w':
      return 'up'
    case 'arrowdown':
    case 's':
      return 'down'
    case 'arrowleft':
    case 'a':
      return 'left'
    case 'arrowright':
    case 'd':
      return 'right'
    default:
      return null
  }
}

export function buildHintPreview(
  state: PuzzleState,
  tileId: string,
  source: HintResolutionSource
): SuggestedHintPreview | null {
  const tile = state.tiles.find((entry) => entry.id === tileId)
  if (!tile || tile.isEmpty) return null

  const deltaRow = state.emptyRow - tile.row
  const deltaCol = state.emptyCol - tile.col
  let direction: HintDirection

  if (deltaRow === -1) {
    direction = 'up'
  } else if (deltaRow === 1) {
    direction = 'down'
  } else if (deltaCol === -1) {
    direction = 'left'
  } else {
    direction = 'right'
  }

  const directionLabel = HINT_DIRECTION_LABELS[direction]
  const confidenceTone: HintConfidenceTone = source === 'greedy' ? 'medium' : 'high'
  const confidenceLabel = source === 'greedy' ? 'Mittel' : 'Hoch'
  const sourceLabel =
    source === 'exact'
      ? 'Direkter Loesungspfad'
      : source === 'tracked'
        ? 'Pfad aus deinem Verlauf'
        : 'Lokale Heuristik'
  const tileLabel = `Kachel ${tile.correctIndex + 1}`
  const description =
    source === 'greedy'
      ? `${tileLabel} ${directionLabel}. Bester lokaler Zug.`
      : `${tileLabel} ${directionLabel}. Liegt auf dem Loesungspfad.`

  return {
    tileId,
    tileLabel,
    direction,
    directionLabel,
    sourceLabel,
    confidenceLabel,
    confidenceTone,
    description,
  }
}

export function getProgressStatusLabel(progressPercent: number | null | undefined): string {
  if (typeof progressPercent !== 'number') return 'Guter Start'
  if (progressPercent >= 94) return 'Fast geschafft'
  if (progressPercent >= 76) return 'Stabil auf Kurs'
  if (progressPercent >= 48) return 'Puzzle formt sich'
  return 'Guter Start'
}

export function formatElapsedTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}





