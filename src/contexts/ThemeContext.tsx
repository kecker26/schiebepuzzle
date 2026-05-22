import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { ImageThemePalette } from '../types/index.ts'

export type ThemeMode = 'light' | 'dark'

interface ThemeState {
  mode: ThemeMode
  imagePalette: ImageThemePalette | null
  activeImagePalette: ImageThemePalette
  emotionThemeEnabled: boolean
  setMode: (mode: ThemeMode) => void
  setImagePalette: (palette: ImageThemePalette | null) => void
  setEmotionThemeEnabled: (enabled: boolean) => void
  resolveImagePalette: (palette: ImageThemePalette | null | undefined) => ImageThemePalette | null
  toggleMode: () => void
  toggleEmotionTheme: () => void
}

const ThemeContext = createContext<ThemeState | null>(null)

const STORAGE_KEY_MODE = 'puzzle-theme-mode'
const STORAGE_KEY_EMOTION_THEME = 'puzzle-emotion-theme-enabled'
const DEFAULT_IMAGE_THEME: ImageThemePalette = {
  accentSolid: 'rgb(88, 136, 216)',
  accentSoft: 'rgba(88, 136, 216, 0.18)',
  accentStrong: 'rgba(88, 136, 216, 0.34)',
  glow: 'rgba(136, 182, 255, 0.48)',
  primaryColor: '#2563eb',
  primaryHover: '#1d4ed8',
  primaryShadow: 'rgba(37, 99, 235, 0.28)',
  primaryShadowHover: 'rgba(37, 99, 235, 0.38)',
  mood: 'calm',
  moodLabel: 'Ruhig',
  confidence: 0,
  source: 'fallback',
  reason: null,
  analyzedAt: new Date(0).toISOString(),
}

const RADIANCE_STRENGTH_BY_MOOD: Record<ImageThemePalette['mood'], number> = {
  joyful: 0.68,
  melancholic: 0.34,
  dark: 0.38,
  energetic: 0.74,
  calm: 0.42,
  dramatic: 0.58,
  nostalgic: 0.5,
  dreamy: 0.64,
  epic: 0.66,
  minimal: 0.28,
}

interface RgbColor {
  r: number
  g: number
  b: number
}

function clampColorChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)))
}

function parseCssColor(color: string): RgbColor | null {
  const trimmed = color.trim()

  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1)
    const normalized = hex.length === 3
      ? hex.split('').map((character) => character + character).join('')
      : hex

    if (normalized.length !== 6) return null

    const value = Number.parseInt(normalized, 16)
    if (Number.isNaN(value)) return null

    return {
      r: (value >> 16) & 255,
      g: (value >> 8) & 255,
      b: value & 255,
    }
  }

  const rgbMatch = trimmed.match(/^rgba?\(([^)]+)\)$/i)
  if (!rgbMatch) return null

  const channels = rgbMatch[1]
    .split(',')
    .slice(0, 3)
    .map((channel) => Number.parseFloat(channel.trim()))

  if (channels.length !== 3 || channels.some((channel) => Number.isNaN(channel))) return null

  return {
    r: clampColorChannel(channels[0]),
    g: clampColorChannel(channels[1]),
    b: clampColorChannel(channels[2]),
  }
}

function getRelativeLuminance({ r, g, b }: RgbColor): number {
  const channels = [r, g, b].map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

function getContrastRatio(first: RgbColor, second: RgbColor): number {
  const firstLuminance = getRelativeLuminance(first)
  const secondLuminance = getRelativeLuminance(second)
  const lighter = Math.max(firstLuminance, secondLuminance)
  const darker = Math.min(firstLuminance, secondLuminance)
  return (lighter + 0.05) / (darker + 0.05)
}

function getTextOnPrimaryColor(primaryColor: string, primaryHover: string): string {
  const primary = parseCssColor(primaryColor)
  const hover = parseCssColor(primaryHover)
  if (!primary || !hover) return '#ffffff'

  const lightText = { r: 255, g: 255, b: 255 }
  const darkText = { r: 15, g: 23, b: 42 }
  const lightContrast = Math.min(getContrastRatio(primary, lightText), getContrastRatio(hover, lightText))
  const darkContrast = Math.min(getContrastRatio(primary, darkText), getContrastRatio(hover, darkText))

  return darkContrast > lightContrast ? '#0f172a' : '#ffffff'
}

function getRadianceStrength(imageTheme: ImageThemePalette): string {
  const baseStrength = RADIANCE_STRENGTH_BY_MOOD[imageTheme.mood] ?? RADIANCE_STRENGTH_BY_MOOD.calm
  const confidenceMultiplier = 0.82 + Math.min(1, Math.max(0, imageTheme.confidence)) * 0.28
  const sourceMultiplier = imageTheme.source === 'fallback' ? 0.78 : 1
  const strength = Math.min(0.78, Math.max(0.22, baseStrength * confidenceMultiplier * sourceMultiplier))

  return strength.toFixed(2)
}

function getStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_MODE)
    if (stored === 'dark' || stored === 'light') return stored
  } catch {
    /* ignore */
  }
  return 'light'
}

function getStoredEmotionThemeEnabled(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_EMOTION_THEME)
    if (stored === 'false') return false
    if (stored === 'true') return true
  } catch {
    /* ignore */
  }
  return true
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(getStoredMode)
  const [imagePalette, setImagePaletteState] = useState<ImageThemePalette | null>(null)
  const [emotionThemeEnabled, setEmotionThemeEnabledState] = useState<boolean>(getStoredEmotionThemeEnabled)

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    try {
      localStorage.setItem(STORAGE_KEY_MODE, next)
    } catch {
      /* ignore */
    }
  }, [])

  const setImagePalette = useCallback((next: ImageThemePalette | null) => {
    setImagePaletteState(next)
  }, [])

  const setEmotionThemeEnabled = useCallback((next: boolean) => {
    setEmotionThemeEnabledState(next)
    try {
      localStorage.setItem(STORAGE_KEY_EMOTION_THEME, String(next))
    } catch {
      /* ignore */
    }
  }, [])

  const toggleMode = useCallback(() => {
    setModeState((current) => {
      const next = current === 'light' ? 'dark' : 'light'
      try {
        localStorage.setItem(STORAGE_KEY_MODE, next)
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const toggleEmotionTheme = useCallback(() => {
    setEmotionThemeEnabledState((current) => {
      const next = !current
      try {
        localStorage.setItem(STORAGE_KEY_EMOTION_THEME, String(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const resolveImagePalette = useCallback((palette: ImageThemePalette | null | undefined) => {
    return emotionThemeEnabled ? palette ?? null : null
  }, [emotionThemeEnabled])

  const activeImagePalette = resolveImagePalette(imagePalette) ?? DEFAULT_IMAGE_THEME

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', mode)
    root.setAttribute('data-emotion-theme', emotionThemeEnabled ? 'on' : 'off')

    root.setAttribute('data-image-mood', activeImagePalette.mood)
    root.setAttribute('data-image-palette-source', activeImagePalette.source)
    root.style.setProperty('--image-accent-solid', activeImagePalette.accentSolid)
    root.style.setProperty('--image-accent-soft', activeImagePalette.accentSoft)
    root.style.setProperty('--image-accent-strong', activeImagePalette.accentStrong)
    root.style.setProperty('--image-glow', activeImagePalette.glow)
    root.style.setProperty('--theme-radiance-strength', getRadianceStrength(activeImagePalette))
    root.style.setProperty('--primary-color', activeImagePalette.primaryColor)
    root.style.setProperty('--primary-hover', activeImagePalette.primaryHover)
    root.style.setProperty('--primary-shadow', activeImagePalette.primaryShadow)
    root.style.setProperty('--primary-shadow-hover', activeImagePalette.primaryShadowHover)
    root.style.setProperty(
      '--text-on-primary',
      getTextOnPrimaryColor(activeImagePalette.primaryColor, activeImagePalette.primaryHover)
    )
  }, [activeImagePalette, emotionThemeEnabled, mode])

  return (
    <ThemeContext.Provider value={{
      mode,
      imagePalette,
      activeImagePalette,
      emotionThemeEnabled,
      setMode,
      setImagePalette,
      setEmotionThemeEnabled,
      resolveImagePalette,
      toggleMode,
      toggleEmotionTheme,
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useOptionalTheme(): ThemeState | null {
  return useContext(ThemeContext)
}

export function useTheme(): ThemeState {
  const ctx = useOptionalTheme()
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
