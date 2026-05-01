import {
  DEFAULT_RANDOM_IMAGE_MAX_EDGE,
  createImageDimensions,
  pickRandomImageDimensions,
  type RandomImageDimensions,
} from './RandomImageDimensions.ts'

const GENERATED_IMAGE_QUALITY = 0.92

interface GeneratedPalette {
  skyTop: string
  skyBottom: string
  accent: string
  ground: string
  groundShade: string
  glow: string
}

const GENERATED_PALETTES: GeneratedPalette[] = [
  {
    skyTop: '#79c7ff',
    skyBottom: '#f3fbff',
    accent: '#ffd76e',
    ground: '#7ed8a6',
    groundShade: '#2d7d6b',
    glow: '#9dd8ff',
  },
  {
    skyTop: '#ffb78e',
    skyBottom: '#fff1dd',
    accent: '#ffef96',
    ground: '#7fc97f',
    groundShade: '#35695f',
    glow: '#ffd2b0',
  },
  {
    skyTop: '#b9b3ff',
    skyBottom: '#f9f6ff',
    accent: '#fff3a2',
    ground: '#71d3c8',
    groundShade: '#24586c',
    glow: '#d6c7ff',
  },
  {
    skyTop: '#95d8d2',
    skyBottom: '#eefcf7',
    accent: '#ffe18a',
    ground: '#73c87a',
    groundShade: '#2d5b4d',
    glow: '#9fe5da',
  },
]

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)] ?? items[0]
}

function drawCircleGlow(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number
): void {
  context.save()
  context.globalAlpha = alpha
  context.fillStyle = color
  context.beginPath()
  context.arc(x, y, radius, 0, Math.PI * 2)
  context.fill()
  context.restore()
}

function drawLandscapeLayer(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: string,
  baseline: number,
  amplitude: number,
  controlShift: number
): void {
  context.fillStyle = color
  context.beginPath()
  context.moveTo(0, height)
  context.lineTo(0, baseline + randomBetween(-amplitude * 0.2, amplitude * 0.2))

  for (let index = 1; index <= 4; index += 1) {
    const x = (width / 4) * index
    const y = baseline + randomBetween(-amplitude, amplitude)
    const controlX = x - width / 8
    const controlY = y - controlShift
    context.quadraticCurveTo(controlX, controlY, x, y)
  }

  context.lineTo(width, height)
  context.closePath()
  context.fill()
}

function drawLightStreaks(context: CanvasRenderingContext2D, width: number, height: number): void {
  const shortEdge = Math.min(width, height)
  context.save()
  context.globalAlpha = 0.16
  context.strokeStyle = '#ffffff'
  context.lineWidth = shortEdge * 0.012

  for (let index = 0; index < 3; index += 1) {
    const startX = randomBetween(width * 0.08, width * 0.32)
    const startY = randomBetween(height * 0.1, height * 0.45)
    const endX = startX + randomBetween(width * 0.28, width * 0.5)
    const endY = startY + randomBetween(height * 0.06, height * 0.16)

    context.beginPath()
    context.moveTo(startX, startY)
    context.quadraticCurveTo(
      startX + (endX - startX) * 0.45,
      startY - shortEdge * 0.08,
      endX,
      endY
    )
    context.stroke()
  }

  context.restore()
}

function resolveGeneratedImageDimensions(
  sizeOrDimensions?: number | RandomImageDimensions
): RandomImageDimensions {
  if (typeof sizeOrDimensions === 'number') {
    return createImageDimensions(sizeOrDimensions, sizeOrDimensions)
  }

  if (sizeOrDimensions) {
    return createImageDimensions(sizeOrDimensions.width, sizeOrDimensions.height)
  }

  return pickRandomImageDimensions(DEFAULT_RANDOM_IMAGE_MAX_EDGE)
}

export function createGeneratedRandomImage(sizeOrDimensions?: number | RandomImageDimensions): string {
  const { width, height } = resolveGeneratedImageDimensions(sizeOrDimensions)
  const shortEdge = Math.min(width, height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    return ''
  }

  const palette = pickRandom(GENERATED_PALETTES)
  const skyGradient = context.createLinearGradient(0, 0, 0, height)
  skyGradient.addColorStop(0, palette.skyTop)
  skyGradient.addColorStop(0.58, palette.skyBottom)
  skyGradient.addColorStop(1, palette.ground)

  context.fillStyle = skyGradient
  context.fillRect(0, 0, width, height)

  drawCircleGlow(
    context,
    randomBetween(width * 0.18, width * 0.8),
    randomBetween(height * 0.12, height * 0.26),
    randomBetween(shortEdge * 0.07, shortEdge * 0.11) * shortEdge,
    palette.accent,
    0.95
  )

  drawCircleGlow(
    context,
    randomBetween(width * 0.12, width * 0.32),
    randomBetween(height * 0.18, height * 0.34),
    randomBetween(shortEdge * 0.12, shortEdge * 0.18) * shortEdge,
    palette.glow,
    0.18
  )

  drawCircleGlow(
    context,
    randomBetween(width * 0.66, width * 0.9),
    randomBetween(height * 0.58, height * 0.82),
    randomBetween(shortEdge * 0.12, shortEdge * 0.19) * shortEdge,
    '#ffffff',
    0.08
  )

  drawLightStreaks(context, width, height)

  drawLandscapeLayer(
    context,
    width,
    height,
    'rgba(255, 255, 255, 0.22)',
    height * 0.54,
    height * 0.04,
    height * 0.025
  )
  drawLandscapeLayer(context, width, height, palette.ground, height * 0.63, height * 0.06, height * 0.03)
  drawLandscapeLayer(
    context,
    width,
    height,
    palette.groundShade,
    height * 0.74,
    height * 0.07,
    height * 0.035
  )

  context.save()
  context.globalAlpha = 0.08
  context.fillStyle = '#081020'
  for (let index = 0; index < 28; index += 1) {
    const x = randomBetween(0, width)
    const y = randomBetween(0, height)
    const radius = randomBetween(shortEdge * 0.006, shortEdge * 0.018)
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.fill()
  }
  context.restore()

  return canvas.toDataURL('image/jpeg', GENERATED_IMAGE_QUALITY)
}
