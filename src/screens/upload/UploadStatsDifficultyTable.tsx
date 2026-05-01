import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useMemo, useState } from 'react'
import AnimatedButton from '../../motion/AnimatedButton.tsx'
import { PuzzleCompletionRecord, PuzzleStats } from '../../types/index'
import { formatPuzzleSize } from '../../utils/puzzleDifficulty.ts'
import UploadStatsSection from './UploadStatsSection.tsx'
import {
  DifficultyReportRow,
  StandardDifficultyStatsEntry,
  buildDifficultyReportRows,
  formatDate,
  formatExtraMoves,
  formatOptionalDuration,
  formatOptionalMoves,
  formatPercent,
} from './uploadUtils.ts'

type SortDirection = 'asc' | 'desc'

type DifficultySortKey =
  | 'difficulty'
  | 'solveCount'
  | 'cleanRate'
  | 'bestTime'
  | 'worstTime'
  | 'bestMoves'
  | 'worstMoves'
  | 'medianTime'
  | 'medianMoves'
  | 'averageExtraMoves'
  | 'profileCoverage'
  | 'lastCompletedAt'

interface UploadStatsDifficultyTableProps {
  stats: PuzzleStats | null
  completionHistory: PuzzleCompletionRecord[]
  standardDifficultyStats: StandardDifficultyStatsEntry[]
  onReloadView: () => void
  onBackToStart: () => void
}

function compareNullableNumbers(left: number | null, right: number | null, direction: SortDirection): number {
  if (left === null && right === null) return 0
  if (left === null) return 1
  if (right === null) return -1
  return direction === 'asc' ? left - right : right - left
}

function compareNullableDates(left: string | null, right: string | null, direction: SortDirection): number {
  if (!left && !right) return 0
  if (!left) return 1
  if (!right) return -1

  const leftValue = Date.parse(left)
  const rightValue = Date.parse(right)
  if (Number.isNaN(leftValue) && Number.isNaN(rightValue)) return 0
  if (Number.isNaN(leftValue)) return 1
  if (Number.isNaN(rightValue)) return -1
  return direction === 'asc' ? leftValue - rightValue : rightValue - leftValue
}

function compareDifficulty(left: DifficultyReportRow, right: DifficultyReportRow, direction: SortDirection): number {
  if (left.option.rows !== right.option.rows) {
    return direction === 'asc'
      ? left.option.rows - right.option.rows
      : right.option.rows - left.option.rows
  }

  return direction === 'asc'
    ? left.option.cols - right.option.cols
    : right.option.cols - left.option.cols
}

function getSortIndicator(key: DifficultySortKey, activeKey: DifficultySortKey, direction: SortDirection): string {
  if (key !== activeKey) return '↕'
  return direction === 'asc' ? '↑' : '↓'
}

function sortDifficultyRows(
  rows: DifficultyReportRow[],
  sortKey: DifficultySortKey,
  direction: SortDirection
): DifficultyReportRow[] {
  return [...rows].sort((left, right) => {
    let result = 0

    switch (sortKey) {
      case 'difficulty':
        result = compareDifficulty(left, right, direction)
        break
      case 'solveCount':
        result = compareNullableNumbers(left.solveCount, right.solveCount, direction)
        break
      case 'cleanRate':
        result = compareNullableNumbers(left.cleanRate, right.cleanRate, direction)
        break
      case 'bestTime':
        result = compareNullableNumbers(left.bestTime, right.bestTime, direction)
        break
      case 'worstTime':
        result = compareNullableNumbers(left.worstTime, right.worstTime, direction)
        break
      case 'bestMoves':
        result = compareNullableNumbers(left.bestMoves, right.bestMoves, direction)
        break
      case 'worstMoves':
        result = compareNullableNumbers(left.worstMoves, right.worstMoves, direction)
        break
      case 'medianTime':
        result = compareNullableNumbers(left.medianTime, right.medianTime, direction)
        break
      case 'medianMoves':
        result = compareNullableNumbers(left.medianMoves, right.medianMoves, direction)
        break
      case 'averageExtraMoves':
        result = compareNullableNumbers(left.averageExtraMoves, right.averageExtraMoves, direction)
        break
      case 'profileCoverage':
        result = compareNullableNumbers(left.profileCoverage, right.profileCoverage, direction)
        break
      case 'lastCompletedAt':
        result = compareNullableDates(left.lastCompletedAt, right.lastCompletedAt, direction)
        break
      default:
        result = 0
        break
    }

    if (result !== 0) return result
    return compareDifficulty(left, right, 'asc')
  })
}

export default function UploadStatsDifficultyTable({
  stats,
  completionHistory,
  standardDifficultyStats,
  onReloadView,
  onBackToStart,
}: UploadStatsDifficultyTableProps) {
  const [sortKey, setSortKey] = useState<DifficultySortKey>('solveCount')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const difficultyRows = useMemo(
    () => buildDifficultyReportRows(standardDifficultyStats, completionHistory),
    [completionHistory, standardDifficultyStats]
  )

  const sortedRows = useMemo(
    () => sortDifficultyRows(difficultyRows, sortKey, sortDirection),
    [difficultyRows, sortDirection, sortKey]
  )

  const solvedDifficultyCount = difficultyRows.filter((row) => row.solveCount > 0).length

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

  const handleSort = (nextKey: DifficultySortKey) => {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortKey(nextKey)
    setSortDirection(nextKey === 'difficulty' ? 'asc' : 'desc')
  }

  return (
    <UploadStatsSection
      id="stats-report-difficulties"
      kicker="Detailtabelle"
      title="Sortierbarer Vergleich je Schwierigkeit"
      copy="Jede Spalte laesst sich sortieren. So kannst du schnell nach Bestzeiten, schwankenden Laeufen, Profilabdeckung oder zaehen Schwierigkeitsstufen suchen."
      summaryMeta={
        <>
          <span className="stats-report-summary-pill">
            {solvedDifficultyCount} von {difficultyRows.length} geloest
          </span>
          <span className="stats-report-summary-pill">
            {stats?.totalSolved ?? 0} Siege gesamt
          </span>
        </>
      }
      collapsible
      defaultOpen
      onReloadView={onReloadView}
      onBackToStart={onBackToStart}
    >
      <div className="stats-table-shell">
        <table className="stats-data-table stats-detail-table">
          <thead>
            <tr>
              <th scope="col" aria-sort={sortKey === 'difficulty' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <AnimatedButton className="stats-table-sort" interaction="chip" onClick={() => handleSort('difficulty')} onKeyDown={handleSortButtonKeyDown}>
                  <span>Stufe</span>
                  <span className="stats-table-sort-indicator" aria-hidden="true">
                    {getSortIndicator('difficulty', sortKey, sortDirection)}
                  </span>
                </AnimatedButton>
              </th>
              <th scope="col" aria-sort={sortKey === 'solveCount' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <AnimatedButton className="stats-table-sort" interaction="chip" onClick={() => handleSort('solveCount')} onKeyDown={handleSortButtonKeyDown}>
                  <span>Siege</span>
                  <span className="stats-table-sort-indicator" aria-hidden="true">
                    {getSortIndicator('solveCount', sortKey, sortDirection)}
                  </span>
                </AnimatedButton>
              </th>
              <th scope="col" aria-sort={sortKey === 'cleanRate' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <AnimatedButton className="stats-table-sort" interaction="chip" onClick={() => handleSort('cleanRate')} onKeyDown={handleSortButtonKeyDown}>
                  <span>Clean</span>
                  <span className="stats-table-sort-indicator" aria-hidden="true">
                    {getSortIndicator('cleanRate', sortKey, sortDirection)}
                  </span>
                </AnimatedButton>
              </th>
              <th scope="col" aria-sort={sortKey === 'bestTime' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <AnimatedButton className="stats-table-sort" interaction="chip" onClick={() => handleSort('bestTime')} onKeyDown={handleSortButtonKeyDown}>
                  <span>Bestzeit</span>
                  <span className="stats-table-sort-indicator" aria-hidden="true">
                    {getSortIndicator('bestTime', sortKey, sortDirection)}
                  </span>
                </AnimatedButton>
              </th>
              <th scope="col" aria-sort={sortKey === 'worstTime' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <AnimatedButton className="stats-table-sort" interaction="chip" onClick={() => handleSort('worstTime')} onKeyDown={handleSortButtonKeyDown}>
                  <span>Langsamste</span>
                  <span className="stats-table-sort-indicator" aria-hidden="true">
                    {getSortIndicator('worstTime', sortKey, sortDirection)}
                  </span>
                </AnimatedButton>
              </th>
              <th scope="col" aria-sort={sortKey === 'bestMoves' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <AnimatedButton className="stats-table-sort" interaction="chip" onClick={() => handleSort('bestMoves')} onKeyDown={handleSortButtonKeyDown}>
                  <span>Wenigste Zuege</span>
                  <span className="stats-table-sort-indicator" aria-hidden="true">
                    {getSortIndicator('bestMoves', sortKey, sortDirection)}
                  </span>
                </AnimatedButton>
              </th>
              <th scope="col" aria-sort={sortKey === 'worstMoves' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <AnimatedButton className="stats-table-sort" interaction="chip" onClick={() => handleSort('worstMoves')} onKeyDown={handleSortButtonKeyDown}>
                  <span>Meiste Zuege</span>
                  <span className="stats-table-sort-indicator" aria-hidden="true">
                    {getSortIndicator('worstMoves', sortKey, sortDirection)}
                  </span>
                </AnimatedButton>
              </th>
              <th scope="col" aria-sort={sortKey === 'medianTime' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <AnimatedButton className="stats-table-sort" interaction="chip" onClick={() => handleSort('medianTime')} onKeyDown={handleSortButtonKeyDown}>
                  <span>Medianzeit</span>
                  <span className="stats-table-sort-indicator" aria-hidden="true">
                    {getSortIndicator('medianTime', sortKey, sortDirection)}
                  </span>
                </AnimatedButton>
              </th>
              <th scope="col" aria-sort={sortKey === 'medianMoves' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <AnimatedButton className="stats-table-sort" interaction="chip" onClick={() => handleSort('medianMoves')} onKeyDown={handleSortButtonKeyDown}>
                  <span>Median-Zuege</span>
                  <span className="stats-table-sort-indicator" aria-hidden="true">
                    {getSortIndicator('medianMoves', sortKey, sortDirection)}
                  </span>
                </AnimatedButton>
              </th>
              <th scope="col" aria-sort={sortKey === 'averageExtraMoves' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <AnimatedButton className="stats-table-sort" interaction="chip" onClick={() => handleSort('averageExtraMoves')} onKeyDown={handleSortButtonKeyDown}>
                  <span>Umwege</span>
                  <span className="stats-table-sort-indicator" aria-hidden="true">
                    {getSortIndicator('averageExtraMoves', sortKey, sortDirection)}
                  </span>
                </AnimatedButton>
              </th>
              <th scope="col" aria-sort={sortKey === 'profileCoverage' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <AnimatedButton className="stats-table-sort" interaction="chip" onClick={() => handleSort('profileCoverage')} onKeyDown={handleSortButtonKeyDown}>
                  <span>Profil</span>
                  <span className="stats-table-sort-indicator" aria-hidden="true">
                    {getSortIndicator('profileCoverage', sortKey, sortDirection)}
                  </span>
                </AnimatedButton>
              </th>
              <th scope="col" aria-sort={sortKey === 'lastCompletedAt' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <AnimatedButton className="stats-table-sort" interaction="chip" onClick={() => handleSort('lastCompletedAt')} onKeyDown={handleSortButtonKeyDown}>
                  <span>Letzter Sieg</span>
                  <span className="stats-table-sort-indicator" aria-hidden="true">
                    {getSortIndicator('lastCompletedAt', sortKey, sortDirection)}
                  </span>
                </AnimatedButton>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr key={row.option.key} className={row.solveCount === 0 ? 'is-muted' : ''}>
                <th scope="row" className="stats-data-row-title">
                  <span className="stats-data-cell-main">{row.option.label}</span>
                  <span className="stats-data-cell-copy">{formatPuzzleSize({ rows: row.option.rows, cols: row.option.cols })}</span>
                </th>
                <td>
                  <span className="stats-data-cell-main">{row.solveCount}</span>
                  <span className="stats-data-cell-copy">
                    {row.cleanSolveCount} clean, {row.assistedSolveCount} unterstuetzt
                  </span>
                </td>
                <td>
                  <span className="stats-data-cell-main">{formatPercent(row.cleanRate)}</span>
                  <span className="stats-data-cell-copy">
                    {row.cleanSolveCount}/{row.solveCount || 0} clean
                  </span>
                </td>
                <td className="is-positive">
                  <span className="stats-data-cell-main">{formatOptionalDuration(row.bestTime)}</span>
                  <span className="stats-data-cell-copy">schnellster Sieg</span>
                  {row.bestTime !== null ? (
                    <div className="stats-data-badges">
                      <span className="stats-data-badge is-positive">Bestzeit</span>
                    </div>
                  ) : null}
                </td>
                <td className="is-negative">
                  <span className="stats-data-cell-main">{formatOptionalDuration(row.worstTime)}</span>
                  <span className="stats-data-cell-copy">langsamster Sieg</span>
                  {row.worstTime !== null ? (
                    <div className="stats-data-badges">
                      <span className="stats-data-badge is-negative">Langsamste Zeit</span>
                    </div>
                  ) : null}
                </td>
                <td className="is-positive">
                  <span className="stats-data-cell-main">{formatOptionalMoves(row.bestMoves)}</span>
                  <span className="stats-data-cell-copy">effizientester Sieg</span>
                  {row.bestMoves !== null ? (
                    <div className="stats-data-badges">
                      <span className="stats-data-badge is-positive">Wenigste Zuege</span>
                    </div>
                  ) : null}
                </td>
                <td className="is-negative">
                  <span className="stats-data-cell-main">{formatOptionalMoves(row.worstMoves)}</span>
                  <span className="stats-data-cell-copy">zaehester Sieg</span>
                  {row.worstMoves !== null ? (
                    <div className="stats-data-badges">
                      <span className="stats-data-badge is-negative">Meiste Zuege</span>
                    </div>
                  ) : null}
                </td>
                <td>
                  <span className="stats-data-cell-main">{formatOptionalDuration(row.medianTime)}</span>
                  <span className="stats-data-cell-copy">zuletzt {formatOptionalDuration(row.recentMedianTime)}</span>
                </td>
                <td>
                  <span className="stats-data-cell-main">{formatOptionalMoves(row.medianMoves)}</span>
                  <span className="stats-data-cell-copy">zuletzt {formatOptionalMoves(row.recentMedianMoves)}</span>
                </td>
                <td>
                  <span className="stats-data-cell-main">{formatExtraMoves(row.averageExtraMoves)}</span>
                  <span className="stats-data-cell-copy">Zusatzaktionen im Schnitt</span>
                </td>
                <td>
                  <span className="stats-data-cell-main">{formatPercent(row.profileCoverage)}</span>
                  <span className="stats-data-cell-copy">
                    {row.profiledSolveCount} Profil, {row.legacySolveCount} Legacy
                  </span>
                </td>
                <td>
                  <span className="stats-data-cell-main">{row.lastCompletedAt ? formatDate(row.lastCompletedAt) : '--'}</span>
                  <span className="stats-data-cell-copy">
                    {row.lastCompletedAt
                      ? `${formatOptionalDuration(row.lastTime)} / ${formatOptionalMoves(row.lastMoves)}`
                      : 'noch kein Abschluss'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </UploadStatsSection>
  )
}
