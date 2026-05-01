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
  title: string
  body: string
  reason: string
  focusLabel: string
  anchorLabel: string
  stabilityLabel: string
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

  getContextHint(state: PuzzleState, hintedTileId: string | null = null): PuzzleContextHint {
    const totalTiles = Math.max(0, this.tileCount - 1)
    const correctTiles = state.tiles.reduce((count, tile) => {
      if (tile.isEmpty) return count
      return count + (tile.row === tile.correctRow && tile.col === tile.correctCol ? 1 : 0)
    }, 0)
    const remainingTiles = Math.max(0, totalTiles - correctTiles)
    const solvedPrefixCount = this.getSolvedPrefixCount(state)
    const stabilityLabel = solvedPrefixCount > 0 ? `${solvedPrefixCount} Kacheln stabil` : 'Kein Block gesichert'

    if (remainingTiles === 0) {
      return {
        title: 'Runde kontrolliert abschliessen',
        body: 'Alle Kacheln sitzen bereits richtig. Halte das Brett ruhig und bringe den Lauf zu Ende.',
        reason: 'Weil keine offene Kachel mehr uebrig ist.',
        focusLabel: 'Fokus Zielbild',
        anchorLabel: 'Alle Kacheln korrekt',
        stabilityLabel: `${totalTiles} Kacheln stabil`,
      }
    }

    const targetTile = this.getContextTargetTile(state, hintedTileId)
    if (!targetTile) {
      return {
        title: 'Behalte den naechsten Block im Blick',
        body: 'Ordne das Brett kontrolliert weiter und halte bereits korrekte Kacheln moeglichst stabil.',
        reason: `Weil noch ${this.formatTileCount(remainingTiles, 'offene Kachel', 'offene Kacheln')} auf dem Brett liegen.`,
        focusLabel: 'Fokus Gesamtbild',
        anchorLabel: 'Ziel naechster Block',
        stabilityLabel,
      }
    }

    const tileLabel = `Kachel ${targetTile.correctIndex + 1}`
    const targetRowLabel = `Reihe ${targetTile.correctRow + 1}`
    const targetColLabel = `Spalte ${targetTile.correctCol + 1}`
    const rowOpenTiles = this.getOpenTilesForCorrectRow(state, targetTile.correctRow)
    const colOpenTiles = this.getOpenTilesForCorrectCol(state, targetTile.correctCol)
    const finalBlockThreshold = Math.max(2, Math.min(this.config.rows, this.config.cols) - 1)
    const focusLabel =
      remainingTiles <= finalBlockThreshold
        ? 'Fokus Schlussblock'
        : targetTile.correctRow === 0
          ? 'Fokus obere Reihe'
          : targetTile.correctCol === 0
            ? 'Fokus linke Spalte'
            : targetTile.correctRow >= this.config.rows - 2 && targetTile.correctCol >= this.config.cols - 2
              ? 'Fokus unten rechts'
              : targetTile.correctRow >= this.config.rows - 2
                ? `Fokus ${targetRowLabel}`
                : targetTile.correctCol >= this.config.cols - 2
                  ? `Fokus ${targetColLabel}`
                  : 'Fokus Mittelblock'
    const { title, body } = this.buildContextActionCopy(state, targetTile)
    let reason: string

    if (remainingTiles <= finalBlockThreshold) {
      reason = `Weil im Schlussblock nur noch ${this.formatTileCount(remainingTiles, 'offene Kachel', 'offene Kacheln')} fehlen.`
    } else if (targetTile.correctRow === 0) {
      reason = `Weil ${targetRowLabel} noch ${this.formatTileCount(rowOpenTiles, 'offene Kachel', 'offene Kacheln')} hat.`
    } else if (targetTile.correctCol === 0) {
      reason = `Weil ${targetColLabel} noch ${this.formatTileCount(colOpenTiles, 'offene Kachel', 'offene Kacheln')} hat und die obere Reihe stabil bleiben soll.`
    } else if (targetTile.correctRow >= this.config.rows - 2 && targetTile.correctCol >= this.config.cols - 2) {
      const openTilesInFinalBlock = this.getOpenTilesInLowerRightBlock(state)
      reason = `Weil unten rechts noch ${this.formatTileCount(openTilesInFinalBlock, 'offene Kachel', 'offene Kacheln')} auf den Schlussblock warten.`
    } else if (targetTile.correctRow >= this.config.rows - 2) {
      reason = `Weil ${targetRowLabel} noch ${this.formatTileCount(rowOpenTiles, 'offene Kachel', 'offene Kacheln')} hat.`
    } else if (targetTile.correctCol >= this.config.cols - 2) {
      reason = `Weil ${targetColLabel} noch ${this.formatTileCount(colOpenTiles, 'offene Kachel', 'offene Kacheln')} hat.`
    } else {
      const middleBlockPressure = Math.max(rowOpenTiles, colOpenTiles)
      reason = `Weil im Mittelblock rund um ${tileLabel} noch ${this.formatTileCount(middleBlockPressure, 'offene Kachel', 'offene Kacheln')} Anschluss brauchen.`
    }

    return {
      title,
      body,
      reason,
      focusLabel,
      anchorLabel: `Ziel ${tileLabel}`,
      stabilityLabel,
    }
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

  private getSolvedPrefixCount(state: PuzzleState): number {
    let count = 0
    for (let index = 0; index < state.board.length - 1; index++) {
      if (state.board[index] !== index) break
      count += 1
    }
    return count
  }

  private buildContextActionCopy(state: PuzzleState, targetTile: Tile): Pick<PuzzleContextHint, 'title' | 'body'> {
    const tileLabel = `Kachel ${targetTile.correctIndex + 1}`
    const targetRowLabel = `Reihe ${targetTile.correctRow + 1}`
    const targetColLabel = `Spalte ${targetTile.correctCol + 1}`
    const tilePositionLabel = this.formatGridPosition(targetTile.row, targetTile.col)
    const emptyPositionLabel = this.formatGridPosition(state.emptyRow, state.emptyCol)
    const tileDistance = Math.abs(targetTile.correctRow - targetTile.row) + Math.abs(targetTile.correctCol - targetTile.col)
    const emptyDistance = Math.abs(state.emptyRow - targetTile.row) + Math.abs(state.emptyCol - targetTile.col)
    const isMovable = this.canMoveTile(state, targetTile.id)
    const isRowAligned = targetTile.row === targetTile.correctRow
    const isColAligned = targetTile.col === targetTile.correctCol

    if (tileDistance === 0) {
      return {
        title: `Nutze ${tileLabel} als Anker`,
        body: `${tileLabel} sitzt schon richtig. Halte sie stabil und sortiere das Umfeld weiter kontrolliert aus.`,
      }
    }

    if (isMovable) {
      if (!isRowAligned) {
        return {
          title: `Ziehe ${tileLabel} Richtung ${targetRowLabel}`,
          body: `${tileLabel} ist sofort spielbar. Nutze den direkten Zugriff und verkuerze den Weg aus ${tilePositionLabel} weiter nach oben oder unten, bis ${targetRowLabel} sitzt.`,
        }
      }

      if (!isColAligned) {
        return {
          title: `Richte ${tileLabel} an ${targetColLabel} aus`,
          body: `${tileLabel} ist bereits in der richtigen Reihe. Nutze den aktuellen Zugriff, um jetzt die Spaltenposition ohne Umweg zu stabilisieren.`,
        }
      }

      return {
        title: `Nutze den Zugriff auf ${tileLabel}`,
        body: `${tileLabel} liegt guenstig. Spiele den naechsten Zug so, dass der Weg zum Ziel ruhig bleibt und keine gesicherten Kacheln aufbrechen.`,
      }
    }

    if (emptyDistance <= 1) {
      return {
        title: `Oeffne den Weg fuer ${tileLabel}`,
        body: `Das Leerfeld liegt schon direkt an ${tileLabel}. Drehe nur den nahen Bereich, damit der naechste Zugriff ${targetRowLabel} und ${targetColLabel} vorbereitet.`,
      }
    }

    if (emptyDistance === 2) {
      return {
        title: `Hole das Leerfeld an ${tileLabel}`,
        body: `Das Leerfeld braucht nur noch einen kurzen Umweg. Fuehre es von ${emptyPositionLabel} an ${tilePositionLabel} heran und richte dann ${tileLabel} weiter aus.`,
      }
    }

    return {
      title: `Bereite ${tileLabel} vor`,
      body: `${tileLabel} steht aktuell in ${tilePositionLabel}. Hole zuerst das Leerfeld aus ${emptyPositionLabel} in ihre Naehe, bevor du ${targetRowLabel} und ${targetColLabel} weiter sortierst.`,
    }
  }

  private getContextTargetTile(state: PuzzleState, hintedTileId: string | null): Tile | null {
    if (hintedTileId) {
      const hintedTile = this.getTileById(state, hintedTileId)
      if (hintedTile && !hintedTile.isEmpty) {
        return hintedTile
      }
    }

    for (const tile of state.tiles) {
      if (tile.isEmpty) continue
      if (tile.row !== tile.correctRow || tile.col !== tile.correctCol) {
        return tile
      }
    }

    return null
  }

  private getOpenTilesForCorrectRow(state: PuzzleState, row: number): number {
    return state.tiles.reduce((count, tile) => {
      if (tile.isEmpty || tile.correctRow !== row) return count
      return count + (tile.row === tile.correctRow && tile.col === tile.correctCol ? 0 : 1)
    }, 0)
  }

  private getOpenTilesForCorrectCol(state: PuzzleState, col: number): number {
    return state.tiles.reduce((count, tile) => {
      if (tile.isEmpty || tile.correctCol !== col) return count
      return count + (tile.row === tile.correctRow && tile.col === tile.correctCol ? 0 : 1)
    }, 0)
  }

  private getOpenTilesInLowerRightBlock(state: PuzzleState): number {
    const minRow = Math.max(0, this.config.rows - 2)
    const minCol = Math.max(0, this.config.cols - 2)

    return state.tiles.reduce((count, tile) => {
      if (tile.isEmpty) return count
      if (tile.correctRow < minRow || tile.correctCol < minCol) return count
      return count + (tile.row === tile.correctRow && tile.col === tile.correctCol ? 0 : 1)
    }, 0)
  }

  private formatGridPosition(row: number, col: number): string {
    return `Reihe ${row + 1}, Spalte ${col + 1}`
  }

  private formatTileCount(count: number, singular: string, plural: string): string {
    const safeCount = Math.max(0, count)
    return `${safeCount} ${safeCount === 1 ? singular : plural}`
  }
}

