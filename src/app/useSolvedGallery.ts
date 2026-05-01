import { Dispatch, SetStateAction, useCallback, useEffect, useState } from 'react'
import { loadSolvedGallery, resetSolvedGallery } from '../services/GalleryService.ts'
import { SolvedGallery } from '../types/index'
import { getErrorMessage } from './appUtils.ts'

interface SolvedGalleryResult {
  gallery: SolvedGallery | null
  isLoadingGallery: boolean
  isResettingGallery: boolean
  galleryError: string | null
  setGallery: Dispatch<SetStateAction<SolvedGallery | null>>
  setGalleryError: Dispatch<SetStateAction<string | null>>
  refreshGallery: (showSpinner?: boolean) => Promise<void>
  resetGallery: () => Promise<void>
}

export function useSolvedGallery(): SolvedGalleryResult {
  const [gallery, setGallery] = useState<SolvedGallery | null>(null)
  const [isLoadingGallery, setIsLoadingGallery] = useState(true)
  const [isResettingGallery, setIsResettingGallery] = useState(false)
  const [galleryError, setGalleryError] = useState<string | null>(null)

  const refreshGallery = useCallback(async (showSpinner: boolean = true) => {
    if (showSpinner) {
      setIsLoadingGallery(true)
    }

    try {
      const nextGallery = await loadSolvedGallery()
      setGallery(nextGallery)
      setGalleryError(null)
    } catch (error) {
      setGalleryError(`Galerie konnte nicht geladen werden: ${getErrorMessage(error)}`)
    } finally {
      if (showSpinner) {
        setIsLoadingGallery(false)
      }
    }
  }, [])

  const resetGallery = useCallback(async () => {
    setIsResettingGallery(true)
    try {
      const emptyGallery = await resetSolvedGallery()
      setGallery(emptyGallery)
      setGalleryError(null)
    } catch (error) {
      setGalleryError(`Galerie konnte nicht geloescht werden: ${getErrorMessage(error)}`)
      throw error
    } finally {
      setIsResettingGallery(false)
    }
  }, [])

  useEffect(() => {
    void refreshGallery()
  }, [refreshGallery])

  return {
    gallery,
    isLoadingGallery,
    isResettingGallery,
    galleryError,
    setGallery,
    setGalleryError,
    refreshGallery,
    resetGallery,
  }
}
