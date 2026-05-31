import { type CSSProperties, type RefObject, useMemo, useState } from 'react'
import {
  Activity,
  Download,
  LayoutDashboard,
  LineChart as LineChartIcon,
  Table2,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
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

export type VisualStatsView = 'overview' | 'history' | 'raw'

type TrendMetric = 'actions' | 'time' | 'quality'

type HistoryRange = 'recent12' | 'recent30' | 'all'

type RawStatsView = 'difficulties' | 'history' | 'matrix'

interface AssistanceSummary {
  totalSolved: number
  cleanSolvedCount: number
  hintedSolvedCount: number
  autoAssistedSolvedCount: number
  legacySolvedCount: number
  cleanRate: number | null
  profileCoverage: number | null
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

interface KpiCard {
  label: string
  value: string
  detail: string
  title?: string
}

interface ScoreBreakdown {
  score: number
  correctionPenalty: number
  hintPenalty: number
  autoPenalty: number
  assistancePenalty: number
  corrections: number
  hints: number
  autoMoves: number
}

interface ScoreBreakdownDatum {
  key: 'score' | 'corrections' | 'hints' | 'auto' | 'assistance'
  label: string
  value: number
  displayValue: string
  detail: string
  color: string
}

interface FavoriteDifficultyDatum {
  key: string
  label: string
  solveCount: number
  share: number
  medianTime: number | null
  medianMoves: number | null
  isFavorite: boolean
  color: string
}

interface DonutSegment {
  key: string
  label: string
  value: number
  color: string
}

interface TrendPoint {
  id: string
  index: number
  difficultyKey: string
  date: string
  label: string
  difficulty: string
  actions: number | null
  moves: number
  corrections: number | null
  time: number
  quality: number | null
  hints: number | null
  autoMoves: number | null
  runType: string
}

interface TrendDifficultySeries {
  key: string
  label: string
  color: string
}

interface TrendSeriesChartPoint {
  id: string
  index: number
  value: number
  source: TrendPoint
}

interface TrendReferenceStats {
  best: number | null
  median: number | null
}

interface ChartTooltipPayload {
  name?: string | number
  value?: unknown
  color?: string
  dataKey?: unknown
  payload?: TrendSeriesChartPoint | DonutSegment | ScoreBreakdownDatum | FavoriteDifficultyDatum
}

interface ChartTooltipProps {
  active?: boolean
  label?: string | number
  payload?: readonly ChartTooltipPayload[]
}

const VISUAL_STATS_VIEWS: Array<{
  id: VisualStatsView
  label: string
  icon: typeof LayoutDashboard
}> = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'history', label: 'Verlauf & Trends', icon: LineChartIcon },
  { id: 'raw', label: 'Rohdaten & Details', icon: Table2 },
]

const TREND_METRICS: Array<{
  id: TrendMetric
  label: string
  description: string
}> = [
  {
    id: 'actions',
    label: 'Aktionen',
    description: 'Netto-Zuege ueber die Zeit, getrennt nach Schwierigkeit.',
  },
  {
    id: 'time',
    label: 'Zeit',
    description: 'Laufzeiten ueber die Zeit, getrennt nach Schwierigkeit.',
  },
  {
    id: 'quality',
    label: 'Lauf-Score',
    description: 'Lauf-Score ueber die Zeit, getrennt nach Schwierigkeit.',
  },
]

const HISTORY_RANGES: Array<{
  id: HistoryRange
  label: string
}> = [
  { id: 'recent12', label: 'Letzte 12' },
  { id: 'recent30', label: 'Letzte 30' },
  { id: 'all', label: 'Alle' },
]

const RAW_STATS_VIEWS: Array<{
  id: RawStatsView
  label: string
  description: string
}> = [
  {
    id: 'difficulties',
    label: 'Stufen-Tabelle',
    description: 'Sortierbare Aggregatwerte je Schwierigkeit.',
  },
  {
    id: 'history',
    label: 'Einzellauf-Tabelle',
    description: 'Jeder gespeicherte Sieg als filterbare Tabelle.',
  },
  {
    id: 'matrix',
    label: 'Vergleichsmatrix',
    description: 'Pivot-Ansicht fuer Gesamtwerte, Stufen und Extremwerte.',
  },
]

const ASSISTANCE_COLORS = {
  clean: '#34d399',
  hinted: '#f59e0b',
  auto: '#60a5fa',
  legacy: '#94a3b8',
}

const DIFFICULTY_TREND_COLORS = ['#60a5fa', '#34d399', '#f59e0b', '#f472b6', '#a78bfa', '#22d3ee']

function getCompletionTimestamp(entry: PuzzleCompletionRecord): number {
  const parsed = Date.parse(entry.completedAt)
  return Number.isNaN(parsed) ? 0 : parsed
}

function sortCompletionsAscending(entries: PuzzleCompletionRecord[]): PuzzleCompletionRecord[] {
  return [...entries].sort((left, right) => getCompletionTimestamp(left) - getCompletionTimestamp(right))
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
    const profiledSolvedCount = stats?.profiledSolvedCount ?? 0

    return {
      totalSolved,
      cleanSolvedCount: stats?.cleanSolvedCount ?? 0,
      hintedSolvedCount: stats ? Math.max(0, stats.assistedSolvedCount - stats.autoAssistedSolvedCount) : 0,
      autoAssistedSolvedCount: stats?.autoAssistedSolvedCount ?? 0,
      legacySolvedCount: stats?.legacySolvedCount ?? 0,
      cleanRate: getCleanRate(stats),
      profileCoverage: totalSolved > 0 ? Math.round((profiledSolvedCount / totalSolved) * 100) : null,
    }
  }

  const counts = completionHistory.reduce(
    (summary, entry) => {
      if (!entry.hasDetailedProfile) {
        summary.legacySolvedCount += 1
        return summary
      }

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
      legacySolvedCount: 0,
      profiledSolvedCount: 0,
    }
  )
  const totalSolved = Math.max(stats?.totalSolved ?? 0, completionHistory.length)
  const cleanRate = totalSolved > 0 ? Math.round((counts.cleanSolvedCount / totalSolved) * 100) : null
  const profileCoverage = totalSolved > 0 ? Math.round((counts.profiledSolvedCount / totalSolved) * 100) : null

  return {
    totalSolved,
    cleanSolvedCount: counts.cleanSolvedCount,
    hintedSolvedCount: counts.hintedSolvedCount,
    autoAssistedSolvedCount: counts.autoAssistedSolvedCount,
    legacySolvedCount: Math.max(counts.legacySolvedCount, totalSolved - counts.profiledSolvedCount),
    cleanRate,
    profileCoverage,
  }
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

function formatShortDate(isoDate: string): string {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return '--'
  return parsed.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
  })
}

function formatChartTooltipDate(isoDate: string): string {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return '--'

  return parsed.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
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
      'Korrekturen Schnitt',
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
      'Aktionen',
      'Korrekturen',
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
    ['Korrekturen', ...columns.map((column) => formatExtraMoves(column.averageExtraMoves))],
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

function calculateAverage(values: number[]): number | null {
  const average = calculateAverageValue(values)
  return average === null ? null : Math.round(average)
}

function calculateAverageValue(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function formatAverageCount(value: number | null): string {
  if (value === null) return '--'

  const roundedValue = Math.round(value * 10) / 10
  if (roundedValue === 0 && value > 0) return '<0,1'
  if (Number.isInteger(roundedValue)) return `${roundedValue}`

  return roundedValue.toLocaleString('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

function calculateMedian(values: number[]): number | null {
  if (values.length === 0) return null
  const sortedValues = [...values].sort((left, right) => left - right)
  const middleIndex = Math.floor(sortedValues.length / 2)

  return sortedValues.length % 2 === 0
    ? Math.round((sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2)
    : sortedValues[middleIndex]
}

function calculateQualityBreakdown(entry: PuzzleCompletionRecord): ScoreBreakdown | null {
  if (!entry.hasDetailedProfile) return null

  const corrections = getCompletionExtraMoves(entry)
  const correctionPenalty = Math.min(48, corrections * 4)
  const hintPenalty = Math.min(28, entry.hintCount * 8)
  const autoPenalty = Math.min(36, entry.suggestedMoveCount * 12)
  const assistancePenalty = entry.assistanceMode === 'clean' ? 0 : 8

  return {
    score: Math.max(0, Math.round(100 - correctionPenalty - hintPenalty - autoPenalty - assistancePenalty)),
    correctionPenalty,
    hintPenalty,
    autoPenalty,
    assistancePenalty,
    corrections,
    hints: entry.hintCount,
    autoMoves: entry.suggestedMoveCount,
  }
}

function calculateQualityScore(entry: PuzzleCompletionRecord): number | null {
  return calculateQualityBreakdown(entry)?.score ?? null
}

function getAverageScoreBreakdown(entries: PuzzleCompletionRecord[]): ScoreBreakdown | null {
  const breakdowns = entries
    .map((entry) => calculateQualityBreakdown(entry))
    .filter((breakdown): breakdown is ScoreBreakdown => breakdown !== null)

  if (breakdowns.length === 0) return null

  const average = (selector: (breakdown: ScoreBreakdown) => number): number =>
    breakdowns.reduce((sum, breakdown) => sum + selector(breakdown), 0) / breakdowns.length

  return {
    score: Math.round(average((breakdown) => breakdown.score)),
    correctionPenalty: average((breakdown) => breakdown.correctionPenalty),
    hintPenalty: average((breakdown) => breakdown.hintPenalty),
    autoPenalty: average((breakdown) => breakdown.autoPenalty),
    assistancePenalty: average((breakdown) => breakdown.assistancePenalty),
    corrections: average((breakdown) => breakdown.corrections),
    hints: average((breakdown) => breakdown.hints),
    autoMoves: average((breakdown) => breakdown.autoMoves),
  }
}

function formatPenaltyValue(value: number): string {
  const formattedValue = formatAverageCount(value)
  return value > 0 ? `-${formattedValue}` : '0'
}

function formatShare(part: number, total: number): string {
  if (total <= 0) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

function buildScoreBreakdownData(breakdown: ScoreBreakdown | null): ScoreBreakdownDatum[] {
  if (!breakdown) return []

  return [
    {
      key: 'score',
      label: 'Score',
      value: breakdown.score,
      displayValue: `${breakdown.score}/100`,
      detail: 'Verbleibende Punkte nach allen Abzuegen.',
      color: '#34d399',
    },
    {
      key: 'corrections',
      label: 'Korrekturen',
      value: breakdown.correctionPenalty,
      displayValue: formatPenaltyValue(breakdown.correctionPenalty),
      detail: `${formatAverageCount(breakdown.corrections)} Korrekturen, 4 Punkte Abzug je Korrektur, maximal 48.`,
      color: '#f59e0b',
    },
    {
      key: 'hints',
      label: 'Hinweise',
      value: breakdown.hintPenalty,
      displayValue: formatPenaltyValue(breakdown.hintPenalty),
      detail: `${formatAverageCount(breakdown.hints)} Hinweise, 8 Punkte Abzug je Hinweis, maximal 28.`,
      color: '#f97316',
    },
    {
      key: 'auto',
      label: 'Auto-Zuege',
      value: breakdown.autoPenalty,
      displayValue: breakdown.autoPenalty >= 36 ? '-36 max.' : formatPenaltyValue(breakdown.autoPenalty),
      detail: `${formatAverageCount(breakdown.autoMoves)} Auto-Zuege, 12 Punkte Abzug je Auto-Zug, maximal 36.`,
      color: '#ef4444',
    },
    {
      key: 'assistance',
      label: 'Hilfe-Modus',
      value: breakdown.assistancePenalty,
      displayValue: formatPenaltyValue(breakdown.assistancePenalty),
      detail: breakdown.assistancePenalty > 0 ? '8 Punkte Abzug, sobald der Lauf nicht clean ist.' : 'Kein Abzug bei cleanem Lauf.',
      color: '#a855f7',
    },
  ]
}

function buildAverageScoreBreakdownData(
  entries: PuzzleCompletionRecord[],
  breakdown: ScoreBreakdown | null
): ScoreBreakdownDatum[] {
  const data = buildScoreBreakdownData(breakdown)
  const profiledEntries = entries.filter((entry) => entry.hasDetailedProfile)

  if (!breakdown || profiledEntries.length === 0) return data

  const totalActionMoves = profiledEntries.reduce((sum, entry) => sum + entry.actionMoves, 0)
  const totalNetMoves = profiledEntries.reduce((sum, entry) => sum + entry.moves, 0)
  const totalCorrections = profiledEntries.reduce((sum, entry) => sum + getCompletionExtraMoves(entry), 0)
  const totalHints = profiledEntries.reduce((sum, entry) => sum + entry.hintCount, 0)
  const totalAutoMoves = profiledEntries.reduce((sum, entry) => sum + entry.suggestedMoveCount, 0)
  const assistedRuns = profiledEntries.filter((entry) => entry.assistanceMode !== 'clean').length

  return data.map((datum) => {
    switch (datum.key) {
      case 'score':
        return {
          ...datum,
          detail: `Durchschnitt aus ${profiledEntries.length} Laufprofilen mit ${totalActionMoves} Aktionen insgesamt (${totalNetMoves} Netto-Zuege).`,
        }
      case 'corrections':
        return {
          ...datum,
          detail: `${totalCorrections} Korrekturen bei ${totalActionMoves} Aktionen insgesamt (${formatShare(totalCorrections, totalActionMoves)}). Im Schnitt ${formatAverageCount(breakdown.corrections)} pro Lauf.`,
        }
      case 'hints':
        return {
          ...datum,
          detail: `${totalHints} Hinweise bei ${totalActionMoves} Aktionen insgesamt (${formatShare(totalHints, totalActionMoves)}). Im Schnitt ${formatAverageCount(breakdown.hints)} pro Lauf.`,
        }
      case 'auto':
        return {
          ...datum,
          detail: `${totalAutoMoves} Auto-Zuege bei ${totalActionMoves} Aktionen insgesamt (${formatShare(totalAutoMoves, totalActionMoves)}). Die Score-Strafe ist bei 36 Punkten gedeckelt.`,
        }
      case 'assistance':
        return {
          ...datum,
          detail: `${assistedRuns} von ${profiledEntries.length} Laufprofilen waren nicht clean. Dafuer fallen im Schnitt ${formatPenaltyValue(breakdown.assistancePenalty)} Punkte an.`,
        }
      default:
        return datum
    }
  })
}

function buildFavoriteDifficultyData(
  rows: DifficultyReportRow[],
  favoriteDifficultyKey: string | null
): FavoriteDifficultyDatum[] {
  const solvedRows = rows
    .filter((row) => row.solveCount > 0)
    .sort((left, right) => right.solveCount - left.solveCount || left.option.label.localeCompare(right.option.label))
  const totalSolves = solvedRows.reduce((sum, row) => sum + row.solveCount, 0)
  if (totalSolves === 0) return []

  const favoriteRow = favoriteDifficultyKey
    ? solvedRows.find((row) => `${row.option.rows}x${row.option.cols}` === favoriteDifficultyKey)
    : null
  const featuredRows =
    favoriteRow && solvedRows.slice(0, 4).every((row) => row !== favoriteRow)
      ? [...solvedRows.filter((row) => row !== favoriteRow).slice(0, 3), favoriteRow]
      : solvedRows.slice(0, 4)
  const featuredKeys = new Set(featuredRows.map((row) => `${row.option.rows}x${row.option.cols}`))
  const remainingRows = solvedRows.filter((row) => !featuredKeys.has(`${row.option.rows}x${row.option.cols}`))

  const data = featuredRows.map((row, index) => {
    const key = `${row.option.rows}x${row.option.cols}`
    const isFavorite = key === favoriteDifficultyKey

    return {
      key,
      label: row.option.label,
      solveCount: row.solveCount,
      share: Math.round((row.solveCount / totalSolves) * 100),
      medianTime: row.medianTime,
      medianMoves: row.medianMoves,
      isFavorite,
      color: isFavorite ? '#34d399' : DIFFICULTY_TREND_COLORS[index % DIFFICULTY_TREND_COLORS.length],
    }
  })

  if (remainingRows.length > 0) {
    const remainingSolves = remainingRows.reduce((sum, row) => sum + row.solveCount, 0)
    data.push({
      key: 'other',
      label: 'Weitere',
      solveCount: remainingSolves,
      share: Math.round((remainingSolves / totalSolves) * 100),
      medianTime: null,
      medianMoves: null,
      isFavorite: false,
      color: '#94a3b8',
    })
  }

  return data
}

function buildTrendPoints(entries: PuzzleCompletionRecord[]): TrendPoint[] {
  return entries.map((entry, index) => {
    const corrections = entry.hasDetailedProfile ? getCompletionExtraMoves(entry) : null

    return {
      id: entry.id,
      index: index + 1,
      difficultyKey: getCompletionDifficultyKey(entry),
      date: entry.completedAt,
      label: formatShortDate(entry.completedAt),
      difficulty: formatDifficultyLabel(entry.config),
      actions: entry.hasDetailedProfile ? entry.actionMoves : null,
      moves: entry.moves,
      corrections,
      time: entry.time,
      quality: calculateQualityScore(entry),
      hints: entry.hasDetailedProfile ? entry.hintCount : null,
      autoMoves: entry.hasDetailedProfile ? entry.suggestedMoveCount : null,
      runType: entry.hasDetailedProfile ? formatAssistanceModeLabel(entry.assistanceMode) : 'Legacy',
    }
  })
}

function getCompletionDifficultyKey(entry: Pick<PuzzleCompletionRecord, 'config'>): string {
  return `${entry.config.rows}x${entry.config.cols}`
}

function getTrendMetricValue(point: TrendPoint, metric: TrendMetric): number | null {
  switch (metric) {
    case 'time':
      return point.time
    case 'quality':
      return point.quality
    case 'actions':
    default:
      return point.moves
  }
}

function buildTrendSeriesChartPoints(points: TrendPoint[], metric: TrendMetric): Record<string, TrendSeriesChartPoint[]> {
  return points.reduce<Record<string, TrendSeriesChartPoint[]>>((seriesPoints, point) => {
    const metricValue = getTrendMetricValue(point, metric)

    if (metricValue === null) return seriesPoints

    const existingPoints = seriesPoints[point.difficultyKey] ?? []
    seriesPoints[point.difficultyKey] = [
      ...existingPoints,
      {
        id: point.id,
        index: point.index,
        value: metricValue,
        source: point,
      },
    ]

    return seriesPoints
  }, {})
}

function getTrendTicks(points: TrendPoint[]): number[] {
  const maximumTicks = 8
  if (points.length <= maximumTicks) return points.map((point) => point.index)

  const lastIndex = points.length - 1
  const step = lastIndex / (maximumTicks - 1)
  return Array.from({ length: maximumTicks }, (_, index) => {
    const pointIndex = Math.round(index * step)
    return points[pointIndex]?.index ?? index + 1
  })
}

function getTrendReferenceStats(
  points: TrendPoint[],
  metric: TrendMetric,
  seriesKey: string | null
): TrendReferenceStats {
  if (!seriesKey) {
    return { best: null, median: null }
  }

  const values = points
    .filter((point) => point.difficultyKey === seriesKey)
    .map((point) => getTrendMetricValue(point, metric))
    .filter((value): value is number => value !== null)

  if (values.length === 0) {
    return { best: null, median: null }
  }

  return {
    best: metric === 'quality' ? Math.max(...values) : Math.min(...values),
    median: calculateMedian(values),
  }
}

function getTrendValueFormatter(metric: TrendMetric): (value: unknown) => string {
  return (value) => {
    if (typeof value !== 'number') return '--'
    if (metric === 'time') return formatOptionalDuration(value)
    if (metric === 'quality') return `${value}/100`
    return `${value}`
  }
}

function getTrendDomain(metric: TrendMetric): [number | string, number | string] {
  if (metric === 'quality') return [0, 100]
  return ['auto', 'auto']
}

function buildKpiCards(
  stats: PuzzleStats | null,
  latestCompletion: PuzzleCompletionRecord | null,
  assistanceSummary: AssistanceSummary,
  completionHistory: PuzzleCompletionRecord[]
): KpiCard[] {
  const profiledHistory = completionHistory.filter((entry) => entry.hasDetailedProfile)
  const averageActionMoves = calculateAverage(profiledHistory.map((entry) => entry.actionMoves))
  const averageCorrections = calculateAverageValue(profiledHistory.map((entry) => getCompletionExtraMoves(entry)))

  return [
    {
      label: 'Spiele',
      value: `${stats?.totalSolved ?? 0}`,
      detail: `${stats?.activeDays ?? 0} aktive Tage`,
    },
    {
      label: 'Erfolgsrate',
      value: (stats?.totalSolved ?? 0) > 0 ? '100%' : '--',
      detail: 'Statistik erfasst abgeschlossene Siege.',
      title: 'Aktuell werden nur geloeste Laeufe in den Stats gespeichert; deshalb ist die Erfolgsrate auf abgeschlossene Spiele bezogen.',
    },
    {
      label: 'Beste Zeit',
      value: formatOptionalDuration(stats?.bestTime ?? null),
      detail: latestCompletion ? `Zuletzt ${formatDifficultyLabel(latestCompletion.config)}` : 'Noch kein Lauf',
    },
    {
      label: 'Durchschn. Aktionen',
      value: averageActionMoves === null ? '--' : `${averageActionMoves}`,
      detail: `${formatPercent(assistanceSummary.profileCoverage)} Datenqualitaet`,
      title: 'Durchschnitt der gespeicherten Gesamtaktionen in Laeufen mit vollem Laufprofil.',
    },
    {
      label: 'Durchschn. Korrekturen (Undos)',
      value: formatAverageCount(averageCorrections),
      detail: 'Aktionen minus Netto-Zuege.',
      title: 'Korrekturen (Undos) sind die Differenz aus Gesamtaktionen und Netto-Zuegen. Das Tracking bleibt intern kompatibel.',
    },
    {
      label: 'Clean-Quote',
      value: formatPercent(assistanceSummary.cleanRate),
      detail: `${assistanceSummary.cleanSolvedCount} clean geloest`,
      title: 'Anteil der abgeschlossenen Laeufe ohne Hinweise oder Auto-Zuege.',
    },
  ]
}

function buildDonutSegments(assistanceSummary: AssistanceSummary): DonutSegment[] {
  return [
    { key: 'clean', label: 'Clean', value: assistanceSummary.cleanSolvedCount, color: ASSISTANCE_COLORS.clean },
    { key: 'hinted', label: 'Mit Hinweisen', value: assistanceSummary.hintedSolvedCount, color: ASSISTANCE_COLORS.hinted },
    { key: 'auto', label: 'Auto/Solver', value: assistanceSummary.autoAssistedSolvedCount, color: ASSISTANCE_COLORS.auto },
    { key: 'legacy', label: 'Legacy', value: assistanceSummary.legacySolvedCount, color: ASSISTANCE_COLORS.legacy },
  ].filter((segment) => segment.value > 0)
}

function renderKpiCards(cards: KpiCard[]) {
  return (
    <div className="stats-visual-kpi-grid">
      {cards.map((card) => (
        <article key={card.label} className="stats-report-card stats-visual-kpi-card" title={card.title}>
          <span className="saved-games-kicker">{card.label}</span>
          <strong className="stats-report-card-value">{card.value}</strong>
          <p className="stats-report-card-copy">{card.detail}</p>
        </article>
      ))}
    </div>
  )
}

function renderScoreBreakdownChart(data: ScoreBreakdownDatum[], label: string) {
  if (data.length === 0) {
    return (
      <div className="stats-empty-state dashboard-empty-state">
        <span className="empty-icon" aria-hidden="true"><Activity /></span>
        <p>Noch keine Laufprofil-Daten vorhanden.</p>
      </div>
    )
  }

  return (
    <div className="stats-score-breakdown-frame" aria-label={label}>
      <div className="stats-score-breakdown-layout">
        <div className="stats-score-breakdown-categories" aria-label="Score-Kategorien">
          {data.map((datum) => (
            <div key={datum.key} className="stats-score-breakdown-category">
              <span>{datum.label}</span>
              <button
                type="button"
                className="stats-score-breakdown-help-badge"
                aria-label={`${datum.label}: ${datum.detail}`}
                data-tooltip={datum.detail}
              >
                ?
              </button>
            </div>
          ))}
        </div>
        <div className="stats-score-breakdown-chart">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 10, right: 54, bottom: 8, left: 0 }}
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis
                type="number"
                domain={[0, 100]}
                ticks={[0, 50, 100]}
                tickFormatter={(value) => `${value}`}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={0}
                tick={false}
                tickLine={false}
                axisLine={false}
              />
              <Bar dataKey="value" radius={[0, 999, 999, 0]} barSize={16}>
                {data.map((datum) => (
                  <Cell key={datum.key} fill={datum.color} />
                ))}
                <LabelList dataKey="displayValue" position="right" className="stats-score-breakdown-label" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <p className="stats-score-breakdown-note">
        100 Startpunkte minus Abzuege. Die Auto-Zug-Strafe ist bei 36 Punkten gedeckelt.
      </p>
    </div>
  )
}

function renderFavoriteDifficultyTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const datum = payload[0]?.payload as FavoriteDifficultyDatum | undefined
  if (!datum) return null

  return (
    <div className="stats-recharts-tooltip">
      <strong>{datum.label}</strong>
      <span>{datum.solveCount} Siege</span>
      <span>{datum.share}% Anteil an allen sichtbaren Siegen</span>
      <div className="stats-recharts-tooltip-list">
        <span>Medianzeit: {formatOptionalDuration(datum.medianTime)}</span>
        <span>Median-Zuege: {formatOptionalMoves(datum.medianMoves)}</span>
      </div>
      {datum.isFavorite ? <small>Aktuelle Lieblingsstufe nach Siegzahl.</small> : null}
    </div>
  )
}

function renderFavoriteDifficultyChart(data: FavoriteDifficultyDatum[]) {
  if (data.length === 0) {
    return (
      <div className="stats-empty-state dashboard-empty-state">
        <span className="empty-icon" aria-hidden="true"><Activity /></span>
        <p>Noch keine geloesten Stufen vorhanden.</p>
      </div>
    )
  }

  return (
    <div className="stats-favorite-difficulty-frame" aria-label="Siege nach Lieblingsstufe">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 10, right: 46, bottom: 8, left: 0 }}
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis type="number" allowDecimals={false} tickFormatter={(value) => `${value}`} />
          <YAxis
            type="category"
            dataKey="label"
            width={82}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={renderFavoriteDifficultyTooltip} cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} />
          <Bar dataKey="solveCount" radius={[0, 999, 999, 0]} barSize={16}>
            {data.map((datum) => (
              <Cell key={datum.key} fill={datum.color} />
            ))}
            <LabelList dataKey="solveCount" position="right" className="stats-favorite-difficulty-label" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="stats-favorite-difficulty-note">
        Balken zeigen Siege je Stufe; der Tooltip zeigt Anteil und Medianwerte.
      </p>
    </div>
  )
}

function renderRechartsTooltip({ active, payload }: ChartTooltipProps, metric: TrendMetric) {
  if (!active || !payload || payload.length === 0) return null

  const visiblePayload = payload.filter((item) => typeof item.value === 'number')
  const chartPoint = visiblePayload[0]?.payload as TrendSeriesChartPoint | undefined
  const point = chartPoint?.source ?? null
  if (!point) return null

  const formatter = getTrendValueFormatter(metric)
  const metricValue = getTrendMetricValue(point, metric)

  return (
    <div className="stats-recharts-tooltip">
      <strong>{point.difficulty}</strong>
      <span>{formatChartTooltipDate(point.date)}</span>
      <span>{point.runType}</span>
      <div className="stats-recharts-tooltip-list">
        <span>
          <i aria-hidden="true" style={{ backgroundColor: visiblePayload[0]?.color ?? 'currentColor' }} />
          {metric === 'time' ? 'Zeit' : metric === 'quality' ? 'Lauf-Score' : 'Netto-Zuege'}: {formatter(metricValue)}
        </span>
        <span>Aktionen: {formatOptionalMoves(point.actions)}</span>
        <span>Korrekturen: {formatExtraMoves(point.corrections)}</span>
      </div>
      <small>
        {point.hints ?? 0} Hinweise, {point.autoMoves ?? 0} Auto-Zuege
      </small>
    </div>
  )
}

function renderDonutTooltip({ active, payload }: ChartTooltipProps, total: number) {
  if (!active || !payload || payload.length === 0) return null

  const segment = payload[0]?.payload as DonutSegment | undefined
  if (!segment) return null
  const percentage = total > 0 ? Math.round((segment.value / total) * 100) : 0

  return (
    <div className="stats-recharts-tooltip">
      <strong>{segment.label}</strong>
      <span>{segment.value} Laeufe</span>
      <span>{percentage}% der erfassten Siege</span>
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
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('actions')
  const [historyRange, setHistoryRange] = useState<HistoryRange>('recent12')
  const [hiddenTrendDifficultyKeys, setHiddenTrendDifficultyKeys] = useState<string[]>([])
  const [rawStatsView, setRawStatsView] = useState<RawStatsView>('difficulties')
  const [isSavingRawExport, setIsSavingRawExport] = useState(false)
  const [rawExportStatus, setRawExportStatus] = useState<string | null>(null)

  const difficultyRows = useMemo(
    () => buildDifficultyReportRows(standardDifficultyStats, completionHistory),
    [completionHistory, standardDifficultyStats]
  )
  const solvedDifficultyRows = useMemo(
    () => difficultyRows.filter((row) => row.solveCount > 0),
    [difficultyRows]
  )
  const rangedHistory = useMemo(
    () => getHistoryRangeEntries(completionHistory, historyRange),
    [completionHistory, historyRange]
  )
  const trendPoints = useMemo(() => buildTrendPoints(rangedHistory), [rangedHistory])
  const trendSeriesChartPoints = useMemo(
    () => buildTrendSeriesChartPoints(trendPoints, trendMetric),
    [trendMetric, trendPoints]
  )
  const trendTickLabels = useMemo(
    () => new Map(trendPoints.map((point) => [point.index, point.label])),
    [trendPoints]
  )
  const trendTicks = useMemo(() => getTrendTicks(trendPoints), [trendPoints])
  const assistanceSummary = useMemo(
    () => getDerivedAssistanceSummary(stats, completionHistory),
    [completionHistory, stats]
  )
  const trendSeriesOptions = useMemo<TrendDifficultySeries[]>(
    () => solvedDifficultyRows.map((row, index) => ({
      key: `${row.option.rows}x${row.option.cols}`,
      label: row.option.label,
      color: DIFFICULTY_TREND_COLORS[index % DIFFICULTY_TREND_COLORS.length],
    })),
    [solvedDifficultyRows]
  )
  const visibleTrendSeries = trendSeriesOptions.filter((series) => !hiddenTrendDifficultyKeys.includes(series.key))
  const focusedTrendSeries = visibleTrendSeries.length === 1 ? visibleTrendSeries[0] : null
  const selectedDifficultyEntries = useMemo(() => {
    if (trendSeriesOptions.length === 0 || visibleTrendSeries.length === trendSeriesOptions.length) {
      return completionHistory
    }

    const visibleDifficultyKeys = new Set(visibleTrendSeries.map((series) => series.key))
    return completionHistory.filter((entry) => visibleDifficultyKeys.has(getCompletionDifficultyKey(entry)))
  }, [completionHistory, trendSeriesOptions, visibleTrendSeries])
  const selectedAssistanceSummary = useMemo(
    () => getDerivedAssistanceSummary(null, selectedDifficultyEntries),
    [selectedDifficultyEntries]
  )
  const kpiCards = useMemo(
    () => buildKpiCards(stats, latestCompletion, assistanceSummary, completionHistory),
    [assistanceSummary, completionHistory, latestCompletion, stats]
  )
  const donutSegments = useMemo(() => buildDonutSegments(selectedAssistanceSummary), [selectedAssistanceSummary])
  const latestScoreBreakdown = useMemo(
    () => latestCompletion ? calculateQualityBreakdown(latestCompletion) : null,
    [latestCompletion]
  )
  const averageScoreBreakdown = useMemo(
    () => getAverageScoreBreakdown(selectedDifficultyEntries),
    [selectedDifficultyEntries]
  )
  const latestScoreBreakdownData = useMemo(
    () => buildScoreBreakdownData(latestScoreBreakdown),
    [latestScoreBreakdown]
  )
  const averageScoreBreakdownData = useMemo(
    () => buildAverageScoreBreakdownData(selectedDifficultyEntries, averageScoreBreakdown),
    [averageScoreBreakdown, selectedDifficultyEntries]
  )
  const favoriteDifficultyKey = favoriteDifficulty ? getCompletionDifficultyKey(favoriteDifficulty) : null
  const favoriteDifficultyChartData = useMemo(
    () => buildFavoriteDifficultyData(solvedDifficultyRows, favoriteDifficultyKey),
    [favoriteDifficultyKey, solvedDifficultyRows]
  )
  const focusedTrendStats = getTrendReferenceStats(trendPoints, trendMetric, focusedTrendSeries?.key ?? null)
  const trendFormatter = getTrendValueFormatter(trendMetric)
  const selectedTrend = TREND_METRICS.find((metric) => metric.id === trendMetric) ?? TREND_METRICS[0]
  const averageQuality = averageScoreBreakdown?.score ?? null

  const handleToggleTrendSeries = (seriesKey: string) => {
    setHiddenTrendDifficultyKeys((current) => {
      if (current.includes(seriesKey)) {
        return current.filter((key) => key !== seriesKey)
      }

      const visibleSeries = trendSeriesOptions.filter((series) => !current.includes(series.key))
      if (visibleSeries.length <= 1) {
        return current
      }

      return [...current, seriesKey]
    })
  }

  const renderDifficultyFilterControls = () => {
    if (trendSeriesOptions.length === 0) return null

    return (
      <div className="stats-visual-series-legend" aria-label="Schwierigkeiten filtern" onKeyDown={handleDirectionalFocusNavigation}>
        <AnimatedChipButton
          className={`dashboard-filter-chip stats-visual-series-chip${visibleTrendSeries.length === trendSeriesOptions.length ? ' is-active' : ''}`}
          onClick={() => setHiddenTrendDifficultyKeys([])}
          disabled={visibleTrendSeries.length === trendSeriesOptions.length}
          aria-pressed={visibleTrendSeries.length === trendSeriesOptions.length}
        >
          Alle
        </AnimatedChipButton>
        {trendSeriesOptions.map((series) => {
          const isVisible = !hiddenTrendDifficultyKeys.includes(series.key)
          const isLastVisible = isVisible && visibleTrendSeries.length <= 1
          return (
            <AnimatedChipButton
              key={series.key}
              className={`dashboard-filter-chip stats-visual-series-chip${isVisible ? ' is-active' : ''}`}
              style={{ '--series-color': series.color } as CSSProperties}
              onClick={() => handleToggleTrendSeries(series.key)}
              disabled={isLastVisible}
              aria-pressed={isVisible}
            >
              <i aria-hidden="true" />
              {series.label}
            </AnimatedChipButton>
          )
        })}
      </div>
    )
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
              {renderKpiCards(kpiCards)}

              <div className="stats-visual-dashboard-grid">
                <article className="stats-report-card stats-visual-donut-card">
                  <div className="stats-visual-card-head">
                    <span className="saved-games-kicker">Laufarten</span>
                    <strong className="stats-report-card-value">{formatPercent(selectedAssistanceSummary.cleanRate)}</strong>
                    <p className="stats-report-card-copy">
                      Clean-Quote nach Laufprofilen und sichtbaren Schwierigkeitsstufen. Legacy-Laeufe bleiben sichtbar, werden aber nicht umgerechnet.
                    </p>
                  </div>
                  {donutSegments.length === 0 ? (
                    <div className="stats-empty-state dashboard-empty-state">
                      <span className="empty-icon" aria-hidden="true"><Activity /></span>
                      <p>Noch keine Laufarten vorhanden.</p>
                    </div>
                  ) : (
                    <div className="stats-recharts-donut-frame">
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={donutSegments}
                            dataKey="value"
                            nameKey="label"
                            innerRadius="58%"
                            outerRadius="82%"
                            paddingAngle={3}
                            stroke="transparent"
                          >
                            {donutSegments.map((segment) => (
                              <Cell key={segment.key} fill={segment.color} />
                            ))}
                          </Pie>
                          <Tooltip content={(props) => renderDonutTooltip(props, selectedAssistanceSummary.totalSolved)} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {renderDifficultyFilterControls()}
                </article>

                <article className="stats-report-card stats-visual-focus-card stats-visual-latest-card">
                  <div className="stats-visual-card-head">
                    <span className="saved-games-kicker">Letzter Lauf</span>
                    <strong className="stats-report-card-value">
                      {latestScoreBreakdown ? `${latestScoreBreakdown.score}/100` : '--'}
                    </strong>
                    <p className="stats-report-card-copy">
                      {latestCompletion
                        ? `${formatDifficultyLabel(latestCompletion.config)}, ${formatOptionalDuration(latestCompletion.time)}, ${latestCompletion.moves} Netto-Zuege, ${formatAssistanceModeLabel(latestCompletion.assistanceMode)}.`
                        : 'Nach dem naechsten Sieg erscheint hier die direkte Einordnung.'}
                    </p>
                  </div>
                  <div className="stats-visual-card-visual">
                    {renderScoreBreakdownChart(latestScoreBreakdownData, 'Score-Aufschluesselung fuer den letzten Lauf')}
                  </div>
                </article>

                <article className="stats-report-card stats-visual-focus-card stats-visual-favorite-card">
                  <div className="stats-visual-card-head">
                    <span className="saved-games-kicker">Lieblingsstufe</span>
                    <strong className="stats-report-card-value">
                      {favoriteDifficulty ? formatDifficultyLabel(favoriteDifficulty.config) : '--'}
                    </strong>
                    <p className="stats-report-card-copy">
                      {favoriteDifficulty ? `${favoriteDifficulty.solveCount} Siege` : 'Noch kein Favorit'}
                    </p>
                  </div>
                  <div className="stats-visual-card-visual">
                    {renderFavoriteDifficultyChart(favoriteDifficultyChartData)}
                  </div>
                </article>

                <article className="stats-report-card stats-visual-focus-card stats-visual-quality-card">
                  <div className="stats-visual-card-head">
                    <span className="saved-games-kicker">Durchschn. Laufanalyse</span>
                    <strong className="stats-report-card-value">
                      {averageQuality === null ? '--' : `${averageQuality}/100`}
                    </strong>
                    <p className="stats-report-card-copy">
                      Durchschnittlicher Score mit sichtbaren Abzuegen. Niedrige Abzuege bedeuten sauberere Laeufe.
                    </p>
                  </div>
                  <div className="stats-visual-card-visual">
                    {renderScoreBreakdownChart(averageScoreBreakdownData, 'Durchschnittliche Score-Aufschluesselung')}
                  </div>
                </article>
              </div>
            </>
          ) : null}

          {activeView === 'history' ? (
            <>
              <div className="stats-visual-toolbar">
                <div className="dashboard-filter-row stats-visual-segmented" aria-label="Trendmetrik waehlen" onKeyDown={handleDirectionalFocusNavigation}>
                  {TREND_METRICS.map((metric) => (
                    <AnimatedChipButton
                      key={metric.id}
                      className={`dashboard-filter-chip${trendMetric === metric.id ? ' is-active' : ''}`}
                      onClick={() => setTrendMetric(metric.id)}
                      title={metric.description}
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
              </div>

              <article className="stats-report-card stats-visual-line-card">
                <div className="stats-visual-line-head">
                  <span>
                    <strong>{selectedTrend.label}</strong>
                    <span> {selectedTrend.description}</span>
                  </span>
                  <span>
                    <strong>{rangedHistory.length}</strong>
                    <span> Laeufe im Ausschnitt</span>
                  </span>
                </div>

                {trendPoints.length === 0 || visibleTrendSeries.length === 0 ? (
                  <div className="stats-empty-state dashboard-empty-state">
                    <span className="empty-icon" aria-hidden="true"><Activity /></span>
                    <p>Keine Werte fuer diese Visualisierung.</p>
                    <p className="empty-hint">Waehle einen anderen Zeitraum oder spiele weitere Runden.</p>
                  </div>
                ) : (
                  <div className="stats-recharts-line-frame">
                    <ResponsiveContainer width="100%" height={340}>
                      <LineChart margin={{ top: 18, right: 22, left: 4, bottom: 12 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="index"
                          type="number"
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                          domain={['dataMin', 'dataMax']}
                          ticks={trendTicks}
                          tickFormatter={(value) => trendTickLabels.get(Number(value)) ?? ''}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          width={64}
                          domain={getTrendDomain(trendMetric)}
                          tickFormatter={(value) => trendFormatter(typeof value === 'number' ? value : null)}
                        />
                        <Tooltip
                          content={(props) => renderRechartsTooltip(props, trendMetric)}
                          shared={false}
                        />
                        <Legend />
                        {focusedTrendStats.best !== null ? (
                          <ReferenceLine
                            y={focusedTrendStats.best}
                            stroke="var(--success-color, #34d399)"
                            strokeDasharray="6 6"
                            label={{
                              value: `Bestwert ${trendFormatter(focusedTrendStats.best)}`,
                              fill: 'var(--text-secondary)',
                              fontSize: 12,
                            }}
                          />
                        ) : null}
                        {focusedTrendStats.median !== null ? (
                          <ReferenceLine
                            y={focusedTrendStats.median}
                            stroke="var(--text-muted)"
                            strokeDasharray="4 8"
                            label={{
                              value: `Median ${trendFormatter(focusedTrendStats.median)}`,
                              fill: 'var(--text-secondary)',
                              fontSize: 12,
                            }}
                          />
                        ) : null}
                        {visibleTrendSeries.map((line) => (
                          <Line
                            key={line.key}
                            type="monotone"
                            data={trendSeriesChartPoints[line.key] ?? []}
                            dataKey="value"
                            name={line.label}
                            stroke={line.color}
                            strokeWidth={3}
                            dot={{ r: 4, strokeWidth: 2 }}
                            activeDot={{ r: 6, strokeWidth: 2 }}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {renderDifficultyFilterControls()}

                <div className="stats-visual-line-legend">
                  <span>{completionHistory.length} Laeufe gesamt</span>
                  <span>{visibleTrendSeries.length} von {trendSeriesOptions.length} Stufen sichtbar</span>
                  <span>{focusedTrendSeries ? `Fokus: ${focusedTrendSeries.label}` : 'Alle sichtbaren Stufen im Vergleich'}</span>
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
                    className="primary stats-raw-export-primary"
                    interaction="chip"
                    onClick={() => {
                      void handleExportActiveRawCsv()
                    }}
                    disabled={isSavingRawExport || (rawStatsView === 'history' ? filteredHistory.length === 0 : completionHistory.length === 0)}
                    title="Speichert die aktuell gewaehlte Rohdatenansicht als CSV im Projektordner statistik-exporte"
                  >
                    <Download size={16} aria-hidden="true" />
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
