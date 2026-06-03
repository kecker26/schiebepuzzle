const HERO_CANVAS_SIZE = 960
const HERO_IMAGE_PADDING = 68
const HERO_IMAGE_RADIUS = 40
const HERO_GRID_SIZE = 4
const HERO_GRID_SHADOW_WIDTH = 14
const HERO_GRID_HIGHLIGHT_WIDTH = 4
const HERO_EMPTY_TILE_INSET = 10
const HERO_OUTPUT_QUALITY = 0.9

function addRoundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const roundedRadius = Math.max(0, Math.min(radius, width / 2, height / 2))

  context.beginPath()
  context.moveTo(x + roundedRadius, y)
  context.lineTo(x + width - roundedRadius, y)
  context.quadraticCurveTo(x + width, y, x + width, y + roundedRadius)
  context.lineTo(x + width, y + height - roundedRadius)
  context.quadraticCurveTo(x + width, y + height, x + width - roundedRadius, y + height)
  context.lineTo(x + roundedRadius, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - roundedRadius)
  context.lineTo(x, y + roundedRadius)
  context.quadraticCurveTo(x, y, x + roundedRadius, y)
  context.closePath()
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Bild konnte nicht geladen werden'))
    image.src = source
  })
}

function drawGridLine(
  context: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number
): void {
  context.lineCap = 'round'

  context.strokeStyle = 'rgba(6, 14, 28, 0.82)'
  context.lineWidth = HERO_GRID_SHADOW_WIDTH
  context.beginPath()
  context.moveTo(startX, startY)
  context.lineTo(endX, endY)
  context.stroke()

  context.strokeStyle = 'rgba(255, 255, 255, 0.68)'
  context.lineWidth = HERO_GRID_HIGHLIGHT_WIDTH
  context.beginPath()
  context.moveTo(startX, startY)
  context.lineTo(endX, endY)
  context.stroke()
}

function drawPuzzleGrid(context: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const tileSize = size / HERO_GRID_SIZE

  drawGridLine(context, x, y, x + size, y)
  drawGridLine(context, x + size, y, x + size, y + size)
  drawGridLine(context, x + size, y + size, x, y + size)
  drawGridLine(context, x, y + size, x, y)

  for (let index = 1; index < HERO_GRID_SIZE; index += 1) {
    const verticalX = x + tileSize * index
    const horizontalY = y + tileSize * index
    drawGridLine(context, verticalX, y, verticalX, y + size)
    drawGridLine(context, x, horizontalY, x + size, horizontalY)
  }

  const emptyTileX = x + tileSize * (HERO_GRID_SIZE - 1) + HERO_EMPTY_TILE_INSET
  const emptyTileY = y + tileSize * (HERO_GRID_SIZE - 1) + HERO_EMPTY_TILE_INSET
  const emptyTileSize = tileSize - HERO_EMPTY_TILE_INSET * 2

  context.fillStyle = 'rgba(5, 12, 24, 0.36)'
  addRoundedRectPath(context, emptyTileX, emptyTileY, emptyTileSize, emptyTileSize, 22)
  context.fill()

  context.strokeStyle = 'rgba(255, 255, 255, 0.78)'
  context.lineWidth = 2.5
  addRoundedRectPath(context, emptyTileX, emptyTileY, emptyTileSize, emptyTileSize, 22)
  context.stroke()
}

export async function createStartScreenHeroTexture(source: string): Promise<string> {
  try {
    const image = await loadImage(source)
    const canvas = document.createElement('canvas')
    canvas.width = HERO_CANVAS_SIZE
    canvas.height = HERO_CANVAS_SIZE

    const context = canvas.getContext('2d')
    if (!context) {
      return source
    }

    const sourceSquare = Math.min(image.width, image.height)
    const sourceX = (image.width - sourceSquare) / 2
    const sourceY = (image.height - sourceSquare) / 2

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSquare,
      sourceSquare,
      0,
      0,
      HERO_CANVAS_SIZE,
      HERO_CANVAS_SIZE
    )

    const highlightGradient = context.createRadialGradient(
      HERO_CANVAS_SIZE * 0.22,
      HERO_CANVAS_SIZE * 0.16,
      HERO_CANVAS_SIZE * 0.04,
      HERO_CANVAS_SIZE * 0.22,
      HERO_CANVAS_SIZE * 0.16,
      HERO_CANVAS_SIZE * 0.7
    )
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.18)')
    highlightGradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.05)')
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    context.fillStyle = highlightGradient
    context.fillRect(0, 0, HERO_CANVAS_SIZE, HERO_CANVAS_SIZE)

    const shadeGradient = context.createLinearGradient(0, 0, 0, HERO_CANVAS_SIZE)
    shadeGradient.addColorStop(0, 'rgba(8, 18, 38, 0.04)')
    shadeGradient.addColorStop(0.58, 'rgba(8, 18, 38, 0.08)')
    shadeGradient.addColorStop(1, 'rgba(8, 18, 38, 0.26)')
    context.fillStyle = shadeGradient
    context.fillRect(0, 0, HERO_CANVAS_SIZE, HERO_CANVAS_SIZE)

    return canvas.toDataURL('image/jpeg', HERO_OUTPUT_QUALITY)
  } catch {
    return source
  }
}

export async function createStartScreenHeroImage(source: string): Promise<string> {
  try {
    const image = await loadImage(source)
    const canvas = document.createElement('canvas')
    canvas.width = HERO_CANVAS_SIZE
    canvas.height = HERO_CANVAS_SIZE

    const context = canvas.getContext('2d')
    if (!context) {
      return source
    }

    const canvasSize = HERO_CANVAS_SIZE
    const imageSize = canvasSize - HERO_IMAGE_PADDING * 2
    const sourceSquare = Math.min(image.width, image.height)
    const sourceX = (image.width - sourceSquare) / 2
    const sourceY = (image.height - sourceSquare) / 2

    const backgroundGradient = context.createLinearGradient(0, 0, canvasSize, canvasSize)
    backgroundGradient.addColorStop(0, '#18325f')
    backgroundGradient.addColorStop(1, '#081020')
    context.fillStyle = backgroundGradient
    addRoundedRectPath(context, 0, 0, canvasSize, canvasSize, 42)
    context.fill()

    context.fillStyle = 'rgba(104, 195, 255, 0.12)'
    context.beginPath()
    context.arc(154, 156, 122, 0, Math.PI * 2)
    context.fill()

    context.fillStyle = 'rgba(110, 231, 183, 0.1)'
    context.beginPath()
    context.arc(canvasSize - 136, canvasSize - 140, 148, 0, Math.PI * 2)
    context.fill()

    context.save()
    addRoundedRectPath(
      context,
      HERO_IMAGE_PADDING,
      HERO_IMAGE_PADDING,
      imageSize,
      imageSize,
      HERO_IMAGE_RADIUS
    )
    context.clip()

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSquare,
      sourceSquare,
      HERO_IMAGE_PADDING,
      HERO_IMAGE_PADDING,
      imageSize,
      imageSize
    )

    const imageShadeGradient = context.createLinearGradient(
      HERO_IMAGE_PADDING,
      HERO_IMAGE_PADDING,
      HERO_IMAGE_PADDING,
      HERO_IMAGE_PADDING + imageSize
    )
    imageShadeGradient.addColorStop(0, 'rgba(8, 18, 38, 0.08)')
    imageShadeGradient.addColorStop(1, 'rgba(8, 18, 38, 0.22)')
    context.fillStyle = imageShadeGradient
    context.fillRect(HERO_IMAGE_PADDING, HERO_IMAGE_PADDING, imageSize, imageSize)

    context.restore()

    context.strokeStyle = 'rgba(255, 255, 255, 0.14)'
    context.lineWidth = 2
    addRoundedRectPath(
      context,
      HERO_IMAGE_PADDING + 1,
      HERO_IMAGE_PADDING + 1,
      imageSize - 2,
      imageSize - 2,
      HERO_IMAGE_RADIUS - 1
    )
    context.stroke()

    drawPuzzleGrid(context, HERO_IMAGE_PADDING, HERO_IMAGE_PADDING, imageSize)

    return canvas.toDataURL('image/jpeg', HERO_OUTPUT_QUALITY)
  } catch {
    return source
  }
}
