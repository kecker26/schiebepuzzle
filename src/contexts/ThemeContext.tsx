import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { ImageThemePalette } from '../services/ImageThemeService.ts'

export type ThemeMode = 'light' | 'dark'

interface ThemeState {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  setImagePalette: (palette: ImageThemePalette | null) => void
  toggleMode: () => void
}

const ThemeContext = createContext<ThemeState | null>(null)

const STORAGE_KEY_MODE = 'puzzle-theme-mode'
const DEFAULT_IMAGE_THEME: ImageThemePalette = {
  accentSolid: 'rgb(88, 136, 216)',
  accentSoft: 'rgba(88, 136, 216, 0.18)',
  accentStrong: 'rgba(88, 136, 216, 0.34)',
  glow: 'rgba(136, 182, 255, 0.48)',
  primaryColor: '#2563eb',
  primaryHover: '#1d4ed8',
  primaryShadow: 'rgba(37, 99, 235, 0.28)',
  primaryShadowHover: 'rgba(37, 99, 235, 0.38)',
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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(getStoredMode)
  const [imagePalette, setImagePaletteState] = useState<ImageThemePalette | null>(null)

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

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', mode)

    const activeImageTheme = imagePalette ?? DEFAULT_IMAGE_THEME
    root.style.setProperty('--image-accent-solid', activeImageTheme.accentSolid)
    root.style.setProperty('--image-accent-soft', activeImageTheme.accentSoft)
    root.style.setProperty('--image-accent-strong', activeImageTheme.accentStrong)
    root.style.setProperty('--image-glow', activeImageTheme.glow)
    root.style.setProperty('--primary-color', activeImageTheme.primaryColor)
    root.style.setProperty('--primary-hover', activeImageTheme.primaryHover)
    root.style.setProperty('--primary-shadow', activeImageTheme.primaryShadow)
    root.style.setProperty('--primary-shadow-hover', activeImageTheme.primaryShadowHover)
  }, [mode, imagePalette])

  return (
    <ThemeContext.Provider value={{ mode, setMode, setImagePalette, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}