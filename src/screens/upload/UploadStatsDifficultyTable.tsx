import { type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, useCallback, useMemo, useState } from 'react'
import AnimatedButton from '../../motion/AnimatedButton.tsx'
import { PuzzleCompletionRecord, PuzzleStats } from '../../types/index'
import { formatPuzzleSize } from '../../utils/puzzleDifficulty.ts'
import UploadStatsSection from './UploadStatsSection.tsx'
import {
  DifficultyReportRow,
  StandardDifficultyStatsEntry,
  buildStatsDifficultyColorMap,
  buildDifficultyReportRows,
  formatDate,
  formatExtraMoves,
  formatOptionalDuration,
  formatOptionalMoves,
  formatPercent,
  getStatsDifficultyKey,
} from './uploadUtils.ts'

type SortDirection = 'asc' | 'desc'

type DifficultySortKey =
  | 'difficulty'
  | 'solveCount'
  | 'bestTime'
  | 'bestMoves'
  | 'medianTime'
  | 'medianMoves'
  | 'averageExtraMoves'
  | 'lastCompletedAt'

const DIFFICULTY_COLUMN_HELP: Partial<Record<DifficultySortKey, string>> = {
  solveCount: 'Alle abgeschlossenen Siege dieser Stufe. Der Zellhinweis nennt den Anteil ohne Hilfe.',
  bestTime: 'Die schnellste bisher gespeicherte Siegzeit dieser Stufe.',
  bestMoves: 'Die niedrigste Zahl an Netto-Zügen, also reine Puzzle-Züge ohne Zusatzaktionen.',
  medianTime: 'Der mittlere Zeitwert dieser Stufe. Ausreisser zählen dadurch weniger stark als beim Durchschnitt.',
  medianMoves: 'Der mittlere Wert der Netto-Züge dieser Stufe.',
  averageExtraMoves: 'Durchschnittliche Korrekturen (Undos): Gesamtaktionen minus Netto-Züge. Nur mit Laufprofilen berechenbar.',
  lastCompletedAt: 'Der zuletzt gespeicherte Sieg dieser Stufe mit Zeit und Netto-Zügen.',
}

interface UploadStatsDifficultyTableProps {
  stats: PuzzleStats | null
  completionHistory: PuzzleCompletionRecord[]
  standardDifficultyStats: StandardDifficultyStatsEntry[]
  onReloadView: () => void
  onBackToStart: () => void
  defaultOpen?: boolean
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

function renderHeaderLabel(label: string) {
  return <span className="stats-table-label-text">{label}</span>
}

function getHelpHeaderProps(key: DifficultySortKey) {
  const help = DIFFICULTY_COLUMN_HELP[key]

  return help
    ? {
        className: 'has-stats-column-help',
      }
    : {}
}

function renderColumnHelpBadge(key: DifficultySortKey) {
  const help = DIFFICULTY_COLUMN_HELP[key]

  return help ? (
    <span className="stats-table-help-badge" aria-hidden="true" title={help}>
      ?
    </span>
  ) : null
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
      case 'bestTime':
        result = compareNullableNumbers(left.bestTime, right.bestTime, direction)
        break
      case 'bestMoves':
        result = compareNullableNumbers(left.bestMoves, right.bestMoves, direction)
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
  defaultOpen = true,
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
  const difficultyColorMap = useMemo(
    () => buildStatsDifficultyColorMap(difficultyRows),
    [difficultyRows]
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
      className="stats-report-section-table"
      kicker="Detailtabelle"
      title="Sortierbarer Vergleich je Schwierigkeit"
      copy="Jede Spalte lässt sich sortieren. Die Tabelle konzentriert sich auf Siege, typische Werte, Rekorde und den letzten Abschluss je Stufe."
      summaryMeta={
        <>
          <span className="stats-report-summary-pill">
            {solvedDifficultyCount} von {difficultyRows.length} gelöst
          </span>
          <span className="stats-report-summary-pill">
            {stats?.totalSolved ?? 0} Siege gesamt
          </span>
        </>
      }
      collapsible
      defaultOpen={defaultOpen}
      onReloadView={onReloadView}
      onBackToStart={onBackToStart}
    >
      <div className="stats-table-shell">
        <table className="stats-data-table stats-detail-table">
          <thead>
            <tr>
              <th scope="col" aria-sort={sortKey === 'difficulty' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <AnimatedButton className="stats-table-sort" interaction="chip" data-app-tooltip="Nach Schwierigkeitsstufe sortieren." data-app-tooltip-position="top" onClick={() => handleSort('difficulty')} onKeyDown={handleSortButtonKeyDown}>
                  {renderHeaderLabel('Stufe')}
                  <span className="stats-table-sort-indicator" aria-hidden="true">
                    {getSortIndicator('difficulty', sortKey, sortDirection)}
                  </span>
                </AnimatedButton>
              </th>
              <th scope="col" aria-sort={sortKey === 'solveCount' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} {...getHelpHeaderProps('solveCount')}>
                <AnimatedButton className="stats-table-sort" interaction="chip" data-app-tooltip="Nach Anzahl der Siege sortieren." data-app-tooltip-position="top" onClick={() => handleSort('solveCount')} onKeyDown={handleSortButtonKeyDown}>
                  {renderHeaderLabel('Siege')}
                  <span className="stats-table-sort-indicator" aria-hidden="true">
                    {getSortIndicator('solveCount', sortKey, sortDirection)}
                  </span>
                </AnimatedButton>
                {renderColumnHelpBadge('solveCount')}
              </th>
              <th scope="col" aria-sort={sortKey === 'bestTime' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} {...getHelpHeaderProps('bestTime')}>
                <AnimatedButton className="stats-table-sort" interaction="chip" data-app-tooltip="Nach schnellstem Sieg dieser Stufe sortieren." data-app-tooltip-position="top" onClick={() => handleSort('bestTime')} onKeyDown={handleSortButtonKeyDown}>
                  {renderHeaderLabel('Bestzeit')}
                  <span className="stats-table-sort-indicator" aria-hidden="true">
                    {getSortIndicator('bestTime', sortKey, sortDirection)}
                  </span>
                </AnimatedButton>
                {renderColumnHelpBadge('bestTime')}
              </th>
              <th scope="col" aria-sort={sortKey === 'bestMoves' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} {...getHelpHeaderProps('bestMoves')}>
                <AnimatedButton className="stats-table-sort" interaction="chip" data-app-tooltip="Nach wenigsten Netto-Zügen sortieren." data-app-tooltip-position="top" onClick={() => handleSort('bestMoves')} onKeyDown={handleSortButtonKeyDown}>
                  {renderHeaderLabel('Wenigste Züge')}
                  <span className="stats-table-sort-indicator" aria-hidden="true">
                    {getSortIndicator('bestMoves', sortKey, sortDirection)}
                  </span>
                </AnimatedButton>
                {renderColumnHelpBadge('bestMoves')}
              </th>
              <th scope="col" aria-sort={sortKey === 'medianTime' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} {...getHelpHeaderProps('medianTime')}>
                <AnimatedButton className="stats-table-sort" interaction="chip" data-app-tooltip="Nach Median-Zeit je Schwierigkeit sortieren." data-app-tooltip-position="top" onClick={() => handleSort('medianTime')} onKeyDown={handleSortButtonKeyDown}>
                  {renderHeaderLabel('Medianzeit')}
                  <span className="stats-table-sort-indicator" aria-hidden="true">
                    {getSortIndicator('medianTime', sortKey, sortDirection)}
                  </span>
                </AnimatedButton>
                {renderColumnHelpBadge('medianTime')}
              </th>
              <th scope="col" aria-sort={sortKey === 'medianMoves' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} {...getHelpHeaderProps('medianMoves')}>
                <AnimatedButton className="stats-table-sort" interaction="chip" data-app-tooltip="Nach Median der Netto-Züge sortieren." data-app-tooltip-position="top" onClick={() => handleSort('medianMoves')} onKeyDown={handleSortButtonKeyDown}>
                  {renderHeaderLabel('Median-Züge')}
                  <span className="stats-table-sort-indicator" aria-hidden="true">
                    {getSortIndicator('medianMoves', sortKey, sortDirection)}
                  </span>
                </AnimatedButton>
                {renderColumnHelpBadge('medianMoves')}
              </th>
              <th scope="col" aria-sort={sortKey === 'averageExtraMoves' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} {...getHelpHeaderProps('averageExtraMoves')}>
                <AnimatedButton className="stats-table-sort" interaction="chip" data-app-tooltip="Nach durchschnittlichen Korrekturen sortieren." data-app-tooltip-position="top" onClick={() => handleSort('averageExtraMoves')} onKeyDown={handleSortButtonKeyDown}>
                  {renderHeaderLabel('Korrekturen')}
                  <span className="stats-table-sort-indicator" aria-hidden="true">
                    {getSortIndicator('averageExtraMoves', sortKey, sortDirection)}
                  </span>
                </AnimatedButton>
                {renderColumnHelpBadge('averageExtraMoves')}
              </th>
              <th scope="col" aria-sort={sortKey === 'lastCompletedAt' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} {...getHelpHeaderProps('lastCompletedAt')}>
                <AnimatedButton className="stats-table-sort" interaction="chip" data-app-tooltip="Nach letztem Sieg sortieren." data-app-tooltip-position="top" onClick={() => handleSort('lastCompletedAt')} onKeyDown={handleSortButtonKeyDown}>
                  {renderHeaderLabel('Letzter Sieg')}
                  <span className="stats-table-sort-indicator" aria-hidden="true">
                    {getSortIndicator('lastCompletedAt', sortKey, sortDirection)}
                  </span>
                </AnimatedButton>
                {renderColumnHelpBadge('lastCompletedAt')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const difficultyColor = difficultyColorMap.get(getStatsDifficultyKey(row.option))
              const rowClassName = [
                row.solveCount === 0 ? 'is-muted' : '',
                difficultyColor ? 'has-difficulty-color' : '',
              ].filter(Boolean).join(' ')
              const rowStyle = difficultyColor
                ? ({ '--stats-difficulty-color': difficultyColor } as CSSProperties)
                : undefined

              return (
                <tr key={row.option.key} className={rowClassName} style={rowStyle}>
                  <th scope="row" className="stats-data-row-title">
                    <span className="stats-difficulty-label-chip">
                      <span className="stats-difficulty-label-text">{row.option.label}</span>
                      <span className="stats-difficulty-label-size">{formatPuzzleSize({ rows: row.option.rows, cols: row.option.cols })}</span>
                    </span>
                  </th>
                  <td>
                    <span className="stats-data-cell-main">{row.solveCount}</span>
                    <span className="stats-data-cell-copy">
                      {row.solveCount > 0 ? `${row.cleanSolveCount} ohne Hilfe` : 'noch keine Siege'}
                    </span>
                  </td>
                  <td className="is-positive">
                    <span className="stats-data-cell-main">{formatOptionalDuration(row.bestTime)}</span>
                  </td>
                  <td className="is-positive">
                    <span className="stats-data-cell-main">{formatOptionalMoves(row.bestMoves)}</span>
                  </td>
                  <td>
                    <span className="stats-data-cell-main">{formatOptionalDuration(row.medianTime)}</span>
                  </td>
                  <td>
                    <span className="stats-data-cell-main">{formatOptionalMoves(row.medianMoves)}</span>
                  </td>
                  <td>
                    <span className="stats-data-cell-main">{formatExtraMoves(row.averageExtraMoves)}</span>
                    <span className="stats-data-cell-copy">
                      {row.profiledSolveCount > 0 ? `${formatPercent(row.profileCoverage)} Datenqualität` : 'kein Laufprofil'}
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
              )
            })}
          </tbody>
        </table>
      </div>
    </UploadStatsSection>
  )
}
