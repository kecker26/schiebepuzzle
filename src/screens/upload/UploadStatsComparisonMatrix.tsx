import type { CSSProperties, RefObject } from 'react'
import { PuzzleCompletionRecord, PuzzleDifficultyStats, PuzzleStats } from '../../types/index'
import { formatDifficultyLabel, formatPuzzleSize } from '../../utils/puzzleDifficulty.ts'
import UploadStatsSection from './UploadStatsSection.tsx'
import {
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

interface UploadStatsComparisonMatrixProps {
  stats: PuzzleStats | null
  latestCompletion: PuzzleCompletionRecord | null
  favoriteDifficulty: PuzzleDifficultyStats | null
  fastestDifficulty: PuzzleDifficultyStats | null
  completionHistory: PuzzleCompletionRecord[]
  standardDifficultyStats: StandardDifficultyStatsEntry[]
  onReloadView: () => void
  onBackToStart: () => void
  defaultOpen?: boolean
  summaryButtonRef?: RefObject<HTMLButtonElement>
}

interface MatrixColumn {
  id: string
  label: string
  description: string
  solveCount: number
  cleanRate: number | null
  bestTime: number | null
  worstTime: number | null
  bestMoves: number | null
  worstMoves: number | null
  medianTime: number | null
  medianMoves: number | null
  averageExtraMoves: number | null
  profileCoverage: number | null
  lastCompletedAt: string | null
  difficultyColor: string | null
}

type MatrixTone = 'neutral' | 'positive' | 'negative'

function getMaximum(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((maximum, current) => (current > maximum ? current : maximum), values[0])
}

export default function UploadStatsComparisonMatrix({
  stats,
  latestCompletion,
  favoriteDifficulty,
  fastestDifficulty,
  completionHistory,
  standardDifficultyStats,
  onReloadView,
  onBackToStart,
  defaultOpen = true,
  summaryButtonRef,
}: UploadStatsComparisonMatrixProps) {
  const difficultyRows = buildDifficultyReportRows(standardDifficultyStats, completionHistory)
  const difficultyColorMap = buildStatsDifficultyColorMap(difficultyRows)
  const profiledHistory = completionHistory.filter((entry) => entry.hasDetailedProfile)
  const totalCleanRate = stats && stats.totalSolved > 0
    ? Math.round((stats.cleanSolvedCount / stats.totalSolved) * 100)
    : null
  const totalProfileCoverage = stats && stats.totalSolved > 0
    ? Math.round((stats.profiledSolvedCount / stats.totalSolved) * 100)
    : null
  const totalAverageExtraMoves = profiledHistory.length > 0
    ? Math.round(
      profiledHistory.reduce((sum, entry) => sum + Math.max(0, entry.actionMoves - entry.moves), 0) / profiledHistory.length
    )
    : null

  const matrixColumns: MatrixColumn[] = [
    {
      id: 'total',
      label: 'Gesamt',
      description: 'Alle Stufen',
      solveCount: stats?.totalSolved ?? 0,
      cleanRate: totalCleanRate,
      bestTime: stats?.bestTime ?? null,
      worstTime: getMaximum(completionHistory.map((entry) => entry.time)),
      bestMoves: stats?.bestMoves ?? null,
      worstMoves: getMaximum(completionHistory.map((entry) => entry.moves)),
      medianTime: stats && stats.totalSolved > 0 ? stats.medianTime : null,
      medianMoves: stats && stats.totalSolved > 0 ? stats.medianMoves : null,
      averageExtraMoves: totalAverageExtraMoves,
      profileCoverage: totalProfileCoverage,
      lastCompletedAt: latestCompletion?.completedAt ?? stats?.lastCompletedAt ?? null,
      difficultyColor: null,
    },
    ...difficultyRows.map((row) => {
      const difficultyColor = difficultyColorMap.get(getStatsDifficultyKey(row.option)) ?? null

      return {
        id: row.option.key,
        label: row.option.label,
        description: formatPuzzleSize({ rows: row.option.rows, cols: row.option.cols }),
        solveCount: row.solveCount,
        cleanRate: row.cleanRate,
        bestTime: row.bestTime,
        worstTime: row.worstTime,
        bestMoves: row.bestMoves,
        worstMoves: row.worstMoves,
        medianTime: row.medianTime,
        medianMoves: row.medianMoves,
        averageExtraMoves: row.averageExtraMoves,
        profileCoverage: row.profileCoverage,
        lastCompletedAt: row.lastCompletedAt,
        difficultyColor,
      }
    }),
  ]

  const matrixRows: Array<{
    id: string
    label: string
    copy: string
    tone: MatrixTone
    renderValue: (column: MatrixColumn) => string
  }> = [
    {
      id: 'solveCount',
      label: 'Siege',
      copy: 'Abgeschlossene Runden',
      tone: 'neutral',
      renderValue: (column) => `${column.solveCount}`,
    },
    {
      id: 'cleanRate',
      label: 'Ohne Hilfe',
      copy: 'Anteil ohne Hilfen',
      tone: 'neutral',
      renderValue: (column) => formatPercent(column.cleanRate),
    },
    {
      id: 'bestTime',
      label: 'Bestzeit',
      copy: 'Schnellster Sieg',
      tone: 'positive',
      renderValue: (column) => formatOptionalDuration(column.bestTime),
    },
    {
      id: 'worstTime',
      label: 'Langsamste Zeit',
      copy: 'Langsamster Sieg',
      tone: 'negative',
      renderValue: (column) => formatOptionalDuration(column.worstTime),
    },
    {
      id: 'bestMoves',
      label: 'Wenigste Netto-Zuege',
      copy: 'Effizientester Sieg',
      tone: 'positive',
      renderValue: (column) => formatOptionalMoves(column.bestMoves),
    },
    {
      id: 'worstMoves',
      label: 'Meiste Netto-Zuege',
      copy: 'Zaehester Sieg',
      tone: 'negative',
      renderValue: (column) => formatOptionalMoves(column.worstMoves),
    },
    {
      id: 'medianTime',
      label: 'Medianzeit',
      copy: 'Typischer Lauf',
      tone: 'neutral',
      renderValue: (column) => formatOptionalDuration(column.medianTime),
    },
    {
      id: 'medianMoves',
      label: 'Median-Zuege',
      copy: 'Typische Netto-Zuege',
      tone: 'neutral',
      renderValue: (column) => formatOptionalMoves(column.medianMoves),
    },
    {
      id: 'averageExtraMoves',
      label: 'Korrekturen',
      copy: 'Aktionen minus Netto-Zuege im Schnitt',
      tone: 'neutral',
      renderValue: (column) => formatExtraMoves(column.averageExtraMoves),
    },
    {
      id: 'profileCoverage',
      label: 'Datenqualitaet',
      copy: 'Volle Laufprofile verfuegbar',
      tone: 'neutral',
      renderValue: (column) => formatPercent(column.profileCoverage),
    },
    {
      id: 'lastCompletedAt',
      label: 'Letzter Sieg',
      copy: 'Zuletzt abgeschlossen',
      tone: 'neutral',
      renderValue: (column) => column.lastCompletedAt ? formatDate(column.lastCompletedAt) : '--',
    },
  ]

  return (
    <UploadStatsSection
      id="stats-report-comparison"
      className="stats-report-section-table"
      kicker="Expertenansicht"
      title="Erweiterte Vergleichsmatrix"
      copy="Die Matrix stellt Gesamtwert, Schwierigkeit und Extremwerte direkt nebeneinander. Sie ist als Pruef- und Vergleichsansicht gedacht, wenn du alle Kennzahlen in einer Pivot-Tabelle sehen moechtest."
      summaryMeta={
        <>
          <span className="stats-report-summary-pill">
            {latestCompletion ? `Zuletzt ${formatDifficultyLabel(latestCompletion.config)}` : 'Noch kein Sieg'}
          </span>
          <span className="stats-report-summary-pill">
            {favoriteDifficulty ? `Favorit ${formatDifficultyLabel(favoriteDifficulty.config)}` : 'Kein Favorit'}
          </span>
          <span className="stats-report-summary-pill">
            {fastestDifficulty ? `Schnellster Schnitt ${formatDifficultyLabel(fastestDifficulty.config)}` : 'Noch kein Schnitt'}
          </span>
        </>
      }
      collapsible
      defaultOpen={defaultOpen}
      onReloadView={onReloadView}
      onBackToStart={onBackToStart}
      summaryButtonRef={summaryButtonRef}
    >
      {completionHistory.length === 0 ? (
        <div className="stats-empty-state dashboard-empty-state">
          <span className="empty-icon" aria-hidden="true">&#128221;</span>
          <p>Noch keine Statistikwerte vorhanden.</p>
          <p className="empty-hint">
            Nach dem ersten Sieg fuellt sich diese Matrix automatisch mit Gesamtwerten und Kennzahlen pro Schwierigkeit.
          </p>
        </div>
      ) : (
        <div className="stats-table-shell stats-table-shell-matrix">
          <table className="stats-data-table stats-matrix-table">
            <thead>
              <tr>
                <th scope="col" className="stats-matrix-header-cell stats-matrix-header-cell-metric">
                  Kennzahl
                </th>
                {matrixColumns.map((column) => {
                  const columnStyle = column.difficultyColor
                    ? ({ '--stats-difficulty-color': column.difficultyColor } as CSSProperties)
                    : undefined

                  return (
                    <th
                      key={column.id}
                      scope="col"
                      className={`stats-matrix-header-cell${column.difficultyColor ? ' has-difficulty-color' : ''}`}
                      style={columnStyle}
                    >
                      {column.difficultyColor ? (
                        <span className="stats-difficulty-label-chip">
                          <span className="stats-difficulty-label-text">{column.label}</span>
                          <span className="stats-difficulty-label-size">{column.description}</span>
                        </span>
                      ) : (
                        <>
                          <span className="stats-matrix-column-title">{column.label}</span>
                          <span className="stats-matrix-column-copy">{column.description}</span>
                        </>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {matrixRows.map((row) => (
                <tr key={row.id}>
                  <th scope="row" className="stats-matrix-row-heading">
                    <span className="stats-matrix-row-title">{row.label}</span>
                    <span className="stats-matrix-row-copy">{row.copy}</span>
                  </th>
                  {matrixColumns.map((column) => {
                    const value = row.renderValue(column)
                    const columnStyle = column.difficultyColor
                      ? ({ '--stats-difficulty-color': column.difficultyColor } as CSSProperties)
                      : undefined

                    return (
                      <td
                        key={`${row.id}-${column.id}`}
                        className={`stats-matrix-cell${column.difficultyColor ? ' has-difficulty-color' : ''}${row.tone === 'positive' ? ' is-positive' : row.tone === 'negative' ? ' is-negative' : ''}`}
                        style={columnStyle}
                      >
                        <span className="stats-matrix-value">{value}</span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </UploadStatsSection>
  )
}
