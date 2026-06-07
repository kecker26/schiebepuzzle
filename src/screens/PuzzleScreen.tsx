import { AnimatePresence } from 'motion/react'
import { type ChangeEvent, type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { type AppContextMenuHandler, type AppContextMenuRequest } from '../app/appContextMenu.ts'
import { useAccessibilityAnnouncer } from '../app/accessibilityAnnouncer.tsx'
import { type HelpContext } from '../app/helpRegistry.ts'
import { getPuzzleHelpContextForTarget, isPuzzleHelpTarget } from '../app/helpContextTargets.ts'
import {
  createLowerBoundStartMoveCountResult,
  createUnavailableStartMoveCountResult,
} from '../services/ExactPuzzleSolver.ts'
import type { ExactStartMoveCountResult } from '../services/ExactPuzzleSolverProtocol.ts'
import { createPersistedPuzzleProgress, normalizePuzzleState } from '../services/PuzzleStateService.ts'
import PuzzleEngine, { PuzzleContextHint } from '../services/PuzzleEngine.ts'
import PuzzleCelebrationRenderer from '../services/PuzzleCelebrationRenderer.ts'
import audioService from '../services/AudioService.ts'
import PuzzleRenderer, {
  HintOverlay,
  type CorrectTilePulseAnimation,
  type InvalidTileFeedbackAnimation,
  type TileSearchOverlay,
} from '../services/PuzzleRenderer.ts'
import { type PuzzleProgressMetrics } from '../services/PuzzleSolver.ts'
import {
  type GhostPreviewMode,
  GalleryChallengeTarget,
  GalleryReplaySetup,
  OptimalStartMoveCountKind,
  PersistedPuzzleProgress,
  PuzzleConfig,
  PuzzleMoveDirection,
  PuzzleRunMetrics,
  PuzzleState,
  SolverProgress,
  Tile,
  TileMoveAnimation,
  WinStats,
} from '../types/index'
import { isGalleryReplaySetupCompatible } from '../utils/galleryReplaySetup.ts'
import { formatDifficultyLabel, shouldUseFastSuggestion } from '../utils/puzzleDifficulty.ts'
import PuzzleLeftPanel from './puzzle/PuzzleLeftPanel.tsx'
import PuzzleContextMenu, { type ContextMenuPosition } from './puzzle/PuzzleContextMenu.tsx'
import PuzzlePauseOverlay from './puzzle/PuzzlePauseOverlay.tsx'
import PuzzleRestartConfirmDialog from './puzzle/PuzzleRestartConfirmDialog.tsx'
import PuzzleRightPanel from './puzzle/PuzzleRightPanel.tsx'
import {
  buildHintPreview,
  CORRECT_TILE_PULSE_DURATION_MS,
  createMoveRecordForStates,
  EXACT_SOLUTION_NODE_LIMIT,
  formatElapsedTime,
  GHOST_PREVIEW_MODE_DEFAULT,
  getKeyboardMoveDirection,
  GHOST_PREVIEW_WEIGHT_DEFAULT,
  HISTORY_LIMIT,
  HOTKEY_HINT_PREVIEW_MS,
  INVALID_TILE_FEEDBACK_DURATION_MS,
  MOVE_ANIMATION_DURATION_MS,
  normalizeGhostPreviewMode,
  START_APPROXIMATE_SOLUTION_NODE_LIMIT,
  START_APPROXIMATE_SOLUTION_TIME_LIMIT_5X5_MS,
  START_APPROXIMATE_SOLUTION_TIME_LIMIT_6X6_MS,
  TILE_NUMBER_CORRECTNESS_PULSE_DURATION_MS,
  WIN_CELEBRATION_DURATION_MS,
  START_OPTIMAL_SOLUTION_NODE_LIMIT,
  normalizeGhostPreviewWeight,
  PERSISTED_HISTORY_LIMIT,
  SuggestedHintPreview,
  TILE_NUMBER_PREVIEW_MS,
} from './puzzle/puzzleScreenUtils.ts'
import { useExactPuzzleSolverWorker } from './puzzle/useExactPuzzleSolverWorker.ts'
import { usePuzzleKeyboardShortcuts } from './puzzle/usePuzzleKeyboardShortcuts.ts'
import { usePuzzleSolverWorker } from './puzzle/usePuzzleSolverWorker.ts'
import { shouldPreserveNativeContextMenu } from '../utils/contextWindow.ts'
import '../styles/screens/puzzle.css'
interface PuzzleScreenProps {
  image: string
  config: PuzzleConfig
  isHelpOpen: boolean
  onOpenHelp: () => void
  onHelpContextChange: (context: HelpContext) => void
  registerAppContextMenuHandler: (handler: AppContextMenuHandler | null) => void
  initialProgress?: PersistedPuzzleProgress | null
  initialReplaySetup?: GalleryReplaySetup | null
  challengeTarget?: GalleryChallengeTarget | null
  onProgressChange?: (progress: PersistedPuzzleProgress | null) => void
  onWin: (stats: WinStats) => void
  onQuit: () => void
  onGoToStartScreen: () => void
  onRestart: () => void
}

const EMPTY_RUN_METRICS: PuzzleRunMetrics = {
  actionMoves: 0,
  undoCount: 0,
  redoCount: 0,
  hintCount: 0,
  suggestedMoveCount: 0,
}

const LEGACY_OPTIMAL_START_MOVE_COUNT_SOLVER_VERSION = 'legacy-optimal-start-v0'

type BoardToolHelpTopic =
  | 'hint'
  | 'suggested-move'
  | 'preview'
  | 'ghost-preview'
  | 'heatmap'
  | 'tile-numbers'

const DEFAULT_BOARD_CAPTION = 'Das markierte Leerfeld ist dein Anker fuer schnelle, saubere Zugfolgen.'
const BOARD_INTRO_ANIMATION_MS = 1180

const BOARD_TOOL_HELP_MESSAGES: Record<BoardToolHelpTopic, string> = {
  hint: 'Der Hinweis markiert dir die beste naechste Kachel direkt auf dem Brett, ohne den Zug selbst auszufuehren.',
  'suggested-move': 'Zug spielen fuehrt den empfohlenen Schritt direkt aus oder berechnet ihn neu, wenn noch kein Vorschlag bereitsteht.',
  preview: 'Die Vorschau blendet das Zielbild rechts ein oder aus, damit du Bildbereiche schneller mit dem Brett vergleichen kannst.',
  'ghost-preview': 'Die Geisteransicht legt je nach Modus Vollbild, Konturen oder Kanten ueber das Brett, damit du Formen und Positionen leichter abgleichen kannst.',
  heatmap: 'Die Heatmap hebt Kacheln hervor, die noch deutlich von ihrer Zielposition entfernt sind.',
  'tile-numbers': 'Nummern zeigt fuer 5 Sekunden die Soll-Reihenfolge und animiert korrekte Kacheln gruen, falsche rot.',
}

type StartOptimalMoveCountState =
  | {
      status: 'loading'
      moveCount: null
      solverVersion: null
    }
  | ExactStartMoveCountResult

function createEmptyRunMetrics(): PuzzleRunMetrics {
  return { ...EMPTY_RUN_METRICS }
}

function normalizeRunMetrics(runMetrics: PuzzleRunMetrics | undefined, moveCount: number): PuzzleRunMetrics {
  return {
    actionMoves: Math.max(moveCount, runMetrics?.actionMoves ?? moveCount),
    undoCount: runMetrics?.undoCount ?? 0,
    redoCount: runMetrics?.redoCount ?? 0,
    hintCount: runMetrics?.hintCount ?? 0,
    suggestedMoveCount: runMetrics?.suggestedMoveCount ?? 0,
  }
}

function deriveAssistanceModeFromRunMetrics(runMetrics: PuzzleRunMetrics): WinStats['assistanceMode'] {
  if (runMetrics.suggestedMoveCount > 0) return 'auto-assisted'
  if (runMetrics.hintCount > 0) return 'hinted'
  return 'clean'
}

function normalizeStoredOptimalStartMoveCount(value: unknown): number | null | undefined {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Math.max(0, Math.round(value))
}

function normalizeStoredOptimalStartMoveCountKind(value: unknown): OptimalStartMoveCountKind | undefined {
  return value === 'exact' || value === 'lower-bound' || value === 'unavailable'
    ? value
    : undefined
}

function normalizeStoredOptimalStartMoveCountSolverVersion(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function createLoadingStartOptimalMoveCountState(): StartOptimalMoveCountState {
  return {
    status: 'loading',
    moveCount: null,
    solverVersion: null,
  }
}

function normalizeStoredOptimalStartMoveCountResult(
  progress: Pick<PersistedPuzzleProgress,
    'optimalStartMoveCount' | 'optimalStartMoveCountKind' | 'optimalStartMoveCountSolverVersion'
  > | null | undefined
): ExactStartMoveCountResult | undefined {
  if (!progress) return undefined

  const storedCount = normalizeStoredOptimalStartMoveCount(progress.optimalStartMoveCount)
  const storedKind = normalizeStoredOptimalStartMoveCountKind(progress.optimalStartMoveCountKind)
  const solverVersion =
    normalizeStoredOptimalStartMoveCountSolverVersion(progress.optimalStartMoveCountSolverVersion)
    ?? LEGACY_OPTIMAL_START_MOVE_COUNT_SOLVER_VERSION

  if (storedKind === 'exact' && typeof storedCount === 'number') {
    return {
      status: 'exact',
      moveCount: storedCount,
      solverVersion,
    }
  }

  if (storedKind === 'lower-bound' && typeof storedCount === 'number') {
    return {
      status: 'lower-bound',
      moveCount: storedCount,
      solverVersion,
    }
  }

  if (storedKind === 'unavailable') {
    return {
      status: 'unavailable',
      moveCount: null,
      solverVersion,
    }
  }

  if (storedCount === null) {
    return {
      status: 'unavailable',
      moveCount: null,
      solverVersion,
    }
  }

  if (typeof storedCount === 'number') {
    return {
      status: 'exact',
      moveCount: storedCount,
      solverVersion,
    }
  }

  return undefined
}

function createReplaySetupFromStartState(
  startState: PuzzleState | null,
  shuffleMoves: string[],
  optimalState: StartOptimalMoveCountState
): GalleryReplaySetup | undefined {
  if (!startState) return undefined

  return {
    version: 1,
    startBoard: [...startState.board],
    emptyIndex: startState.emptyIndex,
    shuffleMoves: [...shuffleMoves],
    optimalStartMoveCount: optimalState.status === 'loading' ? undefined : optimalState.moveCount,
    optimalStartMoveCountKind: optimalState.status === 'loading' ? undefined : optimalState.status,
    optimalStartMoveCountSolverVersion: optimalState.status === 'loading' ? undefined : optimalState.solverVersion,
  }
}

function formatChallengeTargetSummary(challengeTarget: GalleryChallengeTarget | null | undefined): string | null {
  if (!challengeTarget) return null

  const optimalText =
    typeof challengeTarget.optimalStartMoveCount === 'number'
      ? challengeTarget.optimalStartMoveCountKind === 'lower-bound'
        ? `min. ${challengeTarget.optimalStartMoveCount}`
        : `${challengeTarget.optimalStartMoveCount}`
      : 'unbekannt'

  return `Vorlage: ${formatElapsedTime(challengeTarget.time)}, ${challengeTarget.actionMoves} Netto-Zuege, optimal ${optimalText}.`
}

export default function PuzzleScreen({
  image,
  config,
  isHelpOpen,
  onOpenHelp,
  onHelpContextChange,
  registerAppContextMenuHandler,
  initialProgress,
  initialReplaySetup,
  challengeTarget,
  onProgressChange,
  onWin,
  onQuit,
  onGoToStartScreen,
  onRestart,
}: PuzzleScreenProps) {
  const announceAccessibility = useAccessibilityAnnouncer()
  const puzzleRootRef = useRef<HTMLDivElement>(null)
  const initialProgressRef = useRef(initialProgress)
  const initialReplaySetupRef = useRef(initialReplaySetup)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const celebrationCanvasRef = useRef<HTMLCanvasElement>(null)
  const boardViewportRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<PuzzleEngine | null>(null)
  const rendererRef = useRef<PuzzleRenderer | null>(null)
  const celebrationRendererRef = useRef<PuzzleCelebrationRenderer | null>(null)
  const latestPuzzleHashRef = useRef<string | null>(null)
  const suggestionSequenceRef = useRef(0)
  const animationFrameRef = useRef<number | null>(null)
  const celebrationFrameRef = useRef<number | null>(null)
  const correctTilePulseFrameRef = useRef<number | null>(null)
  const invalidTileFeedbackFrameRef = useRef<number | null>(null)
  const tileNumberCorrectnessPulseFrameRef = useRef<number | null>(null)
  const boardIntroTimeoutRef = useRef<number | null>(null)
  const winSequenceStartedRef = useRef(false)
  const solutionQueueRef = useRef<string[]>([])
  const lastSuggestionMoveRef = useRef<string | null>(null)
  const shuffleMovesRef = useRef<string[]>([])
  const runStartStateRef = useRef<PuzzleState | null>(null)
  const knownSolutionMovesFromStartRef = useRef<string[]>([])
  const knownSolutionPathHashesRef = useRef<string[]>([])
  const knownSolutionPathIndexByHashRef = useRef<Map<string, number>>(new Map())
  const reducedMovePathRef = useRef<string[]>([])
  const reducedPathHashesRef = useRef<string[]>([])
  const reducedPathIndexByHashRef = useRef<Map<string, number>>(new Map())
  const progressReferenceHeuristicRef = useRef<number | null>(null)
  const boardPointerClientPositionRef = useRef<{ clientX: number; clientY: number } | null>(null)
  const isComputingSuggestionRef = useRef(false)
  const tileNumbersTimeoutRef = useRef<number | null>(null)
  const hintAutoHideTimerRef = useRef<number | null>(null)
  const hasInitialCanvasFocusRef = useRef(false)
  const restartConfirmButtonRef = useRef<HTMLButtonElement | null>(null)
  const hintButtonRef = useRef<HTMLButtonElement | null>(null)
  const suggestedMoveButtonRef = useRef<HTMLButtonElement | null>(null)
  const previewToggleButtonRef = useRef<HTMLButtonElement | null>(null)
  const ghostPreviewButtonRef = useRef<HTMLButtonElement | null>(null)
  const heatmapButtonRef = useRef<HTMLButtonElement | null>(null)
  const tileNumbersButtonRef = useRef<HTMLButtonElement | null>(null)
  const undoButtonRef = useRef<HTMLButtonElement | null>(null)
  const redoButtonRef = useRef<HTMLButtonElement | null>(null)
  const helpTriggerButtonRef = useRef<HTMLButtonElement | null>(null)
  const pauseButtonRef = useRef<HTMLButtonElement | null>(null)
  const quitButtonRef = useRef<HTMLButtonElement | null>(null)

  const { requestSolutionValues } = usePuzzleSolverWorker()
  const { requestExactStartMoveCount } = useExactPuzzleSolverWorker()

  const [puzzleState, setPuzzleState] = useState<PuzzleState | null>(null)
  const [imageRatio, setImageRatio] = useState<number | null>(null)
  const [canvasDisplaySize, setCanvasDisplaySize] = useState<{ width: number; height: number } | null>(null)
  const [moveCount, setMoveCount] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [isPaused, setIsPaused] = useState(Boolean(initialProgressRef.current?.isPaused))
  const [optimalStartMoveCountState, setOptimalStartMoveCountState] = useState<StartOptimalMoveCountState>(
    createLoadingStartOptimalMoveCountState
  )
  const [knownStartSolutionMoveCount, setKnownStartSolutionMoveCount] = useState<number | null>(null)
  const [isImprovingStartSolution, setIsImprovingStartSolution] = useState(false)
  const [hoveredSearchTileId, setHoveredSearchTileId] = useState<string | null>(null)
  const [runMetrics, setRunMetrics] = useState<PuzzleRunMetrics>(createEmptyRunMetrics)
  const [moveHistory, setMoveHistory] = useState<PuzzleState[]>([])
  const [redoHistory, setRedoHistory] = useState<PuzzleState[]>([])
  const [isPreviewVisible, setIsPreviewVisible] = useState(true)
  const [isGhostPreviewVisible, setIsGhostPreviewVisible] = useState(false)
  const [isHeatmapOverlayVisible, setIsHeatmapOverlayVisible] = useState(false)
  const [ghostPreviewMode, setGhostPreviewMode] = useState<GhostPreviewMode>(GHOST_PREVIEW_MODE_DEFAULT)
  const [ghostPreviewWeight, setGhostPreviewWeight] = useState(GHOST_PREVIEW_WEIGHT_DEFAULT)
  const [areTileNumbersVisible, setAreTileNumbersVisible] = useState(false)
  const [tileNumberCorrectnessPulseProgress, setTileNumberCorrectnessPulseProgress] = useState<number | null>(null)
  const [showRestoredNotice, setShowRestoredNotice] = useState(Boolean(initialProgressRef.current?.puzzleState))
  const [moveAnimation, setMoveAnimation] = useState<TileMoveAnimation | null>(null)
  const [correctTilePulse, setCorrectTilePulse] = useState<CorrectTilePulseAnimation | null>(null)
  const [invalidTileFeedback, setInvalidTileFeedback] = useState<InvalidTileFeedbackAnimation | null>(null)
  const [isCelebratingWin, setIsCelebratingWin] = useState(false)
  const [isBoardIntroActive, setIsBoardIntroActive] = useState(false)
  const [isComputingSuggestion, setIsComputingSuggestion] = useState(false)
  const [hintPreview, setHintPreview] = useState<SuggestedHintPreview | null>(null)
  const [isRestartConfirmOpen, setIsRestartConfirmOpen] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] = useState<ContextMenuPosition | null>(null)
  const [boardCaption, setBoardCaption] = useState(DEFAULT_BOARD_CAPTION)
  const [isBoardFocused, setIsBoardFocused] = useState(false)

  const setSuggestionComputingState = (value: boolean) => {
    isComputingSuggestionRef.current = value
    setIsComputingSuggestion(value)
  }

  const showBoardToolHelp = useCallback((topic: BoardToolHelpTopic) => {
    setBoardCaption(BOARD_TOOL_HELP_MESSAGES[topic])
  }, [])

  const clearTileNumbersTimeout = useCallback(() => {
    if (tileNumbersTimeoutRef.current !== null) {
      window.clearTimeout(tileNumbersTimeoutRef.current)
      tileNumbersTimeoutRef.current = null
    }
  }, [])

  const focusActionControl = useCallback((targetRef: RefObject<HTMLElement>) => {
    window.requestAnimationFrame(() => {
      const target = targetRef.current
      if (!target?.isConnected || target.matches(':disabled')) {
        return
      }

      target.focus({ preventScroll: true })
    })
  }, [])

  const focusBoardCanvas = useCallback(() => {
    const focusCanvas = () => {
      const canvasElement = canvasRef.current
      if (!canvasElement?.isConnected) {
        return false
      }

      canvasElement.focus({ preventScroll: true })
      return true
    }

    if (focusCanvas()) {
      return
    }

    window.requestAnimationFrame(() => {
      focusCanvas()
    })
  }, [])

  const focusHotkeyFeedbackTarget = useCallback((targetRef: RefObject<HTMLElement>) => {
    if (document.activeElement === canvasRef.current) {
      focusBoardCanvas()
      return
    }

    focusActionControl(targetRef)
  }, [focusActionControl, focusBoardCanvas])

  const clearHintAutoHideTimeout = useCallback(() => {
    if (hintAutoHideTimerRef.current !== null) {
      window.clearTimeout(hintAutoHideTimerRef.current)
      hintAutoHideTimerRef.current = null
    }
  }, [])

  const scheduleHintAutoHideTimeout = useCallback((durationMs: number) => {
    clearHintAutoHideTimeout()
    hintAutoHideTimerRef.current = window.setTimeout(() => {
      hintAutoHideTimerRef.current = null
      setHintPreview(null)
    }, durationMs)
  }, [clearHintAutoHideTimeout])

  useEffect(() => {
    if (hasInitialCanvasFocusRef.current || isHelpOpen || isRestartConfirmOpen || isPaused) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      focusBoardCanvas()
      hasInitialCanvasFocusRef.current = true
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [focusBoardCanvas, isHelpOpen, isPaused, isRestartConfirmOpen])

  useEffect(() => {
    const updateHelpContext = (target: EventTarget | null) => {
      onHelpContextChange(getPuzzleHelpContextForTarget(target))
    }

    updateHelpContext(document.activeElement)

    const handleFocusIn = (event: FocusEvent) => {
      if (!isPuzzleHelpTarget(event.target, puzzleRootRef.current)) {
        return
      }

      updateHelpContext(event.target)
    }

    window.addEventListener('focusin', handleFocusIn, true)
    return () => {
      window.removeEventListener('focusin', handleFocusIn, true)
    }
  }, [onHelpContextChange])

  const stopTileNumberCorrectnessPulse = useCallback(() => {
    if (tileNumberCorrectnessPulseFrameRef.current !== null) {
      window.cancelAnimationFrame(tileNumberCorrectnessPulseFrameRef.current)
      tileNumberCorrectnessPulseFrameRef.current = null
    }
  }, [])

  const clearTileNumberCorrectnessPulse = useCallback(() => {
    stopTileNumberCorrectnessPulse()
    setTileNumberCorrectnessPulseProgress(null)
  }, [stopTileNumberCorrectnessPulse])

  const hideTileNumbers = useCallback(() => {
    clearTileNumbersTimeout()
    clearTileNumberCorrectnessPulse()
    setAreTileNumbersVisible(false)
  }, [clearTileNumbersTimeout, clearTileNumberCorrectnessPulse])

  const startTileNumberCorrectnessPulse = useCallback(() => {
    stopTileNumberCorrectnessPulse()
    setTileNumberCorrectnessPulseProgress(0)

    const startedAt = performance.now()
    const animate = (timestamp: number) => {
      const progress = ((timestamp - startedAt) % TILE_NUMBER_CORRECTNESS_PULSE_DURATION_MS) / TILE_NUMBER_CORRECTNESS_PULSE_DURATION_MS
      setTileNumberCorrectnessPulseProgress(progress)
      tileNumberCorrectnessPulseFrameRef.current = window.requestAnimationFrame(animate)
    }

    tileNumberCorrectnessPulseFrameRef.current = window.requestAnimationFrame(animate)
  }, [stopTileNumberCorrectnessPulse])

  const cancelSuggestionFlow = useCallback(({
    clearQueue = true,
    clearLastMove = true,
  }: {
    clearQueue?: boolean
    clearLastMove?: boolean
  } = {}) => {
    suggestionSequenceRef.current += 1
    clearHintAutoHideTimeout()
    setSuggestionComputingState(false)

    if (clearQueue) {
      solutionQueueRef.current = []
    }
    if (clearLastMove) {
      lastSuggestionMoveRef.current = null
    }
    setHintPreview(null)
  }, [clearHintAutoHideTimeout])

  const endActiveBoardHelp = useCallback(() => {
    cancelSuggestionFlow()
    setIsGhostPreviewVisible(false)
    setIsHeatmapOverlayVisible(false)
    hideTileNumbers()
  }, [cancelSuggestionFlow, hideTileNumbers])

  const handleShowTileNumbers = useCallback(() => {
    if (!puzzleState || isPaused) return

    showBoardToolHelp('tile-numbers')
    endActiveBoardHelp()
    setAreTileNumbersVisible(true)
    startTileNumberCorrectnessPulse()
    tileNumbersTimeoutRef.current = window.setTimeout(() => {
      tileNumbersTimeoutRef.current = null
      hideTileNumbers()
    }, TILE_NUMBER_PREVIEW_MS)
  }, [endActiveBoardHelp, hideTileNumbers, isPaused, puzzleState, showBoardToolHelp, startTileNumberCorrectnessPulse])

  const mapTileValueToId = useCallback((state: PuzzleState, tileValue: number): string | null => {
    const directTile = state.tiles[tileValue]
    if (directTile && directTile.correctIndex === tileValue) {
      return directTile.id
    }

    return state.tiles.find((tile) => tile.correctIndex === tileValue)?.id ?? null
  }, [])

  const mapSolutionValuesToMoves = useCallback((state: PuzzleState, solutionValues: number[]): string[] | null => {
    const solutionMoves: string[] = []

    for (const value of solutionValues) {
      const tileId = mapTileValueToId(state, value)
      if (!tileId) return null
      solutionMoves.push(tileId)
    }

    return solutionMoves
  }, [mapTileValueToId])

  const getPlayableTileById = useCallback((state: PuzzleState, tileId: string | null): Tile | null => {
    if (!tileId) return null
    const tile = state.tiles.find((entry) => entry.id === tileId) ?? null
    if (!tile || tile.isEmpty) return null
    return tile
  }, [])

  const updateHoveredSearchTileId = useCallback((tileId: string | null) => {
    setHoveredSearchTileId((prev) => (prev === tileId ? prev : tileId))
  }, [])

  const resetTrackedPathToState = useCallback((state: PuzzleState) => {
    const activeEngine = engineRef.current
    if (!activeEngine) return

    const stateHash = activeEngine.getStateHash(state)
    shuffleMovesRef.current = []
    knownSolutionMovesFromStartRef.current = []
    knownSolutionPathHashesRef.current = []
    knownSolutionPathIndexByHashRef.current = new Map()
    reducedMovePathRef.current = []
    reducedPathHashesRef.current = [stateHash]
    reducedPathIndexByHashRef.current = new Map([[stateHash, 0]])
    progressReferenceHeuristicRef.current = null
  }, [])

  const rebuildKnownSolutionPathFromStart = useCallback((startState: PuzzleState, shuffleMoves: string[]) => {
    const activeEngine = engineRef.current
    if (!activeEngine) return

    const normalizedStartState = normalizePuzzleState(startState, config)
    const solutionMovesFromStart = [...shuffleMoves].reverse()
    const solutionPathHashes: string[] = [activeEngine.getStateHash(normalizedStartState)]
    const solutionPathIndexByHash = new Map<string, number>([[solutionPathHashes[0], 0]])
    let currentState = normalizedStartState

    for (const move of solutionMovesFromStart) {
      const nextState = activeEngine.makeMove(currentState, move)
      if (nextState === currentState) {
        knownSolutionMovesFromStartRef.current = []
        knownSolutionPathHashesRef.current = []
        knownSolutionPathIndexByHashRef.current = new Map()
        return
      }

      currentState = normalizePuzzleState(nextState, config)
      const nextHash = activeEngine.getStateHash(currentState)
      solutionPathHashes.push(nextHash)
      solutionPathIndexByHash.set(nextHash, solutionPathHashes.length - 1)
    }

    knownSolutionMovesFromStartRef.current = solutionMovesFromStart
    knownSolutionPathHashesRef.current = solutionPathHashes
    knownSolutionPathIndexByHashRef.current = solutionPathIndexByHash
  }, [config])

  const initializeTrackedPath = useCallback((startState: PuzzleState, shuffleMoves: string[], reducedMovePath: string[] = []) => {
    const activeEngine = engineRef.current
    if (!activeEngine) return

    let currentState = normalizePuzzleState(startState, config)
    const pathHashes: string[] = [activeEngine.getStateHash(currentState)]
    const pathIndexByHash = new Map<string, number>([[pathHashes[0], 0]])
    const pathMoves: string[] = []

    for (const move of reducedMovePath) {
      const nextState = activeEngine.makeMove(currentState, move)
      if (nextState === currentState) {
        resetTrackedPathToState(startState)
        return
      }

      currentState = normalizePuzzleState(nextState, config)
      const nextHash = activeEngine.getStateHash(currentState)
      pathMoves.push(move)
      pathHashes.push(nextHash)
      pathIndexByHash.set(nextHash, pathHashes.length - 1)
    }

    shuffleMovesRef.current = [...shuffleMoves]
    rebuildKnownSolutionPathFromStart(startState, shuffleMoves)
    reducedMovePathRef.current = pathMoves
    reducedPathHashesRef.current = pathHashes
    reducedPathIndexByHashRef.current = pathIndexByHash
    progressReferenceHeuristicRef.current = activeEngine.getHeuristicScore(startState)
  }, [config, rebuildKnownSolutionPathFromStart, resetTrackedPathToState])

  const restoreTrackedPath = useCallback((currentState: PuzzleState, solverProgress?: SolverProgress): PuzzleState => {
    const activeEngine = engineRef.current
    if (!activeEngine || !solverProgress || solverProgress.shuffleMoves.length === 0) {
      resetTrackedPathToState(currentState)
      return currentState
    }

    let shuffledState = normalizePuzzleState(currentState, config)
    for (const move of [...solverProgress.reducedMovePath].reverse()) {
      const previousState = activeEngine.makeMove(shuffledState, move)
      if (previousState === shuffledState) {
        resetTrackedPathToState(currentState)
        return currentState
      }
      shuffledState = normalizePuzzleState(previousState, config)
    }

    initializeTrackedPath(shuffledState, solverProgress.shuffleMoves, solverProgress.reducedMovePath)

    if (activeEngine.getStateHash(currentState) !== reducedPathHashesRef.current[reducedPathHashesRef.current.length - 1]) {
      resetTrackedPathToState(currentState)
      return currentState
    }

    return shuffledState
  }, [config, initializeTrackedPath, resetTrackedPathToState])

  const trimTrackedPathToIndex = (index: number) => {
    const removedHashes = reducedPathHashesRef.current.slice(index + 1)
    for (const hash of removedHashes) {
      reducedPathIndexByHashRef.current.delete(hash)
    }
    reducedPathHashesRef.current = reducedPathHashesRef.current.slice(0, index + 1)
    reducedMovePathRef.current = reducedMovePathRef.current.slice(0, index)
  }

  const recordTrackedMove = (nextState: PuzzleState, tileId: string) => {
    const activeEngine = engineRef.current
    if (!activeEngine) return

    const nextHash = activeEngine.getStateHash(nextState)
    const existingIndex = reducedPathIndexByHashRef.current.get(nextHash)
    if (existingIndex !== undefined) {
      trimTrackedPathToIndex(existingIndex)
      return
    }

    const nextIndex = reducedPathHashesRef.current.length
    reducedMovePathRef.current = [...reducedMovePathRef.current, tileId]
    reducedPathHashesRef.current = [...reducedPathHashesRef.current, nextHash]
    reducedPathIndexByHashRef.current.set(nextHash, nextIndex)
  }

  const syncTrackedPathToState = (state: PuzzleState) => {
    const activeEngine = engineRef.current
    if (!activeEngine) return

    const stateHash = activeEngine.getStateHash(state)
    const existingIndex = reducedPathIndexByHashRef.current.get(stateHash)
    if (existingIndex === undefined) {
      resetTrackedPathToState(state)
      return
    }

    trimTrackedPathToIndex(existingIndex)
  }

  const getTrackedSolutionMoves = (state: PuzzleState): string[] => {
    const activeEngine = engineRef.current
    if (!activeEngine) return []

    const stateHash = activeEngine.getStateHash(state)
    const existingIndex = reducedPathIndexByHashRef.current.get(stateHash)
    if (existingIndex === undefined) {
      return []
    }

    for (let anchorIndex = existingIndex; anchorIndex >= 0; anchorIndex -= 1) {
      const anchorHash = reducedPathHashesRef.current[anchorIndex]
      const solutionIndex = knownSolutionPathIndexByHashRef.current.get(anchorHash)
      if (solutionIndex === undefined) continue

      const backtrackMoves = reducedMovePathRef.current.slice(anchorIndex, existingIndex).reverse()
      const remainingSolutionMoves = knownSolutionMovesFromStartRef.current.slice(solutionIndex)
      return [...backtrackMoves, ...remainingSolutionMoves]
    }

    return []
  }

  const stopAnimationFrame = () => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }


  const stopCelebrationFrame = useCallback(() => {
    if (celebrationFrameRef.current !== null) {
      window.cancelAnimationFrame(celebrationFrameRef.current)
      celebrationFrameRef.current = null
    }
  }, [])

  const clearWinCelebration = useCallback(() => {
    stopCelebrationFrame()
    audioService.stopWinCelebration()
    celebrationRendererRef.current?.clear()
    setIsCelebratingWin(false)
  }, [stopCelebrationFrame])

  const stopCorrectTilePulse = useCallback(() => {
    if (correctTilePulseFrameRef.current !== null) {
      window.cancelAnimationFrame(correctTilePulseFrameRef.current)
      correctTilePulseFrameRef.current = null
    }
  }, [])

  const clearCorrectTilePulse = useCallback(() => {
    stopCorrectTilePulse()
    audioService.stopCorrectPlacement()
    setCorrectTilePulse(null)
  }, [stopCorrectTilePulse])

  const stopInvalidTileFeedback = useCallback(() => {
    if (invalidTileFeedbackFrameRef.current !== null) {
      window.cancelAnimationFrame(invalidTileFeedbackFrameRef.current)
      invalidTileFeedbackFrameRef.current = null
    }
  }, [])

  const clearInvalidTileFeedback = useCallback(() => {
    stopInvalidTileFeedback()
    setInvalidTileFeedback(null)
  }, [stopInvalidTileFeedback])

  const stopBoardIntro = useCallback(() => {
    if (boardIntroTimeoutRef.current !== null) {
      window.clearTimeout(boardIntroTimeoutRef.current)
      boardIntroTimeoutRef.current = null
    }
    setIsBoardIntroActive(false)
  }, [])

  const startBoardIntro = useCallback(() => {
    if (boardIntroTimeoutRef.current !== null) {
      window.clearTimeout(boardIntroTimeoutRef.current)
    }

    setIsBoardIntroActive(true)
    boardIntroTimeoutRef.current = window.setTimeout(() => {
      boardIntroTimeoutRef.current = null
      setIsBoardIntroActive(false)
    }, BOARD_INTRO_ANIMATION_MS)
  }, [])

  const startInvalidTileFeedback = useCallback((tileId: string) => {
    stopInvalidTileFeedback()
    audioService.activate()
    audioService.playBlockedTile()
    setInvalidTileFeedback({
      tileId,
      progress: 0,
    })

    const startedAt = performance.now()
    const animate = (timestamp: number) => {
      const progress = Math.min(1, (timestamp - startedAt) / INVALID_TILE_FEEDBACK_DURATION_MS)
      setInvalidTileFeedback((prev) => (prev && prev.tileId === tileId ? { ...prev, progress } : prev))

      if (progress < 1) {
        invalidTileFeedbackFrameRef.current = window.requestAnimationFrame(animate)
        return
      }

      invalidTileFeedbackFrameRef.current = null
      setInvalidTileFeedback(null)
    }

    invalidTileFeedbackFrameRef.current = window.requestAnimationFrame(animate)
  }, [stopInvalidTileFeedback])

  const startCorrectTilePulse = useCallback((tileId: string) => {
    stopCorrectTilePulse()
    audioService.playCorrectPlacement(CORRECT_TILE_PULSE_DURATION_MS)
    setCorrectTilePulse({
      tileId,
      progress: 0,
    })

    const startedAt = performance.now()
    const animate = (timestamp: number) => {
      const progress = Math.min(1, (timestamp - startedAt) / CORRECT_TILE_PULSE_DURATION_MS)
      setCorrectTilePulse((prev) => (prev && prev.tileId === tileId ? { ...prev, progress } : prev))

      if (progress < 1) {
        correctTilePulseFrameRef.current = window.requestAnimationFrame(animate)
        return
      }

      correctTilePulseFrameRef.current = null
      setCorrectTilePulse(null)
    }

    correctTilePulseFrameRef.current = window.requestAnimationFrame(animate)
  }, [stopCorrectTilePulse])

  const startWinCelebration = useCallback((stats: WinStats) => {
    stopCelebrationFrame()
    clearCorrectTilePulse()
    celebrationRendererRef.current?.reset()
    setIsCelebratingWin(true)
    audioService.playWinCelebration(WIN_CELEBRATION_DURATION_MS)

    const startedAt = performance.now()
    const animateCelebration = (timestamp: number) => {
      const progress = Math.min(1, (timestamp - startedAt) / WIN_CELEBRATION_DURATION_MS)
      celebrationRendererRef.current?.render(progress)

      if (progress < 1) {
        celebrationFrameRef.current = window.requestAnimationFrame(animateCelebration)
        return
      }

      celebrationFrameRef.current = null
      celebrationRendererRef.current?.clear()
      setIsCelebratingWin(false)
      onWin(stats)
    }

    celebrationFrameRef.current = window.requestAnimationFrame(animateCelebration)
  }, [clearCorrectTilePulse, onWin, stopCelebrationFrame])


  useEffect(() => {
    return () => {
      clearTileNumbersTimeout()
      stopTileNumberCorrectnessPulse()
      clearHintAutoHideTimeout()
      stopAnimationFrame()
      stopCelebrationFrame()
      stopCorrectTilePulse()
      stopInvalidTileFeedback()
      stopBoardIntro()
      suggestionSequenceRef.current += 1
      setSuggestionComputingState(false)
    }
  }, [clearHintAutoHideTimeout, clearTileNumbersTimeout, stopBoardIntro, stopCelebrationFrame, stopCorrectTilePulse, stopInvalidTileFeedback, stopTileNumberCorrectnessPulse])

  useEffect(() => {
    let isCancelled = false
    winSequenceStartedRef.current = false
    stopAnimationFrame()
    cancelSuggestionFlow()
    shuffleMovesRef.current = []
    runStartStateRef.current = null
    knownSolutionMovesFromStartRef.current = []
    knownSolutionPathHashesRef.current = []
    knownSolutionPathIndexByHashRef.current = new Map()
    reducedMovePathRef.current = []
    reducedPathHashesRef.current = []
    reducedPathIndexByHashRef.current = new Map()
    progressReferenceHeuristicRef.current = null
    latestPuzzleHashRef.current = null
    setImageRatio(null)
    setCanvasDisplaySize(null)
    setOptimalStartMoveCountState(createLoadingStartOptimalMoveCountState())
    setKnownStartSolutionMoveCount(null)
    setIsImprovingStartSolution(false)
    setHoveredSearchTileId(null)
    setMoveAnimation(null)
    setInvalidTileFeedback(null)
    stopBoardIntro()
    clearWinCelebration()
    clearCorrectTilePulse()
    stopInvalidTileFeedback()
    hideTileNumbers()
    setIsGhostPreviewVisible(false)
    setIsHeatmapOverlayVisible(false)
    setGhostPreviewMode(GHOST_PREVIEW_MODE_DEFAULT)
    setGhostPreviewWeight(GHOST_PREVIEW_WEIGHT_DEFAULT)

    const initPuzzle = async () => {
      if (!canvasRef.current) return

      const engine = new PuzzleEngine(image, config)
      engineRef.current = engine

      const initial = await engine.generateInitialState()
      if (isCancelled || !canvasRef.current) return

      const resolveStartOptimalMoveCount = async (
        startState: PuzzleState,
        restoredProgress?: Pick<PersistedPuzzleProgress,
          'optimalStartMoveCount' | 'optimalStartMoveCountKind' | 'optimalStartMoveCountSolverVersion'
        > | null,
        allowFreshComputation: boolean = true
      ) => {
        const persistedOptimalStartMoveCount = normalizeStoredOptimalStartMoveCountResult(restoredProgress)
        if (persistedOptimalStartMoveCount) {
          setOptimalStartMoveCountState(persistedOptimalStartMoveCount)
          return
        }

        const startMoveLowerBound = engine.getHeuristicScore(startState)

        if (!allowFreshComputation) {
          setOptimalStartMoveCountState(
            startMoveLowerBound > 0
              ? createLowerBoundStartMoveCountResult(startMoveLowerBound)
              : createUnavailableStartMoveCountResult()
          )
          return
        }

        setOptimalStartMoveCountState(createLoadingStartOptimalMoveCountState())

        const exactStartMoveCountResult = await requestExactStartMoveCount({
          board: startState.board,
          emptyPos: startState.emptyIndex,
          config,
          maxVisitedNodes: START_OPTIMAL_SOLUTION_NODE_LIMIT,
        })
        if (isCancelled) return

        const resolvedStartMoveCountResult =
          exactStartMoveCountResult
          ?? (startMoveLowerBound > 0
            ? createLowerBoundStartMoveCountResult(startMoveLowerBound)
            : createUnavailableStartMoveCountResult())
        setOptimalStartMoveCountState(resolvedStartMoveCountResult)

        const knownStartSolutionMoves = getTrackedSolutionMoves(startState)
        let bestKnownStartSolutionCount = knownStartSolutionMoves.length

        const maybeUpdateKnownStartSolution = (candidateMoves: string[]) => {
          if (candidateMoves.length === 0) return
          if (bestKnownStartSolutionCount > 0 && candidateMoves.length >= bestKnownStartSolutionCount) return

          bestKnownStartSolutionCount = candidateMoves.length
          shuffleMovesRef.current = [...candidateMoves].reverse()
          rebuildKnownSolutionPathFromStart(startState, shuffleMovesRef.current)
          setKnownStartSolutionMoveCount(candidateMoves.length)
        }

        if (
          resolvedStartMoveCountResult.status === 'lower-bound'
          && knownStartSolutionMoves.length > 0
          && shouldUseFastSuggestion(config)
        ) {
          const timeLimitMs =
            config.rows * config.cols >= 36
              ? START_APPROXIMATE_SOLUTION_TIME_LIMIT_6X6_MS
              : START_APPROXIMATE_SOLUTION_TIME_LIMIT_5X5_MS
          const startedAt = performance.now()
          const checkpointStates: Array<{ state: PuzzleState; prefixMoves: string[] }> = []
          const checkpointStride = Math.max(12, Math.floor(knownStartSolutionMoves.length / 5))
          let checkpointState = normalizePuzzleState(startState, config)
          const checkpointPrefixMoves: string[] = []

          checkpointStates.push({
            state: checkpointState,
            prefixMoves: [],
          })

          for (let index = 0; index < knownStartSolutionMoves.length; index++) {
            const nextState = engine.makeMove(checkpointState, knownStartSolutionMoves[index])
            if (nextState === checkpointState) break

            checkpointState = normalizePuzzleState(nextState, config)
            checkpointPrefixMoves.push(knownStartSolutionMoves[index])

            const reachedStride = (index + 1) % checkpointStride === 0
            const leavesUsefulTail = knownStartSolutionMoves.length - (index + 1) >= 10
            const canStillBeatBest = checkpointPrefixMoves.length < Math.max(0, bestKnownStartSolutionCount - 4)
            if (reachedStride && leavesUsefulTail && canStillBeatBest) {
              checkpointStates.push({
                state: checkpointState,
                prefixMoves: [...checkpointPrefixMoves],
              })
            }
          }

          setIsImprovingStartSolution(true)

          try {
            for (const checkpoint of checkpointStates) {
              if (isCancelled) return
              if (performance.now() - startedAt >= timeLimitMs) {
                break
              }

              if (bestKnownStartSolutionCount > 0) {
                const bestLowerBoundGap = bestKnownStartSolutionCount - resolvedStartMoveCountResult.moveCount
                if (bestLowerBoundGap <= 8) {
                  break
                }
              }

              const approximateSolutionValues = await requestSolutionValues({
                board: checkpoint.state.board,
                emptyPos: checkpoint.state.emptyIndex,
                config,
                maxVisitedNodes: START_APPROXIMATE_SOLUTION_NODE_LIMIT,
              })
              if (isCancelled) return
              if (!approximateSolutionValues || approximateSolutionValues.length === 0) continue

              const approximateSuffixMoves = mapSolutionValuesToMoves(checkpoint.state, approximateSolutionValues)
              if (!approximateSuffixMoves) continue

              maybeUpdateKnownStartSolution([...checkpoint.prefixMoves, ...approximateSuffixMoves])
            }
          } finally {
            if (!isCancelled) {
              setIsImprovingStartSolution(false)
            }
          }
        }
      }

      const engineCanvas = engine.getCanvas()
      const ratio = engineCanvas.width > 0 && engineCanvas.height > 0 ? engineCanvas.width / engineCanvas.height : 1
      setImageRatio(ratio)

      const renderer = new PuzzleRenderer(canvasRef.current, config, image, ratio)
      rendererRef.current = renderer

      const restoredProgress = initialProgressRef.current
      if (restoredProgress?.puzzleState) {
        const restoredState = normalizePuzzleState(restoredProgress.puzzleState, config)
        const restoredMoveHistory = Array.isArray(restoredProgress.moveHistory)
          ? restoredProgress.moveHistory.map((state) => normalizePuzzleState(state, config))
          : []
        const restoredRedoHistory = Array.isArray(restoredProgress.redoHistory)
          ? restoredProgress.redoHistory.map((state) => normalizePuzzleState(state, config))
          : []

        const restoredMoveCount = Math.max(0, restoredProgress.moveCount)
        const restoredStartState = restoreTrackedPath(restoredState, restoredProgress.solverProgress)
        runStartStateRef.current = restoredStartState
        setPuzzleState(restoredState)
        startBoardIntro()
        setMoveCount(restoredMoveCount)
        setElapsedTime(Math.max(0, restoredProgress.elapsedTime))
        setIsPaused(Boolean(restoredProgress.isPaused))
        setRunMetrics(normalizeRunMetrics(restoredProgress.runMetrics, restoredMoveCount))
        setMoveHistory(restoredMoveHistory)
        setRedoHistory(restoredRedoHistory)
        setIsPreviewVisible(restoredProgress.previewVisible)
        const restoredHeatmapOverlayVisible = restoredProgress.heatmapOverlayVisible ?? false
        setIsGhostPreviewVisible(restoredHeatmapOverlayVisible ? false : (restoredProgress.ghostPreviewVisible ?? false))
        setIsHeatmapOverlayVisible(restoredHeatmapOverlayVisible)
        setGhostPreviewMode(normalizeGhostPreviewMode(restoredProgress.ghostPreviewMode))
        setGhostPreviewWeight(normalizeGhostPreviewWeight(restoredProgress.ghostPreviewWeight))
        setKnownStartSolutionMoveCount(
          restoredProgress.solverProgress?.shuffleMoves.length
            ? restoredProgress.solverProgress.shuffleMoves.length
            : null
        )
        void resolveStartOptimalMoveCount(
          restoredStartState,
          restoredProgress,
          restoredMoveCount === 0 || Boolean(restoredProgress.solverProgress?.shuffleMoves.length)
        )
        return
      }

      const replaySetup = initialReplaySetupRef.current
      if (replaySetup && isGalleryReplaySetupCompatible(replaySetup, config)) {
        const replayState = engine.createStateFromBoard(initial, replaySetup.startBoard, replaySetup.emptyIndex)
        if (replayState) {
          const normalizedReplayState = normalizePuzzleState(replayState, config)
          initializeTrackedPath(normalizedReplayState, replaySetup.shuffleMoves)
          runStartStateRef.current = normalizedReplayState
          setPuzzleState(normalizedReplayState)
          startBoardIntro()
          setMoveCount(0)
          setElapsedTime(0)
          setIsPaused(false)
          setKnownStartSolutionMoveCount(replaySetup.shuffleMoves.length > 0 ? replaySetup.shuffleMoves.length : null)
          setRunMetrics(createEmptyRunMetrics())
          setMoveHistory([])
          setRedoHistory([])
          setIsPreviewVisible(true)
          setIsGhostPreviewVisible(false)
          setIsHeatmapOverlayVisible(false)
          setGhostPreviewMode(GHOST_PREVIEW_MODE_DEFAULT)
          setGhostPreviewWeight(GHOST_PREVIEW_WEIGHT_DEFAULT)
          void resolveStartOptimalMoveCount(normalizedReplayState, replaySetup)
          return
        }
      }

      const shuffledResult = engine.shuffleWithMoves(initial, 100)
      const shuffledState = normalizePuzzleState(shuffledResult.state, config)
      initializeTrackedPath(shuffledState, shuffledResult.moves)
      runStartStateRef.current = shuffledState
      setPuzzleState(shuffledState)
      startBoardIntro()
      setMoveCount(0)
      setElapsedTime(0)
      setIsPaused(false)
      setKnownStartSolutionMoveCount(shuffledResult.moves.length > 0 ? shuffledResult.moves.length : null)
      setRunMetrics(createEmptyRunMetrics())
      setMoveHistory([])
      setRedoHistory([])
      setIsPreviewVisible(true)
      setIsGhostPreviewVisible(false)
      setIsHeatmapOverlayVisible(false)
      setGhostPreviewMode(GHOST_PREVIEW_MODE_DEFAULT)
      setGhostPreviewWeight(GHOST_PREVIEW_WEIGHT_DEFAULT)
      void resolveStartOptimalMoveCount(shuffledState, undefined)
    }

    void initPuzzle()

    return () => {
      isCancelled = true
      winSequenceStartedRef.current = false
      stopAnimationFrame()
      suggestionSequenceRef.current += 1
      setSuggestionComputingState(false)
      solutionQueueRef.current = []
      lastSuggestionMoveRef.current = null
      shuffleMovesRef.current = []
      runStartStateRef.current = null
      knownSolutionMovesFromStartRef.current = []
      knownSolutionPathHashesRef.current = []
      knownSolutionPathIndexByHashRef.current = new Map()
      reducedMovePathRef.current = []
      reducedPathHashesRef.current = []
      reducedPathIndexByHashRef.current = new Map()
      progressReferenceHeuristicRef.current = null
      latestPuzzleHashRef.current = null
      setImageRatio(null)
      setCanvasDisplaySize(null)
      setMoveAnimation(null)
      setInvalidTileFeedback(null)
      stopBoardIntro()
      clearWinCelebration()
      clearCorrectTilePulse()
      stopInvalidTileFeedback()
      clearTileNumbersTimeout()
      clearHintAutoHideTimeout()
      setHintPreview(null)
      setHoveredSearchTileId(null)
      setGhostPreviewMode(GHOST_PREVIEW_MODE_DEFAULT)
    }
  }, [
    cancelSuggestionFlow,
    clearCorrectTilePulse,
    clearWinCelebration,
    clearHintAutoHideTimeout,
    clearTileNumbersTimeout,
    config,
    hideTileNumbers,
    image,
    initializeTrackedPath,
    mapSolutionValuesToMoves,
    rebuildKnownSolutionPathFromStart,
    requestExactStartMoveCount,
    requestSolutionValues,
    restoreTrackedPath,
    startBoardIntro,
    stopBoardIntro,
    stopInvalidTileFeedback,
  ])

  useEffect(() => {
    if (!boardViewportRef.current || !imageRatio) return

    const boardViewport = boardViewportRef.current
    const updateCanvasDisplaySize = () => {
      if (boardViewport.clientWidth <= 0 || boardViewport.clientHeight <= 0) return

      const availableWidth = Math.max(120, boardViewport.clientWidth)
      const availableHeight = Math.max(120, boardViewport.clientHeight)

      let targetWidth = availableWidth
      let targetHeight = targetWidth / imageRatio

      if (targetHeight > availableHeight) {
        targetHeight = availableHeight
        targetWidth = targetHeight * imageRatio
      }

      const nextSize = {
        width: Math.max(60, Math.floor(targetWidth)),
        height: Math.max(60, Math.floor(targetHeight)),
      }

      setCanvasDisplaySize((prev) => {
        if (prev && prev.width === nextSize.width && prev.height === nextSize.height) {
          return prev
        }
        return nextSize
      })
    }

    updateCanvasDisplaySize()

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          updateCanvasDisplaySize()
        })
      : null

    resizeObserver?.observe(boardViewport)
    window.addEventListener('resize', updateCanvasDisplaySize)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateCanvasDisplaySize)
    }
  }, [imageRatio, isPreviewVisible, config.rows, config.cols])

  useEffect(() => {
    if (!showRestoredNotice) return

    const timeout = window.setTimeout(() => {
      setShowRestoredNotice(false)
    }, 3500)

    return () => window.clearTimeout(timeout)
  }, [showRestoredNotice])

  const isTimerActive = puzzleState !== null && !puzzleState.isSolved && !isPaused

  useEffect(() => {
    if (!isTimerActive) return

    const interval = window.setInterval(() => {
      setElapsedTime((prev) => prev + 1)
    }, 1000)

    return () => window.clearInterval(interval)
  }, [isTimerActive])

  useEffect(() => {
    if (!puzzleState || !rendererRef.current) return

    if (canvasDisplaySize) {
      rendererRef.current.resize(canvasDisplaySize.width, canvasDisplaySize.height, config)
    }

    const hintOverlay: HintOverlay | null = hintPreview
      ? { tileId: hintPreview.tileId, direction: hintPreview.direction }
      : null
    const tileSearchOverlay: TileSearchOverlay | null =
      hoveredSearchTileId && getPlayableTileById(puzzleState, hoveredSearchTileId)
        ? { tileId: hoveredSearchTileId }
        : null
    rendererRef.current.render(
      puzzleState,
      moveAnimation,
      correctTilePulse,
      tileSearchOverlay,
      hintOverlay,
      areTileNumbersVisible,
      tileNumberCorrectnessPulseProgress,
      isGhostPreviewVisible,
      ghostPreviewWeight / 100,
      ghostPreviewMode,
      isHeatmapOverlayVisible,
      invalidTileFeedback,
      hoveredSearchTileId
    )
  }, [
    areTileNumbersVisible,
    canvasDisplaySize,
    config,
    correctTilePulse,
    ghostPreviewWeight,
    ghostPreviewMode,
    hintPreview,
    hoveredSearchTileId,
    invalidTileFeedback,
    isHeatmapOverlayVisible,
    isGhostPreviewVisible,
    moveAnimation,
    puzzleState,
    tileNumberCorrectnessPulseProgress,
    getPlayableTileById,
  ])

  useEffect(() => {
    const pointerPosition = boardPointerClientPositionRef.current
    if (!pointerPosition || !puzzleState || !canvasRef.current || !engineRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    if (
      rect.width <= 0
      || rect.height <= 0
      || pointerPosition.clientX < rect.left
      || pointerPosition.clientX > rect.right
      || pointerPosition.clientY < rect.top
      || pointerPosition.clientY > rect.bottom
    ) {
      updateHoveredSearchTileId(null)
      return
    }

    const engineCanvas = engineRef.current.getCanvas()
    const canvasX = (pointerPosition.clientX - rect.left) * (engineCanvas.width / rect.width)
    const canvasY = (pointerPosition.clientY - rect.top) * (engineCanvas.height / rect.height)
    const tileId = engineRef.current.getTileAtPosition(puzzleState, canvasX, canvasY)
    const playableTile = getPlayableTileById(puzzleState, tileId)
    updateHoveredSearchTileId(playableTile?.id ?? null)
  }, [canvasDisplaySize, getPlayableTileById, puzzleState, updateHoveredSearchTileId])

  useEffect(() => {
    if (!celebrationCanvasRef.current || !canvasDisplaySize) return

    if (!celebrationRendererRef.current) {
      celebrationRendererRef.current = new PuzzleCelebrationRenderer(celebrationCanvasRef.current)
    }

    celebrationRendererRef.current.resize(canvasDisplaySize.width, canvasDisplaySize.height)
    if (!isCelebratingWin) {
      celebrationRendererRef.current.clear()
    }
  }, [canvasDisplaySize, isCelebratingWin])

  useEffect(() => {
    if (!puzzleState || !engineRef.current) {
      latestPuzzleHashRef.current = null
      return
    }

    latestPuzzleHashRef.current = engineRef.current.getStateHash(puzzleState)
  }, [puzzleState])

  useEffect(() => {
    if (!hintPreview || !puzzleState || !engineRef.current) return
    if (!engineRef.current.canMoveTile(puzzleState, hintPreview.tileId)) {
      setHintPreview(null)
    }
  }, [hintPreview, puzzleState])

  useEffect(() => {
    if (hintPreview !== null) return
    clearHintAutoHideTimeout()
  }, [clearHintAutoHideTimeout, hintPreview])

  const persistedElapsedTime = Math.floor(elapsedTime / 5) * 5
  useEffect(() => {
    if (!onProgressChange || !puzzleState) return

    if (puzzleState.isSolved) {
      onProgressChange(null)
      return
    }

    onProgressChange(
      createPersistedPuzzleProgress({
        state: puzzleState,
        config,
        moveCount,
        elapsedTime: persistedElapsedTime,
        isPaused,
        optimalStartMoveCount:
          optimalStartMoveCountState.status === 'loading'
            ? undefined
            : optimalStartMoveCountState.moveCount,
        optimalStartMoveCountKind:
          optimalStartMoveCountState.status === 'loading'
            ? undefined
            : optimalStartMoveCountState.status,
        optimalStartMoveCountSolverVersion:
          optimalStartMoveCountState.status === 'loading'
            ? undefined
            : optimalStartMoveCountState.solverVersion,
        runMetrics,
        moveHistory,
        redoHistory,
        previewVisible: isPreviewVisible,
        ghostPreviewVisible: isGhostPreviewVisible,
        ghostPreviewWeight,
        ghostPreviewMode,
        heatmapOverlayVisible: isHeatmapOverlayVisible,
        solverProgress: {
          shuffleMoves: [...shuffleMovesRef.current],
          reducedMovePath: [...reducedMovePathRef.current],
        },
        historyLimit: PERSISTED_HISTORY_LIMIT,
      })
    )
  }, [
    config,
    ghostPreviewWeight,
    ghostPreviewMode,
    isHeatmapOverlayVisible,
    isGhostPreviewVisible,
    isPaused,
    isPreviewVisible,
    moveCount,
    moveHistory,
    onProgressChange,
    optimalStartMoveCountState,
    persistedElapsedTime,
    puzzleState,
    redoHistory,
    runMetrics,
  ])

  useEffect(() => {
    if (!puzzleState?.isSolved || winSequenceStartedRef.current) return

    winSequenceStartedRef.current = true
    startWinCelebration({
      moves: moveCount,
      time: elapsedTime,
      ...runMetrics,
      assistanceMode: deriveAssistanceModeFromRunMetrics(runMetrics),
      replaySetup: createReplaySetupFromStartState(
        runStartStateRef.current,
        shuffleMovesRef.current,
        optimalStartMoveCountState
      ),
    })
  }, [elapsedTime, moveCount, optimalStartMoveCountState, puzzleState?.isSolved, runMetrics, startWinCelebration])

  const isMoveAnimating = Boolean(moveAnimation)
  const isInteractionLocked = isMoveAnimating || isCelebratingWin || isComputingSuggestion || isPaused
  const useFastSuggestionOnly = shouldUseFastSuggestion(config)

  const requestExactSolutionMoves = useCallback(async (snapshot: PuzzleState): Promise<string[] | null> => {
    const solutionValues = await requestSolutionValues({
      board: snapshot.board,
      emptyPos: snapshot.emptyIndex,
      config,
      maxVisitedNodes: EXACT_SOLUTION_NODE_LIMIT,
    })

    if (!solutionValues || solutionValues.length === 0) {
      return solutionValues === null ? null : []
    }

    const solutionMoves: string[] = []
    for (const value of solutionValues) {
      const tileId = mapTileValueToId(snapshot, value)
      if (!tileId) return null
      solutionMoves.push(tileId)
    }

    return solutionMoves
  }, [config, mapTileValueToId, requestSolutionValues])

  const optimalMoveSummary =
    optimalStartMoveCountState.status === 'exact'
      ? `Optimal: ${optimalStartMoveCountState.moveCount}`
      : optimalStartMoveCountState.status === 'lower-bound'
        ? knownStartSolutionMoveCount !== null && knownStartSolutionMoveCount > 0
          ? knownStartSolutionMoveCount > optimalStartMoveCountState.moveCount
            ? `Bekannt: ${knownStartSolutionMoveCount} (Min. ${optimalStartMoveCountState.moveCount}${isImprovingStartSolution ? ', Suche laeuft' : ''})`
            : `Bekannt: ${knownStartSolutionMoveCount}`
          : `Mindestens: ${optimalStartMoveCountState.moveCount}${isImprovingStartSolution ? ' | Suche laeuft' : ''}`
      : optimalStartMoveCountState.status === 'loading'
        ? 'Optimal wird berechnet ...'
        : 'Optimal momentan nicht verfuegbar'
  const challengeSummary = formatChallengeTargetSummary(challengeTarget)

  const resolveSuggestedQueue = async (
    puzzleSnapshot: PuzzleState
  ): Promise<{ queue: string[]; source: 'exact' | 'tracked' | 'greedy' } | null> => {
    const activeEngine = engineRef.current
    if (!activeEngine || puzzleSnapshot.isSolved) {
      return null
    }

    const trackedSolutionMoves = getTrackedSolutionMoves(puzzleSnapshot)
    const exactSolutionMoves = useFastSuggestionOnly ? null : await requestExactSolutionMoves(puzzleSnapshot)

    if (exactSolutionMoves && exactSolutionMoves.length > 0 && trackedSolutionMoves.length > 0) {
      return exactSolutionMoves.length <= trackedSolutionMoves.length
        ? { queue: exactSolutionMoves, source: 'exact' }
        : { queue: trackedSolutionMoves, source: 'tracked' }
    }

    if (exactSolutionMoves && exactSolutionMoves.length > 0) {
      return { queue: exactSolutionMoves, source: 'exact' }
    }

    if (trackedSolutionMoves.length > 0) {
      return { queue: trackedSolutionMoves, source: 'tracked' }
    }

    const fallbackMove = activeEngine.getGreedySuggestedMove(puzzleSnapshot, lastSuggestionMoveRef.current)
    return fallbackMove ? { queue: [fallbackMove], source: 'greedy' } : null
  }

  const applyMove = (tileId: string, moveSource: 'manual' | 'suggested' = 'manual'): boolean => {
    if (!puzzleState || !engineRef.current) return false

    const currentState = normalizePuzzleState(puzzleState, config)
    const nextState = engineRef.current.makeMove(currentState, tileId)
    if (nextState === currentState) {
      return false
    }

    const normalizedNextState = normalizePuzzleState(nextState, config)
    const movedTileBefore = currentState.tiles.find((tile) => tile.id === tileId)
    const movedTileAfter = normalizedNextState.tiles.find((tile) => tile.id === tileId)
    const reachedCorrectPlace = Boolean(
      movedTileBefore &&
        movedTileAfter &&
        (movedTileBefore.row !== movedTileBefore.correctRow || movedTileBefore.col !== movedTileBefore.correctCol) &&
        movedTileAfter.row === movedTileAfter.correctRow &&
        movedTileAfter.col === movedTileAfter.correctCol
    )

    recordTrackedMove(normalizedNextState, tileId)
    setHintPreview(null)
    setMoveHistory((prev) => [...prev.slice(-(HISTORY_LIMIT - 1)), currentState])
    setRedoHistory([])
    setMoveCount(normalizedNextState.moveCount)
    setRunMetrics((prev) => ({
      ...prev,
      actionMoves: prev.actionMoves + 1,
      suggestedMoveCount: moveSource === 'suggested' ? prev.suggestedMoveCount + 1 : prev.suggestedMoveCount,
    }))
    setPuzzleState(normalizedNextState)
    if (reachedCorrectPlace) {
      startCorrectTilePulse(tileId)
    }
    return true
  }

  const startAnimatedMove = (tileId: string, fromSuggestion: boolean = false): boolean => {
    if (!puzzleState || !engineRef.current || puzzleState.isSolved || animationFrameRef.current !== null || isComputingSuggestionRef.current) {
      return false
    }

    if (!fromSuggestion) {
      const blockedTile = puzzleState.tiles.find((entry) => entry.id === tileId)
      if (blockedTile && !blockedTile.isEmpty && !engineRef.current.canMoveTile(puzzleState, tileId)) {
        startInvalidTileFeedback(tileId)
      }
    }

    if (!engineRef.current.canMoveTile(puzzleState, tileId)) {
      return false
    }

    if (!fromSuggestion) {
      cancelSuggestionFlow()
    }

    const tile = puzzleState.tiles.find((entry) => entry.id === tileId)
    if (!tile || tile.isEmpty) return false

    if (boardPointerClientPositionRef.current) {
      updateHoveredSearchTileId(null)
    }
    clearInvalidTileFeedback()
    hideTileNumbers()
    const animation: TileMoveAnimation = {
      tileId,
      fromRow: tile.row,
      fromCol: tile.col,
      toRow: puzzleState.emptyRow,
      toCol: puzzleState.emptyCol,
      progress: 0,
    }

    audioService.activate()
    audioService.playMove()
    stopAnimationFrame()
    clearCorrectTilePulse()
    setPuzzleState((prev) =>
      prev
        ? {
            ...prev,
            isAnimating: true,
            dragState: null,
            tiles: prev.tiles.map((entry) => ({ ...entry, isDragging: false })),
          }
        : null
    )
    setMoveAnimation(animation)

    const startedAt = performance.now()
    const animate = (timestamp: number) => {
      const progress = Math.min(1, (timestamp - startedAt) / MOVE_ANIMATION_DURATION_MS)
      setMoveAnimation((prev) => (prev ? { ...prev, progress } : null))

      if (progress < 1) {
        animationFrameRef.current = window.requestAnimationFrame(animate)
        return
      }

      animationFrameRef.current = null
      setMoveAnimation(null)
      const moved = applyMove(tileId, fromSuggestion ? 'suggested' : 'manual')

      if (moved && fromSuggestion) {
        lastSuggestionMoveRef.current = tileId
        if (solutionQueueRef.current[0] === tileId) {
          solutionQueueRef.current = solutionQueueRef.current.slice(1)
        } else {
          solutionQueueRef.current = []
        }
      }

      if (moved && !fromSuggestion) {
        lastSuggestionMoveRef.current = null
      }

      if (!moved) {
        if (fromSuggestion) {
          solutionQueueRef.current = []
          lastSuggestionMoveRef.current = null
        }

        setPuzzleState((prev) =>
          prev
            ? {
                ...prev,
                isAnimating: false,
                dragState: null,
                tiles: prev.tiles.map((entry) => ({ ...entry, isDragging: false })),
              }
            : null
        )
      }
    }

    animationFrameRef.current = window.requestAnimationFrame(animate)
    return true
  }

  const startHistoryMoveAnimation = (
    fromState: PuzzleState,
    tileId: string,
    onComplete: () => void
  ): boolean => {
    if (animationFrameRef.current !== null) {
      return false
    }

    const tile = fromState.tiles.find((entry) => entry.id === tileId)
    if (!tile || tile.isEmpty) return false

    const animation: TileMoveAnimation = {
      tileId,
      fromRow: tile.row,
      fromCol: tile.col,
      toRow: fromState.emptyRow,
      toCol: fromState.emptyCol,
      progress: 0,
    }

    audioService.activate()
    audioService.playMove()
    stopAnimationFrame()
    setPuzzleState((prev) =>
      prev
        ? {
            ...prev,
            isAnimating: true,
            dragState: null,
            tiles: prev.tiles.map((entry) => ({ ...entry, isDragging: false })),
          }
        : null
    )
    setMoveAnimation(animation)

    const startedAt = performance.now()
    const animate = (timestamp: number) => {
      const progress = Math.min(1, (timestamp - startedAt) / MOVE_ANIMATION_DURATION_MS)
      setMoveAnimation((prev) => (prev ? { ...prev, progress } : null))

      if (progress < 1) {
        animationFrameRef.current = window.requestAnimationFrame(animate)
        return
      }

      animationFrameRef.current = null
      setMoveAnimation(null)
      onComplete()
    }

    animationFrameRef.current = window.requestAnimationFrame(animate)
    return true
  }

  const didTileReachCorrectPlace = (
    fromState: PuzzleState,
    toState: PuzzleState,
    tileId: string
  ): boolean => {
    const movedTileBefore = fromState.tiles.find((tile) => tile.id === tileId)
    const movedTileAfter = toState.tiles.find((tile) => tile.id === tileId)

    return Boolean(
      movedTileBefore &&
        movedTileAfter &&
        !movedTileBefore.isEmpty &&
        !movedTileAfter.isEmpty &&
        (movedTileBefore.row !== movedTileBefore.correctRow || movedTileBefore.col !== movedTileBefore.correctCol) &&
        movedTileAfter.row === movedTileAfter.correctRow &&
        movedTileAfter.col === movedTileAfter.correctCol
    )
  }

  const getTileIdFromCanvasEvent = (event: React.MouseEvent<HTMLCanvasElement>): string | null => {
    if (!canvasRef.current || !puzzleState || !engineRef.current) return null

    const rect = canvasRef.current.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null

    const engineCanvas = engineRef.current.getCanvas()
    const canvasX = (event.clientX - rect.left) * (engineCanvas.width / rect.width)
    const canvasY = (event.clientY - rect.top) * (engineCanvas.height / rect.height)

    return engineRef.current.getTileAtPosition(puzzleState, canvasX, canvasY)
  }

  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!puzzleState) return

    boardPointerClientPositionRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
    }
    const tileId = getTileIdFromCanvasEvent(event)
    const playableTile = getPlayableTileById(puzzleState, tileId)
    updateHoveredSearchTileId(playableTile?.id ?? null)

    if (canvasRef.current && !puzzleState.isSolved) {
      const isOverMovable = tileId
        ? rendererRef.current?.isTileMovable(puzzleState, tileId) ?? false
        : false
      canvasRef.current.style.cursor = isOverMovable ? 'grab' : 'default'
    }
  }

  const handleCanvasMouseLeave = () => {
    boardPointerClientPositionRef.current = null
    updateHoveredSearchTileId(null)
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'default'
    }
  }

  const openContextWindow = useCallback((request: AppContextMenuRequest) => {
    if (shouldPreserveNativeContextMenu(request.target)) return
    if (!puzzleState || isPaused) return

    request.preventDefault?.()
    setContextMenuPosition({ x: request.clientX, y: request.clientY })
  }, [isPaused, puzzleState])

  useEffect(() => {
    registerAppContextMenuHandler(openContextWindow)
    return () => registerAppContextMenuHandler(null)
  }, [openContextWindow, registerAppContextMenuHandler])

  const handleScreenContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    openContextWindow({
      clientX: event.clientX,
      clientY: event.clientY,
      target: event.target,
      preventDefault: () => event.preventDefault(),
    })
  }

  const closeContextMenu = useCallback(() => {
    setContextMenuPosition(null)
  }, [])

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    event.currentTarget.focus({ preventScroll: true })

    if (!puzzleState || !engineRef.current || puzzleState.isSolved || isPaused || isMoveAnimating || isComputingSuggestionRef.current) {
      return
    }

    const tileId = getTileIdFromCanvasEvent(event)
    if (!tileId) return
    startAnimatedMove(tileId)
  }

  const handleReferenceTileHover = useCallback((correctIndex: number | null) => {
    if (correctIndex === null || !puzzleState || isPaused) {
      updateHoveredSearchTileId(null)
      return
    }

    const tileId = mapTileValueToId(puzzleState, correctIndex)
    const playableTile = getPlayableTileById(puzzleState, tileId)
    updateHoveredSearchTileId(playableTile?.id ?? null)
  }, [getPlayableTileById, isPaused, mapTileValueToId, puzzleState, updateHoveredSearchTileId])

  const getTileIdForKeyboardMove = (direction: PuzzleMoveDirection): string | null => {
    if (!puzzleState) return null

    let targetRow = puzzleState.emptyRow
    let targetCol = puzzleState.emptyCol

    switch (direction) {
      case 'up':
        targetRow += 1
        break
      case 'down':
        targetRow -= 1
        break
      case 'left':
        targetCol += 1
        break
      case 'right':
        targetCol -= 1
        break
    }

    if (targetRow < 0 || targetRow >= config.rows || targetCol < 0 || targetCol >= config.cols) {
      return null
    }

    return puzzleState.tiles.find((tile) => tile.row === targetRow && tile.col === targetCol)?.id ?? null
  }

  const handleKeyboardMove = (direction: PuzzleMoveDirection): boolean => {
    if (!puzzleState || puzzleState.isSolved || isInteractionLocked) return false

    const tileId = getTileIdForKeyboardMove(direction)
    if (!tileId) return false

    return startAnimatedMove(tileId)
  }

  const handleCanvasKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    const direction = getKeyboardMoveDirection(event.key)
    if (!direction) return

    event.preventDefault()
    event.stopPropagation()
    handleKeyboardMove(direction)
  }

  const runSuggestionResolution = (autoPlay: boolean, hintAutoHideMs: number | null = null) => {
    if (!puzzleState || !engineRef.current || puzzleState.isSolved || isInteractionLocked) return

    if (hintAutoHideMs === null) {
      clearHintAutoHideTimeout()
    }

    hideTileNumbers()
    const puzzleSnapshot = normalizePuzzleState(puzzleState, config)
    const snapshotHash = engineRef.current.getStateHash(puzzleSnapshot)
    const requestSequence = suggestionSequenceRef.current + 1
    suggestionSequenceRef.current = requestSequence
    setSuggestionComputingState(true)

    void (async () => {
      try {
        const resolution = await resolveSuggestedQueue(puzzleSnapshot)
        if (suggestionSequenceRef.current !== requestSequence || latestPuzzleHashRef.current !== snapshotHash) {
          return
        }

        setSuggestionComputingState(false)

        if (!resolution || resolution.queue.length === 0) {
          solutionQueueRef.current = []
          lastSuggestionMoveRef.current = null
          setHintPreview(null)
          return
        }

        solutionQueueRef.current = resolution.queue
        const nextHintPreview = buildHintPreview(puzzleSnapshot, resolution.queue[0], resolution.source)
        if (!autoPlay && nextHintPreview) {
          setRunMetrics((prev) => ({
            ...prev,
            hintCount: prev.hintCount + 1,
          }))
        }
        setHintPreview(nextHintPreview)

        if (nextHintPreview && hintAutoHideMs !== null) {
          scheduleHintAutoHideTimeout(hintAutoHideMs)
        } else {
          clearHintAutoHideTimeout()
        }

        if (autoPlay) {
          const nextMove = resolution.queue[0]
          if (!nextMove) return
          startAnimatedMove(nextMove, true)
        }
      } finally {
        if (suggestionSequenceRef.current === requestSequence) {
          setSuggestionComputingState(false)
        }
      }
    })()
  }

  const handleShowHint = () => {
    showBoardToolHelp('hint')
    endActiveBoardHelp()
    runSuggestionResolution(false)
  }

  const handleShowHintFromHotkey = () => {
    showBoardToolHelp('hint')
    endActiveBoardHelp()
    runSuggestionResolution(false, HOTKEY_HINT_PREVIEW_MS)
    focusHotkeyFeedbackTarget(hintButtonRef)
  }

  const handleSuggestedMove = () => {
    if (!puzzleState || !engineRef.current || puzzleState.isSolved || isInteractionLocked) return

    showBoardToolHelp('suggested-move')

    const suggestedMoveFromPreview = hintPreview?.tileId ?? null
    const suggestedMove =
      suggestedMoveFromPreview && engineRef.current.canMoveTile(puzzleState, suggestedMoveFromPreview)
        ? suggestedMoveFromPreview
        : solutionQueueRef.current[0]

    endActiveBoardHelp()
    if (suggestedMove && engineRef.current.canMoveTile(puzzleState, suggestedMove)) {
      startAnimatedMove(suggestedMove, true)
      return
    }

    runSuggestionResolution(true)
  }

  const togglePersistentPreviewVisibility = useCallback(() => {
    if (isPaused) return
    showBoardToolHelp('preview')
    hideTileNumbers()
    setIsPreviewVisible((prev) => !prev)
  }, [hideTileNumbers, isPaused, showBoardToolHelp])

  const toggleGhostPreviewVisibility = useCallback(() => {
    if (isPaused) return
    showBoardToolHelp('ghost-preview')
    const nextValue = !isGhostPreviewVisible
    if (nextValue) {
      endActiveBoardHelp()
    }
    setIsGhostPreviewVisible(nextValue)
  }, [endActiveBoardHelp, isGhostPreviewVisible, isPaused, showBoardToolHelp])

  const toggleHeatmapOverlayVisibility = useCallback(() => {
    if (isPaused) return
    showBoardToolHelp('heatmap')
    const nextValue = !isHeatmapOverlayVisible
    if (nextValue) {
      endActiveBoardHelp()
    }
    setIsHeatmapOverlayVisible(nextValue)
  }, [endActiveBoardHelp, isHeatmapOverlayVisible, isPaused, showBoardToolHelp])

  const handleGhostPreviewWeightChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    if (isPaused) return
    setGhostPreviewWeight(normalizeGhostPreviewWeight(Number(event.target.value)))
  }, [isPaused])

  const handleGhostPreviewModeChange = useCallback((mode: GhostPreviewMode) => {
    if (isPaused) return
    setGhostPreviewMode(mode)
  }, [isPaused])

  const closeRestartConfirm = useCallback(() => {
    setIsRestartConfirmOpen(false)
  }, [])

  const confirmRestartPuzzle = useCallback(() => {
    setIsRestartConfirmOpen(false)
    onRestart()
  }, [onRestart])

  const handleRestartPuzzle = useCallback(() => {
    if (isInteractionLocked) return

    const shouldConfirmRestart = moveCount > 0 || elapsedTime > 0 || moveHistory.length > 0 || redoHistory.length > 0
    if (!shouldConfirmRestart) {
      onRestart()
      return
    }

    setIsRestartConfirmOpen(true)
  }, [elapsedTime, isInteractionLocked, moveCount, moveHistory.length, onRestart, redoHistory.length])

  const handleUndoMove = () => {
    if (!puzzleState || moveHistory.length === 0 || isInteractionLocked) return

    hideTileNumbers()
    cancelSuggestionFlow()
    clearCorrectTilePulse()
    clearInvalidTileFeedback()
    const currentState = normalizePuzzleState(puzzleState, config)
    const previousState = normalizePuzzleState(moveHistory[moveHistory.length - 1], config)
    const moveRecord = createMoveRecordForStates(previousState, currentState, currentState.moveCount)

    const commitUndoMove = () => {
      syncTrackedPathToState(previousState)
      setMoveHistory((prev) => prev.slice(0, -1))
      setRedoHistory((prev) => [...prev.slice(-(HISTORY_LIMIT - 1)), currentState])
      setPuzzleState(previousState)
      setMoveCount(previousState.moveCount)
      setRunMetrics((prev) => ({
        ...prev,
        undoCount: prev.undoCount + 1,
      }))
      if (moveRecord && didTileReachCorrectPlace(currentState, previousState, moveRecord.tileId)) {
        startCorrectTilePulse(moveRecord.tileId)
      }
    }

    if (moveRecord && startHistoryMoveAnimation(currentState, moveRecord.tileId, commitUndoMove)) {
      return
    }

    commitUndoMove()
  }

  const handleRedoMove = () => {
    if (!puzzleState || redoHistory.length === 0 || isInteractionLocked) return

    hideTileNumbers()
    cancelSuggestionFlow()
    clearCorrectTilePulse()
    clearInvalidTileFeedback()
    const currentState = normalizePuzzleState(puzzleState, config)
    const nextState = normalizePuzzleState(redoHistory[redoHistory.length - 1], config)
    const moveRecord = createMoveRecordForStates(currentState, nextState, nextState.moveCount)

    const commitRedoMove = () => {
      if (moveRecord) {
        recordTrackedMove(nextState, moveRecord.tileId)
      } else {
        syncTrackedPathToState(nextState)
      }

      setRedoHistory((prev) => prev.slice(0, -1))
      setMoveHistory((prev) => [...prev.slice(-(HISTORY_LIMIT - 1)), currentState])
      setPuzzleState(nextState)
      setMoveCount(nextState.moveCount)
      setRunMetrics((prev) => ({
        ...prev,
        actionMoves: prev.actionMoves + 1,
        redoCount: prev.redoCount + 1,
      }))
      if (moveRecord && didTileReachCorrectPlace(currentState, nextState, moveRecord.tileId)) {
        startCorrectTilePulse(moveRecord.tileId)
      }
    }

    if (moveRecord && startHistoryMoveAnimation(currentState, moveRecord.tileId, commitRedoMove)) {
      return
    }

    commitRedoMove()
  }

  const handleSuggestedMoveFromHotkey = () => {
    handleSuggestedMove()
    focusHotkeyFeedbackTarget(suggestedMoveButtonRef)
  }

  const togglePreviewFromHotkey = () => {
    togglePersistentPreviewVisibility()
    focusHotkeyFeedbackTarget(previewToggleButtonRef)
  }

  const toggleGhostPreviewFromHotkey = () => {
    toggleGhostPreviewVisibility()
    focusHotkeyFeedbackTarget(ghostPreviewButtonRef)
  }

  const toggleHeatmapFromHotkey = () => {
    toggleHeatmapOverlayVisibility()
    focusHotkeyFeedbackTarget(heatmapButtonRef)
  }

  const handleShowTileNumbersFromHotkey = () => {
    handleShowTileNumbers()
    focusHotkeyFeedbackTarget(tileNumbersButtonRef)
  }

  const handleUndoMoveFromHotkey = () => {
    handleUndoMove()
    focusHotkeyFeedbackTarget(undoButtonRef)
  }

  const handleRedoMoveFromHotkey = () => {
    handleRedoMove()
    focusHotkeyFeedbackTarget(redoButtonRef)
  }

  const pausePuzzle = useCallback(() => {
    if (!puzzleState || puzzleState.isSolved || isPaused) return

    endActiveBoardHelp()
    clearCorrectTilePulse()
    clearInvalidTileFeedback()
    setContextMenuPosition(null)
    setIsRestartConfirmOpen(false)
    updateHoveredSearchTileId(null)
    setIsPaused(true)
    setBoardCaption('Pause aktiv. Timer, Brett und Zielbild sind bis zum Weiterspielen gesperrt.')
    announceAccessibility('Puzzle pausiert. Timer, Brett und Zielbild sind verdeckt.')
  }, [
    announceAccessibility,
    clearCorrectTilePulse,
    clearInvalidTileFeedback,
    endActiveBoardHelp,
    isPaused,
    puzzleState,
    updateHoveredSearchTileId,
  ])

  const resumePuzzle = useCallback(() => {
    if (!isPaused) return

    setIsPaused(false)
    setBoardCaption(DEFAULT_BOARD_CAPTION)
    announceAccessibility('Puzzle wird fortgesetzt.')
    focusBoardCanvas()
  }, [announceAccessibility, focusBoardCanvas, isPaused])

  const togglePause = useCallback(() => {
    if (isPaused) {
      resumePuzzle()
      return
    }

    pausePuzzle()
  }, [isPaused, pausePuzzle, resumePuzzle])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        pausePuzzle()
      }
    }

    handleVisibilityChange()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [pausePuzzle])

  usePuzzleKeyboardShortcuts({
    isRestartConfirmOpen,
    isHelpOpen,
    isPaused,
    puzzleState,
    isInteractionLocked,
    onFocusBoard: focusBoardCanvas,
    onTogglePause: togglePause,
    onQuit,
    onTogglePreview: togglePreviewFromHotkey,
    onToggleGhostPreview: toggleGhostPreviewFromHotkey,
    onToggleHeatmapOverlay: toggleHeatmapFromHotkey,
    onShowTileNumbers: handleShowTileNumbersFromHotkey,
    onSuggestedMove: handleSuggestedMoveFromHotkey,
    onShowHint: handleShowHintFromHotkey,
    onRestart: handleRestartPuzzle,
    onUndo: handleUndoMoveFromHotkey,
    onRedo: handleRedoMoveFromHotkey,
  })

  const progressMetrics: PuzzleProgressMetrics | null =
    puzzleState && engineRef.current
      ? engineRef.current.getProgressMetrics(puzzleState, progressReferenceHeuristicRef.current)
      : null
  const contextHint: PuzzleContextHint | null =
    puzzleState && engineRef.current
      ? engineRef.current.getContextHint(puzzleState, hintPreview?.tileId ?? null)
      : null
  const difficultyLabel = formatDifficultyLabel(config)
  const playableTileCount = Math.max(0, config.rows * config.cols - 1)
  const activeSearchTile = puzzleState
    ? getPlayableTileById(puzzleState, hoveredSearchTileId)
    : null
  const highlightedReferenceIndex = activeSearchTile?.correctIndex ?? null
  const boardCaptionId = 'puzzle-board-caption'
  const boardDescriptionId = 'puzzle-board-description'

  useEffect(() => {
    if (!isBoardFocused) {
      return
    }

    announceAccessibility('Puzzlebrett fokussiert. Pfeile oder WASD bewegen Kacheln. B bringt den Fokus jederzeit zurueck.')
  }, [announceAccessibility, isBoardFocused])

  return (
    <div ref={puzzleRootRef} className="puzzle-screen" data-page-focus-root="true" onContextMenu={handleScreenContextMenu}>
      <div className="puzzle-wrapper">
        {showRestoredNotice && (
          <div className="restore-notice" role="status" aria-live="polite">
            Spielstand wiederhergestellt.
          </div>
        )}

        <div className="puzzle-main-layout">
            <PuzzleLeftPanel
              config={config}
              moveCount={moveCount}
            optimalMoveSummary={optimalMoveSummary}
            isImprovingStartSolution={isImprovingStartSolution}
            challengeSummary={challengeSummary}
            elapsedTime={elapsedTime}
            progressMetrics={progressMetrics}
            hintPreview={hintPreview}
            isComputingSuggestion={isComputingSuggestion}
            isInteractionLocked={isInteractionLocked}
            isPaused={isPaused}
            isPreviewVisible={isPreviewVisible}
            isGhostPreviewVisible={isGhostPreviewVisible}
            isHeatmapOverlayVisible={isHeatmapOverlayVisible}
            areTileNumbersVisible={areTileNumbersVisible}
            ghostPreviewMode={ghostPreviewMode}
            ghostPreviewWeight={ghostPreviewWeight}
            moveHistoryLength={moveHistory.length}
            redoHistoryLength={redoHistory.length}
            onShowHint={handleShowHint}
            onTogglePause={togglePause}
            onSuggestedMove={handleSuggestedMove}
            onTogglePreview={togglePersistentPreviewVisibility}
            onToggleGhostPreview={toggleGhostPreviewVisibility}
            onToggleHeatmapOverlay={toggleHeatmapOverlayVisibility}
            onShowTileNumbers={handleShowTileNumbers}
              onGhostPreviewModeChange={handleGhostPreviewModeChange}
              onGhostPreviewWeightChange={handleGhostPreviewWeightChange}
              onUndo={handleUndoMove}
              onRedo={handleRedoMove}
              onQuit={onQuit}
              onOpenHelp={onOpenHelp}
              actionButtonRefs={{
                hint: hintButtonRef,
                suggestedMove: suggestedMoveButtonRef,
                preview: previewToggleButtonRef,
                ghostPreview: ghostPreviewButtonRef,
                heatmap: heatmapButtonRef,
                tileNumbers: tileNumbersButtonRef,
                undo: undoButtonRef,
                redo: redoButtonRef,
                helpTrigger: helpTriggerButtonRef,
                pause: pauseButtonRef,
                quit: quitButtonRef,
              }}
            />

          <div className="puzzle-content-area">
            <div className={`puzzle-board-stage${isBoardFocused ? ' is-board-focused' : ''}`}>
              <div className={`puzzle-board-frame${isBoardFocused ? ' is-focused' : ''}${isPaused ? ' is-paused' : ''}`}>
                <div className="puzzle-board-viewport" ref={boardViewportRef}>
                  <div
                    className={`puzzle-board-canvas-stack${isBoardIntroActive ? ' is-intro' : ''}${isCelebratingWin ? ' is-celebrating' : ''}${isPaused ? ' is-paused' : ''}`}
                    style={canvasDisplaySize ? { width: `${canvasDisplaySize.width}px`, height: `${canvasDisplaySize.height}px` } : undefined}
                    data-app-tooltip="Brett fokussieren: Pfeile/WASD bewegen, H Hinweis, Enter Auto-Zug, Leertaste Vorschau."
                    data-app-tooltip-align="start"
                  >
                    <canvas
                      ref={canvasRef}
                      className={`puzzle-canvas${isInteractionLocked ? ' is-locked' : ''}`}
                      data-page-primary-focus="true"
                      data-tab-actionable="true"
                      style={canvasDisplaySize ? { width: '100%', height: '100%' } : undefined}
                      onClick={handleCanvasClick}
                      onFocus={() => setIsBoardFocused(true)}
                      onBlur={() => setIsBoardFocused(false)}
                      onMouseMove={handleCanvasMouseMove}
                      onMouseLeave={handleCanvasMouseLeave}
                      onKeyDown={handleCanvasKeyDown}
                      tabIndex={isPaused ? -1 : 0}
                      aria-label="Puzzlebrett. Wenn das Brett fokussiert ist, bewegen Pfeiltasten oder WASD benachbarte Kacheln in das Leerfeld."
                      aria-describedby={`${boardDescriptionId} ${boardCaptionId}`}
                      aria-roledescription="Schiebepuzzle-Brett"
                      aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight W A S D B H Enter Space G M N P Control+Z Control+Y Control+Shift+Z R Escape"
                    />
                    <canvas
                      ref={celebrationCanvasRef}
                      className={`puzzle-celebration-canvas${isCelebratingWin ? ' is-visible' : ''}`}
                      style={canvasDisplaySize ? { width: '100%', height: '100%' } : undefined}
                      aria-hidden="true"
                    />
                    {isPaused && (
                      <PuzzlePauseOverlay
                        elapsedTime={elapsedTime}
                        onResume={resumePuzzle}
                      />
                    )}
                  </div>
                </div>
              </div>
              <p id={boardDescriptionId} className="visually-hidden">
                Das Puzzlebrett ist der zentrale Spielbereich. Pfeiltasten oder WASD bewegen Kacheln, H zeigt einen Hinweis, Enter spielt den empfohlenen Zug und B holt den Fokus zurueck auf das Brett.
              </p>
              <p id={boardCaptionId} className="puzzle-board-caption" aria-live="polite">
                {boardCaption}
              </p>
            </div>
          </div>

          <PuzzleRightPanel
            image={image}
            config={config}
            imageRatio={imageRatio}
            difficultyLabel={difficultyLabel}
            playableTileCount={playableTileCount}
            isPreviewVisible={isPreviewVisible}
            isPaused={isPaused}
            progressMetrics={progressMetrics}
            contextHint={contextHint}
            highlightedReferenceIndex={highlightedReferenceIndex}
            onReferenceTileHover={handleReferenceTileHover}
          />
        </div>

        <AnimatePresence initial={false}>
          {isRestartConfirmOpen && (
            <PuzzleRestartConfirmDialog
              onCancel={closeRestartConfirm}
              onConfirm={confirmRestartPuzzle}
              confirmButtonRef={restartConfirmButtonRef}
            />
          )}
        </AnimatePresence>

        {contextMenuPosition && (
          <PuzzleContextMenu
            position={contextMenuPosition}
            isSolved={puzzleState?.isSolved ?? true}
            isInteractionLocked={isInteractionLocked}
            isPreviewVisible={isPreviewVisible}
            isGhostPreviewVisible={isGhostPreviewVisible}
            isHeatmapOverlayVisible={isHeatmapOverlayVisible}
            onShowHint={handleShowHint}
            onSuggestedMove={handleSuggestedMove}
            onTogglePreview={togglePersistentPreviewVisibility}
            onToggleGhostPreview={toggleGhostPreviewVisibility}
            onToggleHeatmapOverlay={toggleHeatmapOverlayVisibility}
            onShowTileNumbers={handleShowTileNumbers}
            onUndo={handleUndoMove}
            onRedo={handleRedoMove}
            onOpenHelp={onOpenHelp}
            onGoToSelectionScreen={onQuit}
            onGoToStartScreen={onGoToStartScreen}
            onClose={closeContextMenu}
            canUndo={moveHistory.length > 0}
            canRedo={redoHistory.length > 0}
          />
        )}
      </div>
    </div>
  )
}
























