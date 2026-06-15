import { type GhostPreviewMode, type HeatmapMode, PuzzleConfig, PuzzleState, Tile, TileMoveAnimation } from '../types/index'

const CANVAS_FONT_FAMILY = "'Puzzle UI', 'Segoe UI', sans-serif"

export interface HintOverlay {
  tileId: string
  direction: 'up' | 'down' | 'left' | 'right'
  finalTargetRow: number
  finalTargetCol: number
}

export interface CorrectTilePulseAnimation {
  tileId: string
  progress: number
}

export interface TileSearchOverlay {
  tileId: string
}

export interface InvalidTileFeedbackAnimation {
  tileId: string
  progress: number
}

export interface HeatmapOverlayOptions {
  mode: HeatmapMode
  intensity: number
  showDistances: boolean
  tileDeltas?: Readonly<Record<string, number>>
  tilePotentials?: Readonly<Record<string, number>>
  bestPotentialTileId?: string
  pathStepByTileId?: Readonly<Record<string, number>>
  pathTargetTileId?: string
}

export default class PuzzleRenderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private sourceImage: HTMLImageElement
  private tileWidth: number
  private tileHeight: number
  private logicalWidth: number
  private logicalHeight: number
  private dpr: number
  private ghostPreviewCache: {
    width: number
    height: number
    contours: HTMLCanvasElement | null
    edges: HTMLCanvasElement | null
  } | null

  constructor(canvas: HTMLCanvasElement, config: PuzzleConfig, imageSrc: string, imageRatio: number) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas context not available')
    this.ctx = ctx

    this.tileWidth = 0
    this.tileHeight = 0
    this.logicalWidth = 0
    this.logicalHeight = 0
    this.dpr = 1
    this.ghostPreviewCache = null

    const fallbackWidth = Math.max(320, Math.min(920, window.innerWidth - 80))
    const fallbackHeight = Math.max(180, Math.round(fallbackWidth / imageRatio))
    this.resize(fallbackWidth, fallbackHeight, config)

    this.sourceImage = new Image()
    this.sourceImage.crossOrigin = 'anonymous'
    this.sourceImage.decoding = 'async'
    this.sourceImage.addEventListener('load', () => {
      this.invalidateGhostPreviewCache()
    })
    this.sourceImage.src = imageSrc
  }

  resize(displayWidth: number, displayHeight: number, config: PuzzleConfig): void {
    const nextWidth = Math.max(60, Math.round(displayWidth))
    const nextHeight = Math.max(60, Math.round(displayHeight))
    const nextDpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2))
    const sizeChanged = this.logicalWidth !== nextWidth || this.logicalHeight !== nextHeight

    this.logicalWidth = nextWidth
    this.logicalHeight = nextHeight
    this.dpr = nextDpr
    this.canvas.width = Math.max(1, Math.round(nextWidth * nextDpr))
    this.canvas.height = Math.max(1, Math.round(nextHeight * nextDpr))
    this.ctx.setTransform(nextDpr, 0, 0, nextDpr, 0, 0)
    this.tileWidth = nextWidth / config.cols
    this.tileHeight = nextHeight / config.rows

    if (sizeChanged) {
      this.invalidateGhostPreviewCache()
    }
  }

  render(
    state: PuzzleState,
    moveAnimation: TileMoveAnimation | null = null,
    correctTilePulse: CorrectTilePulseAnimation | null = null,
    tileSearchOverlay: TileSearchOverlay | null = null,
    hintOverlay: HintOverlay | null = null,
    showTileNumbers: boolean = false,
    tileNumberCorrectnessPulseProgress: number | null = null,
    showGhostPreview: boolean = false,
    ghostPreviewWeight: number = 0.56,
    ghostPreviewMode: GhostPreviewMode = 'image',
    heatmapOverlay: HeatmapOverlayOptions | null = null,
    invalidTileFeedback: InvalidTileFeedbackAnimation | null = null,
    hoveredTileId: string | null = null
  ): void {
    if (this.logicalWidth <= 0 || this.logicalHeight <= 0) return

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight)
    this.ctx.fillStyle = '#f5f5f5'
    this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight)

    const animatedTileId = moveAnimation?.tileId ?? null
    const invalidTileId = invalidTileFeedback?.tileId ?? null
    let invalidFeedbackTile: Tile | null = null
    state.tiles.forEach((tile) => {
      if (tile.id === animatedTileId) return
      if (tile.id === invalidTileId) {
        invalidFeedbackTile = tile
        return
      }

      this.renderTile(tile, state, showTileNumbers, tileNumberCorrectnessPulseProgress, hoveredTileId)
    })

    if (moveAnimation) {
      this.renderAnimatedTile(state, moveAnimation, showTileNumbers, tileNumberCorrectnessPulseProgress)
    }

    if (showGhostPreview) {
      this.renderGhostPreviewOverlay(state, ghostPreviewWeight, ghostPreviewMode)
    } else if (heatmapOverlay) {
      this.renderHeatmapOverlay(state, moveAnimation, heatmapOverlay)
    }

    if (invalidFeedbackTile) {
      this.renderTile(
        invalidFeedbackTile,
        state,
        showTileNumbers,
        tileNumberCorrectnessPulseProgress,
        hoveredTileId,
        invalidTileFeedback
      )
    }

    if (tileSearchOverlay && tileSearchOverlay.tileId !== animatedTileId) {
      this.renderTileSearchOverlay(state, tileSearchOverlay)
    }

    if (hintOverlay && hintOverlay.tileId !== animatedTileId) {
      this.renderHintOverlay(state, hintOverlay)
    }

    if (correctTilePulse && correctTilePulse.tileId !== animatedTileId) {
      this.renderCorrectTilePulse(state, correctTilePulse)
    }

    if (tileSearchOverlay && tileSearchOverlay.tileId === animatedTileId && moveAnimation) {
      this.renderAnimatedTileSearchOverlay(state, moveAnimation)
    }

    if (showTileNumbers) {
      this.renderTileNumbers(state, moveAnimation, tileNumberCorrectnessPulseProgress)
    }

    const shouldHideCorrectTileCheckmarks =
      showGhostPreview
      || heatmapOverlay !== null
      || showTileNumbers

    const blockedCheckmarkTileIds = new Set<string>()
    if (tileSearchOverlay) {
      blockedCheckmarkTileIds.add(tileSearchOverlay.tileId)
    }
    if (hintOverlay) {
      blockedCheckmarkTileIds.add(hintOverlay.tileId)
    }
    if (correctTilePulse) {
      blockedCheckmarkTileIds.add(correctTilePulse.tileId)
    }
    if (invalidTileFeedback) {
      blockedCheckmarkTileIds.add(invalidTileFeedback.tileId)
    }

    if (!shouldHideCorrectTileCheckmarks) {
      this.renderCorrectTileCheckmarks(state, moveAnimation, blockedCheckmarkTileIds)
    }
  }

  private renderCorrectTilePulse(state: PuzzleState, correctTilePulse: CorrectTilePulseAnimation): void {
    const tile = state.tiles.find((entry) => entry.id === correctTilePulse.tileId)
    if (!tile || tile.isEmpty) return
    if (tile.row !== tile.correctRow || tile.col !== tile.correctCol) return

    const progress = Math.max(0, Math.min(1, correctTilePulse.progress))
    const fade = 1 - progress
    if (fade <= 0) return

    const easedProgress = this.easeOutCubic(progress)
    const x = tile.col * this.tileWidth
    const y = tile.row * this.tileHeight
    const shortEdge = Math.min(this.tileWidth, this.tileHeight)
    const spread = shortEdge * 0.16 * easedProgress
    const outlineSpread = spread + Math.max(2, Math.round(shortEdge * 0.03))
    const outerLineWidth = Math.max(4, Math.round(shortEdge * 0.055))
    const outlineLineWidth = outerLineWidth + Math.max(2, Math.round(shortEdge * 0.02))
    const innerLineWidth = Math.max(2, Math.round(shortEdge * 0.024))
    const innerInset = Math.max(3, Math.round(shortEdge * 0.04))
    const fillAlpha = 0.28 * Math.pow(fade, 0.78)
    const outlineAlpha = 0.74 * Math.pow(fade, 0.82)
    const outerAlpha = 0.98 * Math.pow(fade, 0.68)
    const innerAlpha = 0.7 * Math.pow(fade, 0.9)

    this.ctx.save()
    this.ctx.fillStyle = `rgba(255, 255, 255, ${fillAlpha})`
    this.ctx.fillRect(x, y, this.tileWidth, this.tileHeight)

    this.ctx.strokeStyle = `rgba(2, 6, 23, ${outlineAlpha})`
    this.ctx.lineWidth = outlineLineWidth
    this.ctx.strokeRect(
      x - outlineSpread + outlineLineWidth / 2,
      y - outlineSpread + outlineLineWidth / 2,
      this.tileWidth + outlineSpread * 2 - outlineLineWidth,
      this.tileHeight + outlineSpread * 2 - outlineLineWidth
    )

    this.ctx.shadowColor = `rgba(255, 255, 255, ${0.88 * fade})`
    this.ctx.shadowBlur = Math.max(16, Math.round(shortEdge * 0.34))
    this.ctx.strokeStyle = `rgba(255, 255, 255, ${outerAlpha})`
    this.ctx.lineWidth = outerLineWidth
    this.ctx.strokeRect(
      x - spread + outerLineWidth / 2,
      y - spread + outerLineWidth / 2,
      this.tileWidth + spread * 2 - outerLineWidth,
      this.tileHeight + spread * 2 - outerLineWidth
    )

    this.ctx.shadowBlur = 0
    this.ctx.strokeStyle = `rgba(15, 23, 42, ${innerAlpha})`
    this.ctx.lineWidth = innerLineWidth
    this.ctx.strokeRect(
      x + innerInset + innerLineWidth / 2,
      y + innerInset + innerLineWidth / 2,
      this.tileWidth - innerInset * 2 - innerLineWidth,
      this.tileHeight - innerInset * 2 - innerLineWidth
    )

    this.renderCorrectTilePulseLabel(x, y, fade)
    this.ctx.restore()
  }

  private renderCorrectTilePulseLabel(x: number, y: number, fade: number): void {
    const label = 'Position korrekt'
    const shortEdge = Math.min(this.tileWidth, this.tileHeight)
    const horizontalInset = Math.max(6, Math.round(this.tileWidth * 0.08))
    const verticalInset = Math.max(6, Math.round(this.tileHeight * 0.08))
    const badgePaddingX = Math.max(8, Math.round(shortEdge * 0.08))
    const badgePaddingY = Math.max(4, Math.round(shortEdge * 0.05))
    const maxBadgeWidth = Math.max(52, this.tileWidth - horizontalInset * 2)
    const maxBadgeHeight = Math.max(20, this.tileHeight - verticalInset * 2)
    let fontSize = Math.max(
      8,
      Math.min(
        18,
        Math.round(shortEdge * 0.17),
        Math.round(this.tileHeight * 0.24)
      )
    )

    this.ctx.font = `700 ${fontSize}px ${CANVAS_FONT_FAMILY}`
    while (fontSize > 8 && this.ctx.measureText(label).width > maxBadgeWidth - badgePaddingX * 2) {
      fontSize -= 1
      this.ctx.font = `700 ${fontSize}px ${CANVAS_FONT_FAMILY}`
    }

    const textWidth = this.ctx.measureText(label).width
    const badgeWidth = Math.min(maxBadgeWidth, Math.max(textWidth + badgePaddingX * 2, 44))
    const badgeHeight = Math.min(maxBadgeHeight, Math.max(fontSize + badgePaddingY * 2, 18))
    const badgeX = x + (this.tileWidth - badgeWidth) / 2
    const badgeY = y + (this.tileHeight - badgeHeight) / 2

    this.ctx.save()
    this.ctx.shadowColor = `rgba(255, 255, 255, ${0.24 * fade})`
    this.ctx.shadowBlur = Math.max(6, Math.round(shortEdge * 0.12))
    this.ctx.fillStyle = `rgba(0, 0, 0, ${0.9 * Math.pow(fade, 0.72)})`
    this.ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 * Math.pow(fade, 0.9)})`
    this.ctx.lineWidth = 1
    this.ctx.beginPath()
    this.ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, Math.max(6, Math.round(badgeHeight * 0.35)))
    this.ctx.fill()
    this.ctx.shadowBlur = 0
    this.ctx.stroke()

    this.ctx.font = `700 ${fontSize}px ${CANVAS_FONT_FAMILY}`
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    this.ctx.fillStyle = `rgba(255, 255, 255, ${0.98 * Math.pow(fade, 0.6)})`
    this.ctx.fillText(label, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2)
    this.ctx.restore()
  }

  private renderAnimatedTile(
    state: PuzzleState,
    moveAnimation: TileMoveAnimation,
    showTileNumbers: boolean,
    tileNumberCorrectnessPulseProgress: number | null
  ): void {
    const tile = state.tiles.find((entry) => entry.id === moveAnimation.tileId)
    if (!tile || tile.isEmpty) return

    const progress = Math.max(0, Math.min(1, moveAnimation.progress))
    const easedProgress = this.easeOutQuart(progress)
    const startX = moveAnimation.fromCol * this.tileWidth
    const startY = moveAnimation.fromRow * this.tileHeight
    const targetX = moveAnimation.toCol * this.tileWidth
    const targetY = moveAnimation.toRow * this.tileHeight
    const x = startX + (targetX - startX) * easedProgress
    const y = startY + (targetY - startY) * easedProgress
    const lift = Math.sin(progress * Math.PI)
    const settleProgress = Math.max(0, Math.min(1, (progress - 0.7) / 0.3))
    const settleSnap = Math.sin(settleProgress * Math.PI) * 0.024
    const scale = 1 + lift * 0.05 - settleSnap
    const centerX = x + this.tileWidth / 2
    const centerY = y + this.tileHeight / 2

    this.renderMoveTargetGlow(targetX, targetY, progress)
    this.ctx.save()
    this.ctx.translate(centerX, centerY)
    this.ctx.scale(scale, scale)
    this.ctx.shadowColor = `rgba(15, 23, 42, ${0.26 + lift * 0.24})`
    this.ctx.shadowBlur = Math.max(14, Math.round(Math.min(this.tileWidth, this.tileHeight) * (0.14 + lift * 0.2)))
    this.ctx.shadowOffsetY = Math.max(5, Math.round(Math.min(this.tileWidth, this.tileHeight) * (0.045 + lift * 0.065)))
    this.drawTileImage(tile, -this.tileWidth / 2, -this.tileHeight / 2)

    this.ctx.shadowBlur = 0
    this.ctx.shadowOffsetY = 0
    this.ctx.strokeStyle = 'rgba(15, 23, 42, 0.82)'
    this.ctx.lineWidth = Math.max(2, Math.round(Math.min(this.tileWidth, this.tileHeight) * 0.018))
    this.ctx.strokeRect(-this.tileWidth / 2, -this.tileHeight / 2, this.tileWidth, this.tileHeight)
    this.ctx.strokeStyle = `rgba(248, 250, 252, ${0.26 + lift * 0.26})`
    this.ctx.lineWidth = Math.max(1, Math.round(Math.min(this.tileWidth, this.tileHeight) * 0.01))
    this.ctx.strokeRect(
      -this.tileWidth / 2 + 2,
      -this.tileHeight / 2 + 2,
      this.tileWidth - 4,
      this.tileHeight - 4
    )

    if (showTileNumbers) {
      this.renderTileNumberCorrectnessOverlay(
        tile,
        -this.tileWidth / 2,
        -this.tileHeight / 2,
        tileNumberCorrectnessPulseProgress
      )
    }
    this.ctx.restore()
  }

  private renderMoveTargetGlow(x: number, y: number, progress: number): void {
    const shortEdge = Math.min(this.tileWidth, this.tileHeight)
    const pulse = Math.sin(Math.max(0, Math.min(1, progress)) * Math.PI)
    const inset = Math.max(5, Math.round(shortEdge * 0.06))
    const lineWidth = Math.max(2, Math.round(shortEdge * 0.026))

    this.ctx.save()
    this.ctx.fillStyle = `rgba(34, 197, 94, ${0.08 + pulse * 0.16})`
    this.ctx.fillRect(x + inset, y + inset, this.tileWidth - inset * 2, this.tileHeight - inset * 2)
    this.ctx.shadowColor = `rgba(34, 197, 94, ${0.22 + pulse * 0.34})`
    this.ctx.shadowBlur = Math.max(14, Math.round(shortEdge * (0.18 + pulse * 0.24)))
    this.ctx.strokeStyle = `rgba(187, 247, 208, ${0.36 + pulse * 0.52})`
    this.ctx.lineWidth = lineWidth
    this.ctx.strokeRect(
      x + inset + lineWidth / 2,
      y + inset + lineWidth / 2,
      this.tileWidth - inset * 2 - lineWidth,
      this.tileHeight - inset * 2 - lineWidth
    )
    this.ctx.restore()
  }

  private renderTile(
    tile: Tile,
    state: PuzzleState,
    showTileNumbers: boolean,
    tileNumberCorrectnessPulseProgress: number | null,
    hoveredTileId: string | null = null,
    invalidTileFeedback: InvalidTileFeedbackAnimation | null = null
  ): void {
    const x = tile.col * this.tileWidth
    const y = tile.row * this.tileHeight

    if (tile.isEmpty) {
      this.renderEmptyTile(x, y)
      return
    }

    const invalidFeedbackMetrics = invalidTileFeedback
      ? this.getInvalidTileFeedbackMetrics(invalidTileFeedback.progress)
      : null
    const drawX = x + (invalidFeedbackMetrics?.offsetX ?? 0)

    this.drawTileImage(tile, drawX, y)

    this.ctx.strokeStyle = '#888'
    this.ctx.lineWidth = 1
    this.ctx.strokeRect(drawX, y, this.tileWidth, this.tileHeight)

    const emptyRow = state.emptyRow
    const emptyCol = state.emptyCol
    const isMovable =
      (Math.abs(tile.row - emptyRow) === 1 && tile.col === emptyCol) ||
      (Math.abs(tile.col - emptyCol) === 1 && tile.row === emptyRow)

    if (isMovable && !tile.isDragging) {
      const isHovered = hoveredTileId === tile.id
      if (isHovered) {
        this.renderMovableHoverGlow(drawX, y)
      } else {
        this.ctx.strokeStyle = '#667eea'
        this.ctx.lineWidth = 3
        this.ctx.strokeRect(drawX + 1, y + 1, this.tileWidth - 2, this.tileHeight - 2)
      }
    }

    if (tile.isDragging) {
      this.ctx.fillStyle = 'rgba(102, 126, 234, 0.3)'
      this.ctx.fillRect(drawX, y, this.tileWidth, this.tileHeight)
    }

    if (invalidFeedbackMetrics) {
      this.renderInvalidTileFeedback(drawX, y, invalidFeedbackMetrics)
    }

    if (showTileNumbers) {
      this.renderTileNumberCorrectnessOverlay(tile, drawX, y, tileNumberCorrectnessPulseProgress)
    }
  }

  private renderCorrectTileCheckmarks(
    state: PuzzleState,
    moveAnimation: TileMoveAnimation | null,
    blockedTileIds: ReadonlySet<string>
  ): void {
    const animatedTileId = moveAnimation?.tileId ?? null

    state.tiles.forEach((tile) => {
      if (tile.isEmpty) return
      if (tile.row !== tile.correctRow || tile.col !== tile.correctCol) return
      if (blockedTileIds.has(tile.id)) return

      if (moveAnimation && tile.id === animatedTileId) {
        if (moveAnimation.progress < 0.995) return
        this.renderCorrectTileCheckmark(
          moveAnimation.toCol * this.tileWidth,
          moveAnimation.toRow * this.tileHeight
        )
        return
      }

      this.renderCorrectTileCheckmark(tile.col * this.tileWidth, tile.row * this.tileHeight)
    })
  }

  private renderCorrectTileCheckmark(x: number, y: number): void {
    const shortEdge = Math.min(this.tileWidth, this.tileHeight)
    const badgeSize = Math.max(16, Math.round(shortEdge * 0.18))
    const inset = Math.max(6, Math.round(shortEdge * 0.07))
    const centerX = x + this.tileWidth - inset - badgeSize / 2
    const centerY = y + this.tileHeight - inset - badgeSize / 2
    const radius = badgeSize / 2

    this.ctx.save()
    this.ctx.shadowColor = 'rgba(22, 163, 74, 0.36)'
    this.ctx.shadowBlur = Math.max(6, Math.round(shortEdge * 0.14))
    this.ctx.fillStyle = 'rgba(22, 163, 74, 0.96)'
    this.ctx.strokeStyle = 'rgba(220, 252, 231, 0.94)'
    this.ctx.lineWidth = Math.max(1.2, shortEdge * 0.018)
    this.ctx.beginPath()
    this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    this.ctx.fill()
    this.ctx.shadowBlur = 0
    this.ctx.stroke()

    this.ctx.strokeStyle = '#ffffff'
    this.ctx.lineWidth = Math.max(2, shortEdge * 0.03)
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'
    this.ctx.beginPath()
    this.ctx.moveTo(centerX - badgeSize * 0.22, centerY + badgeSize * 0.02)
    this.ctx.lineTo(centerX - badgeSize * 0.05, centerY + badgeSize * 0.2)
    this.ctx.lineTo(centerX + badgeSize * 0.24, centerY - badgeSize * 0.17)
    this.ctx.stroke()
    this.ctx.restore()
  }

  isTileMovable(state: PuzzleState, tileId: string | null): boolean {
    if (!tileId) return false
    const tile = state.tiles.find((entry) => entry.id === tileId)
    if (!tile || tile.isEmpty) return false
    return (
      (Math.abs(tile.row - state.emptyRow) === 1 && tile.col === state.emptyCol) ||
      (Math.abs(tile.col - state.emptyCol) === 1 && tile.row === state.emptyRow)
    )
  }

  private renderMovableHoverGlow(x: number, y: number): void {
    const shortEdge = Math.min(this.tileWidth, this.tileHeight)
    const outerInset = 1
    const innerInset = Math.max(4, Math.round(shortEdge * 0.05))
    const outerLineWidth = Math.max(3, Math.round(shortEdge * 0.035))
    const innerLineWidth = Math.max(1.5, Math.round(shortEdge * 0.018))

    this.ctx.save()

    // Subtle fill overlay
    this.ctx.fillStyle = 'rgba(99, 140, 255, 0.1)'
    this.ctx.fillRect(x + outerInset, y + outerInset, this.tileWidth - outerInset * 2, this.tileHeight - outerInset * 2)

    // Outer glow border
    this.ctx.shadowColor = 'rgba(99, 140, 255, 0.48)'
    this.ctx.shadowBlur = Math.max(8, Math.round(shortEdge * 0.14))
    this.ctx.strokeStyle = 'rgba(130, 170, 255, 0.92)'
    this.ctx.lineWidth = outerLineWidth
    this.ctx.strokeRect(
      x + outerInset + outerLineWidth / 2,
      y + outerInset + outerLineWidth / 2,
      this.tileWidth - outerInset * 2 - outerLineWidth,
      this.tileHeight - outerInset * 2 - outerLineWidth
    )

    // Inner highlight stroke
    this.ctx.shadowBlur = 0
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.38)'
    this.ctx.lineWidth = innerLineWidth
    this.ctx.strokeRect(
      x + innerInset + innerLineWidth / 2,
      y + innerInset + innerLineWidth / 2,
      this.tileWidth - innerInset * 2 - innerLineWidth,
      this.tileHeight - innerInset * 2 - innerLineWidth
    )

    this.ctx.restore()
  }

  private getInvalidTileFeedbackMetrics(progress: number): {
    offsetX: number
    fillAlpha: number
    strokeAlpha: number
    glowAlpha: number
    shadowBlur: number
    innerStrokeAlpha: number
  } {
    const clamped = Math.max(0, Math.min(1, progress))
    const shortEdge = Math.min(this.tileWidth, this.tileHeight)
    const pulse = Math.sin(clamped * Math.PI)
    const decay = 1 - clamped
    const offsetAmplitude = Math.max(5, Math.min(14, shortEdge * 0.08))

    return {
      offsetX: Math.sin(clamped * Math.PI * 7.5) * offsetAmplitude * Math.pow(decay, 0.72),
      fillAlpha: 0.04 + pulse * 0.18 * (0.68 + decay * 0.32),
      strokeAlpha: 0.18 + pulse * 0.56,
      glowAlpha: 0.12 + pulse * 0.34,
      shadowBlur: Math.max(10, Math.round(shortEdge * (0.14 + pulse * 0.16))),
      innerStrokeAlpha: 0.12 + pulse * 0.28,
    }
  }

  private renderInvalidTileFeedback(
    x: number,
    y: number,
    metrics: {
      offsetX: number
      fillAlpha: number
      strokeAlpha: number
      glowAlpha: number
      shadowBlur: number
      innerStrokeAlpha: number
    }
  ): void {
    const shortEdge = Math.min(this.tileWidth, this.tileHeight)
    const outerInset = Math.max(2, Math.round(shortEdge * 0.025))
    const innerInset = Math.max(6, Math.round(shortEdge * 0.075))
    const outerLineWidth = Math.max(2, Math.round(shortEdge * 0.032))
    const innerLineWidth = Math.max(1.5, Math.round(shortEdge * 0.018))
    const gradient = this.ctx.createLinearGradient(x, y, x, y + this.tileHeight)

    gradient.addColorStop(0, `rgba(254, 226, 226, ${metrics.fillAlpha * 0.78})`)
    gradient.addColorStop(1, `rgba(220, 38, 38, ${metrics.fillAlpha})`)

    this.ctx.save()
    this.ctx.fillStyle = gradient
    this.ctx.fillRect(x + outerInset, y + outerInset, this.tileWidth - outerInset * 2, this.tileHeight - outerInset * 2)

    this.ctx.shadowColor = `rgba(239, 68, 68, ${metrics.glowAlpha})`
    this.ctx.shadowBlur = metrics.shadowBlur
    this.ctx.strokeStyle = `rgba(254, 202, 202, ${metrics.strokeAlpha})`
    this.ctx.lineWidth = outerLineWidth
    this.ctx.strokeRect(
      x + outerInset + outerLineWidth / 2,
      y + outerInset + outerLineWidth / 2,
      this.tileWidth - outerInset * 2 - outerLineWidth,
      this.tileHeight - outerInset * 2 - outerLineWidth
    )

    this.ctx.shadowBlur = 0
    this.ctx.strokeStyle = `rgba(127, 29, 29, ${metrics.innerStrokeAlpha})`
    this.ctx.lineWidth = innerLineWidth
    this.ctx.strokeRect(
      x + innerInset + innerLineWidth / 2,
      y + innerInset + innerLineWidth / 2,
      this.tileWidth - innerInset * 2 - innerLineWidth,
      this.tileHeight - innerInset * 2 - innerLineWidth
    )

    if (shortEdge >= 48) {
      const label = 'BLOCKIERT'
      const badgeHeight = Math.max(22, Math.round(shortEdge * 0.18))
      const badgePaddingX = Math.max(8, Math.round(shortEdge * 0.08))
      let fontSize = Math.max(10, Math.round(shortEdge * 0.11))

      this.ctx.font = `800 ${fontSize}px ${CANVAS_FONT_FAMILY}`
      while (fontSize > 9 && this.ctx.measureText(label).width > this.tileWidth - badgePaddingX * 4) {
        fontSize -= 1
        this.ctx.font = `800 ${fontSize}px ${CANVAS_FONT_FAMILY}`
      }

      const labelWidth = this.ctx.measureText(label).width
      const badgeWidth = Math.min(this.tileWidth - badgePaddingX * 2, labelWidth + badgePaddingX * 2)
      const badgeX = x + (this.tileWidth - badgeWidth) / 2
      const badgeY = y + (this.tileHeight - badgeHeight) / 2

      this.ctx.fillStyle = `rgba(127, 29, 29, ${0.74 + metrics.glowAlpha * 0.2})`
      this.ctx.strokeStyle = `rgba(254, 226, 226, ${0.34 + metrics.strokeAlpha * 0.26})`
      this.ctx.lineWidth = 1
      this.ctx.beginPath()
      this.ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, badgeHeight / 2)
      this.ctx.fill()
      this.ctx.stroke()
      this.ctx.fillStyle = `rgba(255, 255, 255, ${0.84 + metrics.strokeAlpha * 0.12})`
      this.ctx.font = `800 ${fontSize}px ${CANVAS_FONT_FAMILY}`
      this.ctx.textAlign = 'center'
      this.ctx.textBaseline = 'middle'
      this.ctx.fillText(label, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2)
    }
    this.ctx.restore()
  }

  private renderGhostPreviewOverlay(
    state: PuzzleState,
    ghostPreviewWeight: number,
    ghostPreviewMode: GhostPreviewMode
  ): void {
    const emptyX = state.emptyCol * this.tileWidth
    const emptyY = state.emptyRow * this.tileHeight
    const shortEdge = Math.min(this.tileWidth, this.tileHeight)
    const inset = Math.max(4, Math.round(shortEdge * 0.05))
    const ghostTiles = state.tiles.filter(
      (tile) => tile.isEmpty || tile.row !== tile.correctRow || tile.col !== tile.correctCol
    )

    if (ghostTiles.length === 0) {
      this.renderSolvedTileGhostBadges(state)
      return
    }

    this.ctx.save()
    this.ctx.beginPath()
    ghostTiles.forEach((tile) => {
      const x = tile.col * this.tileWidth
      const y = tile.row * this.tileHeight
      this.ctx.rect(x, y, this.tileWidth, this.tileHeight)
    })
    this.ctx.clip()
    const didRenderOverlay =
      ghostPreviewMode === 'image'
        ? this.renderGhostPreviewImageLayer(ghostPreviewWeight)
        : ghostPreviewMode === 'contours'
          ? this.renderGhostPreviewContourLayer(ghostPreviewWeight)
          : this.renderGhostPreviewEdgeLayer(ghostPreviewWeight)
    this.ctx.restore()

    if (!didRenderOverlay) return

    this.ctx.save()
    this.renderSolvedTileGhostBadges(state)
    this.renderIncorrectTileGhostBadges(state)
    this.ctx.strokeStyle = 'rgba(248, 250, 252, 0.42)'
    this.ctx.lineWidth = Math.max(2, Math.round(shortEdge * 0.02))
    this.ctx.setLineDash([Math.max(6, Math.round(shortEdge * 0.08)), Math.max(5, Math.round(shortEdge * 0.06))])
    this.ctx.strokeRect(
      emptyX + inset,
      emptyY + inset,
      this.tileWidth - inset * 2,
      this.tileHeight - inset * 2
    )
    this.ctx.setLineDash([])
    this.ctx.restore()
  }

  private renderGhostPreviewImageLayer(ghostPreviewWeight: number): boolean {
    if (!this.canDrawSourceImage()) return false

    const clampedWeight = Math.max(0, Math.min(1, ghostPreviewWeight))
    const overlayShadeAlpha = clampedWeight * 0.14

    this.ctx.fillStyle = `rgba(2, 6, 23, ${overlayShadeAlpha})`
    this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight)
    this.ctx.filter = 'grayscale(1) contrast(1.28) brightness(1.08)'
    this.ctx.globalAlpha = clampedWeight

    try {
      this.ctx.drawImage(this.sourceImage, 0, 0, this.logicalWidth, this.logicalHeight)
      return true
    } catch {
      return false
    } finally {
      this.ctx.filter = 'none'
      this.ctx.globalAlpha = 1
    }
  }

  private renderGhostPreviewContourLayer(ghostPreviewWeight: number): boolean {
    const clampedWeight = Math.max(0, Math.min(1, ghostPreviewWeight))
    const contourCanvas = this.getGhostPreviewVariantCanvas('contours')

    if (!contourCanvas) {
      return this.renderGhostPreviewImageLayer(Math.max(0.28, clampedWeight * 0.92))
    }

    this.ctx.fillStyle = `rgba(2, 6, 23, ${0.16 + clampedWeight * 0.14})`
    this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight)

    if (this.canDrawSourceImage()) {
      this.ctx.filter = 'grayscale(1) contrast(1.08) brightness(0.78)'
      this.ctx.globalAlpha = 0.08 + clampedWeight * 0.14

      try {
        this.ctx.drawImage(this.sourceImage, 0, 0, this.logicalWidth, this.logicalHeight)
      } catch {
        // Ignore the faint base layer and still draw the contour overlay.
      } finally {
        this.ctx.filter = 'none'
        this.ctx.globalAlpha = 1
      }
    }

    this.ctx.globalAlpha = 0.42 + clampedWeight * 0.42
    this.ctx.drawImage(contourCanvas, 0, 0, this.logicalWidth, this.logicalHeight)
    this.ctx.globalAlpha = 1
    return true
  }

  private renderGhostPreviewEdgeLayer(ghostPreviewWeight: number): boolean {
    const clampedWeight = Math.max(0, Math.min(1, ghostPreviewWeight))
    const edgeCanvas = this.getGhostPreviewVariantCanvas('edges')

    if (!edgeCanvas) {
      return this.renderGhostPreviewImageLayer(Math.max(0.22, clampedWeight * 0.84))
    }

    this.ctx.fillStyle = `rgba(2, 6, 23, ${0.22 + clampedWeight * 0.18})`
    this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight)
    this.ctx.globalAlpha = 0.46 + clampedWeight * 0.44
    this.ctx.drawImage(edgeCanvas, 0, 0, this.logicalWidth, this.logicalHeight)
    this.ctx.globalAlpha = 1
    return true
  }

  private renderSolvedTileGhostBadges(state: PuzzleState): void {
    state.tiles.forEach((tile) => {
      if (tile.isEmpty) return
      if (tile.row !== tile.correctRow || tile.col !== tile.correctCol) return

      const x = tile.col * this.tileWidth
      const y = tile.row * this.tileHeight
      this.renderGhostTileBadge(tile, x, y, {
        fillStyle: 'rgba(15, 23, 42, 0.5)',
        strokeStyle: 'rgba(255, 255, 255, 0.2)',
        textStyle: 'rgba(248, 250, 252, 0.82)',
      })
    })
  }

  private renderIncorrectTileGhostBadges(state: PuzzleState): void {
    state.tiles.forEach((tile) => {
      if (tile.isEmpty) return
      if (tile.row === tile.correctRow && tile.col === tile.correctCol) return

      const x = tile.col * this.tileWidth
      const y = tile.row * this.tileHeight
      this.renderGhostTileBadge(tile, x, y, {
        fillStyle: 'rgba(220, 38, 38, 0.74)',
        strokeStyle: 'rgba(254, 226, 226, 0.32)',
        textStyle: 'rgba(255, 255, 255, 0.98)',
      })
    })
  }

  private renderGhostTileBadge(
    tile: Tile,
    x: number,
    y: number,
    palette: {
      fillStyle: string
      strokeStyle: string
      textStyle: string
    }
  ): void {
    const shortEdge = Math.min(this.tileWidth, this.tileHeight)
    const badgeSize = Math.max(22, Math.round(shortEdge * 0.2))
    const inset = Math.max(6, Math.round(shortEdge * 0.07))
    const badgeX = x + this.tileWidth - badgeSize - inset
    const badgeY = y + inset
    const label = String(tile.correctIndex + 1)

    this.ctx.save()
    this.ctx.fillStyle = palette.fillStyle
    this.ctx.strokeStyle = palette.strokeStyle
    this.ctx.lineWidth = 1
    this.ctx.beginPath()
    this.ctx.roundRect(badgeX, badgeY, badgeSize, badgeSize, Math.max(8, Math.round(badgeSize * 0.38)))
    this.ctx.fill()
    this.ctx.stroke()

    const fontSize = Math.max(10, Math.round(shortEdge * 0.11))
    this.ctx.font = `700 ${fontSize}px ${CANVAS_FONT_FAMILY}`
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    this.ctx.fillStyle = palette.textStyle
    this.ctx.fillText(label, badgeX + badgeSize / 2, badgeY + badgeSize / 2)
    this.ctx.restore()
  }

  private invalidateGhostPreviewCache(): void {
    this.ghostPreviewCache = null
  }

  private canDrawSourceImage(): boolean {
    return this.sourceImage.complete && this.sourceImage.naturalWidth > 0 && this.sourceImage.naturalHeight > 0
  }

  private getGhostPreviewVariantCanvas(mode: 'contours' | 'edges'): HTMLCanvasElement | null {
    if (!this.canDrawSourceImage() || this.logicalWidth <= 0 || this.logicalHeight <= 0) return null

    if (
      !this.ghostPreviewCache
      || this.ghostPreviewCache.width !== this.logicalWidth
      || this.ghostPreviewCache.height !== this.logicalHeight
    ) {
      this.ghostPreviewCache = {
        width: this.logicalWidth,
        height: this.logicalHeight,
        contours: null,
        edges: null,
      }
    }

    const cachedCanvas = this.ghostPreviewCache[mode]
    if (cachedCanvas) return cachedCanvas

    const nextCanvas = this.buildGhostPreviewVariantCanvas(mode)
    this.ghostPreviewCache[mode] = nextCanvas
    return nextCanvas
  }

  private buildGhostPreviewVariantCanvas(mode: 'contours' | 'edges'): HTMLCanvasElement | null {
    if (!this.canDrawSourceImage()) return null

    const sourceCanvas = document.createElement('canvas')
    sourceCanvas.width = this.logicalWidth
    sourceCanvas.height = this.logicalHeight
    const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true })
    if (!sourceCtx) return null

    try {
      sourceCtx.drawImage(this.sourceImage, 0, 0, this.logicalWidth, this.logicalHeight)
    } catch {
      return null
    }

    const sourceImageData = sourceCtx.getImageData(0, 0, this.logicalWidth, this.logicalHeight)
    const outputCanvas = document.createElement('canvas')
    outputCanvas.width = this.logicalWidth
    outputCanvas.height = this.logicalHeight
    const outputCtx = outputCanvas.getContext('2d')
    if (!outputCtx) return null

    const outputImageData = outputCtx.createImageData(this.logicalWidth, this.logicalHeight)
    const sourcePixels = sourceImageData.data
    const outputPixels = outputImageData.data
    const luminance = new Float32Array(this.logicalWidth * this.logicalHeight)

    for (let index = 0; index < luminance.length; index += 1) {
      const offset = index * 4
      luminance[index] =
        sourcePixels[offset] * 0.299
        + sourcePixels[offset + 1] * 0.587
        + sourcePixels[offset + 2] * 0.114
    }

    for (let row = 1; row < this.logicalHeight - 1; row += 1) {
      for (let col = 1; col < this.logicalWidth - 1; col += 1) {
        const index = row * this.logicalWidth + col
        const offset = index * 4
        const gx = luminance[index + 1] - luminance[index - 1]
        const gy = luminance[index + this.logicalWidth] - luminance[index - this.logicalWidth]
        const diagForward =
          luminance[index + this.logicalWidth + 1] - luminance[index - this.logicalWidth - 1]
        const diagBackward =
          luminance[index + this.logicalWidth - 1] - luminance[index - this.logicalWidth + 1]
        const magnitude = Math.min(
          255,
          Math.abs(gx) * 0.72
          + Math.abs(gy) * 0.72
          + Math.abs(diagForward) * 0.34
          + Math.abs(diagBackward) * 0.34
        )

        if (mode === 'contours') {
          const contourStrength = Math.max(0, Math.min(1, (magnitude - 18) / 82))
          if (contourStrength <= 0) continue

          const alpha = Math.min(0.92, Math.pow(contourStrength, 0.72))
          const brightness = 168 + contourStrength * 62
          outputPixels[offset] = Math.max(140, Math.round(brightness - 18))
          outputPixels[offset + 1] = Math.min(255, Math.round(brightness + 24))
          outputPixels[offset + 2] = 255
          outputPixels[offset + 3] = Math.round(alpha * 255)
          continue
        }

        const edgeStrength = Math.max(0, Math.min(1, (magnitude - 34) / 118))
        if (edgeStrength <= 0) continue

        const alpha = Math.min(1, Math.pow(edgeStrength, 1.34))
        const brightness = 214 + edgeStrength * 34
        outputPixels[offset] = Math.round(brightness)
        outputPixels[offset + 1] = Math.round(brightness)
        outputPixels[offset + 2] = 255
        outputPixels[offset + 3] = Math.round(alpha * 255)
      }
    }

    outputCtx.putImageData(outputImageData, 0, 0)

    if (mode === 'contours') {
      const softenedCanvas = document.createElement('canvas')
      softenedCanvas.width = this.logicalWidth
      softenedCanvas.height = this.logicalHeight
      const softenedCtx = softenedCanvas.getContext('2d')
      if (!softenedCtx) return outputCanvas

      softenedCtx.filter = 'blur(0.8px)'
      softenedCtx.drawImage(outputCanvas, 0, 0)
      softenedCtx.filter = 'none'
      softenedCtx.globalAlpha = 0.72
      softenedCtx.drawImage(outputCanvas, 0, 0)
      softenedCtx.globalAlpha = 1
      return softenedCanvas
    }

    return outputCanvas
  }

  private renderHeatmapOverlay(
    state: PuzzleState,
    moveAnimation: TileMoveAnimation | null,
    options: HeatmapOverlayOptions
  ): void {
    const overlayTiles = state.tiles.filter((tile) => (
      !tile.isEmpty
      && (
        options.mode === 'delta'
        || tile.row !== tile.correctRow
        || tile.col !== tile.correctCol
        || options.tilePotentials?.[tile.id] !== undefined
        || options.pathStepByTileId?.[tile.id] !== undefined
        || tile.id === options.pathTargetTileId
      )
    ))
    if (overlayTiles.length === 0) return

    const boardRows = state.tiles.reduce((maxRow, tile) => Math.max(maxRow, tile.row, tile.correctRow), state.emptyRow) + 1
    const boardCols = state.tiles.reduce((maxCol, tile) => Math.max(maxCol, tile.col, tile.correctCol), state.emptyCol) + 1
    const boardSize = this.getHeatmapBoardSize(boardRows, boardCols)
    const maxDistance = Math.max(1, boardRows + boardCols - 2)
    const animatedTileId = moveAnimation?.tileId ?? null

    overlayTiles.forEach((tile) => {
      const distance = Math.abs(tile.row - tile.correctRow) + Math.abs(tile.col - tile.correctCol)
      if (
        distance <= 0
        && options.mode !== 'delta'
        && options.pathStepByTileId?.[tile.id] === undefined
        && tile.id !== options.pathTargetTileId
      ) return

      let x = tile.col * this.tileWidth
      let y = tile.row * this.tileHeight

      if (moveAnimation && tile.id === animatedTileId) {
        const easedProgress = this.easeOutQuart(moveAnimation.progress)
        const startX = moveAnimation.fromCol * this.tileWidth
        const startY = moveAnimation.fromRow * this.tileHeight
        const targetX = moveAnimation.toCol * this.tileWidth
        const targetY = moveAnimation.toRow * this.tileHeight
        x = startX + (targetX - startX) * easedProgress
        y = startY + (targetY - startY) * easedProgress
      }

      if (options.mode === 'delta') {
        this.renderHeatmapDeltaOverlayAt(x, y, options.tileDeltas?.[tile.id] ?? 0, options.intensity)
      } else if (distance > 0 && options.mode === 'arrows') {
        this.renderHeatmapDirectionArrowAt(x, y, tile, options.intensity)
      } else if (distance > 0) {
        this.renderHeatmapTileOverlayAt(x, y, distance, boardSize, maxDistance, options.intensity)
      }

      if (options.showDistances) {
        this.renderHeatmapDistanceBadgeAt(x, y, tile, options.intensity)
      }

      const potential = options.tilePotentials?.[tile.id]
      if (potential !== undefined) {
        this.renderHeatmapMovePotentialAt(
          x,
          y,
          potential,
          tile.id === options.bestPotentialTileId,
          options.intensity
        )
      }

      const pathStep = options.pathStepByTileId?.[tile.id]
      if (pathStep !== undefined && pathStep > 1) {
        this.renderHeatmapPathStepAt(x, y, pathStep, options.intensity)
      }
      if (tile.id === options.pathTargetTileId) {
        this.renderHeatmapPathTargetAt(x, y, options.intensity)
      }
    })
  }

  private renderHeatmapPathStepAt(x: number, y: number, step: number, intensity: number): void {
    const alpha = Math.max(0.4, Math.min(1, intensity))
    const shortEdge = Math.min(this.tileWidth, this.tileHeight)
    const inset = Math.max(3, Math.round(shortEdge * 0.035))
    const badgeSize = Math.max(15, Math.min(25, Math.round(shortEdge * 0.2)))
    const badgeX = x + inset
    const badgeY = y + inset

    this.ctx.save()
    this.ctx.fillStyle = `rgba(14, 165, 233, ${0.92 * alpha})`
    this.ctx.shadowColor = `rgba(14, 165, 233, ${0.62 * alpha})`
    this.ctx.shadowBlur = Math.max(7, shortEdge * 0.12)
    this.ctx.beginPath()
    this.ctx.arc(badgeX + badgeSize / 2, badgeY + badgeSize / 2, badgeSize / 2, 0, Math.PI * 2)
    this.ctx.fill()
    this.ctx.shadowBlur = 0
    this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
    this.ctx.font = `900 ${Math.max(9, Math.round(badgeSize * 0.54))}px ${CANVAS_FONT_FAMILY}`
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    this.ctx.fillText(String(step), badgeX + badgeSize / 2, badgeY + badgeSize / 2)
    this.ctx.restore()
  }

  private renderHeatmapPathTargetAt(x: number, y: number, intensity: number): void {
    const alpha = Math.max(0.4, Math.min(1, intensity))
    const shortEdge = Math.min(this.tileWidth, this.tileHeight)
    const radius = Math.max(5, shortEdge * 0.065)
    const centerX = x + this.tileWidth - Math.max(9, shortEdge * 0.11)
    const centerY = y + this.tileHeight - Math.max(9, shortEdge * 0.11)

    this.ctx.save()
    this.ctx.strokeStyle = `rgba(56, 189, 248, ${0.92 * alpha})`
    this.ctx.lineWidth = Math.max(2, shortEdge * 0.025)
    this.ctx.beginPath()
    this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    this.ctx.stroke()
    this.ctx.beginPath()
    this.ctx.arc(centerX, centerY, radius * 0.35, 0, Math.PI * 2)
    this.ctx.fillStyle = `rgba(56, 189, 248, ${0.92 * alpha})`
    this.ctx.fill()
    this.ctx.restore()
  }

  private renderHeatmapMovePotentialAt(
    x: number,
    y: number,
    potential: number,
    isBest: boolean,
    intensity: number
  ): void {
    const alpha = Math.max(0.35, Math.min(1, intensity))
    const shortEdge = Math.min(this.tileWidth, this.tileHeight)
    const inset = Math.max(3, Math.round(shortEdge * 0.035))
    const lineWidth = Math.max(isBest ? 3 : 2, Math.round(shortEdge * (isBest ? 0.045 : 0.028)))
    const color = potential > 0
      ? { red: 34, green: 197, blue: 94 }
      : potential < 0
        ? { red: 239, green: 68, blue: 68 }
        : { red: 245, green: 158, blue: 11 }

    this.ctx.save()
    this.ctx.shadowColor = `rgba(${color.red}, ${color.green}, ${color.blue}, ${isBest ? 0.9 * alpha : 0.42 * alpha})`
    this.ctx.shadowBlur = isBest ? Math.max(12, shortEdge * 0.22) : Math.max(5, shortEdge * 0.08)
    this.ctx.strokeStyle = `rgba(${color.red}, ${color.green}, ${color.blue}, ${0.9 * alpha})`
    this.ctx.lineWidth = lineWidth
    this.ctx.strokeRect(
      x + inset + lineWidth / 2,
      y + inset + lineWidth / 2,
      this.tileWidth - inset * 2 - lineWidth,
      this.tileHeight - inset * 2 - lineWidth
    )
    this.ctx.shadowBlur = 0

    if (isBest) {
      const badgeSize = Math.max(16, Math.min(28, Math.round(shortEdge * 0.22)))
      const badgeX = x + inset
      const badgeY = y + inset
      this.ctx.fillStyle = `rgba(${color.red}, ${color.green}, ${color.blue}, ${0.94 * alpha})`
      this.ctx.beginPath()
      this.ctx.arc(badgeX + badgeSize / 2, badgeY + badgeSize / 2, badgeSize / 2, 0, Math.PI * 2)
      this.ctx.fill()
      this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
      this.ctx.font = `900 ${Math.max(10, Math.round(badgeSize * 0.56))}px ${CANVAS_FONT_FAMILY}`
      this.ctx.textAlign = 'center'
      this.ctx.textBaseline = 'middle'
      this.ctx.fillText('1', badgeX + badgeSize / 2, badgeY + badgeSize / 2)
    }
    this.ctx.restore()
  }

  private renderHeatmapDeltaOverlayAt(x: number, y: number, delta: number, intensity: number): void {
    const alpha = Math.max(0.25, Math.min(1, intensity))
    const shortEdge = Math.min(this.tileWidth, this.tileHeight)
    const inset = Math.max(4, Math.round(shortEdge * 0.05))
    const lineWidth = Math.max(2, Math.round(shortEdge * 0.035))
    const magnitude = Math.min(1, Math.abs(delta) / 3)
    const isImproved = delta > 0
    const isWorsened = delta < 0
    const color = isImproved
      ? { red: 34, green: 197, blue: 94 }
      : isWorsened
        ? { red: 239, green: 68, blue: 68 }
        : { red: 148, green: 163, blue: 184 }
    const label = isImproved ? `-${delta}` : isWorsened ? `+${Math.abs(delta)}` : '0'
    const fillAlpha = (isImproved || isWorsened ? 0.2 + magnitude * 0.2 : 0.11) * alpha
    const strokeAlpha = (isImproved || isWorsened ? 0.76 + magnitude * 0.2 : 0.42) * alpha

    this.ctx.save()
    this.ctx.fillStyle = `rgba(${color.red}, ${color.green}, ${color.blue}, ${fillAlpha})`
    this.ctx.fillRect(x + inset, y + inset, this.tileWidth - inset * 2, this.tileHeight - inset * 2)
    this.ctx.shadowColor = `rgba(${color.red}, ${color.green}, ${color.blue}, ${0.58 * alpha})`
    this.ctx.shadowBlur = isImproved || isWorsened ? Math.max(8, shortEdge * 0.16) : 0
    this.ctx.strokeStyle = `rgba(${color.red}, ${color.green}, ${color.blue}, ${strokeAlpha})`
    this.ctx.lineWidth = lineWidth
    this.ctx.strokeRect(
      x + inset + lineWidth / 2,
      y + inset + lineWidth / 2,
      this.tileWidth - inset * 2 - lineWidth,
      this.tileHeight - inset * 2 - lineWidth
    )
    this.ctx.shadowBlur = 0
    this.renderHeatmapDeltaLabelAt(x, y, label, color, alpha)
    this.ctx.restore()
  }

  private renderHeatmapDeltaLabelAt(
    x: number,
    y: number,
    label: string,
    color: { red: number; green: number; blue: number },
    alpha: number
  ): void {
    const shortEdge = Math.min(this.tileWidth, this.tileHeight)
    const fontSize = Math.max(11, Math.min(24, Math.round(shortEdge * 0.2)))
    const paddingX = Math.max(7, shortEdge * 0.07)
    const paddingY = Math.max(4, shortEdge * 0.04)
    this.ctx.font = `800 ${fontSize}px ${CANVAS_FONT_FAMILY}`
    const width = this.ctx.measureText(label).width + paddingX * 2
    const height = fontSize + paddingY * 2
    const badgeX = x + (this.tileWidth - width) / 2
    const badgeY = y + (this.tileHeight - height) / 2

    this.ctx.fillStyle = `rgba(7, 12, 24, ${0.82 * alpha})`
    this.ctx.strokeStyle = `rgba(${color.red}, ${color.green}, ${color.blue}, ${0.9 * alpha})`
    this.ctx.lineWidth = Math.max(1.5, shortEdge * 0.018)
    this.ctx.beginPath()
    this.ctx.roundRect(badgeX, badgeY, width, height, Math.max(7, height * 0.34))
    this.ctx.fill()
    this.ctx.stroke()
    this.ctx.fillStyle = `rgba(255, 255, 255, ${0.98 * alpha})`
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    this.ctx.fillText(label, x + this.tileWidth / 2, y + this.tileHeight / 2 + 0.5)
  }

  private renderHeatmapTileOverlayAt(
    x: number,
    y: number,
    distance: number,
    boardSize: 3 | 4 | 5 | 6,
    maxDistance: number,
    intensity: number
  ): void {
    const shortEdge = Math.min(this.tileWidth, this.tileHeight)
    const heatmapIntensity = this.getHeatmapIntensity(distance, boardSize, maxDistance)
    const palette = this.getHeatmapPalette(heatmapIntensity.bandIndex, heatmapIntensity.bandProgress)
    const alphaBoost = this.getHeatmapAlphaBoost(boardSize) * Math.max(0.25, Math.min(1, intensity))
    const hue = this.lerp(palette.hueStart, palette.hueEnd, heatmapIntensity.bandProgress)
    const highlightHue = Math.max(0, Math.min(62, hue + palette.highlightHueShift))
    const shadowHue = Math.max(0, hue - palette.shadowHueShift)
    const fillAlpha = Math.min(0.9, this.lerp(palette.fillAlphaStart, palette.fillAlphaEnd, heatmapIntensity.emphasis) * alphaBoost)
    const accentAlpha = Math.min(1, this.lerp(palette.accentAlphaStart, palette.accentAlphaEnd, heatmapIntensity.emphasis) * alphaBoost)
    const glowAlpha = Math.min(0.92, this.lerp(palette.glowAlphaStart, palette.glowAlphaEnd, heatmapIntensity.emphasis) * alphaBoost)
    const topLightness = this.lerp(palette.topLightnessStart, palette.topLightnessEnd, heatmapIntensity.emphasis)
    const midLightness = this.lerp(palette.midLightnessStart, palette.midLightnessEnd, heatmapIntensity.emphasis)
    const bottomLightness = this.lerp(palette.bottomLightnessStart, palette.bottomLightnessEnd, heatmapIntensity.emphasis)
    const topBandAlpha = Math.min(0.92, this.lerp(palette.topBandAlphaStart, palette.topBandAlphaEnd, heatmapIntensity.emphasis) * alphaBoost)
    const bottomBarAlpha = Math.min(0.94, this.lerp(palette.bottomBarAlphaStart, palette.bottomBarAlphaEnd, heatmapIntensity.emphasis) * alphaBoost)
    const inset = Math.max(3, Math.round(shortEdge * 0.04))
    const innerInset = Math.max(9, Math.round(shortEdge * 0.12))
    const lineWidth = Math.max(2, Math.round(shortEdge * 0.026))
    const innerLineWidth = Math.max(1, Math.round(shortEdge * 0.018))
    const accentHeight = Math.max(5, Math.round(this.tileHeight * 0.1))
    const topBandHeight = Math.max(6, Math.round(this.tileHeight * 0.14))
    const gradient = this.ctx.createLinearGradient(x, y, x + this.tileWidth, y + this.tileHeight)
    gradient.addColorStop(0, `hsla(${highlightHue}, 100%, ${topLightness}%, ${fillAlpha * 0.94})`)
    gradient.addColorStop(0.42, `hsla(${hue}, 100%, ${midLightness}%, ${fillAlpha * 0.86})`)
    gradient.addColorStop(1, `hsla(${shadowHue}, 100%, ${bottomLightness}%, ${fillAlpha})`)
    const glowGradient = this.ctx.createRadialGradient(
      x + this.tileWidth * 0.36,
      y + this.tileHeight * 0.3,
      Math.max(2, shortEdge * 0.08),
      x + this.tileWidth / 2,
      y + this.tileHeight / 2,
      Math.max(shortEdge, Math.max(this.tileWidth, this.tileHeight) * 0.78)
    )
    glowGradient.addColorStop(0, `hsla(${highlightHue}, 100%, ${Math.min(92, topLightness + 8)}%, ${glowAlpha * 0.96})`)
    glowGradient.addColorStop(1, `hsla(${hue}, 100%, 52%, 0)`)

    this.ctx.save()
    this.ctx.fillStyle = gradient
    this.ctx.fillRect(x + inset, y + inset, this.tileWidth - inset * 2, this.tileHeight - inset * 2)
    this.ctx.fillStyle = glowGradient
    this.ctx.fillRect(x + inset, y + inset, this.tileWidth - inset * 2, this.tileHeight - inset * 2)

    this.ctx.fillStyle = `hsla(${highlightHue}, 100%, ${Math.max(42, midLightness - 4)}%, ${topBandAlpha})`
    this.ctx.fillRect(x + inset, y + inset, this.tileWidth - inset * 2, topBandHeight)

    this.ctx.shadowColor = `hsla(${shadowHue}, 100%, 46%, ${glowAlpha})`
    this.ctx.shadowBlur = Math.max(10, Math.round(shortEdge * 0.18))
    this.ctx.strokeStyle = `hsla(${hue}, 100%, ${Math.max(38, midLightness - 6)}%, ${accentAlpha})`
    this.ctx.lineWidth = lineWidth
    this.ctx.strokeRect(
      x + inset + lineWidth / 2,
      y + inset + lineWidth / 2,
      this.tileWidth - inset * 2 - lineWidth,
      this.tileHeight - inset * 2 - lineWidth
    )

    this.ctx.shadowBlur = 0
    this.ctx.strokeStyle = `rgba(255, 255, 255, ${0.08 + heatmapIntensity.emphasis * 0.26})`
    this.ctx.lineWidth = innerLineWidth
    this.ctx.strokeRect(
      x + innerInset + innerLineWidth / 2,
      y + innerInset + innerLineWidth / 2,
      this.tileWidth - innerInset * 2 - innerLineWidth,
      this.tileHeight - innerInset * 2 - innerLineWidth
    )

    this.ctx.fillStyle = `hsla(${shadowHue}, 100%, ${Math.max(18, bottomLightness - 4)}%, ${bottomBarAlpha})`
    this.ctx.fillRect(
      x + innerInset,
      y + this.tileHeight - innerInset - accentHeight,
      this.tileWidth - innerInset * 2,
      accentHeight
    )
    this.ctx.restore()
  }

  private renderHeatmapDirectionArrowAt(x: number, y: number, tile: Tile, intensity: number): void {
    const deltaCol = tile.correctCol - tile.col
    const deltaRow = tile.correctRow - tile.row
    const length = Math.hypot(deltaCol, deltaRow)
    if (length <= 0) return

    const alpha = Math.max(0.25, Math.min(1, intensity))
    const shortEdge = Math.min(this.tileWidth, this.tileHeight)
    const unitX = deltaCol / length
    const unitY = deltaRow / length
    const arrowLength = shortEdge * 0.42
    const centerX = x + this.tileWidth / 2
    const centerY = y + this.tileHeight / 2
    const startX = centerX - unitX * arrowLength * 0.34
    const startY = centerY - unitY * arrowLength * 0.34
    const endX = centerX + unitX * arrowLength * 0.46
    const endY = centerY + unitY * arrowLength * 0.46
    const headLength = Math.max(7, shortEdge * 0.13)
    const headAngle = Math.PI / 6
    const angle = Math.atan2(unitY, unitX)
    const lineWidth = Math.max(3, shortEdge * 0.045)

    this.ctx.save()
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'
    this.ctx.shadowColor = `rgba(239, 68, 68, ${0.72 * alpha})`
    this.ctx.shadowBlur = Math.max(10, shortEdge * 0.18)
    this.ctx.strokeStyle = `rgba(255, 255, 255, ${0.96 * alpha})`
    this.ctx.lineWidth = lineWidth + Math.max(2, shortEdge * 0.025)
    this.drawHeatmapArrowPath(startX, startY, endX, endY, angle, headAngle, headLength)
    this.ctx.shadowBlur = 0
    this.ctx.strokeStyle = `rgba(220, 38, 38, ${0.98 * alpha})`
    this.ctx.lineWidth = lineWidth
    this.drawHeatmapArrowPath(startX, startY, endX, endY, angle, headAngle, headLength)
    this.ctx.restore()
  }

  private drawHeatmapArrowPath(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    angle: number,
    headAngle: number,
    headLength: number
  ): void {
    this.ctx.beginPath()
    this.ctx.moveTo(startX, startY)
    this.ctx.lineTo(endX, endY)
    this.ctx.moveTo(endX, endY)
    this.ctx.lineTo(
      endX - Math.cos(angle - headAngle) * headLength,
      endY - Math.sin(angle - headAngle) * headLength
    )
    this.ctx.moveTo(endX, endY)
    this.ctx.lineTo(
      endX - Math.cos(angle + headAngle) * headLength,
      endY - Math.sin(angle + headAngle) * headLength
    )
    this.ctx.stroke()
  }

  private renderHeatmapDistanceBadgeAt(x: number, y: number, tile: Tile, intensity: number): void {
    const alpha = Math.max(0.35, Math.min(1, intensity))
    const shortEdge = Math.min(this.tileWidth, this.tileHeight)
    const deltaX = tile.correctCol - tile.col
    const deltaY = tile.row - tile.correctRow
    const formatAxisDelta = (axis: 'X' | 'Y', value: number) => `${axis} ${value >= 0 ? '+' : ''}${value}`
    const xLabel = formatAxisDelta('X', deltaX)
    const yLabel = formatAxisDelta('Y', deltaY)
    const fontSize = Math.max(8, Math.min(12, Math.round(shortEdge * 0.095)))
    const lineHeight = fontSize + Math.max(2, Math.round(shortEdge * 0.018))
    const paddingX = Math.max(5, Math.round(shortEdge * 0.045))
    const paddingY = Math.max(3, Math.round(shortEdge * 0.028))
    this.ctx.font = `800 ${fontSize}px ${CANVAS_FONT_FAMILY}`
    const badgeWidth = Math.max(
      this.ctx.measureText(xLabel).width,
      this.ctx.measureText(yLabel).width
    ) + paddingX * 2
    const badgeHeight = lineHeight * 2 + paddingY * 2
    const inset = Math.max(5, shortEdge * 0.05)
    const badgeX = x + this.tileWidth - badgeWidth - inset
    const badgeY = y + inset

    this.ctx.save()
    this.ctx.shadowColor = `rgba(2, 6, 23, ${0.54 * alpha})`
    this.ctx.shadowBlur = Math.max(5, shortEdge * 0.08)
    this.ctx.fillStyle = `rgba(7, 12, 24, ${0.9 * alpha})`
    this.ctx.strokeStyle = `rgba(255, 255, 255, ${0.78 * alpha})`
    this.ctx.lineWidth = Math.max(1.5, shortEdge * 0.018)
    this.ctx.beginPath()
    this.ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, Math.max(5, badgeHeight * 0.24))
    this.ctx.fill()
    this.ctx.shadowBlur = 0
    this.ctx.stroke()
    this.ctx.fillStyle = `rgba(255, 255, 255, ${0.98 * alpha})`
    this.ctx.font = `800 ${fontSize}px ${CANVAS_FONT_FAMILY}`
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    const centerX = badgeX + badgeWidth / 2
    this.ctx.fillText(xLabel, centerX, badgeY + paddingY + lineHeight * 0.5)
    this.ctx.fillText(yLabel, centerX, badgeY + paddingY + lineHeight * 1.5)
    this.ctx.restore()
  }

  private getHeatmapBoardSize(boardRows: number, boardCols: number): 3 | 4 | 5 | 6 {
    const size = Math.max(3, Math.min(6, Math.max(boardRows, boardCols)))
    if (size === 3 || size === 4 || size === 5) return size
    return 6
  }

  private getHeatmapIntensity(
    distance: number,
    boardSize: 3 | 4 | 5 | 6,
    maxDistance: number
  ): {
    bandIndex: number
    bandProgress: number
    emphasis: number
  } {
    const thresholds = this.getHeatmapThresholds(boardSize)
    let bandIndex = thresholds.findIndex((threshold) => distance <= threshold)
    if (bandIndex === -1) {
      bandIndex = thresholds.length
    }

    const bandStart = bandIndex === 0 ? 1 : thresholds[bandIndex - 1] + 1
    const bandEnd = bandIndex < thresholds.length ? thresholds[bandIndex] : maxDistance
    const bandProgress =
      bandEnd <= bandStart
        ? 1
        : Math.max(0, Math.min(1, (distance - bandStart) / Math.max(1, bandEnd - bandStart)))
    const normalizedDistance = Math.max(0, Math.min(1, distance / Math.max(1, maxDistance)))
    const boostedDistance = Math.min(1, normalizedDistance * this.getHeatmapDistanceBoost(boardSize))
    const contrastExponent = this.getHeatmapContrastExponent(boardSize)
    const bandPosition = Math.max(0, Math.min(1, (bandIndex + bandProgress) / Math.max(1, thresholds.length)))
    const bandEmphasis =
      this.getHeatmapBandFloor(boardSize)
      + bandPosition * this.getHeatmapBandRange(boardSize)
    const emphasis = Math.max(
      Math.pow(boostedDistance, contrastExponent),
      Math.max(0, Math.min(1, bandEmphasis))
    )

    return {
      bandIndex,
      bandProgress,
      emphasis,
    }
  }

  private getHeatmapThresholds(boardSize: 3 | 4 | 5 | 6): number[] {
    switch (boardSize) {
      case 3:
        return [1, 2, 3, 4]
      case 4:
        return [1, 2, 3, 5]
      case 5:
        return [1, 2, 3, 5]
      case 6:
      default:
        return [1, 2, 4, 6]
    }
  }

  private getHeatmapContrastExponent(boardSize: 3 | 4 | 5 | 6): number {
    switch (boardSize) {
      case 3:
        return 0.96
      case 4:
        return 0.9
      case 5:
        return 0.82
      case 6:
      default:
        return 0.74
    }
  }

  private getHeatmapDistanceBoost(boardSize: 3 | 4 | 5 | 6): number {
    switch (boardSize) {
      case 3:
        return 1
      case 4:
        return 1.06
      case 5:
        return 1.2
      case 6:
      default:
        return 1.34
    }
  }

  private getHeatmapBandFloor(boardSize: 3 | 4 | 5 | 6): number {
    switch (boardSize) {
      case 3:
        return 0.08
      case 4:
        return 0.1
      case 5:
        return 0.14
      case 6:
      default:
        return 0.18
    }
  }

  private getHeatmapBandRange(boardSize: 3 | 4 | 5 | 6): number {
    switch (boardSize) {
      case 3:
        return 0.78
      case 4:
        return 0.8
      case 5:
        return 0.84
      case 6:
      default:
        return 0.86
    }
  }

  private getHeatmapAlphaBoost(boardSize: 3 | 4 | 5 | 6): number {
    switch (boardSize) {
      case 3:
        return 1
      case 4:
        return 1.04
      case 5:
        return 1.16
      case 6:
      default:
        return 1.24
    }
  }

  private getHeatmapPalette(bandIndex: number, bandProgress: number): {
    hueStart: number
    hueEnd: number
    highlightHueShift: number
    shadowHueShift: number
    fillAlphaStart: number
    fillAlphaEnd: number
    accentAlphaStart: number
    accentAlphaEnd: number
    glowAlphaStart: number
    glowAlphaEnd: number
    topLightnessStart: number
    topLightnessEnd: number
    midLightnessStart: number
    midLightnessEnd: number
    bottomLightnessStart: number
    bottomLightnessEnd: number
    topBandAlphaStart: number
    topBandAlphaEnd: number
    bottomBarAlphaStart: number
    bottomBarAlphaEnd: number
  } {
    const palette = [
      {
        hueStart: 60,
        hueEnd: 54,
        highlightHueShift: 3,
        shadowHueShift: 16,
        fillAlphaStart: 0.08,
        fillAlphaEnd: 0.16,
        accentAlphaStart: 0.2,
        accentAlphaEnd: 0.34,
        glowAlphaStart: 0.06,
        glowAlphaEnd: 0.16,
        topLightnessStart: 90,
        topLightnessEnd: 84,
        midLightnessStart: 78,
        midLightnessEnd: 70,
        bottomLightnessStart: 60,
        bottomLightnessEnd: 50,
        topBandAlphaStart: 0.16,
        topBandAlphaEnd: 0.28,
        bottomBarAlphaStart: 0.14,
        bottomBarAlphaEnd: 0.28,
      },
      {
        hueStart: 50,
        hueEnd: 40,
        highlightHueShift: 4,
        shadowHueShift: 18,
        fillAlphaStart: 0.18,
        fillAlphaEnd: 0.28,
        accentAlphaStart: 0.34,
        accentAlphaEnd: 0.5,
        glowAlphaStart: 0.12,
        glowAlphaEnd: 0.24,
        topLightnessStart: 86,
        topLightnessEnd: 78,
        midLightnessStart: 72,
        midLightnessEnd: 62,
        bottomLightnessStart: 52,
        bottomLightnessEnd: 42,
        topBandAlphaStart: 0.24,
        topBandAlphaEnd: 0.38,
        bottomBarAlphaStart: 0.22,
        bottomBarAlphaEnd: 0.38,
      },
      {
        hueStart: 32,
        hueEnd: 22,
        highlightHueShift: 5,
        shadowHueShift: 18,
        fillAlphaStart: 0.34,
        fillAlphaEnd: 0.48,
        accentAlphaStart: 0.52,
        accentAlphaEnd: 0.7,
        glowAlphaStart: 0.24,
        glowAlphaEnd: 0.4,
        topLightnessStart: 82,
        topLightnessEnd: 72,
        midLightnessStart: 66,
        midLightnessEnd: 54,
        bottomLightnessStart: 46,
        bottomLightnessEnd: 34,
        topBandAlphaStart: 0.36,
        topBandAlphaEnd: 0.5,
        bottomBarAlphaStart: 0.34,
        bottomBarAlphaEnd: 0.5,
      },
      {
        hueStart: 16,
        hueEnd: 8,
        highlightHueShift: 6,
        shadowHueShift: 16,
        fillAlphaStart: 0.5,
        fillAlphaEnd: 0.64,
        accentAlphaStart: 0.68,
        accentAlphaEnd: 0.84,
        glowAlphaStart: 0.4,
        glowAlphaEnd: 0.58,
        topLightnessStart: 78,
        topLightnessEnd: 68,
        midLightnessStart: 58,
        midLightnessEnd: 46,
        bottomLightnessStart: 36,
        bottomLightnessEnd: 26,
        topBandAlphaStart: 0.52,
        topBandAlphaEnd: 0.66,
        bottomBarAlphaStart: 0.5,
        bottomBarAlphaEnd: 0.66,
      },
      {
        hueStart: 6,
        hueEnd: 0,
        highlightHueShift: 6,
        shadowHueShift: 10,
        fillAlphaStart: 0.64,
        fillAlphaEnd: 0.8,
        accentAlphaStart: 0.86,
        accentAlphaEnd: 1,
        glowAlphaStart: 0.56,
        glowAlphaEnd: 0.78,
        topLightnessStart: 72,
        topLightnessEnd: 62,
        midLightnessStart: 50,
        midLightnessEnd: 40,
        bottomLightnessStart: 28,
        bottomLightnessEnd: 18,
        topBandAlphaStart: 0.66,
        topBandAlphaEnd: 0.82,
        bottomBarAlphaStart: 0.64,
        bottomBarAlphaEnd: 0.82,
      },
    ][Math.max(0, Math.min(4, bandIndex))]

    return {
      hueStart: this.lerp(palette.hueStart, palette.hueEnd, bandProgress * 0.24),
      hueEnd: palette.hueEnd,
      highlightHueShift: palette.highlightHueShift,
      shadowHueShift: palette.shadowHueShift,
      fillAlphaStart: palette.fillAlphaStart,
      fillAlphaEnd: palette.fillAlphaEnd,
      accentAlphaStart: palette.accentAlphaStart,
      accentAlphaEnd: palette.accentAlphaEnd,
      glowAlphaStart: palette.glowAlphaStart,
      glowAlphaEnd: palette.glowAlphaEnd,
      topLightnessStart: palette.topLightnessStart,
      topLightnessEnd: palette.topLightnessEnd,
      midLightnessStart: palette.midLightnessStart,
      midLightnessEnd: palette.midLightnessEnd,
      bottomLightnessStart: palette.bottomLightnessStart,
      bottomLightnessEnd: palette.bottomLightnessEnd,
      topBandAlphaStart: palette.topBandAlphaStart,
      topBandAlphaEnd: palette.topBandAlphaEnd,
      bottomBarAlphaStart: palette.bottomBarAlphaStart,
      bottomBarAlphaEnd: palette.bottomBarAlphaEnd,
    }
  }

  private lerp(start: number, end: number, progress: number): number {
    const clampedProgress = Math.max(0, Math.min(1, progress))
    return start + (end - start) * clampedProgress
  }

  private renderAnimatedTileSearchOverlay(state: PuzzleState, moveAnimation: TileMoveAnimation): void {
    const tile = state.tiles.find((entry) => entry.id === moveAnimation.tileId)
    if (!tile || tile.isEmpty) return

    const easedProgress = this.easeOutQuart(moveAnimation.progress)
    const startX = moveAnimation.fromCol * this.tileWidth
    const startY = moveAnimation.fromRow * this.tileHeight
    const targetX = moveAnimation.toCol * this.tileWidth
    const targetY = moveAnimation.toRow * this.tileHeight
    const x = startX + (targetX - startX) * easedProgress
    const y = startY + (targetY - startY) * easedProgress

    this.renderTileSearchOverlayAt(x, y)
  }

  private renderTileSearchOverlay(state: PuzzleState, tileSearchOverlay: TileSearchOverlay): void {
    const tile = state.tiles.find((entry) => entry.id === tileSearchOverlay.tileId)
    if (!tile || tile.isEmpty) return

    const x = tile.col * this.tileWidth
    const y = tile.row * this.tileHeight
    this.renderTileSearchOverlayAt(x, y)
  }

  private renderTileSearchOverlayAt(x: number, y: number): void {
    const shortEdge = Math.min(this.tileWidth, this.tileHeight)
    const outerInset = Math.max(2, Math.round(shortEdge * 0.025))
    const innerInset = Math.max(7, Math.round(shortEdge * 0.085))
    const outerLineWidth = Math.max(4, Math.round(shortEdge * 0.045))
    const innerLineWidth = Math.max(2, Math.round(shortEdge * 0.024))
    const badgeWidth = Math.max(62, Math.round(this.tileWidth * 0.44))
    const badgeHeight = Math.max(24, Math.round(this.tileHeight * 0.18))
    const badgeX = x + innerInset
    const badgeY = y + innerInset
    const fontSize = Math.max(10, Math.round(shortEdge * 0.11))
    const cornerSize = Math.max(10, Math.round(shortEdge * 0.13))
    const cornerLineWidth = Math.max(3, Math.round(shortEdge * 0.03))

    this.ctx.save()
    this.ctx.fillStyle = 'rgba(56, 189, 248, 0.12)'
    this.ctx.fillRect(x + outerInset, y + outerInset, this.tileWidth - outerInset * 2, this.tileHeight - outerInset * 2)

    this.ctx.shadowColor = 'rgba(56, 189, 248, 0.34)'
    this.ctx.shadowBlur = Math.max(10, Math.round(shortEdge * 0.18))
    this.ctx.strokeStyle = 'rgba(248, 250, 252, 0.96)'
    this.ctx.lineWidth = outerLineWidth
    this.ctx.strokeRect(
      x + outerInset + outerLineWidth / 2,
      y + outerInset + outerLineWidth / 2,
      this.tileWidth - outerInset * 2 - outerLineWidth,
      this.tileHeight - outerInset * 2 - outerLineWidth
    )

    this.ctx.shadowBlur = 0
    this.ctx.strokeStyle = 'rgba(8, 145, 178, 0.92)'
    this.ctx.lineWidth = innerLineWidth
    this.ctx.strokeRect(
      x + innerInset + innerLineWidth / 2,
      y + innerInset + innerLineWidth / 2,
      this.tileWidth - innerInset * 2 - innerLineWidth,
      this.tileHeight - innerInset * 2 - innerLineWidth
    )

    this.ctx.fillStyle = 'rgba(8, 15, 30, 0.9)'
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
    this.ctx.lineWidth = 1
    this.ctx.beginPath()
    this.ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, badgeHeight / 2)
    this.ctx.fill()
    this.ctx.stroke()

    this.ctx.fillStyle = '#f8fafc'
    this.ctx.font = `700 ${fontSize}px ${CANVAS_FONT_FAMILY}`
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    this.ctx.fillText('SUCHE', badgeX + badgeWidth / 2, badgeY + badgeHeight / 2)

    this.ctx.strokeStyle = 'rgba(12, 74, 110, 0.96)'
    this.ctx.lineWidth = cornerLineWidth
    this.ctx.lineCap = 'round'
    this.ctx.beginPath()
    this.ctx.moveTo(x + innerInset, y + innerInset + cornerSize)
    this.ctx.lineTo(x + innerInset, y + innerInset)
    this.ctx.lineTo(x + innerInset + cornerSize, y + innerInset)
    this.ctx.moveTo(x + this.tileWidth - innerInset - cornerSize, y + innerInset)
    this.ctx.lineTo(x + this.tileWidth - innerInset, y + innerInset)
    this.ctx.lineTo(x + this.tileWidth - innerInset, y + innerInset + cornerSize)
    this.ctx.moveTo(x + innerInset, y + this.tileHeight - innerInset - cornerSize)
    this.ctx.lineTo(x + innerInset, y + this.tileHeight - innerInset)
    this.ctx.lineTo(x + innerInset + cornerSize, y + this.tileHeight - innerInset)
    this.ctx.moveTo(x + this.tileWidth - innerInset - cornerSize, y + this.tileHeight - innerInset)
    this.ctx.lineTo(x + this.tileWidth - innerInset, y + this.tileHeight - innerInset)
    this.ctx.lineTo(x + this.tileWidth - innerInset, y + this.tileHeight - innerInset - cornerSize)
    this.ctx.stroke()
    this.ctx.restore()
  }

  private renderHintOverlay(state: PuzzleState, hintOverlay: HintOverlay): void {
    const tile = state.tiles.find((entry) => entry.id === hintOverlay.tileId)
    if (!tile || tile.isEmpty) return

    const x = tile.col * this.tileWidth
    const y = tile.row * this.tileHeight
    const targetSlotX = state.emptyCol * this.tileWidth
    const targetSlotY = state.emptyRow * this.tileHeight
    const finalTargetSlotX = hintOverlay.finalTargetCol * this.tileWidth
    const finalTargetSlotY = hintOverlay.finalTargetRow * this.tileHeight
    const centerX = x + this.tileWidth / 2
    const centerY = y + this.tileHeight / 2
    const targetX = targetSlotX + this.tileWidth / 2
    const targetY = targetSlotY + this.tileHeight / 2
    const shortEdge = Math.min(this.tileWidth, this.tileHeight)
    const inset = Math.max(8, Math.round(shortEdge * 0.08))
    const innerInset = Math.max(5, Math.round(shortEdge * 0.045))
    const angle = Math.atan2(targetY - centerY, targetX - centerX)
    const routeStartX = centerX + Math.cos(angle) * shortEdge * 0.18
    const routeStartY = centerY + Math.sin(angle) * shortEdge * 0.18
    const routeEndX = targetX - Math.cos(angle) * shortEdge * 0.16
    const routeEndY = targetY - Math.sin(angle) * shortEdge * 0.16
    const arrowSize = Math.max(11, Math.round(shortEdge * 0.13))

    this.ctx.save()
    if (finalTargetSlotX !== targetSlotX || finalTargetSlotY !== targetSlotY) {
      this.ctx.fillStyle = 'rgba(245, 158, 11, 0.12)'
      this.ctx.fillRect(
        finalTargetSlotX + innerInset,
        finalTargetSlotY + innerInset,
        this.tileWidth - innerInset * 2,
        this.tileHeight - innerInset * 2
      )
      this.ctx.strokeStyle = 'rgba(251, 191, 36, 0.92)'
      this.ctx.lineWidth = Math.max(3, Math.round(shortEdge * 0.028))
      this.ctx.setLineDash([Math.max(5, Math.round(shortEdge * 0.06)), Math.max(5, Math.round(shortEdge * 0.06))])
      this.ctx.strokeRect(
        finalTargetSlotX + innerInset,
        finalTargetSlotY + innerInset,
        this.tileWidth - innerInset * 2,
        this.tileHeight - innerInset * 2
      )
      this.ctx.setLineDash([])
    }

    this.ctx.fillStyle = 'rgba(14, 165, 233, 0.18)'
    this.ctx.fillRect(
      targetSlotX + innerInset,
      targetSlotY + innerInset,
      this.tileWidth - innerInset * 2,
      this.tileHeight - innerInset * 2
    )
    this.ctx.shadowColor = 'rgba(56, 189, 248, 0.54)'
    this.ctx.shadowBlur = Math.max(16, Math.round(shortEdge * 0.24))
    this.ctx.strokeStyle = 'rgba(186, 230, 253, 0.96)'
    this.ctx.lineWidth = Math.max(4, Math.round(shortEdge * 0.036))
    this.ctx.setLineDash([Math.max(8, Math.round(shortEdge * 0.1)), Math.max(5, Math.round(shortEdge * 0.06))])
    this.ctx.strokeRect(
      targetSlotX + innerInset,
      targetSlotY + innerInset,
      this.tileWidth - innerInset * 2,
      this.tileHeight - innerInset * 2
    )
    this.ctx.setLineDash([])

    this.ctx.shadowBlur = 0
    this.ctx.fillStyle = 'rgba(56, 189, 248, 0.24)'
    this.ctx.fillRect(x + inset, y + inset, this.tileWidth - inset * 2, this.tileHeight - inset * 2)

    this.ctx.shadowColor = 'rgba(14, 165, 233, 0.58)'
    this.ctx.shadowBlur = Math.max(18, Math.round(shortEdge * 0.26))
    this.ctx.strokeStyle = 'rgba(125, 211, 252, 0.98)'
    this.ctx.lineWidth = Math.max(4, Math.round(shortEdge * 0.04))
    this.ctx.strokeRect(x + inset, y + inset, this.tileWidth - inset * 2, this.tileHeight - inset * 2)

    this.ctx.shadowColor = 'rgba(2, 6, 23, 0.58)'
    this.ctx.shadowBlur = Math.max(6, Math.round(shortEdge * 0.08))
    this.ctx.strokeStyle = 'rgba(2, 6, 23, 0.72)'
    this.ctx.lineWidth = Math.max(9, Math.round(shortEdge * 0.075))
    this.ctx.lineCap = 'round'
    this.ctx.beginPath()
    this.ctx.moveTo(routeStartX, routeStartY)
    this.ctx.lineTo(routeEndX, routeEndY)
    this.ctx.stroke()

    this.ctx.shadowColor = 'rgba(56, 189, 248, 0.68)'
    this.ctx.shadowBlur = Math.max(18, Math.round(shortEdge * 0.22))
    this.ctx.strokeStyle = '#f8fafc'
    this.ctx.lineWidth = Math.max(5, Math.round(shortEdge * 0.044))
    this.ctx.beginPath()
    this.ctx.moveTo(routeStartX, routeStartY)
    this.ctx.lineTo(routeEndX, routeEndY)
    this.ctx.stroke()

    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.92)'
    this.ctx.lineWidth = Math.max(2, Math.round(shortEdge * 0.018))
    this.ctx.beginPath()
    this.ctx.moveTo(routeStartX, routeStartY)
    this.ctx.lineTo(routeEndX, routeEndY)
    this.ctx.stroke()

    this.ctx.fillStyle = '#f8fafc'
    this.ctx.beginPath()
    this.ctx.moveTo(routeEndX, routeEndY)
    this.ctx.lineTo(
      routeEndX - arrowSize * Math.cos(angle - Math.PI / 6),
      routeEndY - arrowSize * Math.sin(angle - Math.PI / 6)
    )
    this.ctx.lineTo(
      routeEndX - arrowSize * Math.cos(angle + Math.PI / 6),
      routeEndY - arrowSize * Math.sin(angle + Math.PI / 6)
    )
    this.ctx.closePath()
    this.ctx.fill()

    this.ctx.shadowBlur = 0
    this.ctx.fillStyle = 'rgba(8, 15, 30, 0.88)'
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
    this.ctx.lineWidth = 1
    const badgeWidth = Math.max(54, Math.round(this.tileWidth * 0.34))
    const badgeHeight = Math.max(24, Math.round(this.tileHeight * 0.18))
    const badgeX = x + inset
    const badgeY = y + inset
    this.ctx.beginPath()
    this.ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, badgeHeight / 2)
    this.ctx.fill()
    this.ctx.stroke()
    this.ctx.fillStyle = '#f8fafc'
    this.ctx.font = `700 ${Math.max(11, Math.round(shortEdge * 0.12))}px ${CANVAS_FONT_FAMILY}`
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    this.ctx.fillText('TIPP', badgeX + badgeWidth / 2, badgeY + badgeHeight / 2)
    this.ctx.restore()
  }

  private renderEmptyTile(x: number, y: number): void {
    const accentColor = '#f59e0b'
    const baseColor = '#0f172a'
    const panelColor = '#1e293b'
    const stripeColor = 'rgba(255, 255, 255, 0.08)'
    const outlineColor = 'rgba(255, 255, 255, 0.2)'
    const textColor = '#f8fafc'
    const tileShortEdge = Math.min(this.tileWidth, this.tileHeight)
    const padding = Math.max(6, Math.round(tileShortEdge * 0.08))
    const slotX = x + padding
    const slotY = y + padding
    const slotWidth = this.tileWidth - padding * 2
    const slotHeight = this.tileHeight - padding * 2
    const cornerInset = Math.max(6, Math.round(tileShortEdge * 0.08))
    const cornerLength = Math.max(12, Math.round(tileShortEdge * 0.16))
    const stripeSpacing = Math.max(16, Math.round(tileShortEdge * 0.18))
    const stripeLineWidth = Math.max(6, Math.round(tileShortEdge * 0.06))
    const labelSize = Math.max(14, Math.round(tileShortEdge * 0.18))

    this.ctx.save()
    this.ctx.fillStyle = baseColor
    this.ctx.fillRect(x, y, this.tileWidth, this.tileHeight)

    this.ctx.fillStyle = panelColor
    this.ctx.fillRect(slotX, slotY, slotWidth, slotHeight)

    this.ctx.beginPath()
    this.ctx.rect(slotX, slotY, slotWidth, slotHeight)
    this.ctx.clip()

    this.ctx.lineWidth = stripeLineWidth
    this.ctx.strokeStyle = stripeColor
    for (let offset = -slotHeight; offset < slotWidth + slotHeight; offset += stripeSpacing) {
      this.ctx.beginPath()
      this.ctx.moveTo(slotX + offset, slotY + slotHeight)
      this.ctx.lineTo(slotX + offset + slotHeight, slotY)
      this.ctx.stroke()
    }

    this.ctx.restore()

    this.ctx.save()
    this.ctx.strokeStyle = accentColor
    this.ctx.lineWidth = Math.max(3, Math.round(tileShortEdge * 0.03))
    this.ctx.setLineDash([10, 8])
    this.ctx.strokeRect(slotX, slotY, slotWidth, slotHeight)
    this.ctx.setLineDash([])

    this.ctx.strokeStyle = outlineColor
    this.ctx.lineWidth = 1
    this.ctx.strokeRect(x + 0.5, y + 0.5, this.tileWidth - 1, this.tileHeight - 1)

    this.drawCornerBracket(slotX + cornerInset, slotY + cornerInset, 1, 1, cornerLength, accentColor)
    this.drawCornerBracket(slotX + slotWidth - cornerInset, slotY + cornerInset, -1, 1, cornerLength, accentColor)
    this.drawCornerBracket(slotX + cornerInset, slotY + slotHeight - cornerInset, 1, -1, cornerLength, accentColor)
    this.drawCornerBracket(
      slotX + slotWidth - cornerInset,
      slotY + slotHeight - cornerInset,
      -1,
      -1,
      cornerLength,
      accentColor
    )

    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'
    this.ctx.shadowBlur = 8
    this.ctx.fillStyle = textColor
    this.ctx.font = `700 ${labelSize}px ${CANVAS_FONT_FAMILY}`
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    this.ctx.fillText('LEER', x + this.tileWidth / 2, y + this.tileHeight / 2)
    this.ctx.restore()
  }

  private renderTileNumberCorrectnessOverlay(
    tile: Tile,
    x: number,
    y: number,
    tileNumberCorrectnessPulseProgress: number | null
  ): void {
    if (tile.isEmpty || tileNumberCorrectnessPulseProgress === null) return

    const shortEdge = Math.min(this.tileWidth, this.tileHeight)
    const progress = Math.max(0, Math.min(1, tileNumberCorrectnessPulseProgress))
    const isCorrect = tile.row === tile.correctRow && tile.col === tile.correctCol
    const pulseStrength = isCorrect
      ? Math.sin(progress * Math.PI)
      : Math.pow((Math.sin(progress * Math.PI * 6 - Math.PI / 2) + 1) / 2, 1.85) * (1 - progress * 0.18)
    const effectStrength = (isCorrect ? 0.3 : 0.22) + pulseStrength * (isCorrect ? 0.7 : 0.78)

    const inset = Math.max(2, Math.round(shortEdge * 0.02))
    const outerInset = Math.max(5, Math.round(shortEdge * 0.05))
    const lineWidth = Math.max(2, Math.round(shortEdge * 0.028))
    const glowBlur = Math.max(14, Math.round(shortEdge * (isCorrect ? 0.3 : 0.26) * (0.88 + effectStrength)))
    const fillAlpha = (isCorrect ? 0.14 : 0.11) + effectStrength * (isCorrect ? 0.22 : 0.2)
    const strokeAlpha = (isCorrect ? 0.36 : 0.3) + effectStrength * (isCorrect ? 0.58 : 0.56)
    const topAlpha = (isCorrect ? 0.16 : 0.12) + effectStrength * (isCorrect ? 0.18 : 0.17)
    const glowColor = isCorrect
      ? `rgba(34, 197, 94, ${0.24 + effectStrength * 0.38})`
      : `rgba(239, 68, 68, ${0.22 + effectStrength * 0.36})`
    const gradient = this.ctx.createLinearGradient(x, y, x, y + this.tileHeight)

    if (isCorrect) {
      gradient.addColorStop(0, `rgba(134, 239, 172, ${topAlpha})`)
      gradient.addColorStop(1, `rgba(21, 128, 61, ${fillAlpha})`)
    } else {
      gradient.addColorStop(0, `rgba(252, 165, 165, ${topAlpha})`)
      gradient.addColorStop(1, `rgba(185, 28, 28, ${fillAlpha})`)
    }

    this.ctx.save()
    this.ctx.fillStyle = gradient
    this.ctx.fillRect(x + inset, y + inset, this.tileWidth - inset * 2, this.tileHeight - inset * 2)

    this.ctx.strokeStyle = isCorrect
      ? `rgba(187, 247, 208, ${strokeAlpha})`
      : `rgba(254, 202, 202, ${strokeAlpha})`
    this.ctx.lineWidth = lineWidth
    this.ctx.shadowColor = glowColor
    this.ctx.shadowBlur = glowBlur
    this.ctx.strokeRect(
      x + outerInset + lineWidth / 2,
      y + outerInset + lineWidth / 2,
      this.tileWidth - outerInset * 2 - lineWidth,
      this.tileHeight - outerInset * 2 - lineWidth
    )
    this.ctx.restore()
  }

  private renderTileNumberBadge(
    tile: Tile,
    x: number,
    y: number,
    tileNumberCorrectnessPulseProgress: number | null
  ): void {
    if (tile.isEmpty) return

    const shortEdge = Math.min(this.tileWidth, this.tileHeight)
    const inset = Math.max(8, Math.round(shortEdge * 0.08))
    const badgeHeight = Math.max(26, Math.round(shortEdge * 0.2))
    const badgeWidth = Math.max(36, Math.round(this.tileWidth * 0.24))
    const badgeX = x + inset
    const badgeY = y + inset
    const label = String(tile.correctIndex + 1)
    const isCorrect = tile.row === tile.correctRow && tile.col === tile.correctCol
    const progress = tileNumberCorrectnessPulseProgress === null
      ? null
      : Math.max(0, Math.min(1, tileNumberCorrectnessPulseProgress))
    const pulseStrength = progress === null
      ? 0
      : isCorrect
        ? Math.sin(progress * Math.PI)
        : Math.pow((Math.sin(progress * Math.PI * 6 - Math.PI / 2) + 1) / 2, 1.85) * (1 - progress * 0.18)
    const hasAnimatedPalette = progress !== null
    const colorStrength = (isCorrect ? 0.34 : 0.24) + pulseStrength * (isCorrect ? 0.66 : 0.76)
    const fillStyle = hasAnimatedPalette
      ? isCorrect
        ? `rgba(21, 128, 61, ${0.74 + colorStrength * 0.18})`
        : `rgba(185, 28, 28, ${0.72 + colorStrength * 0.2})`
      : 'rgba(8, 15, 30, 0.68)'
    const strokeStyle = hasAnimatedPalette
      ? isCorrect
        ? `rgba(220, 252, 231, ${0.62 + colorStrength * 0.24})`
        : `rgba(254, 226, 226, ${0.58 + colorStrength * 0.26})`
      : 'rgba(248, 250, 252, 0.28)'
    const shadowColor = hasAnimatedPalette
      ? isCorrect
        ? `rgba(34, 197, 94, ${0.24 + colorStrength * 0.34})`
        : `rgba(239, 68, 68, ${0.22 + colorStrength * 0.34})`
      : 'rgba(2, 6, 23, 0.34)'
    const textStrokeStyle = hasAnimatedPalette
      ? isCorrect
        ? `rgba(20, 83, 45, ${0.5 + colorStrength * 0.12})`
        : `rgba(127, 29, 29, ${0.52 + colorStrength * 0.12})`
      : 'rgba(2, 6, 23, 0.55)'
    const textFillStyle = hasAnimatedPalette
      ? '#f8fafc'
      : '#f8fafc'
    const shadowBlur = hasAnimatedPalette
      ? Math.max(12, Math.round(shortEdge * 0.16 + colorStrength * shortEdge * 0.1))
      : 10

    this.ctx.save()
    this.ctx.fillStyle = fillStyle
    this.ctx.strokeStyle = strokeStyle
    this.ctx.lineWidth = 1
    this.ctx.shadowColor = shadowColor
    this.ctx.shadowBlur = shadowBlur
    this.ctx.beginPath()
    this.ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, badgeHeight / 2)
    this.ctx.fill()
    this.ctx.shadowBlur = 0
    this.ctx.stroke()

    const fontSize = Math.max(12, Math.round(shortEdge * 0.13))
    this.ctx.font = `800 ${fontSize}px ${CANVAS_FONT_FAMILY}`
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    this.ctx.lineWidth = Math.max(2, Math.round(shortEdge * 0.02))
    this.ctx.strokeStyle = textStrokeStyle
    this.ctx.strokeText(label, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2)
    this.ctx.fillStyle = textFillStyle
    this.ctx.fillText(label, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2)
    this.ctx.restore()
  }

  private renderTileNumbers(
    state: PuzzleState,
    moveAnimation: TileMoveAnimation | null,
    tileNumberCorrectnessPulseProgress: number | null
  ): void {
    const animatedTileId = moveAnimation?.tileId ?? null
    const animationProgress = moveAnimation ? this.easeOutQuart(moveAnimation.progress) : 0

    state.tiles.forEach((tile) => {
      if (tile.isEmpty) return

      if (moveAnimation && tile.id === animatedTileId) {
        const startX = moveAnimation.fromCol * this.tileWidth
        const startY = moveAnimation.fromRow * this.tileHeight
        const targetX = moveAnimation.toCol * this.tileWidth
        const targetY = moveAnimation.toRow * this.tileHeight
        const animatedX = startX + (targetX - startX) * animationProgress
        const animatedY = startY + (targetY - startY) * animationProgress
        this.renderTileNumberBadge(tile, animatedX, animatedY, tileNumberCorrectnessPulseProgress)
        return
      }

      this.renderTileNumberBadge(
        tile,
        tile.col * this.tileWidth,
        tile.row * this.tileHeight,
        tileNumberCorrectnessPulseProgress
      )
    })
  }

  private drawCornerBracket(
    x: number,
    y: number,
    horizontalDirection: 1 | -1,
    verticalDirection: 1 | -1,
    length: number,
    color: string
  ): void {
    this.ctx.save()
    this.ctx.strokeStyle = color
    this.ctx.lineWidth = Math.max(3, Math.round(Math.min(this.tileWidth, this.tileHeight) * 0.02))
    this.ctx.beginPath()
    this.ctx.moveTo(x + horizontalDirection * length, y)
    this.ctx.lineTo(x, y)
    this.ctx.lineTo(x, y + verticalDirection * length)
    this.ctx.stroke()
    this.ctx.restore()
  }

  private drawTileImage(tile: Tile, x: number, y: number): void {
    const srcX = tile.imageSliceRef.sourceX
    const srcY = tile.imageSliceRef.sourceY
    const srcW = tile.imageSliceRef.sourceWidth
    const srcH = tile.imageSliceRef.sourceHeight

    try {
      this.ctx.drawImage(this.sourceImage, srcX, srcY, srcW, srcH, x, y, this.tileWidth, this.tileHeight)
    } catch {
      this.ctx.fillStyle = '#e0e0e0'
      this.ctx.fillRect(x, y, this.tileWidth, this.tileHeight)
    }
  }

  private easeOutQuart(progress: number): number {
    const clamped = Math.max(0, Math.min(1, progress))
    return 1 - Math.pow(1 - clamped, 4)
  }

  private easeOutCubic(progress: number): number {
    const clamped = Math.max(0, Math.min(1, progress))
    return 1 - Math.pow(1 - clamped, 3)
  }
}
