import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAccessibilityAnnouncer } from '../../app/accessibilityAnnouncer.tsx'
import AnimatedButton from '../../motion/AnimatedButton.tsx'
import AnimatedChipButton from '../../motion/AnimatedChipButton.tsx'
import AnimatedSwapPane from '../../motion/AnimatedSwapPane.tsx'
import { PuzzleCompletionRecord } from '../../types/index'
import { formatDifficultyLabel } from '../../utils/puzzleDifficulty.ts'
import {
  HistoryFilter,
  HistoryFilterDefinition,
  StandardDifficultyStatsEntry,
  buildDifficultyReportRows,
  formatAssistanceModeLabel,
  formatDate,
  formatProfileSourceLabel,
  formatTime,
  getCompletionExtraMoves,
} from './uploadUtils.ts'
import UploadStatsSection from './UploadStatsSection.tsx'

type SortDirection = 'asc' | 'desc'

type HistorySortKey =
  | 'completedAt'
  | 'difficulty'
  | 'time'
  | 'moves'
  | 'actionMoves'
  | 'extraMoves'
  | 'assistanceMode'
  | 'profile'

interface UploadStatsHistorySectionProps {
  isLoadingStats: boolean
  completionHistory: PuzzleCompletionRecord[]
  filteredHistory: PuzzleCompletionRecord[]
  historyFilter: HistoryFilter
  historyFilterOptions: HistoryFilterDefinition[]
  standardDifficultyStats: StandardDifficultyStatsEntry[]
  onHistoryFilterChange: (value: HistoryFilter) => void
  onReloadView: () => void
  onBackToStart: () => void
}

interface HistoryDifficultyReportSummary {
  bestTime: number | null
  worstTime: number | null
  bestMoves: number | null
  worstMoves: number | null
}

interface HistoryDisplayEntry {
  entry: PuzzleCompletionRecord
  completedAtValue: number | null
  difficultyRows: number
  difficultyCols: number
  actionMovesValue: number | null
  extraMovesValue: number | null
  assistanceRank: number
  profileRank: number
  isBestTime: boolean
  isWorstTime: boolean
  isBestMoves: boolean
  isWorstMoves: boolean
  timeBadges: string[]
  moveBadges: string[]
}

const HISTORY_SORT_LABELS: Record<HistorySortKey, string> = {
  completedAt: 'Datum',
  difficulty: 'Stufe',
  time: 'Zeit',
  moves: 'Netto-Zuege',
  actionMoves: 'Aktionen',
  extraMoves: 'Umwege',
  assistanceMode: 'Laufart',
  profile: 'Datenquelle',
}

function getDifficultyKey(entry: Pick<PuzzleCompletionRecord, 'config'>): `${number}x${number}` {
  return `${entry.config.rows}x${entry.config.cols}`
}

function getHistoryCellTone(isBest: boolean, isWorst: boolean): string {
  if (isBest && isWorst) return ' is-extreme-dual'
  if (isBest) return ' is-positive'
  if (isWorst) return ' is-negative'
  return ''
}

function getTimeCopyLabel(isBest: boolean, isWorst: boolean): string {
  if (isBest && isWorst) return 'Bestzeit und langsamste Zeit'
  if (isBest) return 'Bestzeit'
  if (isWorst) return 'langsamste Zeit'
  return 'Laufzeit'
}

function getMovesCopyLabel(isBest: boolean, isWorst: boolean): string {
  if (isBest && isWorst) return 'wenigste und meiste Netto-Zuege'
  if (isBest) return 'wenigste Netto-Zuege'
  if (isWorst) return 'meiste Netto-Zuege'
  return 'Netto'
}

function getExtremeBadges(isBest: boolean, isWorst: boolean, bestLabel: string, worstLabel: string): string[] {
  const badges: string[] = []

  if (isBest) {
    badges.push(bestLabel)
  }

  if (isWorst) {
    badges.push(worstLabel)
  }

  return badges
}

function compareNullableNumbers(left: number | null, right: number | null, direction: SortDirection): number {
  if (left === null && right === null) return 0
  if (left === null) return 1
  if (right === null) return -1
  return direction === 'asc' ? left - right : right - left
}

function parseOptionalTimestamp(timestamp: string | null | undefined): number | null {
  if (!timestamp) return null

  const parsed = Date.parse(timestamp)
  return Number.isNaN(parsed) ? null : parsed
}

function compareDifficulty(
  left: Pick<HistoryDisplayEntry, 'difficultyRows' | 'difficultyCols'>,
  right: Pick<HistoryDisplayEntry, 'difficultyRows' | 'difficultyCols'>,
  direction: SortDirection
): number {
  if (left.difficultyRows !== right.difficultyRows) {
    return direction === 'asc'
      ? left.difficultyRows - right.difficultyRows
      : right.difficultyRows - left.difficultyRows
  }

  return direction === 'asc'
    ? left.difficultyCols - right.difficultyCols
    : right.difficultyCols - left.difficultyCols
}

function getAssistanceRank(entry: PuzzleCompletionRecord): number {
  if (!entry.hasDetailedProfile) return 3
  if (entry.assistanceMode === 'clean') return 0
  if (entry.assistanceMode === 'hinted') return 1
  return 2
}

function getSortIndicator(key: HistorySortKey, activeKey: HistorySortKey, direction: SortDirection): string {
  if (key !== activeKey) return '\u2195'
  return direction === 'asc' ? '\u2191' : '\u2193'
}

function buildHistoryDisplayEntries(
  entries: PuzzleCompletionRecord[],
  difficultyReportMap: Map<string, HistoryDifficultyReportSummary>
): HistoryDisplayEntry[] {
  return entries.map((entry) => {
    const difficultyReport = difficultyReportMap.get(getDifficultyKey(entry))
    const isBestTime = difficultyReport?.bestTime === entry.time
    const isWorstTime = difficultyReport?.worstTime === entry.time
    const isBestMoves = difficultyReport?.bestMoves === entry.moves
    const isWorstMoves = difficultyReport?.worstMoves === entry.moves

    return {
      entry,
      completedAtValue: parseOptionalTimestamp(entry.completedAt),
      difficultyRows: entry.config.rows,
      difficultyCols: entry.config.cols,
      actionMovesValue: entry.hasDetailedProfile ? entry.actionMoves : null,
      extraMovesValue: entry.hasDetailedProfile ? getCompletionExtraMoves(entry) : null,
      assistanceRank: getAssistanceRank(entry),
      profileRank: entry.hasDetailedProfile ? 1 : 0,
      isBestTime,
      isWorstTime,
      isBestMoves,
      isWorstMoves,
      timeBadges: getExtremeBadges(isBestTime, isWorstTime, 'Bestzeit', 'Langsamste Zeit'),
      moveBadges: getExtremeBadges(isBestMoves, isWorstMoves, 'Wenigste Zuege', 'Meiste Zuege'),
    }
  })
}

function sortHistoryEntries(
  entries: HistoryDisplayEntry[],
  sortKey: HistorySortKey,
  direction: SortDirection
): HistoryDisplayEntry[] {
  return [...entries].sort((left, right) => {
    let result = 0

    switch (sortKey) {
      case 'completedAt':
        result = compareNullableNumbers(left.completedAtValue, right.completedAtValue, direction)
        break
      case 'difficulty':
        result = compareDifficulty(left, right, direction)
        break
      case 'time':
        result = compareNullableNumbers(left.entry.time, right.entry.time, direction)
        break
      case 'moves':
        result = compareNullableNumbers(left.entry.moves, right.entry.moves, direction)
        break
      case 'actionMoves':
        result = compareNullableNumbers(left.actionMovesValue, right.actionMovesValue, direction)
        break
      case 'extraMoves':
        result = compareNullableNumbers(left.extraMovesValue, right.extraMovesValue, direction)
        break
      case 'assistanceMode':
        result = compareNullableNumbers(left.assistanceRank, right.assistanceRank, direction)
        break
      case 'profile':
        result = compareNullableNumbers(left.profileRank, right.profileRank, direction)
        break
      default:
        result = 0
        break
    }

    if (result !== 0) return result
    return compareNullableNumbers(right.completedAtValue, left.completedAtValue, 'asc')
  })
}

export default function UploadStatsHistorySection({
  isLoadingStats,
  completionHistory,
  filteredHistory,
  historyFilter,
  historyFilterOptions,
  standardDifficultyStats,
  onHistoryFilterChange,
  onReloadView,
  onBackToStart,
}: UploadStatsHistorySectionProps) {
  const announceAccessibility = useAccessibilityAnnouncer()
  const historyContentRef = useRef<HTMLDivElement>(null)
  const pendingSortFocusRef = useRef<HistorySortKey | null>(null)
  const [sortKey, setSortKey] = useState<HistorySortKey>('completedAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const difficultyReportMap = useMemo(() => {
    const rows = buildDifficultyReportRows(standardDifficultyStats, completionHistory)
    return new Map(rows.map((row) => [`${row.option.rows}x${row.option.cols}`, row]))
  }, [completionHistory, standardDifficultyStats])

  const historyDisplayEntries = useMemo(
    () => buildHistoryDisplayEntries(filteredHistory, difficultyReportMap),
    [difficultyReportMap, filteredHistory]
  )

  const sortedHistory = useMemo(
    () => sortHistoryEntries(historyDisplayEntries, sortKey, sortDirection),
    [historyDisplayEntries, sortDirection, sortKey]
  )
  const historySwapKey = `${historyFilter}:${sortKey}:${sortDirection}`

  const focusButton = useCallback((button: HTMLButtonElement | undefined) => {
    if (!button) {
      return
    }

    button.focus({ preventScroll: true })
    button.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'auto',
    })
  }, [])

  const handleFilterChipKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
      return
    }

    const filterRow = event.currentTarget.closest<HTMLElement>('.dashboard-filter-row')
    if (!filterRow) {
      return
    }

    const filterButtons = Array.from(
      filterRow.querySelectorAll<HTMLButtonElement>('.dashboard-filter-chip:not([disabled])')
    )
    const currentIndex = filterButtons.indexOf(event.currentTarget)
    if (currentIndex < 0) {
      return
    }

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        if (currentIndex > 0) {
          event.preventDefault()
          focusButton(filterButtons[currentIndex - 1])
        }
        return
      case 'ArrowRight':
      case 'ArrowDown':
        if (currentIndex < filterButtons.length - 1) {
          event.preventDefault()
          focusButton(filterButtons[currentIndex + 1])
        }
        return
      case 'Home':
        event.preventDefault()
        focusButton(filterButtons[0])
        return
      case 'End':
        event.preventDefault()
        focusButton(filterButtons[filterButtons.length - 1])
        return
    }
  }, [focusButton])

  const handleSortButtonKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
      return
    }

    const headerRow = event.currentTarget.closest<HTMLTableRowElement>('tr')
    if (!headerRow) {
      return
    }

    const sortButtons = Array.from(
      headerRow.querySelectorAll<HTMLButtonElement>('.stats-table-sort:not([disabled])')
    )
    const currentIndex = sortButtons.indexOf(event.currentTarget)
    if (currentIndex < 0) {
      return
    }

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        if (currentIndex > 0) {
          event.preventDefault()
          focusButton(sortButtons[currentIndex - 1])
        }
        return
      case 'ArrowRight':
      case 'ArrowDown':
        if (currentIndex < sortButtons.length - 1) {
          event.preventDefault()
          focusButton(sortButtons[currentIndex + 1])
        }
        return
      case 'Home':
        event.preventDefault()
        focusButton(sortButtons[0])
        return
      case 'End':
        event.preventDefault()
        focusButton(sortButtons[sortButtons.length - 1])
        return
    }
  }, [focusButton])

  const handleHistoryFilterSelect = useCallback((filterId: HistoryFilter, label: string) => {
    onHistoryFilterChange(filterId)
    announceAccessibility(`Verlauffilter: ${label}.`)
  }, [announceAccessibility, onHistoryFilterChange])

  const handleSort = useCallback((nextKey: HistorySortKey) => {
    pendingSortFocusRef.current = nextKey

    if (nextKey === sortKey) {
      const nextDirection = sortDirection === 'asc' ? 'desc' : 'asc'
      setSortDirection(nextDirection)
      announceAccessibility(
        `Verlauf sortiert nach ${HISTORY_SORT_LABELS[nextKey]}, ${nextDirection === 'asc' ? 'aufsteigend' : 'absteigend'}.`
      )
      return
    }

    const nextDirection = nextKey === 'difficulty' ? 'asc' : 'desc'
    setSortKey(nextKey)
    setSortDirection(nextDirection)
    announceAccessibility(
      `Verlauf sortiert nach ${HISTORY_SORT_LABELS[nextKey]}, ${nextDirection === 'asc' ? 'aufsteigend' : 'absteigend'}.`
    )
  }, [announceAccessibility, sortDirection, sortKey])

  useEffect(() => {
    const focusSortKey = pendingSortFocusRef.current
    if (!focusSortKey) {
      return
    }

    let frameId = 0
    let attempts = 0
    let isCancelled = false
    const maxAttempts = 30

    const restoreSortButtonFocus = () => {
      if (isCancelled) {
        return
      }

      const targetButton = historyContentRef.current?.querySelector<HTMLButtonElement>(
        `.stats-history-focus-scope[data-history-swap-key="${historySwapKey}"] .stats-table-sort[data-history-sort-key="${focusSortKey}"]`
      )
      if (targetButton?.isConnected) {
        pendingSortFocusRef.current = null
        focusButton(targetButton)
        return
      }

      attempts += 1
      if (attempts >= maxAttempts) {
        pendingSortFocusRef.current = null
        return
      }

      frameId = window.requestAnimationFrame(restoreSortButtonFocus)
    }

    frameId = window.requestAnimationFrame(() => {
      restoreSortButtonFocus()
    })

    return () => {
      isCancelled = true
      window.cancelAnimationFrame(frameId)
    }
  }, [focusButton, historySwapKey])

  return (
    <UploadStatsSection
      id="stats-report-history"
      kicker="Verlaufstabelle"
      title="Komplette Sieg-Historie"
      copy="Jeder Abschluss bleibt erhalten und kann nach Datum, Schwierigkeit, Zeit, Zuegen oder Hilfen sortiert werden. Der Filter oben schraenkt die Tabelle auf einzelne Stufen ein."
      summaryMeta={
        <>
          <span className="stats-report-summary-pill">{completionHistory.length} Eintraege</span>
          <span className="stats-report-summary-pill">{sortedHistory.length} sichtbar</span>
        </>
      }
      collapsible
      defaultOpen
      onReloadView={onReloadView}
      onBackToStart={onBackToStart}
    >
      {!isLoadingStats && completionHistory.length === 0 ? (
        <div className="stats-empty-state dashboard-empty-state">
          <span className="empty-icon" aria-hidden="true">&#128221;</span>
          <p>Noch kein Verlauf vorhanden.</p>
          <p className="empty-hint">
            Nach deinem ersten Sieg wird hier jeder Abschluss mit Zeit, Netto-Zuegen und Laufart gelistet.
          </p>
        </div>
        ) : (
          <>
          <div ref={historyContentRef}>
            <div className="stats-report-toolbar">
              <div className="dashboard-filter-row" aria-label="Verlauf filtern">
                {historyFilterOptions.map((filterOption) => (
                  <AnimatedChipButton
                    key={filterOption.id}
                    className={`dashboard-filter-chip${historyFilter === filterOption.id ? ' is-active' : ''}`}
                    onClick={() => handleHistoryFilterSelect(filterOption.id, filterOption.label)}
                    onKeyDown={handleFilterChipKeyDown}
                  >
                    {filterOption.label}
                  </AnimatedChipButton>
                ))}
              </div>

              <span className="dashboard-section-note">
                {sortedHistory.length} von {completionHistory.length} Eintraegen sichtbar
              </span>
            </div>

            <AnimatedSwapPane swapKey={historySwapKey} className="stats-history-swap">
              <div className="stats-history-focus-scope" data-history-swap-key={historySwapKey}>
                {sortedHistory.length === 0 ? (
                  <div className="stats-empty-state dashboard-empty-state">
                    <span className="empty-icon" aria-hidden="true">&#128269;</span>
                    <p>Keine Eintraege fuer diesen Filter.</p>
                    <p className="empty-hint">
                      Wechsle auf eine andere Schwierigkeit oder zeige wieder alle Siege an.
                    </p>
                  </div>
                ) : (
                  <div className="stats-table-shell">
                    <table className="stats-data-table stats-history-table">
                      <thead>
                        <tr>
                        <th
                          scope="col"
                          aria-sort={sortKey === 'completedAt' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                        >
                          <AnimatedButton
                            className="stats-table-sort"
                            data-history-sort-key="completedAt"
                            interaction="chip"
                            onClick={() => handleSort('completedAt')}
                            onKeyDown={handleSortButtonKeyDown}
                          >
                            <span>Datum</span>
                            <span className="stats-table-sort-indicator" aria-hidden="true">
                              {getSortIndicator('completedAt', sortKey, sortDirection)}
                            </span>
                          </AnimatedButton>
                        </th>
                        <th
                          scope="col"
                          aria-sort={sortKey === 'difficulty' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                        >
                          <AnimatedButton
                            className="stats-table-sort"
                            data-history-sort-key="difficulty"
                            interaction="chip"
                            onClick={() => handleSort('difficulty')}
                            onKeyDown={handleSortButtonKeyDown}
                          >
                            <span>Stufe</span>
                            <span className="stats-table-sort-indicator" aria-hidden="true">
                              {getSortIndicator('difficulty', sortKey, sortDirection)}
                            </span>
                          </AnimatedButton>
                        </th>
                        <th
                          scope="col"
                          aria-sort={sortKey === 'time' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                        >
                          <AnimatedButton
                            className="stats-table-sort"
                            data-history-sort-key="time"
                            interaction="chip"
                            onClick={() => handleSort('time')}
                            onKeyDown={handleSortButtonKeyDown}
                          >
                            <span>Zeit</span>
                            <span className="stats-table-sort-indicator" aria-hidden="true">
                              {getSortIndicator('time', sortKey, sortDirection)}
                            </span>
                          </AnimatedButton>
                        </th>
                        <th
                          scope="col"
                          aria-sort={sortKey === 'moves' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                        >
                          <AnimatedButton
                            className="stats-table-sort"
                            data-history-sort-key="moves"
                            interaction="chip"
                            onClick={() => handleSort('moves')}
                            onKeyDown={handleSortButtonKeyDown}
                          >
                            <span>Netto-Zuege</span>
                            <span className="stats-table-sort-indicator" aria-hidden="true">
                              {getSortIndicator('moves', sortKey, sortDirection)}
                            </span>
                          </AnimatedButton>
                        </th>
                        <th
                          scope="col"
                          aria-sort={sortKey === 'actionMoves' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                        >
                          <AnimatedButton
                            className="stats-table-sort"
                            data-history-sort-key="actionMoves"
                            interaction="chip"
                            onClick={() => handleSort('actionMoves')}
                            onKeyDown={handleSortButtonKeyDown}
                          >
                            <span>Aktionen</span>
                            <span className="stats-table-sort-indicator" aria-hidden="true">
                              {getSortIndicator('actionMoves', sortKey, sortDirection)}
                            </span>
                          </AnimatedButton>
                        </th>
                        <th
                          scope="col"
                          aria-sort={sortKey === 'extraMoves' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                        >
                          <AnimatedButton
                            className="stats-table-sort"
                            data-history-sort-key="extraMoves"
                            interaction="chip"
                            onClick={() => handleSort('extraMoves')}
                            onKeyDown={handleSortButtonKeyDown}
                          >
                            <span>Umwege</span>
                            <span className="stats-table-sort-indicator" aria-hidden="true">
                              {getSortIndicator('extraMoves', sortKey, sortDirection)}
                            </span>
                          </AnimatedButton>
                        </th>
                        <th
                          scope="col"
                          aria-sort={sortKey === 'assistanceMode' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                        >
                          <AnimatedButton
                            className="stats-table-sort"
                            data-history-sort-key="assistanceMode"
                            interaction="chip"
                            onClick={() => handleSort('assistanceMode')}
                            onKeyDown={handleSortButtonKeyDown}
                          >
                            <span>Laufart</span>
                            <span className="stats-table-sort-indicator" aria-hidden="true">
                              {getSortIndicator('assistanceMode', sortKey, sortDirection)}
                            </span>
                          </AnimatedButton>
                        </th>
                        <th
                          scope="col"
                          aria-sort={sortKey === 'profile' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                        >
                          <AnimatedButton
                            className="stats-table-sort"
                            data-history-sort-key="profile"
                            interaction="chip"
                            onClick={() => handleSort('profile')}
                            onKeyDown={handleSortButtonKeyDown}
                          >
                            <span>Datenquelle</span>
                            <span className="stats-table-sort-indicator" aria-hidden="true">
                              {getSortIndicator('profile', sortKey, sortDirection)}
                            </span>
                          </AnimatedButton>
                        </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedHistory.map((historyEntry) => (
                          <tr key={historyEntry.entry.id}>
                          <td>
                            <span className="stats-data-cell-main">{formatDate(historyEntry.entry.completedAt)}</span>
                            <span className="stats-data-cell-copy">{historyEntry.entry.id.slice(0, 8)}</span>
                          </td>
                          <td>
                            <span className="stats-data-cell-main">{formatDifficultyLabel(historyEntry.entry.config)}</span>
                            <span className="stats-data-cell-copy">
                              {historyEntry.entry.config.rows}x{historyEntry.entry.config.cols}
                            </span>
                          </td>
                          <td className={getHistoryCellTone(historyEntry.isBestTime, historyEntry.isWorstTime).trim()}>
                            <span className="stats-data-cell-main">{formatTime(historyEntry.entry.time)}</span>
                            <span className="stats-data-cell-copy">
                              {getTimeCopyLabel(historyEntry.isBestTime, historyEntry.isWorstTime)}
                            </span>
                            {historyEntry.timeBadges.length > 0 ? (
                              <div className="stats-data-badges">
                                {historyEntry.timeBadges.map((badge) => (
                                  <span
                                    key={badge}
                                    className={`stats-data-badge${badge === 'Bestzeit' ? ' is-positive' : ' is-negative'}`}
                                  >
                                    {badge}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </td>
                          <td className={getHistoryCellTone(historyEntry.isBestMoves, historyEntry.isWorstMoves).trim()}>
                            <span className="stats-data-cell-main">{historyEntry.entry.moves}</span>
                            <span className="stats-data-cell-copy">
                              {getMovesCopyLabel(historyEntry.isBestMoves, historyEntry.isWorstMoves)}
                            </span>
                            {historyEntry.moveBadges.length > 0 ? (
                              <div className="stats-data-badges">
                                {historyEntry.moveBadges.map((badge) => (
                                  <span
                                    key={badge}
                                    className={`stats-data-badge${badge === 'Wenigste Zuege' ? ' is-positive' : ' is-negative'}`}
                                  >
                                    {badge}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </td>
                          <td>
                            <span className="stats-data-cell-main">
                              {historyEntry.actionMovesValue !== null ? `${historyEntry.actionMovesValue}` : '--'}
                            </span>
                            <span className="stats-data-cell-copy">alle Aktionen</span>
                          </td>
                          <td>
                            <span className="stats-data-cell-main">
                              {historyEntry.extraMovesValue !== null ? `${historyEntry.extraMovesValue}` : '--'}
                            </span>
                            <span className="stats-data-cell-copy">ueber Netto</span>
                          </td>
                          <td>
                            <span className="stats-data-cell-main">
                              {historyEntry.entry.hasDetailedProfile
                                ? formatAssistanceModeLabel(historyEntry.entry.assistanceMode)
                                : 'Legacy'}
                            </span>
                            <span className="stats-data-cell-copy">
                              {historyEntry.entry.hasDetailedProfile
                                ? `${historyEntry.entry.hintCount} Hinweise, ${historyEntry.entry.suggestedMoveCount} Auto`
                                : 'ohne Laufprofil'}
                            </span>
                          </td>
                          <td>
                            <span className="stats-data-cell-main">
                              {formatProfileSourceLabel(historyEntry.entry.hasDetailedProfile)}
                            </span>
                            <span className="stats-data-cell-copy">
                              {historyEntry.entry.hasDetailedProfile ? 'voll erfasst' : 'nur Basiswerte'}
                            </span>
                          </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </AnimatedSwapPane>
          </div>
        </>
      )}
    </UploadStatsSection>
  )
}
