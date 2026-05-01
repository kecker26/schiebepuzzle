import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react'

import '../styles/components/start-screen-animated-board.css'

interface StartScreenAnimatedBoardProps {
  imageSrc: string
}

type BoardState = number[]
type LoopPhase = 'forward' | 'backward'

interface LoopSequence {
  forward: number[]
  backward: number[]
  scrambledBoard: BoardState
}

const GRID_SIZE = 4
const TILE_COUNT = GRID_SIZE * GRID_SIZE
const EMPTY_TILE_VALUE = TILE_COUNT - 1
const LOOP_MOVE_COUNT = 24
const MAX_CORRECT_VISIBLE_TILES = 3
const INITIAL_PAUSE_MS = 900
const MOVE_INTERVAL_MS = 1080
const MOVE_DURATION_MS = 380
const PHASE_PAUSE_MS = 1280

function createSolvedBoard(): BoardState {
  return Array.from({ length: TILE_COUNT }, (_, index) => index)
}

function getCoordinates(index: number): { row: number; col: number } {
  return {
    row: Math.floor(index / GRID_SIZE),
    col: index % GRID_SIZE,
  }
}

function areNeighborSlots(firstIndex: number, secondIndex: number): boolean {
  const first = getCoordinates(firstIndex)
  const second = getCoordinates(secondIndex)
  return Math.abs(first.row - second.row) + Math.abs(first.col - second.col) === 1
}

function getMovableTileValues(board: BoardState, lastMovedValue: number | null = null): number[] {
  const emptyIndex = board.indexOf(EMPTY_TILE_VALUE)
  const { row, col } = getCoordinates(emptyIndex)
  const candidates = [
    { row: row - 1, col },
    { row: row + 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 },
  ]
    .filter((candidate) => (
      candidate.row >= 0
      && candidate.row < GRID_SIZE
      && candidate.col >= 0
      && candidate.col < GRID_SIZE
    ))
    .map((candidate) => board[candidate.row * GRID_SIZE + candidate.col])
    .filter((tileValue) => tileValue !== EMPTY_TILE_VALUE)

  const withoutImmediateUndo = candidates.filter((tileValue) => tileValue !== lastMovedValue)
  return withoutImmediateUndo.length > 0 ? withoutImmediateUndo : candidates
}

function applyMove(board: BoardState, tileValue: number): BoardState {
  const emptyIndex = board.indexOf(EMPTY_TILE_VALUE)
  const tileIndex = board.indexOf(tileValue)
  if (tileIndex === -1 || !areNeighborSlots(tileIndex, emptyIndex)) {
    return board
  }

  const nextBoard = [...board]
  nextBoard[emptyIndex] = tileValue
  nextBoard[tileIndex] = EMPTY_TILE_VALUE
  return nextBoard
}

function countCorrectVisibleTiles(board: BoardState): number {
  return board.reduce((count, tileValue, index) => {
    if (tileValue === EMPTY_TILE_VALUE) {
      return count
    }

    return count + (tileValue === index ? 1 : 0)
  }, 0)
}

function createLoopSequence(): LoopSequence {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    let board = createSolvedBoard()
    let lastMovedValue: number | null = null
    const forward: number[] = []

    while (forward.length < LOOP_MOVE_COUNT) {
      const movableTiles = getMovableTileValues(board, lastMovedValue)
      if (movableTiles.length === 0) {
        break
      }

      const nextTileValue = movableTiles[Math.floor(Math.random() * movableTiles.length)]
      board = applyMove(board, nextTileValue)
      forward.push(nextTileValue)
      lastMovedValue = nextTileValue
    }

    const emptyIndex = board.indexOf(EMPTY_TILE_VALUE)
    const correctVisibleTiles = countCorrectVisibleTiles(board)
    if (
      forward.length >= LOOP_MOVE_COUNT
      && emptyIndex !== EMPTY_TILE_VALUE
      && correctVisibleTiles <= MAX_CORRECT_VISIBLE_TILES
    ) {
      return {
        forward,
        backward: [...forward].reverse(),
        scrambledBoard: board,
      }
    }
  }

  let fallbackLastMovedValue: number | null = null
  const fallbackMoves: number[] = []
  let fallbackBoard = createSolvedBoard()

  while (fallbackMoves.length < 16) {
    const movableTiles = getMovableTileValues(fallbackBoard, fallbackLastMovedValue)
    const nextTileValue = movableTiles[fallbackMoves.length % movableTiles.length]
    fallbackMoves.push(nextTileValue)
    fallbackBoard = applyMove(fallbackBoard, nextTileValue)
    fallbackLastMovedValue = nextTileValue
  }

  return {
    forward: fallbackMoves,
    backward: [...fallbackMoves].reverse(),
    scrambledBoard: fallbackBoard,
  }
}

function escapeImageUrl(source: string): string {
  return source.replace(/(["\\])/g, '\\$1')
}

function getTileTransformStyle(row: number, col: number): CSSProperties {
  return {
    transform: `translate(${col * 100}%, ${row * 100}%)`,
  }
}

export default function StartScreenAnimatedBoard({ imageSrc }: StartScreenAnimatedBoardProps) {
  const [board, setBoard] = useState<BoardState>(() => createSolvedBoard())
  const [activeTileValue, setActiveTileValue] = useState<number | null>(null)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [isDocumentVisible, setIsDocumentVisible] = useState(() => (
    typeof document === 'undefined' ? true : !document.hidden
  ))

  const moveTimerRef = useRef<number | null>(null)
  const highlightTimerRef = useRef<number | null>(null)
  const loopSequenceRef = useRef<LoopSequence>(createLoopSequence())
  const loopPhaseRef = useRef<LoopPhase>('forward')
  const loopIndexRef = useRef(0)

  const clearMoveTimer = useCallback(() => {
    if (moveTimerRef.current !== null) {
      window.clearTimeout(moveTimerRef.current)
      moveTimerRef.current = null
    }
  }, [])

  const clearHighlightTimer = useCallback(() => {
    if (highlightTimerRef.current !== null) {
      window.clearTimeout(highlightTimerRef.current)
      highlightTimerRef.current = null
    }
  }, [])

  const clearTimers = useCallback(() => {
    clearMoveTimer()
    clearHighlightTimer()
  }, [clearHighlightTimer, clearMoveTimer])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches)
    }

    setPrefersReducedMotion(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const handleVisibilityChange = () => {
      setIsDocumentVisible(!document.hidden)
    }

    handleVisibilityChange()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    clearTimers()
    const nextSequence = createLoopSequence()
    loopSequenceRef.current = nextSequence
    loopPhaseRef.current = 'backward'
    loopIndexRef.current = 0
    setBoard(nextSequence.scrambledBoard)
    setActiveTileValue(null)
  }, [clearTimers, imageSrc])

  useEffect(() => {
    return () => {
      clearTimers()
    }
  }, [clearTimers])

  useEffect(() => {
    clearTimers()

    if (prefersReducedMotion || !isDocumentVisible) {
      setActiveTileValue(null)
      return
    }

    const scheduleNextMove = (delay: number) => {
      clearMoveTimer()
      moveTimerRef.current = window.setTimeout(() => {
        const activeSequence = loopPhaseRef.current === 'forward'
          ? loopSequenceRef.current.forward
          : loopSequenceRef.current.backward

        if (loopIndexRef.current >= activeSequence.length) {
          setActiveTileValue(null)

          if (loopPhaseRef.current === 'forward') {
            loopPhaseRef.current = 'backward'
            loopIndexRef.current = 0
            scheduleNextMove(PHASE_PAUSE_MS)
            return
          }

          loopSequenceRef.current = createLoopSequence()
          loopPhaseRef.current = 'forward'
          loopIndexRef.current = 0
          scheduleNextMove(PHASE_PAUSE_MS)
          return
        }

        const tileValue = activeSequence[loopIndexRef.current]
        loopIndexRef.current += 1
        setActiveTileValue(tileValue)
        setBoard((currentBoard) => applyMove(currentBoard, tileValue))

        clearHighlightTimer()
        highlightTimerRef.current = window.setTimeout(() => {
          setActiveTileValue((currentTileValue) => (currentTileValue === tileValue ? null : currentTileValue))
        }, MOVE_DURATION_MS)

        scheduleNextMove(MOVE_INTERVAL_MS)
      }, delay)
    }

    scheduleNextMove(INITIAL_PAUSE_MS)

    return () => {
      clearTimers()
    }
  }, [clearHighlightTimer, clearMoveTimer, clearTimers, imageSrc, isDocumentVisible, prefersReducedMotion])

  const imageUrl = `url("${escapeImageUrl(imageSrc)}")`
  const emptyTileIndex = board.indexOf(EMPTY_TILE_VALUE)
  const emptyTilePosition = getCoordinates(emptyTileIndex)

  return (
    <div
      className="start-screen-animated-board"
      role="img"
      aria-label="Animierte Vorschau eines 4x4-Schiebepuzzles"
    >
      <div className="start-screen-animated-board-surface">
        <div className="start-screen-animated-board-grid">
          <div
            className="start-screen-animated-board-empty"
            style={getTileTransformStyle(emptyTilePosition.row, emptyTilePosition.col)}
            aria-hidden="true"
          />

          {Array.from({ length: EMPTY_TILE_VALUE }, (_, tileValue) => {
            const tileIndex = board.indexOf(tileValue)
            const currentPosition = getCoordinates(tileIndex)
            const correctPosition = getCoordinates(tileValue)

            const tileStyle: CSSProperties = {
              ...getTileTransformStyle(currentPosition.row, currentPosition.col),
              backgroundImage: imageUrl,
              backgroundPosition: `${(correctPosition.col / (GRID_SIZE - 1)) * 100}% ${(correctPosition.row / (GRID_SIZE - 1)) * 100}%`,
              backgroundSize: `${GRID_SIZE * 100}% ${GRID_SIZE * 100}%`,
            }

            return (
              <div
                key={tileValue}
                className={[
                  'start-screen-animated-board-tile',
                  activeTileValue === tileValue ? 'is-active' : '',
                ].filter(Boolean).join(' ')}
                style={tileStyle}
                aria-hidden="true"
              />
            )
          })}

          <div className="start-screen-animated-board-overlay" aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}
