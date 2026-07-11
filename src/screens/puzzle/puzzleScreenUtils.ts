import {
  type GhostPreviewMode,
  type GhostPreviewMotion,
  type GhostPreviewScope,
  type HeatmapMode,
  PuzzleMoveDirection,
  PuzzleMoveRecord,
  PuzzleState,
} from '../../types/index'

export const HISTORY_LIMIT = 150
export const PERSISTED_HISTORY_LIMIT = 12
export const MOVE_ANIMATION_DURATION_MS = 460
export const INVALID_TILE_FEEDBACK_DURATION_MS = 540
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
export const GHOST_PREVIEW_SCOPE_DEFAULT: GhostPreviewScope = 'misplaced'
export const GHOST_PREVIEW_MOTION_DEFAULT: GhostPreviewMotion = 'static'
export const GHOST_PREVIEW_WEIGHT_DEFAULT = 56
export const HEATMAP_MODE_DEFAULT: HeatmapMode = 'classic'
export const HEATMAP_INTENSITY_DEFAULT = 100
export const HEATMAP_DELTA_LOOKBACK = 5
export const MEDAL_RUN_LOCK_MESSAGE = 'Zielmodus aktiv - Spielhilfen sind gesperrt.'

export type HintResolutionSource = 'exact' | 'tracked' | 'greedy'
export type HintDirection = PuzzleMoveDirection
export type HintConfidenceTone = 'high' | 'medium'

export interface SuggestedHintPreview {
  tileId: string
  tileLabel: string
  direction: HintDirection
  directionLabel: string
  actionLabel: string
  sourceLabel: string
  confidenceLabel: string
  confidenceTone: HintConfidenceTone
  description: string
  currentRow: number
  currentCol: number
  targetRow: number
  targetCol: number
  targetIndex: number
  currentPositionLabel: string
  targetPositionLabel: string
  distance: number
  strategyLabel: string
  objectiveLabel: string | null
  objectiveDetail: string | null
}

export interface HintPathObjective {
  tileId: string
  tileLabel: string
  preparationMoveCount: number
  label: string
  detail: string
}

export interface PuzzleMoveFeedback {
  message: string
  tone: 'positive' | 'neutral' | 'caution'
}

export interface PuzzleMoveFeedbackInput {
  previousFocusTitle: string
  nextFocusTitle: string
  previousFocusRow: number | null
  nextFocusRow: number | null
  previousFocusProgress: number
  nextFocusProgress: number
  nextFocusTotal: number
  tileLabel: string
  tileDistanceBefore: number
  tileDistanceAfter: number
  heuristicBefore: number
  heuristicAfter: number
  isSuggested: boolean
}

export interface HeatmapDeltaAnalysis {
  tileDeltas: Record<string, number>
  lookback: number
  improvedTiles: number
  worsenedTiles: number
  unchangedTiles: number
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

export function normalizeGhostPreviewScope(value: unknown): GhostPreviewScope {
  return value === 'focus' || value === 'misplaced'
    ? value
    : GHOST_PREVIEW_SCOPE_DEFAULT
}

export function normalizeGhostPreviewMotion(value: unknown): GhostPreviewMotion {
  return value === 'pulse' || value === 'static'
    ? value
    : GHOST_PREVIEW_MOTION_DEFAULT
}

export function normalizeGhostPreviewProgressPeak(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

export interface HeatmapDisplaySelection {
  mode: HeatmapMode
  distancesVisible: boolean
}

export type HeatmapMovePotentialTone = 'positive' | 'neutral' | 'negative'

export interface HeatmapMovePotential {
  tileId: string
  tileLabel: string
  direction: HintDirection
  directionLabel: string
  distanceChange: number
  strategicScore: number
  tone: HeatmapMovePotentialTone
  worksOnFocus: boolean
  isBest: boolean
}

export interface HeatmapMovePotentialAnalysis {
  moves: HeatmapMovePotential[]
  bestMove: HeatmapMovePotential | null
  tilePotentials: Readonly<Record<string, number>>
}

export interface HeatmapTargetPathStep {
  step: number
  tileId: string
  tileLabel: string
  compactTileLabel: string
  directionLabel: string
  directionSymbol: string
  reasonLabel: string
  reasonTone: HeatmapMovePotentialTone
}

export interface HeatmapTargetPath {
  steps: HeatmapTargetPathStep[]
  objective: HintPathObjective | null
  targetTileId: string | null
}

export interface HeatmapPathNavigationProgress {
  completedSteps: number
  totalSteps: number
  status: 'active' | 'completed' | 'recalculating'
  message: string
}

export function normalizeHeatmapMode(value: unknown): HeatmapMode {
  return value === 'arrows' || value === 'classic' || value === 'delta'
    ? value
    : HEATMAP_MODE_DEFAULT
}

export function normalizeHeatmapIntensity(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return HEATMAP_INTENSITY_DEFAULT
  return Math.max(25, Math.min(100, Math.round(value)))
}

export function selectHeatmapMode(
  mode: HeatmapMode,
  distancesVisible: boolean
): HeatmapDisplaySelection {
  return {
    mode,
    distancesVisible: mode === 'classic' ? distancesVisible : false,
  }
}

export function toggleHeatmapDistances(
  mode: HeatmapMode,
  distancesVisible: boolean
): HeatmapDisplaySelection {
  return distancesVisible
    ? { mode, distancesVisible: false }
    : { mode: 'classic', distancesVisible: true }
}

function getTileTargetDistance(tile: PuzzleState['tiles'][number]): number {
  return Math.abs(tile.correctRow - tile.row) + Math.abs(tile.correctCol - tile.col)
}

export function buildHeatmapDeltaAnalysis(
  currentState: PuzzleState,
  moveHistory: PuzzleState[],
  requestedLookback: number = HEATMAP_DELTA_LOOKBACK
): HeatmapDeltaAnalysis {
  const lookback = Math.min(Math.max(0, Math.round(requestedLookback)), moveHistory.length)
  const referenceState = lookback > 0 ? moveHistory[moveHistory.length - lookback] : currentState
  const referenceTiles = new Map(referenceState.tiles.map((tile) => [tile.id, tile]))
  const tileDeltas: Record<string, number> = {}
  let improvedTiles = 0
  let worsenedTiles = 0
  let unchangedTiles = 0

  currentState.tiles.forEach((tile) => {
    if (tile.isEmpty) return
    const referenceTile = referenceTiles.get(tile.id)
    const delta = referenceTile
      ? getTileTargetDistance(referenceTile) - getTileTargetDistance(tile)
      : 0
    tileDeltas[tile.id] = delta
    if (delta > 0) improvedTiles += 1
    else if (delta < 0) worsenedTiles += 1
    else unchangedTiles += 1
  })

  return {
    tileDeltas,
    lookback,
    improvedTiles,
    worsenedTiles,
    unchangedTiles,
  }
}

export function buildHeatmapMovePotentialAnalysis(
  state: PuzzleState,
  focusRow: number | null,
  preferredBestTileId?: string | null
): HeatmapMovePotentialAnalysis {
  const moves = state.tiles
    .filter((tile) => (
      !tile.isEmpty
      && Math.abs(tile.row - state.emptyRow) + Math.abs(tile.col - state.emptyCol) === 1
    ))
    .map((tile): HeatmapMovePotential => {
      const distanceBefore = Math.abs(tile.row - tile.correctRow) + Math.abs(tile.col - tile.correctCol)
      const distanceAfter =
        Math.abs(state.emptyRow - tile.correctRow) + Math.abs(state.emptyCol - tile.correctCol)
      const distanceChange = distanceBefore - distanceAfter
      const worksOnFocus = focusRow !== null && tile.correctRow === focusRow
      const strategicScore = distanceChange * 10 + (worksOnFocus ? distanceChange * 3 + 1 : 0)
      const direction =
        state.emptyRow < tile.row
          ? 'up'
          : state.emptyRow > tile.row
            ? 'down'
            : state.emptyCol < tile.col
              ? 'left'
              : 'right'

      return {
        tileId: tile.id,
        tileLabel: `Kachel ${tile.correctIndex + 1}`,
        direction,
        directionLabel: HINT_DIRECTION_LABELS[direction],
        distanceChange,
        strategicScore,
        tone: distanceChange > 0 ? 'positive' : distanceChange < 0 ? 'negative' : 'neutral',
        worksOnFocus,
        isBest: false,
      }
    })
    .sort((left, right) => (
      right.strategicScore - left.strategicScore
      || left.tileLabel.localeCompare(right.tileLabel, 'de')
    ))
  const selectedBestMove =
    preferredBestTileId === null
      ? null
      : preferredBestTileId === undefined
        ? moves[0] ?? null
        : moves.find((move) => move.tileId === preferredBestTileId) ?? null
  const bestMove = selectedBestMove
    ? {
        ...selectedBestMove,
        tone: selectedBestMove.tone === 'negative' ? 'neutral' as const : selectedBestMove.tone,
        isBest: true,
      }
    : null
  const rankedMoves = moves.map((move) => (
    bestMove && move.tileId === bestMove.tileId ? bestMove : move
  ))

  return {
    moves: rankedMoves,
    bestMove,
    tilePotentials: Object.fromEntries(rankedMoves.map((move) => [
      move.tileId,
      move.tone === 'positive' ? 1 : move.tone === 'negative' ? -1 : 0,
    ])),
  }
}

export function buildHeatmapTargetPath(
  initialState: PuzzleState,
  queue: string[],
  focusRow: number | null,
  applyMove: (state: PuzzleState, tileId: string) => PuzzleState,
  maxSteps: number = 4
): HeatmapTargetPath {
  const objective = buildHintPathObjective(initialState, queue, focusRow, applyMove)
  const pathLength = Math.min(
    queue.length,
    objective ? objective.preparationMoveCount + 1 : Math.max(1, maxSteps),
    Math.max(1, maxSteps)
  )
  const steps: HeatmapTargetPathStep[] = []
  const visibleTileIds = new Set<string>()
  let simulatedState = initialState

  for (let index = 0; index < pathLength; index += 1) {
    const tileId = queue[index]
    if (visibleTileIds.has(tileId)) break
    const preview = buildHintPreview(simulatedState, tileId, 'tracked', focusRow, objective)
    if (!preview) break
    const tileBefore = simulatedState.tiles.find((tile) => tile.id === tileId)
    if (!tileBefore) break
    const nextState = applyMove(simulatedState, tileId)
    if (nextState === simulatedState) break
    const tileAfter = nextState.tiles.find((tile) => tile.id === tileId)
    if (!tileAfter) break
    const distanceBefore = getTileTargetDistance(tileBefore)
    const distanceAfter = getTileTargetDistance(tileAfter)
    const distanceChange = distanceBefore - distanceAfter
    const reachesTarget = distanceBefore > 0 && distanceAfter === 0
    const worksOnFocus = focusRow !== null && tileBefore.correctRow === focusRow
    const reasonLabel =
      reachesTarget
        ? 'Zielposition'
        : distanceChange > 0
          ? `Abstand -${distanceChange}`
          : worksOnFocus
            ? 'Fokus vorbereiten'
            : 'Weg öffnen'
    const reasonTone: HeatmapMovePotentialTone =
      reachesTarget || distanceChange > 0 ? 'positive' : 'neutral'
    const directionSymbol =
      preview.direction === 'up'
        ? '↑'
        : preview.direction === 'down'
          ? '↓'
          : preview.direction === 'left'
            ? '←'
            : '→'

    visibleTileIds.add(tileId)
    steps.push({
      step: index + 1,
      tileId,
      tileLabel: preview.tileLabel,
      compactTileLabel: `K${tileBefore.correctIndex + 1}`,
      directionLabel: preview.directionLabel,
      directionSymbol,
      reasonLabel,
      reasonTone,
    })
    simulatedState = nextState
  }

  return {
    steps,
    objective,
    targetTileId: objective?.tileId ?? null,
  }
}

export function advanceHeatmapPathNavigation(
  progress: HeatmapPathNavigationProgress,
  expectedTileId: string,
  movedTileId: string
): HeatmapPathNavigationProgress {
  if (movedTileId !== expectedTileId) {
    return {
      ...progress,
      status: 'recalculating',
      message: 'Pfad verlassen. Neue Route wird berechnet.',
    }
  }

  const completedSteps = Math.min(progress.totalSteps, progress.completedSteps + 1)
  const isCompleted = completedSteps >= progress.totalSteps
  return {
    completedSteps,
    totalSteps: progress.totalSteps,
    status: isCompleted ? 'completed' : 'active',
    message: isCompleted
      ? 'Zwischenziel erreicht.'
      : `Schritt ${completedSteps} von ${progress.totalSteps} erledigt.`,
  }
}

export function getMoveDirectionLabel(direction: PuzzleMoveDirection): string {
  return MOVE_DIRECTION_LABELS[direction]
}

function getGridPositionLabel(row: number, col: number, rows: number, cols: number): string {
  const vertical =
    row === 0
      ? 'oben'
      : row === rows - 1
        ? 'unten'
        : 'mittig'
  const horizontal =
    col === 0
      ? 'links'
      : col === cols - 1
        ? 'rechts'
        : 'mittig'

  if (vertical === 'mittig' && horizontal === 'mittig') return 'in der Mitte'
  if (horizontal === 'mittig') return vertical === 'oben' ? 'oben mittig' : vertical === 'unten' ? 'unten mittig' : 'in der Mitte'
  if (vertical === 'mittig') return `mittig ${horizontal}`
  return `${vertical} ${horizontal}`
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
  source: HintResolutionSource,
  focusRow: number | null = null,
  objective: HintPathObjective | null = null
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
      ? 'Direkter Lösungspfad'
      : source === 'tracked'
        ? 'Pfad aus deinem Verlauf'
        : 'Lokale Heuristik'
  const tileLabel = `Kachel ${tile.correctIndex + 1}`
  const rows = state.tiles.reduce((max, entry) => Math.max(max, entry.row, entry.correctRow), 0) + 1
  const cols = state.tiles.reduce((max, entry) => Math.max(max, entry.col, entry.correctCol), 0) + 1
  const distance = Math.abs(tile.correctRow - tile.row) + Math.abs(tile.correctCol - tile.col)
  const distanceAfterMove =
    Math.abs(tile.correctRow - state.emptyRow) + Math.abs(tile.correctCol - state.emptyCol)
  const description =
    distanceAfterMove === 0
      ? 'Damit sitzt die Kachel direkt an ihrer Zielposition.'
      : distanceAfterMove < distance
        ? 'Dadurch kommt sie ihrer Zielposition einen Schritt näher.'
        : distanceAfterMove > distance
          ? 'Dieser Zwischenschritt öffnet den weiteren Lösungsweg.'
          : 'Dieser Zug hält den weiteren Lösungsweg offen.'

  return {
    tileId,
    tileLabel,
    direction,
    directionLabel,
    actionLabel: `Schiebe ${tileLabel} ${directionLabel}.`,
    sourceLabel,
    confidenceLabel,
    confidenceTone,
    description,
    currentRow: tile.row,
    currentCol: tile.col,
    targetRow: tile.correctRow,
    targetCol: tile.correctCol,
    targetIndex: tile.correctIndex,
    currentPositionLabel: getGridPositionLabel(tile.row, tile.col, rows, cols),
    targetPositionLabel: getGridPositionLabel(tile.correctRow, tile.correctCol, rows, cols),
    distance,
    strategyLabel:
      objective && objective.preparationMoveCount > 0
        ? `Dieser Zwischenschritt bereitet ${objective.tileLabel} vor.`
        : focusRow === null || tile.correctRow === focusRow
          ? 'Dieser Zug arbeitet direkt am aktuellen Fokusbereich.'
          : 'Dieser Zwischenschritt bereitet den aktuellen Fokusbereich vor.',
    objectiveLabel: objective?.label ?? null,
    objectiveDetail: objective?.detail ?? null,
  }
}

export function buildHintPathObjective(
  initialState: PuzzleState,
  queue: string[],
  focusRow: number | null,
  applyMove: (state: PuzzleState, tileId: string) => PuzzleState
): HintPathObjective | null {
  if (queue.length === 0) return null

  let simulatedState = initialState
  const searchLimit = Math.min(queue.length, 12)

  for (let index = 0; index < searchLimit; index++) {
    const tileId = queue[index]
    const tileBefore = simulatedState.tiles.find((tile) => tile.id === tileId)
    if (!tileBefore || tileBefore.isEmpty) return null

    const nextState = applyMove(simulatedState, tileId)
    if (nextState === simulatedState) return null

    const tileAfter = nextState.tiles.find((tile) => tile.id === tileId)
    if (!tileAfter || tileAfter.isEmpty) return null

    const reachedTarget =
      (tileBefore.row !== tileBefore.correctRow || tileBefore.col !== tileBefore.correctCol)
      && tileAfter.row === tileAfter.correctRow
      && tileAfter.col === tileAfter.correctCol
    const reachesFocusTarget = reachedTarget && (focusRow === null || tileAfter.correctRow === focusRow)

    if (reachesFocusTarget) {
      const tileLabel = `Kachel ${tileAfter.correctIndex + 1}`
      const preparationMoveCount = index
      return {
        tileId,
        tileLabel,
        preparationMoveCount,
        label: preparationMoveCount === 0
          ? `${tileLabel} an die Zielposition setzen`
          : `Platz für ${tileLabel} schaffen`,
        detail: preparationMoveCount === 0
          ? `${tileLabel} kann mit dem nächsten Zug richtig eingesetzt werden.`
          : `Noch ${preparationMoveCount} ${preparationMoveCount === 1 ? 'vorbereitender Zug' : 'vorbereitende Züge'}, dann kann ${tileLabel} richtig eingesetzt werden.`,
      }
    }

    simulatedState = nextState
  }

  return null
}

export function buildPuzzleMoveFeedback(input: PuzzleMoveFeedbackInput): PuzzleMoveFeedback | null {
  if (input.nextFocusRow !== input.previousFocusRow) {
    return {
      message: input.nextFocusRow === null
        ? 'Alle Zielbereiche sind vollständig.'
        : `${input.previousFocusTitle} abgeschlossen. Weiter mit ${input.nextFocusTitle.toLowerCase()}.`,
      tone: 'positive',
    }
  }

  if (input.nextFocusProgress > input.previousFocusProgress) {
    return {
      message: `Bereichsfortschritt: ${input.nextFocusProgress}/${input.nextFocusTotal} Positionen stimmen.`,
      tone: 'positive',
    }
  }

  if (input.tileDistanceAfter < input.tileDistanceBefore) {
    return {
      message: `${input.tileLabel} ist jetzt näher an ihrer Zielposition.`,
      tone: 'positive',
    }
  }

  if (input.heuristicAfter < input.heuristicBefore) {
    return {
      message: 'Der Zug verbessert die Lösungsnähe des gesamten Bretts.',
      tone: 'positive',
    }
  }

  if (input.nextFocusProgress < input.previousFocusProgress) {
    return {
      message: input.isSuggested
        ? 'Vorbereitender Zug: Der Lösungsweg bleibt auf den Fokusbereich ausgerichtet.'
        : 'Der aktuelle Fokusbereich wurde wieder geöffnet.',
      tone: input.isSuggested ? 'neutral' : 'caution',
    }
  }

  if (input.isSuggested) {
    return {
      message: 'Vorbereitender Zug für das aktuelle Teilziel.',
      tone: 'neutral',
    }
  }

  return null
}

export function registerHintForState(hintedStateHashes: Set<string>, stateHash: string): boolean {
  if (hintedStateHashes.has(stateHash)) return false
  hintedStateHashes.add(stateHash)
  return true
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





