import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useOptionalTheme } from '../../contexts/ThemeContext.tsx'
import { extractLocalImageThemePalette } from '../../services/ImageThemeService.ts'
import type { ImageThemePalette } from '../../types/index'

export type UploadImagePaletteStyle = CSSProperties & Record<`--${string}`, string>

export function createUploadImagePaletteStyle(
  palette: ImageThemePalette | null
): UploadImagePaletteStyle | undefined {
  if (!palette) return undefined

  return {
    '--image-accent-solid': palette.accentSolid,
    '--image-accent-soft': palette.accentSoft,
    '--image-accent-strong': palette.accentStrong,
    '--image-glow': palette.glow,
    '--image-radiance': `color-mix(in srgb, ${palette.glow} 76%, ${palette.primaryColor})`,
    '--image-radiance-soft': `color-mix(in srgb, ${palette.glow} 42%, transparent)`,
    '--image-radiance-ring': `color-mix(in srgb, ${palette.primaryColor} 72%, #ffffff)`,
    '--image-radiance-border': `color-mix(in srgb, ${palette.glow} 48%, var(--card-border))`,
    '--image-radiance-shadow': `color-mix(in srgb, ${palette.primaryShadowHover} 78%, ${palette.glow})`,
    '--focus-ring': `0 0 0 4px color-mix(in srgb, ${palette.primaryColor} 32%, transparent), 0 0 0 1px color-mix(in srgb, ${palette.primaryColor} 72%, #ffffff)`,
    '--primary-color': palette.primaryColor,
    '--primary-hover': palette.primaryHover,
    '--primary-shadow': palette.primaryShadow,
    '--primary-shadow-hover': palette.primaryShadowHover,
  }
}

export function useUploadImagePalette({
  paletteSource,
  storedPalette,
}: {
  paletteSource: string | null | undefined
  storedPalette: ImageThemePalette | null | undefined
}) {
  const theme = useOptionalTheme()
  const emotionThemeEnabled = theme?.emotionThemeEnabled ?? true
  const [fallbackPalette, setFallbackPalette] = useState<ImageThemePalette | null>(null)

  useEffect(() => {
    if (!emotionThemeEnabled || storedPalette) {
      setFallbackPalette(null)
      return
    }

    if (!paletteSource) {
      setFallbackPalette(null)
      return
    }

    let isCancelled = false

    extractLocalImageThemePalette(paletteSource).then((palette) => {
      if (!isCancelled) {
        setFallbackPalette(palette)
      }
    })

    return () => {
      isCancelled = true
    }
  }, [emotionThemeEnabled, paletteSource, storedPalette])

  const rawPalette = storedPalette ?? fallbackPalette
  const activePalette = theme ? theme.resolveImagePalette(rawPalette) : rawPalette
  const paletteStyle = useMemo(() => createUploadImagePaletteStyle(activePalette), [activePalette])

  return { activePalette, paletteStyle }
}
