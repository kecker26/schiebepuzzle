import { useEffect, useRef, useState } from 'react'
import { createStartScreenHeroTexture } from '../services/StartScreenHeroRenderer.ts'
import { createGeneratedRandomImage } from '../services/GeneratedImageProvider.ts'
import { fetchRandomPuzzleImage } from '../services/RandomImageService.ts'
import { AppState, SavedGameSummary, SolvedGallery } from '../types/index'

interface StartScreenHeroOptions {
  appState: AppState
  gallery?: SolvedGallery | null
  savedGames?: SavedGameSummary[]
  isLoadingGallery?: boolean
  isLoadingSavedGames?: boolean
}

export function useStartScreenHero({ appState }: StartScreenHeroOptions): string | null {
  const [heroImage, setHeroImage] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (appState !== 'welcome') {
      return
    }

    let isCancelled = false
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    const applyHeroIfCurrent = (nextHeroImage: string | null): void => {
      if (isCancelled || requestIdRef.current !== requestId) {
        return
      }

      setHeroImage(nextHeroImage)
    }

    void (async () => {
      try {
        const provisionalSource = createGeneratedRandomImage()
        if (provisionalSource) {
          applyHeroIfCurrent(await createStartScreenHeroTexture(provisionalSource))
        }

        const randomSource = await fetchRandomPuzzleImage()
        if (!randomSource) {
          return
        }

        applyHeroIfCurrent(await createStartScreenHeroTexture(randomSource))
      } catch {
        applyHeroIfCurrent(null)
      }
    })()

    return () => {
      isCancelled = true
    }
  }, [appState])

  return heroImage
}
