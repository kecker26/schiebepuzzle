import { Dispatch, SetStateAction, useCallback, useEffect, useState } from 'react'
import { loadImageCollections } from '../services/CollectionService.ts'
import { ImageCollections } from '../types/index'
import { getErrorMessage } from './appUtils.ts'

interface ImageCollectionsResult {
  collections: ImageCollections | null
  isLoadingCollections: boolean
  collectionsError: string | null
  setCollections: Dispatch<SetStateAction<ImageCollections | null>>
  setCollectionsError: Dispatch<SetStateAction<string | null>>
  refreshCollections: (showSpinner?: boolean) => Promise<void>
}

export function useImageCollections(): ImageCollectionsResult {
  const [collections, setCollections] = useState<ImageCollections | null>(null)
  const [isLoadingCollections, setIsLoadingCollections] = useState(true)
  const [collectionsError, setCollectionsError] = useState<string | null>(null)

  const refreshCollections = useCallback(async (showSpinner: boolean = true) => {
    if (showSpinner) {
      setIsLoadingCollections(true)
    }

    try {
      const nextCollections = await loadImageCollections()
      setCollections(nextCollections)
      setCollectionsError(null)
    } catch (error) {
      setCollectionsError(`Sammlungen konnten nicht geladen werden: ${getErrorMessage(error)}`)
    } finally {
      if (showSpinner) {
        setIsLoadingCollections(false)
      }
    }
  }, [])

  useEffect(() => {
    void refreshCollections()
  }, [refreshCollections])

  return {
    collections,
    isLoadingCollections,
    collectionsError,
    setCollections,
    setCollectionsError,
    refreshCollections,
  }
}
