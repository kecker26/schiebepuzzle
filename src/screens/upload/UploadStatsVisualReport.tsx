import { type CSSProperties, type RefObject, useMemo, useState } from 'react'
import {
  Activity,
  BarChart3,
  LayoutDashboard,
  LineChart,
  Table2,
} from 'lucide-react'
import { handleDirectionalFocusNavigation } from '../../app/directionalFocusNavigation.ts'
import AnimatedButton from '../../motion/AnimatedButton.tsx'
import AnimatedChipButton from '../../motion/AnimatedChipButton.tsx'
import AnimatedSwapPane from '../../motion/AnimatedSwapPane.tsx'
import { savePuzzleStatsExportFile } from '../../services/StatsService.ts'
import { PuzzleCompletionRecord, PuzzleDifficultyStats, PuzzleStats } from '../../types/index'
import { formatDifficultyLabel, formatPuzzleSize } from '../../utils/puzzleDifficulty.ts'
import UploadStatsComparisonMatrix from './UploadStatsComparisonMatrix.tsx'
import UploadStatsDifficultyTable from './UploadStatsDifficultyTable.tsx'
import UploadStatsHistorySection from './UploadStatsHistorySection.tsx'
import UploadStatsRunComparison from './UploadStatsRunComparison.tsx'
import {
  DifficultyReportRow,
  HistoryFilter,
  HistoryFilterDefinition,
  StandardDifficultyStatsEntry,
  buildDifficultyReportRows,
  formatAssistanceModeLabel,
  formatDate,
  formatExtraMoves,
  formatOptionalDuration,
  formatOptionalMoves,
  formatPercent,
  formatTime,
  getCompletionExtraMoves,
} from './uploadUtils.ts'

export type VisualStatsView = 'overview' | 'analysis' | 'history' | 'raw'

type AnalysisView = 'difficulties' | 'records' | 'assistance'

type HistoryMetric = 'time' | 'moves' | 'extraMoves'

type HistoryRange = 'recent12' | 'recent30' | 'all'

type HistoryChartMode = 'chronological' | 'perDifficulty'

type RawStatsView = 'difficulties' | 'history' | 'matrix'

interface AssistanceSummary {
  totalSolved: number
  cleanSolvedCount: number
  hintedSolvedCount: number
  autoAssistedSolvedCount: number
  legacySolvedCount: number
  cleanRate: number | null
}

interface UploadStatsVisualReportProps {
  stats: PuzzleStats | null
  latestCompletion: PuzzleCompletionRecord | null
  favoriteDifficulty: PuzzleDifficultyStats | null
  fastestDifficulty: PuzzleDifficultyStats | null
  completionHistory: PuzzleCompletionRecord[]
  filteredHistory: PuzzleCompletionRecord[]
  historyFilter: HistoryFilter
  historyFilterOptions: HistoryFilterDefinition[]
  standardDifficultyStats: StandardDifficultyStatsEntry[]
  onHistoryFilterChange: (filter: HistoryFilter) => void
  onReloadView: () => void
  onBackToStart: () => void
  activeView: VisualStatsView
  onActiveViewChange: (view: VisualStatsView) => void
  primaryFocusRef?: RefObject<HTMLButtonElement>
}

interface RecordCard {
  label: string
  value: string
  detail: string
  tone?: 'positive' | 'neutral'
}

const VISUAL_STATS_VIEWS: Array<{
  id: VisualStatsView
  label: string
  icon: typeof LayoutDashboard
}> = [
  { id: 'overview', label: 'Ueberblick', icon: LayoutDashboard },
  { id: 'analysis', label: 'Analyse', icon: BarChart3 },
  { id: 'history', label: 'Verlauf', icon: LineChart },
  { id: 'raw', label: 'Rohdaten', icon: Table2 },
]

const ANALYSIS_VIEWS: Array<{
  id: AnalysisView
  label: string
}> = [
  { id: 'difficulties', label: 'Stufen' },
  { id: 'records', label: 'Rekorde' },
  { id: 'assistance', label: 'Sauberkeit' },
]

const HISTORY_METRICS: Array<{
  id: HistoryMetric
  label: string
}> = [
  { id: 'time', label: 'Zeit' },
  { id: 'moves', label: 'Zuege' },
  { id: 'extraMoves', label: 'Umwege' },
]

const HISTORY_RANGES: Array<{
  id: HistoryRange
  label: string
}> = [
  { id: 'recent12', label: 'Letzte 12' },
  { id: 'recent30', label: 'Letzte 30' },
  { id: 'all', label: 'Alle' },
]

const HISTORY_CHART_MODES: Array<{
  id: HistoryChartMode
  label: string
}> = [
  { id: 'chronological', label: 'Chronologisch' },
  { id: 'perDifficulty', label: 'Pro Stufe' },
]

const DIFFICULTY_LINE_COLORS = ['#60a5fa', '#34d399', '#f59e0b', '#f472b6', '#a78bfa', '#22d3ee']

const RAW_STATS_VIEWS: Array<{
  id: RawStatsView
  label: string
  description: string
}> = [
  {
    id: 'difficulties',
    label: 'Stufen-Vergleich',
    description: 'Kompakte Aggregatwerte je Schwierigkeit.',
  },
  {
    id: 'history',
    label: 'Einzellauf-Historie',
    description: 'Jeder gespeicherte Sieg als filterbare Tabelle.',
  },
  {
    id: 'matrix',
    label: 'Expertenmatrix',
    description: 'Pivot-Ansicht fuer Gesamtwerte, Stufen und Extremwerte.',
  },
]

function getCompletionTimestamp(entry: PuzzleCompletionRecord): number {
  const parsed = Date.parse(entry.completedAt)
  return Number.isNaN(parsed) ? 0 : parsed
}

function sortCompletionsAscending(entries: PuzzleCompletionRecord[]): PuzzleCompletionRecord[] {
  return [...entries].sort((left, right) => getCompletionTimestamp(left) - getCompletionTimestamp(right))
}

function getPercent(value: number, max: number): number {
  if (max <= 0) return 0
  return Math.max(4, Math.min(100, Math.round((value / max) * 100)))
}

function getCleanRate(stats: PuzzleStats | null): number | null {
  if (!stats || stats.totalSolved <= 0) return null
  return Math.round((stats.cleanSolvedCount / stats.totalSolved) * 100)
}

function getDerivedAssistanceSummary(
  stats: PuzzleStats | null,
  completionHistory: PuzzleCompletionRecord[]
): AssistanceSummary {
  if (completionHistory.length === 0) {
    const totalSolved = stats?.totalSolved ?? 0
    const cleanSolvedCount = stats?.cleanSolvedCount ?? 0

    return {
      totalSolved,
      cleanSolvedCount,
      hintedSolvedCount: stats ? Math.max(0, stats.assistedSolvedCount - stats.autoAssistedSolvedCount) : 0,
      autoAssistedSolvedCount: stats?.autoAssistedSolvedCount ?? 0,
      legacySolvedCount: stats?.legacySolvedCount ?? 0,
      cleanRate: getCleanRate(stats),
    }
  }

  const counts = completionHistory.reduce(
    (summary, entry) => {
      if (!entry.hasDetailedProfile) return summary

      summary.profiledSolvedCount += 1

      if (entry.hintCount > 0) {
        summary.hintedSolvedCount += 1
      } else if (entry.suggestedMoveCount > 0) {
        summary.autoAssistedSolvedCount += 1
      } else if (entry.assistanceMode === 'clean') {
        summary.cleanSolvedCount += 1
      } else {
        summary.hintedSolvedCount += 1
      }

      return summary
    },
    {
      cleanSolvedCount: 0,
      hintedSolvedCount: 0,
      autoAssistedSolvedCount: 0,
      profiledSolvedCount: 0,
    }
  )
  const totalSolved = Math.max(stats?.totalSolved ?? 0, completionHistory.length)
  const cleanRate = totalSolved > 0 ? Math.round((counts.cleanSolvedCount / totalSolved) * 100) : null

  return {
    totalSolved,
    cleanSolvedCount: counts.cleanSolvedCount,
    hintedSolvedCount: counts.hintedSolvedCount,
    autoAssistedSolvedCount: counts.autoAssistedSolvedCount,
    legacySolvedCount: Math.max(0, totalSolved - counts.profiledSolvedCount),
    cleanRate,
  }
}

function getMetricValue(entry: PuzzleCompletionRecord, metric: HistoryMetric): number | null {
  switch (metric) {
    case 'time':
      return entry.time
    case 'moves':
      return entry.moves
    case 'extraMoves':
      return entry.hasDetailedProfile ? getCompletionExtraMoves(entry) : null
    default:
      return null
  }
}

function formatMetricValue(value: number | null, metric: HistoryMetric): string {
  if (value === null) return '--'
  if (metric === 'time') return formatOptionalDuration(value)
  if (metric === 'moves') return formatOptionalMoves(value)
  return formatExtraMoves(value)
}

function getMetricAxisLabel(metric: HistoryMetric): string {
  switch (metric) {
    case 'time':
      return 'Zeit'
    case 'moves':
      return 'Netto-Zuege'
    case 'extraMoves':
      return 'Umwege'
    default:
      return 'Wert'
  }
}

function formatShortDate(isoDate: string): string {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return '--'
  return parsed.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
  })
}

function formatChartTooltipDate(isoDate: string, includeTime = true): string {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return '--'

  return parsed.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(includeTime
      ? {
          hour: '2-digit',
          minute: '2-digit',
        }
      : {}),
  })
}

function getHistoryRangeEntries(entries: PuzzleCompletionRecord[], range: HistoryRange): PuzzleCompletionRecord[] {
  const sortedEntries = sortCompletionsAscending(entries)

  switch (range) {
    case 'recent12':
      return sortedEntries.slice(-12)
    case 'recent30':
      return sortedEntries.slice(-30)
    case 'all':
    default:
      return sortedEntries
  }
}

function formatExportStamp(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
}

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ''

  const text = String(value)
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function buildCsv(headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>): string {
  return [
    headers.map(escapeCsvCell).join(';'),
    ...rows.map((row) => row.map(escapeCsvCell).join(';')),
  ].join('\r\n')
}

function getMaximum(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((maximum, current) => (current > maximum ? current : maximum), values[0])
}

function buildDifficultyCsv(difficultyRows: DifficultyReportRow[]): string {
  return buildCsv(
    [
      'Stufe',
      'Raster',
      'Siege',
      'Ohne Hilfe',
      'Unterstuetzt',
      'Auto-Zug',
      'Legacy',
      'Clean %',
      'Datenqualitaet %',
      'Bestzeit',
      'Langsamste Zeit',
      'Wenigste Netto-Zuege',
      'Meiste Netto-Zuege',
      'Medianzeit',
      'Median-Zuege',
      'Extra-Zuege Schnitt',
      'Letzter Sieg',
      'Letzte Zeit',
      'Letzte Netto-Zuege',
      'Letzte Laufart',
    ],
    difficultyRows.map((row) => [
      row.option.label,
      formatPuzzleSize({ rows: row.option.rows, cols: row.option.cols }),
      row.solveCount,
      row.cleanSolveCount,
      row.assistedSolveCount,
      row.autoAssistedSolveCount,
      row.legacySolveCount,
      formatPercent(row.cleanRate),
      formatPercent(row.profileCoverage),
      formatOptionalDuration(row.bestTime),
      formatOptionalDuration(row.worstTime),
      formatOptionalMoves(row.bestMoves),
      formatOptionalMoves(row.worstMoves),
      formatOptionalDuration(row.medianTime),
      formatOptionalMoves(row.medianMoves),
      formatExtraMoves(row.averageExtraMoves),
      row.lastCompletedAt ? formatDate(row.lastCompletedAt) : '',
      formatOptionalDuration(row.lastTime),
      formatOptionalMoves(row.lastMoves),
      row.lastHasDetailedProfile ? formatAssistanceModeLabel(row.lastAssistanceMode) : row.solveCount > 0 ? 'Legacy' : '',
    ])
  )
}

function buildHistoryCsv(entries: PuzzleCompletionRecord[]): string {
  const sortedEntries = [...entries].sort((left, right) => getCompletionTimestamp(right) - getCompletionTimestamp(left))

  return buildCsv(
    [
      'Datum',
      'Stufe',
      'Raster',
      'Zeit',
      'Netto-Zuege',
      'Gesamt-Zuege',
      'Extra-Zuege',
      'Laufart',
      'Hinweise',
      'Auto-Zuege',
      'Laufprofil',
    ],
    sortedEntries.map((entry) => [
      formatDate(entry.completedAt),
      formatDifficultyLabel(entry.config),
      `${entry.config.rows}x${entry.config.cols}`,
      formatTime(entry.time),
      entry.moves,
      entry.hasDetailedProfile ? entry.actionMoves : '',
      entry.hasDetailedProfile ? getCompletionExtraMoves(entry) : '',
      entry.hasDetailedProfile ? formatAssistanceModeLabel(entry.assistanceMode) : 'Legacy',
      entry.hasDetailedProfile ? entry.hintCount : '',
      entry.hasDetailedProfile ? entry.suggestedMoveCount : '',
      entry.hasDetailedProfile ? 'ja' : 'nein',
    ])
  )
}

function buildMatrixCsv(
  stats: PuzzleStats | null,
  latestCompletion: PuzzleCompletionRecord | null,
  completionHistory: PuzzleCompletionRecord[],
  difficultyRows: DifficultyReportRow[]
): string {
  const profiledHistory = completionHistory.filter((entry) => entry.hasDetailedProfile)
  const assistanceSummary = getDerivedAssistanceSummary(stats, completionHistory)
  const totalProfileCoverage = assistanceSummary.totalSolved > 0
    ? Math.round((profiledHistory.length / assistanceSummary.totalSolved) * 100)
    : null
  const totalAverageExtraMoves = profiledHistory.length > 0
    ? Math.round(
      profiledHistory.reduce((sum, entry) => sum + getCompletionExtraMoves(entry), 0) / profiledHistory.length
    )
    : null

  const columns = [
    {
      label: 'Gesamt',
      solveCount: assistanceSummary.totalSolved,
      cleanRate: assistanceSummary.cleanRate,
      bestTime: stats?.bestTime ?? null,
      worstTime: getMaximum(completionHistory.map((entry) => entry.time)),
      bestMoves: stats?.bestMoves ?? null,
      worstMoves: getMaximum(completionHistory.map((entry) => entry.moves)),
      medianTime: stats && stats.totalSolved > 0 ? stats.medianTime : null,
      medianMoves: stats && stats.totalSolved > 0 ? stats.medianMoves : null,
      averageExtraMoves: totalAverageExtraMoves,
      profileCoverage: totalProfileCoverage,
      lastCompletedAt: latestCompletion?.completedAt ?? stats?.lastCompletedAt ?? null,
    },
    ...difficultyRows.map((row) => ({
      label: `${row.option.label} (${formatPuzzleSize({ rows: row.option.rows, cols: row.option.cols })})`,
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
    })),
  ]

  const rows = [
    ['Siege', ...columns.map((column) => column.solveCount)],
    ['Ohne Hilfe', ...columns.map((column) => formatPercent(column.cleanRate))],
    ['Bestzeit', ...columns.map((column) => formatOptionalDuration(column.bestTime))],
    ['Langsamste Zeit', ...columns.map((column) => formatOptionalDuration(column.worstTime))],
    ['Wenigste Netto-Zuege', ...columns.map((column) => formatOptionalMoves(column.bestMoves))],
    ['Meiste Netto-Zuege', ...columns.map((column) => formatOptionalMoves(column.worstMoves))],
    ['Medianzeit', ...columns.map((column) => formatOptionalDuration(column.medianTime))],
    ['Median-Zuege', ...columns.map((column) => formatOptionalMoves(column.medianMoves))],
    ['Extra-Zuege', ...columns.map((column) => formatExtraMoves(column.averageExtraMoves))],
    ['Datenqualitaet', ...columns.map((column) => formatPercent(column.profileCoverage))],
    ['Letzter Sieg', ...columns.map((column) => column.lastCompletedAt ? formatDate(column.lastCompletedAt) : '')],
  ]

  return buildCsv(['Kennzahl', ...columns.map((column) => column.label)], rows)
}

function buildRawStatsJson(payload: {
  stats: PuzzleStats | null
  latestCompletion: PuzzleCompletionRecord | null
  favoriteDifficulty: PuzzleDifficultyStats | null
  fastestDifficulty: PuzzleDifficultyStats | null
  completionHistory: PuzzleCompletionRecord[]
  filteredHistory: PuzzleCompletionRecord[]
  historyFilter: HistoryFilter
  difficultyRows: DifficultyReportRow[]
  rawStatsView: RawStatsView
}): string {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    activeView: payload.rawStatsView,
    historyFilter: payload.historyFilter,
    summary: {
      totalSolved: payload.stats?.totalSolved ?? 0,
      cleanSolvedCount: payload.stats?.cleanSolvedCount ?? 0,
      assistedSolvedCount: payload.stats?.assistedSolvedCount ?? 0,
      bestTime: payload.stats?.bestTime ?? null,
      bestMoves: payload.stats?.bestMoves ?? null,
      lastCompletedAt: payload.stats?.lastCompletedAt ?? null,
    },
    stats: payload.stats,
    latestCompletion: payload.latestCompletion,
    favoriteDifficulty: payload.favoriteDifficulty,
    fastestDifficulty: payload.fastestDifficulty,
    difficultyRows: payload.difficultyRows,
    completionHistory: payload.completionHistory,
    filteredHistory: payload.filteredHistory,
  }, null, 2)
}

interface HistorySeriesOption {
  key: string
  label: string
  color: string
}

interface HistorySeriesPoint {
  entry: PuzzleCompletionRecord
  value: number
  x: number
  y: number
  seriesKey: string
  seriesLabel: string
  color: string
  localIndex: number
}

interface HistorySeries {
  key: string
  label: string
  color: string
  points: string
  values: HistorySeriesPoint[]
}

interface DifficultyHelpSummary {
  hintedRuns: number
  autoRuns: number
  totalHints: number
  totalAutoMoves: number
}

interface HelpDetailChip {
  label: string
  className?: string
}

function getCompletionDifficultyKey(entry: PuzzleCompletionRecord): string {
  return `${entry.config.rows}x${entry.config.cols}`
}

function getDifficultyOptionKey(row: DifficultyReportRow): string {
  return `${row.option.rows}x${row.option.cols}`
}

function buildDifficultyHelpSummaries(entries: PuzzleCompletionRecord[]): Map<string, DifficultyHelpSummary> {
  return entries.reduce<Map<string, DifficultyHelpSummary>>((summaryMap, entry) => {
    if (!entry.hasDetailedProfile) return summaryMap

    const key = getCompletionDifficultyKey(entry)
    const summary = summaryMap.get(key) ?? {
      hintedRuns: 0,
      autoRuns: 0,
      totalHints: 0,
      totalAutoMoves: 0,
    }

    if (entry.hintCount > 0) summary.hintedRuns += 1
    if (entry.suggestedMoveCount > 0) summary.autoRuns += 1
    summary.totalHints += entry.hintCount
    summary.totalAutoMoves += entry.suggestedMoveCount
    summaryMap.set(key, summary)

    return summaryMap
  }, new Map())
}

function getHelpDetailChips(summary: DifficultyHelpSummary, hasCompletedRuns: boolean): HelpDetailChip[] {
  if (!hasCompletedRuns) return []

  const chips = [
    summary.hintedRuns > 0 ? { label: `${summary.hintedRuns} Hinweis-Laeufe` } : null,
    summary.totalHints > 0 ? { label: `${summary.totalHints} Hinweise` } : null,
    summary.autoRuns > 0 ? { label: `${summary.autoRuns} Auto-Laeufe` } : null,
    summary.totalAutoMoves > 0 ? { label: `${summary.totalAutoMoves} Auto-Zuege` } : null,
  ].filter((chip): chip is HelpDetailChip => chip !== null)

  return chips.length > 0
    ? chips
    : [{ label: 'Ohne Hilfe', className: 'is-clean' }]
}

function getMultiLineChartData(
  entries: PuzzleCompletionRecord[],
  metric: HistoryMetric,
  mode: HistoryChartMode,
  seriesOptions: HistorySeriesOption[],
  hiddenSeriesKeys: string[]
): {
  series: HistorySeries[]
  values: HistorySeriesPoint[]
  min: number
  max: number
} {
  const seriesByKey = new Map(seriesOptions.map((series) => [series.key, series]))
  const groupedValues = new Map<string, Array<{
    entry: PuzzleCompletionRecord
    value: number
    sourceIndex: number
  }>>()

  entries.forEach((entry, sourceIndex) => {
    const seriesKey = getCompletionDifficultyKey(entry)
    const seriesOption = seriesByKey.get(seriesKey)
    const value = getMetricValue(entry, metric)

    if (!seriesOption || hiddenSeriesKeys.includes(seriesKey) || value === null) return

    const group = groupedValues.get(seriesKey) ?? []
    group.push({ entry, value, sourceIndex })
    groupedValues.set(seriesKey, group)
  })

  const rawValues = Array.from(groupedValues.values()).flat().map((item) => item.value)
  if (rawValues.length === 0) {
    return { series: [], values: [], min: 0, max: 0 }
  }

  const min = Math.min(...rawValues)
  const max = Math.max(...rawValues)
  const range = Math.max(1, max - min)

  const series = seriesOptions
    .filter((seriesOption) => !hiddenSeriesKeys.includes(seriesOption.key))
    .map((seriesOption) => {
      const group = groupedValues.get(seriesOption.key) ?? []
      const plottedValues = group.map((item, localIndex) => {
        const x = mode === 'perDifficulty'
          ? group.length === 1
            ? 50
            : 8 + (localIndex / (group.length - 1)) * 86
          : entries.length === 1
            ? 50
            : 8 + (item.sourceIndex / (entries.length - 1)) * 86
        const y = max === min ? 52 : 82 - ((item.value - min) / range) * 58
        return {
          entry: item.entry,
          value: item.value,
          x,
          y,
          seriesKey: seriesOption.key,
          seriesLabel: seriesOption.label,
          color: seriesOption.color,
          localIndex,
        }
      })

      return {
        ...seriesOption,
        points: plottedValues.map((item) => `${item.x.toFixed(2)},${item.y.toFixed(2)}`).join(' '),
        values: plottedValues,
      }
    })
    .filter((item) => item.values.length > 0)

  return {
    series,
    values: series.flatMap((item) => item.values),
    min,
    max,
  }
}

function getAssistanceSegments(row: DifficultyReportRow) {
  return [
    { label: 'Clean', value: row.cleanSolveCount, className: 'is-clean' },
    {
      label: 'Hinweise',
      value: Math.max(0, row.assistedSolveCount - row.autoAssistedSolveCount),
      className: 'is-hinted',
    },
    { label: 'Auto-Zug', value: row.autoAssistedSolveCount, className: 'is-auto' },
    { label: 'Legacy', value: row.legacySolveCount, className: 'is-legacy' },
  ]
}

function renderStackedSegments(segments: Array<{ label: string; value: number; className: string }>, total: number) {
  return segments.map((segment) => {
    const width = total > 0 ? (segment.value / total) * 100 : 0
    return (
      <span
        key={segment.label}
        className={`stats-visual-stacked-segment ${segment.className}`}
        style={{ width: `${Math.max(0, width)}%` }}
        title={`${segment.label}: ${segment.value}`}
      />
    )
  })
}

function findBestEntry(
  entries: PuzzleCompletionRecord[],
  predicate: (entry: PuzzleCompletionRecord) => boolean,
  getValue: (entry: PuzzleCompletionRecord) => number
): PuzzleCompletionRecord | null {
  const matchingEntries = entries.filter(predicate)
  if (matchingEntries.length === 0) return null

  return matchingEntries.reduce((best, current) => (
    getValue(current) < getValue(best) ? current : best
  ), matchingEntries[0])
}

function renderMetricCards(
  stats: PuzzleStats | null,
  latestCompletion: PuzzleCompletionRecord | null,
  cleanRate: number | null,
  cleanSolvedCount: number
) {
  const cards = [
    {
      label: 'Siege',
      value: `${stats?.totalSolved ?? 0}`,
      detail: `${stats?.activeDays ?? 0} aktive Tage`,
    },
    {
      label: 'Bestzeit',
      value: formatOptionalDuration(stats?.bestTime ?? null),
      detail: latestCompletion ? `Zuletzt ${formatDifficultyLabel(latestCompletion.config)}` : 'Noch kein Lauf',
    },
    {
      label: 'Wenigste Zuege',
      value: formatOptionalMoves(stats?.bestMoves ?? null),
      detail: `${stats?.medianMoves ?? 0} Median`,
    },
    {
      label: 'Clean-Quote',
      value: formatPercent(cleanRate),
      detail: `${cleanSolvedCount} clean geloest`,
    },
  ]

  return (
    <div className="stats-visual-kpi-grid">
      {cards.map((card) => (
        <article key={card.label} className="stats-report-card stats-visual-kpi-card">
          <span className="saved-games-kicker">{card.label}</span>
          <strong className="stats-report-card-value">{card.value}</strong>
          <p className="stats-report-card-copy">{card.detail}</p>
        </article>
      ))}
    </div>
  )
}

export default function UploadStatsVisualReport({
  stats,
  latestCompletion,
  favoriteDifficulty,
  fastestDifficulty,
  completionHistory,
  filteredHistory,
  historyFilter,
  historyFilterOptions,
  standardDifficultyStats,
  onHistoryFilterChange,
  onReloadView,
  onBackToStart,
  activeView,
  onActiveViewChange,
  primaryFocusRef,
}: UploadStatsVisualReportProps) {
  const [analysisView, setAnalysisView] = useState<AnalysisView>('difficulties')
  const [historyMetric, setHistoryMetric] = useState<HistoryMetric>('time')
  const [historyRange, setHistoryRange] = useState<HistoryRange>('recent12')
  const [historyChartMode, setHistoryChartMode] = useState<HistoryChartMode>('chronological')
  const [hiddenHistoryDifficultyKeys, setHiddenHistoryDifficultyKeys] = useState<string[]>([])
  const [rawStatsView, setRawStatsView] = useState<RawStatsView>('difficulties')
  const [isSavingRawExport, setIsSavingRawExport] = useState(false)
  const [rawExportStatus, setRawExportStatus] = useState<string | null>(null)

  const difficultyRows = useMemo(
    () => buildDifficultyReportRows(standardDifficultyStats, completionHistory),
    [completionHistory, standardDifficultyStats]
  )
  const difficultyHelpSummaries = useMemo(
    () => buildDifficultyHelpSummaries(completionHistory),
    [completionHistory]
  )
  const solvedDifficultyRows = difficultyRows.filter((row) => row.solveCount > 0)
  const maxSolveCount = Math.max(1, ...difficultyRows.map((row) => row.solveCount))
  const rangedHistory = useMemo(
    () => getHistoryRangeEntries(completionHistory, historyRange),
    [completionHistory, historyRange]
  )
  const historySeriesOptions = useMemo(
    () => solvedDifficultyRows.map((row, index) => ({
      key: `${row.option.rows}x${row.option.cols}`,
      label: row.option.label,
      color: DIFFICULTY_LINE_COLORS[index % DIFFICULTY_LINE_COLORS.length],
    })),
    [solvedDifficultyRows]
  )
  const lineChart = useMemo(
    () => getMultiLineChartData(
      rangedHistory,
      historyMetric,
      historyChartMode,
      historySeriesOptions,
      hiddenHistoryDifficultyKeys
    ),
    [hiddenHistoryDifficultyKeys, historyChartMode, historyMetric, historySeriesOptions, rangedHistory]
  )
  const lineChartMetricLabel = getMetricAxisLabel(historyMetric)
  const firstLineChartEntry = rangedHistory[0] ?? null
  const lastLineChartEntry = rangedHistory[rangedHistory.length - 1] ?? null
  const visibleHistorySeriesCount = historySeriesOptions.filter(
    (series) => !hiddenHistoryDifficultyKeys.includes(series.key)
  ).length
  const assistanceSummary = useMemo(
    () => getDerivedAssistanceSummary(stats, completionHistory),
    [completionHistory, stats]
  )
  const bestTimeEntry = findBestEntry(completionHistory, () => true, (entry) => entry.time)
  const bestMovesEntry = findBestEntry(completionHistory, () => true, (entry) => entry.moves)
  const bestCleanTimeEntry = findBestEntry(
    completionHistory,
    (entry) => entry.hasDetailedProfile && entry.assistanceMode === 'clean',
    (entry) => entry.time
  )
  const bestExtraMovesEntry = findBestEntry(
    completionHistory,
    (entry) => entry.hasDetailedProfile,
    (entry) => getCompletionExtraMoves(entry)
  )
  const cleanRate = assistanceSummary.cleanRate
  const assistanceTotal = Math.max(1, assistanceSummary.totalSolved)
  const assistanceSegments = [
    { label: 'Clean', value: assistanceSummary.cleanSolvedCount, className: 'is-clean' },
    { label: 'Hinweise', value: assistanceSummary.hintedSolvedCount, className: 'is-hinted' },
    { label: 'Auto-Zug', value: assistanceSummary.autoAssistedSolvedCount, className: 'is-auto' },
    { label: 'Legacy', value: assistanceSummary.legacySolvedCount, className: 'is-legacy' },
  ]
  const overviewFocusCards: RecordCard[] = [
    {
      label: 'Letzter Lauf',
      value: latestCompletion ? formatOptionalDuration(latestCompletion.time) : '--',
      detail: latestCompletion
        ? `${formatDifficultyLabel(latestCompletion.config)}, ${latestCompletion.moves} Netto-Zuege, ${formatAssistanceModeLabel(latestCompletion.assistanceMode)}.`
        : 'Nach dem naechsten Sieg erscheint hier die direkte Einordnung.',
      tone: 'neutral',
    },
    {
      label: 'Lieblingsstufe',
      value: favoriteDifficulty ? formatDifficultyLabel(favoriteDifficulty.config) : '--',
      detail: favoriteDifficulty ? `${favoriteDifficulty.solveCount} Siege` : 'Noch kein Favorit',
      tone: 'neutral',
    },
    {
      label: 'Beste Serie',
      value: `${stats?.bestStreak ?? 0}`,
      detail: `${stats?.currentStreak ?? 0} aktuelle Serie`,
      tone: 'neutral',
    },
  ]
  const recordCards: RecordCard[] = [
    {
      label: 'Schnellster Lauf',
      value: bestTimeEntry ? formatOptionalDuration(bestTimeEntry.time) : '--',
      detail: bestTimeEntry ? formatDifficultyLabel(bestTimeEntry.config) : 'Noch kein Sieg',
      tone: 'positive',
    },
    {
      label: 'Wenigste Zuege',
      value: bestMovesEntry ? formatOptionalMoves(bestMovesEntry.moves) : '--',
      detail: bestMovesEntry ? formatDifficultyLabel(bestMovesEntry.config) : 'Noch kein Sieg',
      tone: 'positive',
    },
    {
      label: 'Beste Clean-Zeit',
      value: bestCleanTimeEntry ? formatOptionalDuration(bestCleanTimeEntry.time) : '--',
      detail: bestCleanTimeEntry ? formatDifficultyLabel(bestCleanTimeEntry.config) : 'Noch kein Clean-Lauf',
      tone: 'positive',
    },
    {
      label: 'Wenigste Umwege',
      value: bestExtraMovesEntry ? formatExtraMoves(getCompletionExtraMoves(bestExtraMovesEntry)) : '--',
      detail: bestExtraMovesEntry ? formatDifficultyLabel(bestExtraMovesEntry.config) : 'Noch kein Laufprofil',
      tone: 'positive',
    },
  ]

  const handleToggleHistorySeries = (seriesKey: string) => {
    setHiddenHistoryDifficultyKeys((current) => {
      if (current.includes(seriesKey)) {
        return current.filter((key) => key !== seriesKey)
      }

      const visibleCount = historySeriesOptions.filter((series) => !current.includes(series.key)).length
      return visibleCount <= 1 ? current : [...current, seriesKey]
    })
  }

  const handleExportActiveRawCsv = async () => {
    if (isSavingRawExport) return

    const stamp = formatExportStamp()
    const csv = rawStatsView === 'history'
      ? buildHistoryCsv(filteredHistory)
      : rawStatsView === 'matrix'
        ? buildMatrixCsv(stats, latestCompletion, completionHistory, difficultyRows)
        : buildDifficultyCsv(difficultyRows)
    const viewName = rawStatsView === 'history'
      ? 'verlauf'
      : rawStatsView === 'matrix'
        ? 'matrix'
        : 'stufen'
    const fileName = `schiebepuzzle-statistik-${viewName}-${stamp}.csv`

    setIsSavingRawExport(true)
    setRawExportStatus(null)

    try {
      const savedFile = await savePuzzleStatsExportFile({
        fileName,
        contents: csv,
        mimeType: 'text/csv;charset=utf-8',
      })
      setRawExportStatus(`Gespeichert: ${savedFile.relativePath}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export konnte nicht gespeichert werden.'
      setRawExportStatus(message)
    } finally {
      setIsSavingRawExport(false)
    }
  }

  const handleExportRawJson = async () => {
    if (isSavingRawExport) return

    const stamp = formatExportStamp()
    const json = buildRawStatsJson({
      stats,
      latestCompletion,
      favoriteDifficulty,
      fastestDifficulty,
      completionHistory,
      filteredHistory,
      historyFilter,
      difficultyRows,
      rawStatsView,
    })
    const fileName = `schiebepuzzle-statistik-rohdaten-${stamp}.json`

    setIsSavingRawExport(true)
    setRawExportStatus(null)

    try {
      const savedFile = await savePuzzleStatsExportFile({
        fileName,
        contents: json,
        mimeType: 'application/json;charset=utf-8',
      })
      setRawExportStatus(`Gespeichert: ${savedFile.relativePath}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export konnte nicht gespeichert werden.'
      setRawExportStatus(message)
    } finally {
      setIsSavingRawExport(false)
    }
  }

  return (
    <section className="stats-visual-report" aria-label="Statistik visualisieren">
      <div className="stats-visual-nav" role="tablist" aria-label="Statistikansicht waehlen" onKeyDown={handleDirectionalFocusNavigation}>
        {VISUAL_STATS_VIEWS.map((view) => {
          const Icon = view.icon
          const isActive = activeView === view.id

          return (
            <AnimatedButton
              key={view.id}
              ref={view.id === 'overview' ? primaryFocusRef : undefined}
              className={`stats-visual-tab${isActive ? ' is-active' : ''}`}
              interaction="chip"
              role="tab"
              aria-selected={isActive}
              aria-controls={`stats-visual-panel-${view.id}`}
              onClick={() => onActiveViewChange(view.id)}
            >
              <Icon className="stats-visual-tab-icon" aria-hidden="true" />
              <span>{view.label}</span>
            </AnimatedButton>
          )
        })}
      </div>

      <AnimatedSwapPane swapKey={activeView} className="stats-visual-panel-swap">
        <div
          id={`stats-visual-panel-${activeView}`}
          className="stats-visual-panel"
          data-view={activeView}
          role="tabpanel"
        >
          {activeView === 'overview' ? (
            <>
              {renderMetricCards(stats, latestCompletion, cleanRate, assistanceSummary.cleanSolvedCount)}

              <div className="stats-visual-overview-grid">
                {overviewFocusCards.map((card) => (
                  <article key={card.label} className="stats-report-card stats-visual-focus-card">
                    <span className="saved-games-kicker">{card.label}</span>
                    <strong className="stats-report-card-value">{card.value}</strong>
                    <p className="stats-report-card-copy">{card.detail}</p>
                  </article>
                ))}

                <article className="stats-report-card stats-visual-focus-card">
                  <span className="saved-games-kicker">Sauberkeit</span>
                  <strong className="stats-report-card-value">{formatPercent(cleanRate)}</strong>
                  <div className="stats-visual-stacked-bar" aria-label={`Clean-Quote ${formatPercent(cleanRate)}`}>
                    {renderStackedSegments(assistanceSegments, assistanceTotal)}
                  </div>
                  <p className="stats-report-card-copy">
                    {assistanceSummary.cleanSolvedCount} clean, {assistanceSummary.hintedSolvedCount + assistanceSummary.autoAssistedSolvedCount} unterstuetzt.
                  </p>
                </article>
              </div>
            </>
          ) : null}

          {activeView === 'analysis' ? (
            <>
              <div className="stats-visual-toolbar stats-analysis-toolbar">
                <div className="dashboard-filter-row" aria-label="Analysebereich waehlen" onKeyDown={handleDirectionalFocusNavigation}>
                  {ANALYSIS_VIEWS.map((view) => (
                    <AnimatedChipButton
                      key={view.id}
                      className={`dashboard-filter-chip${analysisView === view.id ? ' is-active' : ''}`}
                      onClick={() => setAnalysisView(view.id)}
                    >
                      {view.label}
                    </AnimatedChipButton>
                  ))}
                </div>
              </div>

              <AnimatedSwapPane swapKey={analysisView} className="stats-analysis-swap">
                <div className="stats-analysis-panel" data-analysis-view={analysisView}>
                  {analysisView === 'difficulties' ? (
                    <>
                      <div className="stats-visual-bar-legend" aria-label="Balkenlegende">
                        <span className="is-solves"><i aria-hidden="true" /> Siege im Vergleich</span>
                        <span className="is-clean"><i aria-hidden="true" /> Ohne Hilfe</span>
                        <span className="is-hinted"><i aria-hidden="true" /> Mit Hinweisen</span>
                        <span className="is-auto"><i aria-hidden="true" /> Mit Auto-Zug</span>
                        <span className="is-legacy"><i aria-hidden="true" /> Alte Daten</span>
                      </div>
                      <p className="stats-visual-bar-note">
                        Siegtyp zaehlt jeden Sieg genau einmal. Die Detailwerte darunter zeigen zusaetzlich, wie viele Hinweise und Auto-Zuege wirklich benutzt wurden.
                      </p>

                      <div className="stats-visual-difficulty-list">
                        {difficultyRows.map((row) => {
                          const rowTotal = Math.max(1, row.solveCount)
                          const helpSummary = difficultyHelpSummaries.get(getDifficultyOptionKey(row)) ?? {
                            hintedRuns: 0,
                            autoRuns: 0,
                            totalHints: 0,
                            totalAutoMoves: 0,
                          }
                          const helpDetailChips = getHelpDetailChips(helpSummary, row.solveCount > 0)
                          return (
                            <article key={row.option.key} className={`stats-visual-difficulty-row${row.solveCount === 0 ? ' is-muted' : ''}`}>
                              <div className="stats-visual-difficulty-title">
                                <strong>{row.option.label}</strong>
                                <span>{formatPuzzleSize({ rows: row.option.rows, cols: row.option.cols })}</span>
                              </div>

                              <div className="stats-visual-difficulty-bars">
                                <div className="stats-visual-bar-line">
                                  <span>Siege</span>
                                  <div className="stats-visual-bar-track" aria-label={`${row.solveCount} Siege im Vergleich zur meistgeloesten Stufe`}>
                                    <span className="stats-visual-bar-fill" style={{ width: `${getPercent(row.solveCount, maxSolveCount)}%` }} />
                                  </div>
                                </div>
                                <div className="stats-visual-bar-line">
                                  <span>Siegtyp</span>
                                  <div className="stats-visual-stacked-bar" aria-label={`Siegtyp: ${formatPercent(row.cleanRate)} ohne Hilfe`}>
                                    {renderStackedSegments(getAssistanceSegments(row), rowTotal)}
                                  </div>
                                </div>
                                {helpDetailChips.length > 0 ? (
                                  <div className="stats-visual-help-detail-chips" aria-label={`Hilfedetails fuer ${row.option.label}`}>
                                    {helpDetailChips.map((chip) => (
                                      <span key={chip.label} className={chip.className}>
                                        {chip.label}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>

                              <div className="stats-visual-difficulty-metrics">
                                <span><strong>{row.solveCount}</strong> Siege</span>
                                <span><strong>{formatPercent(row.cleanRate)}</strong> ohne Hilfe</span>
                                <span><strong>{formatOptionalDuration(row.bestTime)}</strong> Bestzeit</span>
                                <span><strong>{formatOptionalDuration(row.medianTime)}</strong> Median</span>
                                <span><strong>{formatOptionalMoves(row.bestMoves)}</strong> wenigste Zuege</span>
                                <span><strong>{formatExtraMoves(row.averageExtraMoves)}</strong> Extra-Zuege</span>
                              </div>
                            </article>
                          )
                        })}
                      </div>
                    </>
                  ) : null}

                  {analysisView === 'records' ? (
                    <div className="stats-report-card-grid stats-visual-record-grid">
                      {recordCards.map((card) => (
                        <article
                          key={card.label}
                          className={`stats-report-card stats-visual-record-card${card.tone === 'positive' ? ' is-positive' : ''}`}
                        >
                          <span className="saved-games-kicker">{card.label}</span>
                          <strong className="stats-report-card-value">{card.value}</strong>
                          <p className="stats-report-card-copy">{card.detail}</p>
                        </article>
                      ))}
                    </div>
                  ) : null}

                  {analysisView === 'assistance' ? (
                    <div className="stats-visual-assistance-grid">
                      <article className="stats-report-card stats-visual-assistance-card">
                        <span className="saved-games-kicker">Laufarten gesamt</span>
                        <strong className="stats-report-card-value">{formatPercent(cleanRate)}</strong>
                        <div className="stats-visual-stacked-bar is-large">
                          {renderStackedSegments(assistanceSegments, assistanceTotal)}
                        </div>
                        <div className="stats-visual-segment-legend">
                          {assistanceSegments.map((segment) => (
                            <span key={segment.label} className={segment.className}>
                              <i aria-hidden="true" />
                              {segment.label}: {segment.value}
                            </span>
                          ))}
                        </div>
                      </article>

                      <div className="stats-visual-assistance-list">
                        {difficultyRows.map((row) => {
                          const total = Math.max(1, row.solveCount)
                          const helpSummary = difficultyHelpSummaries.get(getDifficultyOptionKey(row)) ?? {
                            hintedRuns: 0,
                            autoRuns: 0,
                            totalHints: 0,
                            totalAutoMoves: 0,
                          }
                          return (
                            <article key={row.option.key} className={`stats-visual-assistance-row${row.solveCount === 0 ? ' is-muted' : ''}`}>
                              <div>
                                <strong>{row.option.label}</strong>
                                <span>{row.cleanSolveCount} ohne Hilfe, {row.assistedSolveCount} unterstuetzt</span>
                              </div>
                              <div className="stats-visual-stacked-bar">
                                {renderStackedSegments(getAssistanceSegments(row), total)}
                              </div>
                              <div className="stats-visual-assistance-detail">
                                <strong>{formatPercent(row.cleanRate)}</strong>
                                <span>{helpSummary.totalHints} Hinweise</span>
                                <span>{helpSummary.totalAutoMoves} Auto-Zuege</span>
                              </div>
                            </article>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              </AnimatedSwapPane>
            </>
          ) : null}

          {activeView === 'history' ? (
            <>
              <div className="stats-visual-toolbar">
                <div className="dashboard-filter-row" aria-label="Metrik waehlen" onKeyDown={handleDirectionalFocusNavigation}>
                  {HISTORY_METRICS.map((metric) => (
                    <AnimatedChipButton
                      key={metric.id}
                      className={`dashboard-filter-chip${historyMetric === metric.id ? ' is-active' : ''}`}
                      onClick={() => setHistoryMetric(metric.id)}
                    >
                      {metric.label}
                    </AnimatedChipButton>
                  ))}
                </div>

                <div className="dashboard-filter-row" aria-label="Zeitraum waehlen" onKeyDown={handleDirectionalFocusNavigation}>
                  {HISTORY_RANGES.map((range) => (
                    <AnimatedChipButton
                      key={range.id}
                      className={`dashboard-filter-chip${historyRange === range.id ? ' is-active' : ''}`}
                      onClick={() => setHistoryRange(range.id)}
                    >
                      {range.label}
                    </AnimatedChipButton>
                  ))}
                </div>

                <div className="dashboard-filter-row" aria-label="Verlaufsmodus waehlen" onKeyDown={handleDirectionalFocusNavigation}>
                  {HISTORY_CHART_MODES.map((mode) => (
                    <AnimatedChipButton
                      key={mode.id}
                      className={`dashboard-filter-chip${historyChartMode === mode.id ? ' is-active' : ''}`}
                      onClick={() => setHistoryChartMode(mode.id)}
                    >
                      {mode.label}
                    </AnimatedChipButton>
                  ))}
                </div>
              </div>

              <article className="stats-report-card stats-visual-line-card">
                <div className="stats-visual-line-head">
                  <span>
                    <strong>{formatMetricValue(lineChart.min, historyMetric)}</strong>
                    <span> Minimum</span>
                  </span>
                  <span>
                    <strong>{formatMetricValue(lineChart.max, historyMetric)}</strong>
                    <span> Maximum</span>
                  </span>
                </div>

                {historySeriesOptions.length > 0 ? (
                  <div className="stats-visual-chart-legend" aria-label="Farblegende der Verlaufskurven">
                    <strong>Legende</strong>
                    {historySeriesOptions.map((series) => {
                      const isVisible = !hiddenHistoryDifficultyKeys.includes(series.key)
                      return (
                        <span
                          key={series.key}
                          className={isVisible ? '' : 'is-muted'}
                          style={{ '--series-color': series.color } as CSSProperties}
                        >
                          <i aria-hidden="true" />
                          {series.label}
                        </span>
                      )
                    })}
                  </div>
                ) : null}

                {lineChart.values.length === 0 ? (
                  <div className="stats-empty-state dashboard-empty-state">
                    <span className="empty-icon" aria-hidden="true"><Activity /></span>
                    <p>Keine Werte fuer diese Visualisierung.</p>
                    <p className="empty-hint">Waehle eine andere Metrik oder spiele weitere Runden.</p>
                  </div>
                ) : (
                  <div className="stats-visual-chart-frame">
                    <div className="stats-visual-axis-label stats-visual-axis-label-y">{lineChartMetricLabel}</div>
                    <div className="stats-visual-axis-label stats-visual-axis-label-x">Laufverlauf</div>
                    <div className="stats-visual-axis-value stats-visual-axis-value-top">
                      {formatMetricValue(lineChart.max, historyMetric)}
                    </div>
                    <div className="stats-visual-axis-value stats-visual-axis-value-bottom">
                      {formatMetricValue(lineChart.min, historyMetric)}
                    </div>
                    <div className="stats-visual-chart-plot">
                      <svg className="stats-visual-line-chart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                        <line x1="8" y1="24" x2="94" y2="24" className="stats-visual-chart-grid" />
                        <line x1="8" y1="53" x2="94" y2="53" className="stats-visual-chart-grid is-muted" />
                        <line x1="8" y1="82" x2="94" y2="82" className="stats-visual-chart-axis" />
                        <line x1="8" y1="24" x2="8" y2="82" className="stats-visual-chart-axis" />
                        {lineChart.series.map((series) => (
                          <polyline
                            key={series.key}
                            points={series.points}
                            className="stats-visual-chart-line"
                            style={{ '--series-color': series.color } as CSSProperties}
                          />
                        ))}
                      </svg>
                      <div className="stats-visual-chart-points" aria-label={`${lineChartMetricLabel} im Verlauf`}>
                        {lineChart.values.map((point) => {
                          const tooltipDate = formatChartTooltipDate(point.entry.completedAt)

                          return (
                            <button
                              key={`${point.seriesKey}-${point.entry.id}`}
                              type="button"
                              className={`stats-visual-chart-point${visibleHistorySeriesCount === 1 ? ' is-solo-series' : ''}`}
                              style={{
                                '--series-color': point.color,
                                left: `${point.x}%`,
                                top: `${point.y}%`,
                              } as CSSProperties}
                              aria-label={`${point.seriesLabel}, ${formatMetricValue(point.value, historyMetric)}, ${tooltipDate}`}
                            >
                              <span className="stats-visual-chart-tooltip" role="tooltip">
                                <strong>{formatMetricValue(point.value, historyMetric)}</strong>
                                <span>{point.seriesLabel}</span>
                                {historyChartMode === 'perDifficulty' ? <span>Lauf #{point.localIndex + 1}</span> : null}
                                <span>{tooltipDate}</span>
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div className="stats-visual-axis-date stats-visual-axis-date-start">
                      {historyChartMode === 'perDifficulty' ? '1' : firstLineChartEntry ? formatShortDate(firstLineChartEntry.completedAt) : '--'}
                    </div>
                    <div className="stats-visual-axis-date stats-visual-axis-date-end">
                      {historyChartMode === 'perDifficulty'
                        ? `${Math.max(1, ...lineChart.series.map((series) => series.values.length))}`
                        : lastLineChartEntry ? formatShortDate(lastLineChartEntry.completedAt) : '--'}
                    </div>
                  </div>
                )}

                <div className="stats-visual-line-legend">
                  <span>{rangedHistory.length} Laeufe im Ausschnitt</span>
                  <span>{completionHistory.length} Laeufe gesamt</span>
                </div>

                <div className="stats-visual-series-legend" aria-label="Schwierigkeiten ein- oder ausblenden" onKeyDown={handleDirectionalFocusNavigation}>
                  <span className="stats-visual-series-legend-label">Kurven ein-/ausblenden</span>
                  {historySeriesOptions.map((series) => {
                    const isVisible = !hiddenHistoryDifficultyKeys.includes(series.key)
                    const isLastVisible = isVisible && visibleHistorySeriesCount <= 1
                    return (
                      <AnimatedChipButton
                        key={series.key}
                        className={`dashboard-filter-chip stats-visual-series-chip${isVisible ? ' is-active' : ''}`}
                        style={{ '--series-color': series.color } as CSSProperties}
                        onClick={() => handleToggleHistorySeries(series.key)}
                        disabled={isLastVisible}
                      >
                        <i aria-hidden="true" />
                        {series.label}
                      </AnimatedChipButton>
                    )
                  })}
                </div>
              </article>
            </>
          ) : null}

          {activeView === 'raw' ? (
            <div className="stats-raw-explorer">
              <div className="stats-raw-explorer-head">
                <div className="stats-raw-explorer-head-main">
                  <div className="dashboard-filter-row" aria-label="Rohdatenansicht waehlen" onKeyDown={handleDirectionalFocusNavigation}>
                    {RAW_STATS_VIEWS.map((view) => (
                      <AnimatedChipButton
                        key={view.id}
                        className={`dashboard-filter-chip${rawStatsView === view.id ? ' is-active' : ''}`}
                        onClick={() => setRawStatsView(view.id)}
                      >
                        {view.label}
                      </AnimatedChipButton>
                    ))}
                  </div>

                  <p className="stats-raw-explorer-note">
                    {RAW_STATS_VIEWS.find((view) => view.id === rawStatsView)?.description}
                  </p>
                </div>

                <div className="stats-raw-explorer-actions" aria-label="Rohdaten exportieren" onKeyDown={handleDirectionalFocusNavigation}>
                  <AnimatedButton
                    className="secondary"
                    interaction="chip"
                    onClick={() => {
                      void handleExportActiveRawCsv()
                    }}
                    disabled={isSavingRawExport || (rawStatsView === 'history' ? filteredHistory.length === 0 : completionHistory.length === 0)}
                    title="Speichert die aktuell gewaehlte Rohdatenansicht als CSV im Projektordner statistik-exporte"
                  >
                    CSV speichern
                  </AnimatedButton>
                  <AnimatedButton
                    className="secondary"
                    interaction="chip"
                    onClick={() => {
                      void handleExportRawJson()
                    }}
                    disabled={isSavingRawExport || (!stats && completionHistory.length === 0)}
                    title="Speichert alle Statistik-Rohdaten als JSON im Projektordner statistik-exporte"
                  >
                    JSON speichern
                  </AnimatedButton>
                </div>

                {rawExportStatus ? (
                  <p className="stats-raw-export-status" role="status">
                    {rawExportStatus}
                  </p>
                ) : null}
              </div>

              <AnimatedSwapPane swapKey={rawStatsView} className="stats-raw-explorer-swap">
                <div className="stats-visual-raw-stack" data-raw-view={rawStatsView}>
                  {rawStatsView === 'difficulties' ? (
                    <UploadStatsDifficultyTable
                      stats={stats}
                      completionHistory={completionHistory}
                      standardDifficultyStats={standardDifficultyStats}
                      onReloadView={onReloadView}
                      onBackToStart={onBackToStart}
                    />
                  ) : null}

                  {rawStatsView === 'history' ? (
                    <UploadStatsHistorySection
                      isLoadingStats={false}
                      completionHistory={completionHistory}
                      filteredHistory={filteredHistory}
                      historyFilter={historyFilter}
                      historyFilterOptions={historyFilterOptions}
                      standardDifficultyStats={standardDifficultyStats}
                      onHistoryFilterChange={onHistoryFilterChange}
                      onReloadView={onReloadView}
                      onBackToStart={onBackToStart}
                    />
                  ) : null}

                  {rawStatsView === 'matrix' ? (
                    <UploadStatsComparisonMatrix
                      stats={stats}
                      latestCompletion={latestCompletion}
                      favoriteDifficulty={favoriteDifficulty}
                      fastestDifficulty={fastestDifficulty}
                      completionHistory={completionHistory}
                      standardDifficultyStats={standardDifficultyStats}
                      onReloadView={onReloadView}
                      onBackToStart={onBackToStart}
                    />
                  ) : null}
                </div>
              </AnimatedSwapPane>
            </div>
          ) : null}
        </div>
      </AnimatedSwapPane>

      {latestCompletion && activeView === 'overview' ? (
        <div className="stats-visual-latest-run">
          <UploadStatsRunComparison
            stats={stats}
            latestCompletion={latestCompletion}
            completionHistory={completionHistory}
            onReloadView={onReloadView}
            onBackToStart={onBackToStart}
          />
        </div>
      ) : null}

      {activeView !== 'raw' && solvedDifficultyRows.length === 0 ? (
        <div className="stats-empty-state dashboard-empty-state">
          <span className="empty-icon" aria-hidden="true">&#128221;</span>
          <p>Noch keine Statistikwerte vorhanden.</p>
          <p className="empty-hint">Nach dem ersten Sieg erscheinen hier Diagramme, Rekorde und Verlauf.</p>
        </div>
      ) : null}
    </section>
  )
}
