export interface RandomImageDimensions {
  width: number
  height: number
}

export const DEFAULT_RANDOM_IMAGE_MAX_EDGE = 1400

type RandomImageOrientation = 'square' | 'landscape' | 'portrait'

const RANDOM_IMAGE_DIMENSION_PRESETS: Record<RandomImageOrientation, RandomImageDimensions[]> = {
  square: [
    { width: 1400, height: 1400 },
    { width: 1280, height: 1280 },
  ],
  landscape: [
    { width: 1600, height: 1200 },
    { width: 1500, height: 1000 },
    { width: 1400, height: 900 },
  ],
  portrait: [
    { width: 1200, height: 1600 },
    { width: 1200, height: 1500 },
    { width: 900, height: 1400 },
  ],
}

const RANDOM_IMAGE_ORIENTATIONS: RandomImageOrientation[] = ['square', 'landscape', 'portrait']

function clampDimension(value: number): number {
  return Math.max(1, Math.round(value))
}

export function createImageDimensions(width: number, height: number): RandomImageDimensions {
  return {
    width: clampDimension(width),
    height: clampDimension(height),
  }
}

export function scaleImageDimensions(
  width: number,
  height: number,
  maxEdge: number = DEFAULT_RANDOM_IMAGE_MAX_EDGE
): RandomImageDimensions {
  const safeDimensions = createImageDimensions(width, height)
  const safeMaxEdge = clampDimension(maxEdge)
  const longestEdge = Math.max(safeDimensions.width, safeDimensions.height)
  const scale = longestEdge > safeMaxEdge ? safeMaxEdge / longestEdge : 1

  return createImageDimensions(safeDimensions.width * scale, safeDimensions.height * scale)
}

export function pickRandomImageDimensions(maxEdge: number = DEFAULT_RANDOM_IMAGE_MAX_EDGE): RandomImageDimensions {
  const orientation =
    RANDOM_IMAGE_ORIENTATIONS[Math.floor(Math.random() * RANDOM_IMAGE_ORIENTATIONS.length)]
    ?? RANDOM_IMAGE_ORIENTATIONS[0]
  const presets = RANDOM_IMAGE_DIMENSION_PRESETS[orientation]
  const preset = presets[Math.floor(Math.random() * presets.length)] ?? presets[0]

  return scaleImageDimensions(preset.width, preset.height, maxEdge)
}
