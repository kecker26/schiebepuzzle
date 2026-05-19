import { useEffect, useState } from 'react'
import { useTheme } from '../contexts/ThemeContext.tsx'
import { extractLocalImageThemePalette } from '../services/ImageThemeService.ts'
import type { ImageThemePalette } from '../types/index.ts'

export function useImageThemePalette(image: string | null, croppedImage: string | null): ImageThemePalette | null {
  const { emotionThemeEnabled, setImagePalette } = useTheme()
  const [palette, setPalette] = useState<ImageThemePalette | null>(null)

  useEffect(() => {
    const activeImage = croppedImage ?? image
    let cancelled = false

    if (!activeImage || !emotionThemeEnabled) {
      setPalette(null)
      setImagePalette(null)
      return
    }

    const applyImageTheme = async () => {
      const localPalette = await extractLocalImageThemePalette(activeImage)
      if (!cancelled) {
        setPalette(localPalette)
        setImagePalette(localPalette)
      }
    }

    void applyImageTheme()

    return () => {
      cancelled = true
    }
  }, [croppedImage, emotionThemeEnabled, image, setImagePalette])

  return palette
}
