import { type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAccessibilityAnnouncer } from '../../app/accessibilityAnnouncer.tsx'
import AnimatedButton from '../../motion/AnimatedButton.tsx'
import AnimatedChipButton from '../../motion/AnimatedChipButton.tsx'
import AnimatedSwapPane from '../../motion/AnimatedSwapPane.tsx'
import { PuzzleCompletionRecord } from '../../types/index'
import { formatDifficultyLabel, formatPuzzleSize, getDifficultyOption } from '../../utils/puzzleDifficulty.ts'
import {
  HistoryFilter,
  HistoryFilterDefinition,
  StandardDifficultyStatsEntry,
  buildStatsDifficultyColorMap,
  buildDifficultyReportRows,
  formatAssistanceModeLabel,
  formatDate,
  formatTime,
  getCompletionExtraMoves,
  getStatsDifficultyKey,
} from './uploadUtils.ts'
import UploadPageNavigation from './UploadPageNavigation.tsx'
import UploadStatsSection from './UploadStatsSection.tsx'

type SortDirection = 'asc' | 'desc'

type HistorySortKey =
  | 'completedAt'
  | 'difficulty'
  | 'time'
  | 'moves'
  | 'extraMoves'
  | 'assistanceMode'

type AssistanceBadgeTone = 'clean' | 'hinted' | 'auto' | 'legacy'

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
  defaultOpen?: boolean
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
  extraMovesValue: number | null
  assistanceRank: number
  isBestTime: boolean
  isWorstTime: boolean
  isBestMoves: boolean
  isWorstMoves: boolean
  timeBadges: string[]
  moveBadges: string[]
}

interface AssistanceBadgeMeta {
  label: string
  tone: AssistanceBadgeTone
  icon: string
  detail: string | null
  title: string
}

const HISTORY_SORT_LABELS: Record<HistorySortKey, string> = {
  completedAt: 'Datum',
  difficulty: 'Stufe',
  time: 'Zeit',
  moves: 'Zuege',
  extraMoves: 'Korrekturen',
  assistanceMode: 'Laufart',
}

const HISTORY_COLUMN_HELP: Partial<Record<HistorySortKey, string>> = {
  time: 'Die gespeicherte Laufzeit des einzelnen Siegs.',
  moves: 'Netto-Zuege sind die eigentlichen Puzzle-Zuege bis zur Loesung.',
  extraMoves: 'Korrekturen (Undos) sind die Differenz aus Gesamtaktionen und Netto-Zuegen. Nur mit Laufprofilen berechenbar.',
  assistanceMode: 'Clean bedeutet ohne Hilfe. Hinweise und Auto-Zug markieren unterstuetzte Laeufe. Legacy hat kein vollstaendiges Laufprofil.',
}

const HISTORY_ENTRIES_PER_PAGE = 25

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

function formatHistoryDate(isoDate: string): string {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return '--'

  return parsed.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
  })
}

function formatHistoryTime(isoDate: string): string {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return '--:--'

  return parsed.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatHistoryDateTitle(isoDate: string): string {
  return formatDate(isoDate)
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

function formatCountLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

function getAssistanceBadgeMeta(entry: PuzzleCompletionRecord): AssistanceBadgeMeta {
  if (!entry.hasDetailedProfile) {
    return {
      label: 'Legacy',
      tone: 'legacy',
      icon: 'L',
      detail: 'ohne Laufprofil',
      title: 'Legacy: ohne Laufprofil',
    }
  }

  const details = [
    entry.hintCount > 0 ? formatCountLabel(entry.hintCount, 'Hinweis', 'Hinweise') : null,
    entry.suggestedMoveCount > 0 ? `${entry.suggestedMoveCount} Auto` : null,
  ].filter((detail): detail is string => detail !== null)

  if (entry.assistanceMode === 'clean') {
    return {
      label: formatAssistanceModeLabel('clean'),
      tone: 'clean',
      icon: 'C',
      detail: null,
      title: 'Clean: ohne Hilfen',
    }
  }

  if (entry.assistanceMode === 'hinted') {
    const detail = details.join(', ')

    return {
      label: formatAssistanceModeLabel('hinted'),
      tone: 'hinted',
      icon: 'H',
      detail: detail || null,
      title: detail ? `${formatAssistanceModeLabel('hinted')}: ${detail}` : formatAssistanceModeLabel('hinted'),
    }
  }

  const detail = details.join(', ')

  return {
    label: formatAssistanceModeLabel('auto-assisted'),
    tone: 'auto',
    icon: 'A',
    detail: detail || null,
    title: detail ? `${formatAssistanceModeLabel('auto-assisted')}: ${detail}` : formatAssistanceModeLabel('auto-assisted'),
  }
}

function getSortIndicator(key: HistorySortKey, activeKey: HistorySortKey, direction: SortDirection): string {
  if (key !== activeKey) return '\u2195'
  return direction === 'asc' ? '\u2191' : '\u2193'
}

function renderHistoryHeaderLabel(label: string) {
  return <span className="stats-table-label-text">{label}</span>
}

function getHistoryHelpHeaderProps(key: HistorySortKey) {
  const help = HISTORY_COLUMN_HELP[key]

  return help
    ? {
        className: 'has-stats-column-help',
      }
    : {}
}

function renderHistoryColumnHelpBadge(key: HistorySortKey) {
  const help = HISTORY_COLUMN_HELP[key]

  return help ? (
    <span className="stats-table-help-badge" aria-hidden="true" title={help}>
      ?
    </span>
  ) : null
}

function buildHistoryDisplayEntries(
  entries: PuzzleCompletionRecord[],
  difficultyReportMap: Map<string, HistoryDifficultyReportSummary>
): HistoryDisplayEntry[] {
  return entries.map((entry) => {
    const difficultyReport = difficultyReportMap.get(getStatsDifficultyKey(entry.config))
    const isBestTime = difficultyReport?.bestTime === entry.time
    const isWorstTime = difficultyReport?.worstTime === entry.time
    const isBestMoves = difficultyReport?.bestMoves === entry.moves
    const isWorstMoves = difficultyReport?.worstMoves === entry.moves

    return {
      entry,
      completedAtValue: parseOptionalTimestamp(entry.completedAt),
      difficultyRows: entry.config.rows,
      difficultyCols: entry.config.cols,
      extraMovesValue: entry.hasDetailedProfile ? getCompletionExtraMoves(entry) : null,
      assistanceRank: getAssistanceRank(entry),
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
      case 'extraMoves':
        result = compareNullableNumbers(left.extraMovesValue, right.extraMovesValue, direction)
        break
      case 'assistanceMode':
        result = compareNullableNumbers(left.assistanceRank, right.assistanceRank, direction)
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
  defaultOpen = true,
}: UploadStatsHistorySectionProps) {
  const announceAccessibility = useAccessibilityAnnouncer()
  const historyContentRef = useRef<HTMLDivElement>(null)
  const pendingSortFocusRef = useRef<HistorySortKey | null>(null)
  const [sortKey, setSortKey] = useState<HistorySortKey>('completedAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [currentPage, setCurrentPage] = useState(1)

  const difficultyRows = useMemo(
    () => buildDifficultyReportRows(standardDifficultyStats, completionHistory),
    [completionHistory, standardDifficultyStats]
  )
  const difficultyReportMap = useMemo(
    () => new Map<string, HistoryDifficultyReportSummary>(
      difficultyRows.map((row) => [getStatsDifficultyKey(row.option), row])
    ),
    [difficultyRows]
  )
  const difficultyColorMap = useMemo(
    () => buildStatsDifficultyColorMap(difficultyRows),
    [difficultyRows]
  )

  const historyDisplayEntries = useMemo(
    () => buildHistoryDisplayEntries(filteredHistory, difficultyReportMap),
    [difficultyReportMap, filteredHistory]
  )

  const sortedHistory = useMemo(
    () => sortHistoryEntries(historyDisplayEntries, sortKey, sortDirection),
    [historyDisplayEntries, sortDirection, sortKey]
  )
  const historyPageCount = Math.max(1, Math.ceil(sortedHistory.length / HISTORY_ENTRIES_PER_PAGE))
  const activeHistoryPage = Math.min(currentPage, historyPageCount)
  const pagedHistory = useMemo(() => {
    const startIndex = (activeHistoryPage - 1) * HISTORY_ENTRIES_PER_PAGE
    return sortedHistory.slice(startIndex, startIndex + HISTORY_ENTRIES_PER_PAGE)
  }, [activeHistoryPage, sortedHistory])
  const historySwapKey = `${historyFilter}:${sortKey}:${sortDirection}:${activeHistoryPage}`

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, historyPageCount))
  }, [historyPageCount])

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
    setCurrentPage(1)
    onHistoryFilterChange(filterId)
    announceAccessibility(`Verlauffilter: ${label}.`)
  }, [announceAccessibility, onHistoryFilterChange])

  const handleSort = useCallback((nextKey: HistorySortKey) => {
    pendingSortFocusRef.current = nextKey
    setCurrentPage(1)

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

  const handlePageClick = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

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
      className="stats-report-section-table"
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
      defaultOpen={defaultOpen}
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
                {historyPageCount > 1 ? `, ${pagedHistory.length} auf dieser Seite` : ''}
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
                  <div className="stats-table-shell stats-table-shell-history">
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
                            {renderHistoryHeaderLabel('Datum')}
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
                            {renderHistoryHeaderLabel('Stufe')}
                            <span className="stats-table-sort-indicator" aria-hidden="true">
                              {getSortIndicator('difficulty', sortKey, sortDirection)}
                            </span>
                          </AnimatedButton>
                        </th>
                        <th
                          scope="col"
                          aria-sort={sortKey === 'time' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                          {...getHistoryHelpHeaderProps('time')}
                        >
                          <AnimatedButton
                            className="stats-table-sort"
                            data-history-sort-key="time"
                            interaction="chip"
                            onClick={() => handleSort('time')}
                            onKeyDown={handleSortButtonKeyDown}
                          >
                            {renderHistoryHeaderLabel('Zeit')}
                            <span className="stats-table-sort-indicator" aria-hidden="true">
                              {getSortIndicator('time', sortKey, sortDirection)}
                            </span>
                          </AnimatedButton>
                          {renderHistoryColumnHelpBadge('time')}
                        </th>
                        <th
                          scope="col"
                          aria-sort={sortKey === 'moves' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                          {...getHistoryHelpHeaderProps('moves')}
                        >
                          <AnimatedButton
                            className="stats-table-sort"
                            data-history-sort-key="moves"
                            interaction="chip"
                            onClick={() => handleSort('moves')}
                            onKeyDown={handleSortButtonKeyDown}
                          >
                            {renderHistoryHeaderLabel('Zuege')}
                            <span className="stats-table-sort-indicator" aria-hidden="true">
                              {getSortIndicator('moves', sortKey, sortDirection)}
                            </span>
                          </AnimatedButton>
                          {renderHistoryColumnHelpBadge('moves')}
                        </th>
                        <th
                          scope="col"
                          aria-sort={sortKey === 'extraMoves' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                          {...getHistoryHelpHeaderProps('extraMoves')}
                        >
                          <AnimatedButton
                            className="stats-table-sort"
                            data-history-sort-key="extraMoves"
                            interaction="chip"
                            title="Korrekturen (Undos): Aktionen minus Netto-Zuege"
                            onClick={() => handleSort('extraMoves')}
                            onKeyDown={handleSortButtonKeyDown}
                          >
                            {renderHistoryHeaderLabel('Korrekturen')}
                            <span className="stats-table-sort-indicator" aria-hidden="true">
                              {getSortIndicator('extraMoves', sortKey, sortDirection)}
                            </span>
                          </AnimatedButton>
                          {renderHistoryColumnHelpBadge('extraMoves')}
                        </th>
                        <th
                          scope="col"
                          aria-sort={sortKey === 'assistanceMode' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                          {...getHistoryHelpHeaderProps('assistanceMode')}
                        >
                          <AnimatedButton
                            className="stats-table-sort"
                            data-history-sort-key="assistanceMode"
                            interaction="chip"
                            onClick={() => handleSort('assistanceMode')}
                            onKeyDown={handleSortButtonKeyDown}
                          >
                            {renderHistoryHeaderLabel('Laufart')}
                            <span className="stats-table-sort-indicator" aria-hidden="true">
                              {getSortIndicator('assistanceMode', sortKey, sortDirection)}
                            </span>
                          </AnimatedButton>
                          {renderHistoryColumnHelpBadge('assistanceMode')}
                        </th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedHistory.map((historyEntry) => {
                          const assistanceBadge = getAssistanceBadgeMeta(historyEntry.entry)
                          const difficultyColor = difficultyColorMap.get(getStatsDifficultyKey(historyEntry.entry.config))
                          const difficultyOption = getDifficultyOption(historyEntry.entry.config)
                          const difficultyLabel = difficultyOption?.label ?? formatDifficultyLabel(historyEntry.entry.config)
                          const difficultySize = difficultyOption
                            ? formatPuzzleSize({ rows: difficultyOption.rows, cols: difficultyOption.cols })
                            : null
                          const rowClassName = difficultyColor ? 'has-difficulty-accent' : ''
                          const rowStyle = difficultyColor
                            ? ({ '--stats-difficulty-color': difficultyColor } as CSSProperties)
                            : undefined
                          const difficultyCellClassName = [
                            'stats-history-difficulty-cell',
                            difficultyColor ? 'has-difficulty-color' : '',
                          ].filter(Boolean).join(' ')
                          const assistanceBadgeClassName = [
                            'stats-assistance-badge',
                            `is-${assistanceBadge.tone}`,
                            difficultyColor ? 'has-difficulty-color' : '',
                          ].filter(Boolean).join(' ')
                          const extraMovesBadgeClassName = [
                            'stats-extra-moves-badge',
                            difficultyColor ? 'has-difficulty-color' : '',
                          ].filter(Boolean).join(' ')
                          const difficultyCellStyle = difficultyColor
                            ? ({ '--stats-difficulty-color': difficultyColor } as CSSProperties)
                            : undefined

                          return (
                          <tr key={historyEntry.entry.id} className={rowClassName} style={rowStyle}>
                          <td>
                            <span className="stats-data-cell-main" title={formatHistoryDateTitle(historyEntry.entry.completedAt)}>
                              {formatHistoryDate(historyEntry.entry.completedAt)}
                            </span>
                            <span className="stats-data-cell-copy">
                              {formatHistoryTime(historyEntry.entry.completedAt)}
                            </span>
                          </td>
                          <td className={difficultyCellClassName} style={difficultyCellStyle}>
                            <span className="stats-difficulty-label-chip">
                              <span className="stats-difficulty-label-text">{difficultyLabel}</span>
                              {difficultySize ? (
                                <span className="stats-difficulty-label-size">{difficultySize}</span>
                              ) : null}
                            </span>
                          </td>
                          <td className={getHistoryCellTone(historyEntry.isBestTime, historyEntry.isWorstTime).trim()}>
                            <span className="stats-data-cell-main">{formatTime(historyEntry.entry.time)}</span>
                            {historyEntry.timeBadges.length > 0 ? (
                              <div className="stats-data-badges">
                                {historyEntry.timeBadges.map((badge) => (
                                  <span
                                    key={badge}
                                    className={`stats-data-badge${badge === 'Bestzeit' ? ' is-positive' : ' is-negative'}`}
                                    title={getTimeCopyLabel(historyEntry.isBestTime, historyEntry.isWorstTime)}
                                  >
                                    {badge}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </td>
                          <td className={getHistoryCellTone(historyEntry.isBestMoves, historyEntry.isWorstMoves).trim()}>
                            <span className="stats-data-cell-main">{historyEntry.entry.moves}</span>
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
                              {historyEntry.extraMovesValue === null ? '--' : historyEntry.extraMovesValue}
                            </span>
                            {historyEntry.extraMovesValue !== null && historyEntry.extraMovesValue > 0 ? (
                              <div className="stats-data-badges">
                                <span className={extraMovesBadgeClassName} style={difficultyCellStyle} title="Korrekturen (Undos)">
                                  +{historyEntry.extraMovesValue} Korr.
                                </span>
                              </div>
                            ) : (
                              <span className="stats-data-cell-copy">
                                {historyEntry.extraMovesValue === null ? 'kein Laufprofil' : 'cleaner Zugweg'}
                              </span>
                            )}
                          </td>
                          <td>
                            <span className={assistanceBadgeClassName} style={difficultyCellStyle} title={assistanceBadge.title}>
                              <span className="stats-assistance-badge-icon" aria-hidden="true">
                                {assistanceBadge.icon}
                              </span>
                              <span className="stats-assistance-badge-copy">
                                <span>{assistanceBadge.label}</span>
                                {assistanceBadge.detail ? <small>{assistanceBadge.detail}</small> : null}
                              </span>
                            </span>
                          </td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    <UploadPageNavigation
                      activePage={activeHistoryPage}
                      ariaLabel="Einzellaufseiten"
                      onPageChange={handlePageClick}
                      pageCount={historyPageCount}
                    />
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
