import { Dispatch, SetStateAction, useCallback, useEffect, useState } from 'react'
import { listSavedGames } from '../services/SaveService.ts'
import { SavedGameSummary } from '../types/index'
import { getErrorMessage } from './appUtils.ts'

interface SavedGamesCatalogResult {
  savedGames: SavedGameSummary[]
  isLoadingSavedGames: boolean
  savedGamesError: string | null
  setSavedGames: Dispatch<SetStateAction<SavedGameSummary[]>>
  setSavedGamesError: Dispatch<SetStateAction<string | null>>
  refreshSavedGames: (showSpinner?: boolean) => Promise<void>
}

export function useSavedGamesCatalog(): SavedGamesCatalogResult {
  const [savedGames, setSavedGames] = useState<SavedGameSummary[]>([])
  const [isLoadingSavedGames, setIsLoadingSavedGames] = useState(true)
  const [savedGamesError, setSavedGamesError] = useState<string | null>(null)

  const refreshSavedGames = useCallback(async (showSpinner: boolean = true) => {
    if (showSpinner) {
      setIsLoadingSavedGames(true)
    }

    try {
      const items = await listSavedGames()
      setSavedGames(items)
      setSavedGamesError(null)
    } catch (error) {
      setSavedGamesError(`Spielstände konnten nicht geladen werden: ${getErrorMessage(error)}`)
    } finally {
      if (showSpinner) {
        setIsLoadingSavedGames(false)
      }
    }
  }, [])

  useEffect(() => {
    void refreshSavedGames()
  }, [refreshSavedGames])

  return {
    savedGames,
    isLoadingSavedGames,
    savedGamesError,
    setSavedGames,
    setSavedGamesError,
    refreshSavedGames,
  }
}
