export interface ImageThemePalette {
  accentSolid: string
  accentSoft: string
  accentStrong: string
  glow: string
  primaryColor: string
  primaryHover: string
  primaryShadow: string
  primaryShadowHover: string
}

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function rgbToCss({ r, g, b }: RgbColor): string {
  return `rgb(${r}, ${g}, ${b})`
}

function rgbaToCss({ r, g, b }: RgbColor, alpha: number): string {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
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

export async function extractImageThemePalette(src: string): Promise<ImageThemePalette | null> {
  try {
    const image = await loadImage(src)
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return null

    const sampleSize = 48
    canvas.width = sampleSize
    canvas.height = sampleSize
    context.drawImage(image, 0, 0, sampleSize, sampleSize)

    const { data } = context.getImageData(0, 0, sampleSize, sampleSize)
    let redTotal = 0
    let greenTotal = 0
    let blueTotal = 0
    let weightTotal = 0

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
      weightTotal += weight
    }

    if (weightTotal === 0) return null

    const average = {
      r: Math.round(redTotal / weightTotal),
      g: Math.round(greenTotal / weightTotal),
      b: Math.round(blueTotal / weightTotal),
    }

    const hsl = rgbToHsl(average)
    const tunedBase = hslToRgb({
      h: hsl.h,
      s: clamp(Math.max(0.42, hsl.s * 1.35), 0.42, 0.82),
      l: clamp(hsl.l, 0.44, 0.62),
    })
    const tunedGlow = hslToRgb({
      h: hsl.h,
      s: clamp(Math.max(0.5, hsl.s * 1.28), 0.5, 0.88),
      l: clamp(hsl.l + 0.12, 0.52, 0.74),
    })
    const tunedPrimary = hslToRgb({
      h: hsl.h,
      s: clamp(Math.max(0.58, hsl.s * 1.32), 0.58, 0.88),
      l: clamp(hsl.l - 0.08, 0.38, 0.5),
    })
    const tunedPrimaryHover = hslToRgb({
      h: hsl.h,
      s: clamp(Math.max(0.6, hsl.s * 1.38), 0.6, 0.9),
      l: clamp(hsl.l - 0.16, 0.3, 0.44),
    })

    return {
      accentSolid: rgbToCss(tunedBase),
      accentSoft: rgbaToCss(tunedBase, 0.28),
      accentStrong: rgbaToCss(tunedBase, 0.5),
      glow: rgbaToCss(tunedGlow, 0.68),
      primaryColor: rgbToCss(tunedPrimary),
      primaryHover: rgbToCss(tunedPrimaryHover),
      primaryShadow: rgbaToCss(tunedPrimary, 0.28),
      primaryShadowHover: rgbaToCss(tunedPrimaryHover, 0.38),
    }
  } catch {
    return null
  }
}