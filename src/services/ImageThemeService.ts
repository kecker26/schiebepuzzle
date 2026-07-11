import { FastAverageColor, type FastAverageColorResult } from 'fast-average-color'
import type { ImageThemeMoodId, ImageThemePalette, ImageThemePaletteSource } from '../types/index.ts'

interface RgbColor {
  r: number
  g: number
  b: number
}

interface HslColor {
  h: number
  s: number
  l: number
}

interface ImageColorStats {
  average: RgbColor
  saturation: number
  lightness: number
  contrast: number
  warmShare: number
}

interface MoodThemeDefinition {
  label: string
  hueShift: number
  minSaturation: number
  saturationBoost: number
  baseLightness: [number, number]
  primaryLightness: [number, number]
  glowLightness: [number, number]
  glowAlpha: number
  softAlpha: number
  strongAlpha: number
}

const IMAGE_THEME_SAMPLE_SIZE = 56
const fastAverageColor = new FastAverageColor()
const MOOD_DEFINITIONS: Record<ImageThemeMoodId, MoodThemeDefinition> = {
  joyful: {
    label: 'Froehlich',
    hueShift: 0.02,
    minSaturation: 0.58,
    saturationBoost: 1.62,
    baseLightness: [0.52, 0.68],
    primaryLightness: [0.42, 0.54],
    glowLightness: [0.64, 0.82],
    glowAlpha: 0.9,
    softAlpha: 0.38,
    strongAlpha: 0.68,
  },
  melancholic: {
    label: 'Melancholisch',
    hueShift: -0.04,
    minSaturation: 0.34,
    saturationBoost: 1.08,
    baseLightness: [0.38, 0.54],
    primaryLightness: [0.32, 0.44],
    glowLightness: [0.46, 0.64],
    glowAlpha: 0.62,
    softAlpha: 0.28,
    strongAlpha: 0.46,
  },
  dark: {
    label: 'Duester',
    hueShift: -0.02,
    minSaturation: 0.38,
    saturationBoost: 1.26,
    baseLightness: [0.28, 0.42],
    primaryLightness: [0.3, 0.42],
    glowLightness: [0.42, 0.58],
    glowAlpha: 0.58,
    softAlpha: 0.26,
    strongAlpha: 0.44,
  },
  energetic: {
    label: 'Energiegeladen',
    hueShift: 0.04,
    minSaturation: 0.68,
    saturationBoost: 1.82,
    baseLightness: [0.48, 0.62],
    primaryLightness: [0.4, 0.5],
    glowLightness: [0.58, 0.76],
    glowAlpha: 0.94,
    softAlpha: 0.4,
    strongAlpha: 0.72,
  },
  calm: {
    label: 'Ruhig',
    hueShift: -0.07,
    minSaturation: 0.36,
    saturationBoost: 1.12,
    baseLightness: [0.46, 0.62],
    primaryLightness: [0.36, 0.48],
    glowLightness: [0.58, 0.74],
    glowAlpha: 0.68,
    softAlpha: 0.3,
    strongAlpha: 0.5,
  },
  dramatic: {
    label: 'Dramatisch',
    hueShift: 0.01,
    minSaturation: 0.52,
    saturationBoost: 1.56,
    baseLightness: [0.34, 0.5],
    primaryLightness: [0.32, 0.44],
    glowLightness: [0.5, 0.68],
    glowAlpha: 0.88,
    softAlpha: 0.34,
    strongAlpha: 0.66,
  },
  nostalgic: {
    label: 'Nostalgisch',
    hueShift: 0.07,
    minSaturation: 0.42,
    saturationBoost: 1.18,
    baseLightness: [0.46, 0.6],
    primaryLightness: [0.36, 0.48],
    glowLightness: [0.56, 0.72],
    glowAlpha: 0.74,
    softAlpha: 0.34,
    strongAlpha: 0.56,
  },
  dreamy: {
    label: 'Vertraeumt',
    hueShift: -0.09,
    minSaturation: 0.46,
    saturationBoost: 1.34,
    baseLightness: [0.5, 0.68],
    primaryLightness: [0.38, 0.5],
    glowLightness: [0.66, 0.84],
    glowAlpha: 0.92,
    softAlpha: 0.38,
    strongAlpha: 0.64,
  },
  epic: {
    label: 'Episch',
    hueShift: -0.01,
    minSaturation: 0.56,
    saturationBoost: 1.52,
    baseLightness: [0.36, 0.52],
    primaryLightness: [0.3, 0.44],
    glowLightness: [0.54, 0.72],
    glowAlpha: 0.92,
    softAlpha: 0.34,
    strongAlpha: 0.68,
  },
  minimal: {
    label: 'Minimalistisch',
    hueShift: 0,
    minSaturation: 0.28,
    saturationBoost: 0.98,
    baseLightness: [0.44, 0.58],
    primaryLightness: [0.34, 0.46],
    glowLightness: [0.52, 0.68],
    glowAlpha: 0.52,
    softAlpha: 0.24,
    strongAlpha: 0.38,
  },
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalizeHue(value: number): number {
  return ((value % 1) + 1) % 1
}

function rgbToCss({ r, g, b }: RgbColor): string {
  return `rgb(${r}, ${g}, ${b})`
}

function rgbaToCss({ r, g, b }: RgbColor, alpha: number): string {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function mixRgbColors(baseColor: RgbColor, overlayColor: RgbColor, overlayWeight: number): RgbColor {
  const weight = clamp(overlayWeight, 0, 1)
  const baseWeight = 1 - weight

  return {
    r: Math.round(baseColor.r * baseWeight + overlayColor.r * weight),
    g: Math.round(baseColor.g * baseWeight + overlayColor.g * weight),
    b: Math.round(baseColor.b * baseWeight + overlayColor.b * weight),
  }
}

function readFastAverageColorResult(result: FastAverageColorResult): RgbColor | null {
  if (result.error || result.value[3] < 12) return null

  return {
    r: clamp(Math.round(result.value[0]), 0, 255),
    g: clamp(Math.round(result.value[1]), 0, 255),
    b: clamp(Math.round(result.value[2]), 0, 255),
  }
}

function rgbToHsl({ r, g, b }: RgbColor): HslColor {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const lightness = (max + min) / 2

  if (max === min) {
    return { h: 0, s: 0, l: lightness }
  }

  const delta = max - min
  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)

  let hue = 0
  switch (max) {
    case red:
      hue = (green - blue) / delta + (green < blue ? 6 : 0)
      break
    case green:
      hue = (blue - red) / delta + 2
      break
    default:
      hue = (red - green) / delta + 4
      break
  }

  return { h: hue / 6, s: saturation, l: lightness }
}

function hueToRgb(p: number, q: number, t: number): number {
  let next = t
  if (next < 0) next += 1
  if (next > 1) next -= 1
  if (next < 1 / 6) return p + (q - p) * 6 * next
  if (next < 1 / 2) return q
  if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6
  return p
}

function hslToRgb({ h, s, l }: HslColor): RgbColor {
  if (s === 0) {
    const gray = Math.round(l * 255)
    return { r: gray, g: gray, b: gray }
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q

  return {
    r: Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, h) * 255),
    b: Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

function calculateImageColorStats(data: Uint8ClampedArray): ImageColorStats | null {
  let redTotal = 0
  let greenTotal = 0
  let blueTotal = 0
  let weightTotal = 0
  let saturationTotal = 0
  let lightnessTotal = 0
  let warmTotal = 0
  const lightnessValues: number[] = []

  for (let index = 0; index < data.length; index += 16) {
    const alpha = data[index + 3] / 255
    if (alpha < 0.2) continue

    const red = data[index]
    const green = data[index + 1]
    const blue = data[index + 2]
    const pixelHsl = rgbToHsl({ r: red, g: green, b: blue })
    const tonalBalance = clamp(1 - Math.abs(pixelHsl.l - 0.52) * 1.55, 0.18, 1)
    const saturationBias = 0.45 + pixelHsl.s * 1.8
    const weight = tonalBalance * saturationBias

    redTotal += red * weight
    greenTotal += green * weight
    blueTotal += blue * weight
    saturationTotal += pixelHsl.s * weight
    lightnessTotal += pixelHsl.l * weight
    warmTotal += isWarmHue(pixelHsl.h) ? weight : 0
    lightnessValues.push(pixelHsl.l)
    weightTotal += weight
  }

  if (weightTotal === 0) return null

  const averageLightness = lightnessTotal / weightTotal
  const variance = lightnessValues.reduce((sum, value) => sum + (value - averageLightness) ** 2, 0) / lightnessValues.length

  return {
    average: {
      r: Math.round(redTotal / weightTotal),
      g: Math.round(greenTotal / weightTotal),
      b: Math.round(blueTotal / weightTotal),
    },
    saturation: saturationTotal / weightTotal,
    lightness: averageLightness,
    contrast: Math.sqrt(variance),
    warmShare: warmTotal / weightTotal,
  }
}

function isWarmHue(hue: number): boolean {
  return hue < 0.17 || hue > 0.88 || (hue > 0.08 && hue < 0.2)
}

function inferLocalMood(stats: ImageColorStats): ImageThemeMoodId {
  if (stats.saturation < 0.18 && stats.contrast < 0.14) return 'minimal'
  if (stats.lightness < 0.34 && stats.contrast > 0.18) return 'dramatic'
  if (stats.lightness < 0.36) return 'dark'
  if (stats.saturation > 0.54 && stats.contrast > 0.18) return stats.warmShare > 0.44 ? 'energetic' : 'epic'
  if (stats.saturation > 0.48 && stats.lightness > 0.52) return 'joyful'
  if (stats.saturation < 0.28 && stats.lightness < 0.48) return 'melancholic'
  if (stats.warmShare > 0.58 && stats.saturation < 0.46) return 'nostalgic'
  if (stats.lightness > 0.58 && stats.contrast < 0.14) return 'dreamy'
  return 'calm'
}

export function buildImageThemePalette(
  baseColor: RgbColor,
  mood: ImageThemeMoodId,
  source: ImageThemePaletteSource,
  options: {
    confidence?: number
    reason?: string | null
    moodLabel?: string | null
  } = {}
): ImageThemePalette {
  const definition = MOOD_DEFINITIONS[mood] ?? MOOD_DEFINITIONS.calm
  const baseHsl = rgbToHsl(baseColor)
  const hue = normalizeHue(baseHsl.h + definition.hueShift)
  const saturation = clamp(
    Math.max(definition.minSaturation, baseHsl.s * definition.saturationBoost * 1.08),
    0.24,
    0.98
  )
  const tunedBase = hslToRgb({
    h: hue,
    s: saturation,
    l: clamp(baseHsl.l, definition.baseLightness[0], definition.baseLightness[1]),
  })
  const tunedGlow = hslToRgb({
    h: normalizeHue(hue - definition.hueShift * 0.45),
    s: clamp(Math.max(definition.minSaturation + 0.04, saturation * 1.04), 0.28, 1),
    l: clamp(baseHsl.l + 0.16, definition.glowLightness[0], definition.glowLightness[1]),
  })
  const tunedPrimary = hslToRgb({
    h: hue,
    s: clamp(Math.max(definition.minSaturation + 0.12, saturation * 1.14), 0.32, 1),
    l: clamp(baseHsl.l - 0.08, definition.primaryLightness[0], definition.primaryLightness[1]),
  })
  const tunedPrimaryHover = hslToRgb({
    h: hue,
    s: clamp(Math.max(definition.minSaturation + 0.16, saturation * 1.22), 0.36, 1),
    l: clamp(baseHsl.l - 0.16, Math.max(0.22, definition.primaryLightness[0] - 0.08), definition.primaryLightness[1] - 0.04),
  })

  return {
    accentSolid: rgbToCss(tunedBase),
    accentSoft: rgbaToCss(tunedBase, definition.softAlpha),
    accentStrong: rgbaToCss(tunedBase, definition.strongAlpha),
    glow: rgbaToCss(tunedGlow, definition.glowAlpha),
    primaryColor: rgbToCss(tunedPrimary),
    primaryHover: rgbToCss(tunedPrimaryHover),
    primaryShadow: rgbaToCss(tunedPrimary, clamp(definition.strongAlpha * 0.66, 0.28, 0.5)),
    primaryShadowHover: rgbaToCss(tunedPrimaryHover, clamp(definition.strongAlpha * 0.82, 0.34, 0.6)),
    mood,
    moodLabel: options.moodLabel?.trim() || definition.label,
    confidence: clamp(options.confidence ?? 0.58, 0, 1),
    source,
    reason: options.reason?.trim() ? options.reason.trim().slice(0, 180) : null,
    analyzedAt: new Date().toISOString(),
  }
}

async function readImageColorStats(src: string): Promise<ImageColorStats | null> {
  try {
    const image = await loadImage(src)
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return null

    canvas.width = IMAGE_THEME_SAMPLE_SIZE
    canvas.height = IMAGE_THEME_SAMPLE_SIZE
    context.drawImage(image, 0, 0, IMAGE_THEME_SAMPLE_SIZE, IMAGE_THEME_SAMPLE_SIZE)

    const { data } = context.getImageData(0, 0, IMAGE_THEME_SAMPLE_SIZE, IMAGE_THEME_SAMPLE_SIZE)
    const stats = calculateImageColorStats(data)
    if (!stats) return null

    const averageColor = readFastAverageColorResult(fastAverageColor.getColor(canvas, {
      algorithm: 'sqrt',
      defaultColor: [stats.average.r, stats.average.g, stats.average.b, 255],
      mode: 'precision',
      silent: true,
    }))
    const dominantColor = readFastAverageColorResult(fastAverageColor.getColor(canvas, {
      algorithm: 'dominant',
      defaultColor: [stats.average.r, stats.average.g, stats.average.b, 255],
      dominantDivider: 24,
      mode: 'precision',
      silent: true,
    }))

    if (!averageColor && !dominantColor) return stats

    const dominantSaturation = dominantColor ? rgbToHsl(dominantColor).s : 0
    const dominantWeight = dominantColor
      ? clamp(0.42 + dominantSaturation * 0.22 + stats.contrast * 0.32, 0.42, 0.68)
      : 0
    const refinedAverage = averageColor
      ? mixRgbColors(stats.average, averageColor, 0.62)
      : stats.average
    const refinedBase = dominantColor
      ? mixRgbColors(refinedAverage, dominantColor, dominantWeight)
      : refinedAverage

    return {
      ...stats,
      average: refinedBase,
    }
  } catch {
    return null
  }
}

export async function extractLocalImageThemePalette(src: string): Promise<ImageThemePalette | null> {
  const stats = await readImageColorStats(src)
  if (!stats) return null

  const mood = inferLocalMood(stats)
  return buildImageThemePalette(stats.average, mood, 'local-color', {
    confidence: 0.76,
    reason: 'Lokale Farbanalyse mit dominanter fast-average-color-Basis, Helligkeit, Sättigung, Kontrast und Waermeanteil.',
  })
}

export async function extractImageThemePalette(src: string): Promise<ImageThemePalette | null> {
  return extractLocalImageThemePalette(src)
}
