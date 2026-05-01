import { Dispatch, SetStateAction, useCallback, useEffect, useState } from 'react'
import { loadPuzzleStats, resetPuzzleStats } from '../services/StatsService.ts'
import { PuzzleStats } from '../types/index'
import { getErrorMessage } from './appUtils.ts'

interface PuzzleStatsResult {
  statsOverview: PuzzleStats | null
  isLoadingStats: boolean
  isResettingStats: boolean
  statsError: string | null
  setStatsOverview: Dispatch<SetStateAction<PuzzleStats | null>>
  setStatsError: Dispatch<SetStateAction<string | null>>
  refreshStats: (showSpinner?: boolean) => Promise<void>
  resetStats: () => Promise<void>
}

export function usePuzzleStats(): PuzzleStatsResult {
  const [statsOverview, setStatsOverview] = useState<PuzzleStats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [isResettingStats, setIsResettingStats] = useState(false)
  const [statsError, setStatsError] = useState<string | null>(null)

  const refreshStats = useCallback(async (showSpinner: boolean = true) => {
    if (showSpinner) {
      setIsLoadingStats(true)
    }

    try {
      const nextStats = await loadPuzzleStats()
      setStatsOverview(nextStats)
      setStatsError(null)
    } catch (error) {
      setStatsError(`Statistiken konnten nicht geladen werden: ${getErrorMessage(error)}`)
    } finally {
      if (showSpinner) {
        setIsLoadingStats(false)
      }
    }
  }, [])

  const resetStats = useCallback(async () => {
    setIsResettingStats(true)
    try {
      const emptyStats = await resetPuzzleStats()
      setStatsOverview(emptyStats)
      setStatsError(null)
    } catch (error) {
      setStatsError(`Statistiken konnten nicht geloescht werden: ${getErrorMessage(error)}`)
      throw error
    } finally {
      setIsResettingStats(false)
    }
  }, [])

  useEffect(() => {
    void refreshStats()
  }, [refreshStats])

  return {
    statsOverview,
    isLoadingStats,
    isResettingStats,
    statsError,
    setStatsOverview,
    setStatsError,
    refreshStats,
    resetStats,
  }
}
