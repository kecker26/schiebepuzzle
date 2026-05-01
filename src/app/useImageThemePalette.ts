import { useEffect } from 'react'
import { useTheme } from '../contexts/ThemeContext.tsx'
import { extractImageThemePalette } from '../services/ImageThemeService.ts'

export function useImageThemePalette(image: string | null, croppedImage: string | null): void {
  const { setImagePalette } = useTheme()

  useEffect(() => {
    const activeImage = croppedImage ?? image
    let cancelled = false

    if (!activeImage) {
      setImagePalette(null)
      return
    }

    const applyImageTheme = async () => {
      const palette = await extractImageThemePalette(activeImage)
      if (!cancelled) {
        setImagePalette(palette)
      }
    }

    void applyImageTheme()

    return () => {
      cancelled = true
    }
  }, [croppedImage, image, setImagePalette])
}
