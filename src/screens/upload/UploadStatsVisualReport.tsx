import { type CSSProperties, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowUp,
  Download,
  Home,
  Info,
  LayoutDashboard,
  LineChart as LineChartIcon,
  Medal,
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
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import CursorTooltipPortal from '../../components/CursorTooltipPortal.tsx'
import { handleDirectionalFocusNavigation } from '../../app/directionalFocusNavigation.ts'
import AnimatedButton from '../../motion/AnimatedButton.tsx'
import AnimatedChipButton from '../../motion/AnimatedChipButton.tsx'
import AnimatedSwapPane from '../../motion/AnimatedSwapPane.tsx'
import SpringNumber from '../../motion/SpringNumber.tsx'
import { useReducedMotionPreference } from '../../motion/useReducedMotionPreference.ts'
import { savePuzzleStatsExportFile } from '../../services/StatsService.ts'
import {
  ChallengeMedal,
  ImageCollection,
  PuzzleCompletionRecord,
  PuzzleDifficultyStats,
  PuzzleStats,
  SolvedGallery,
  SolvedGalleryEntry,
} from '../../types/index'
import { formatChallengeMedalLabel, getChallengeMedalEmoji, getChallengeMedalRank } from '../../utils/galleryChallenge.ts'
import { formatDifficultyLabel, formatPuzzleSize } from '../../utils/puzzleDifficulty.ts'
import UploadStatsComparisonMatrix from './UploadStatsComparisonMatrix.tsx'
import UploadStatsDifficultyTable from './UploadStatsDifficultyTable.tsx'
import UploadStatsHistorySection from './UploadStatsHistorySection.tsx'
import UploadStatsRunComparison from './UploadStatsRunComparison.tsx'
import UploadCollectionPickerDialog from './UploadCollectionPickerDialog.tsx'
import UploadGalleryDetailDialog from './UploadGalleryDetailDialog.tsx'
import {
  buildGalleryDisplayEntries,
  type GalleryDisplayEntry,
  getSimilarGalleryEntries,
} from './UploadGalleryDisplayUtils.ts'
import UploadPageNavigation from './UploadPageNavigation.tsx'
import type { GalleryReplayRequestHandler } from './galleryReplayRequest.ts'
import {
  buildGroupedMotifCards,
  buildMedalDistribution,
  MEDAL_STATS_COLORS,
  MEDAL_STATS_ORDER,
} from './UploadMedalStatsUtils.ts'
import {
  DifficultyReportRow,
  HistoryFilter,
  HistoryFilterDefinition,
  StandardDifficultyStatsEntry,
  STATS_DIFFICULTY_COLORS,
  buildStatsDifficultyColorMap,
  buildDifficultyReportRows,
  formatAssistanceModeLabel,
  formatDate,
  formatExtraMoves,
  formatOptionalDuration,
  formatOptionalMoves,
  formatPercent,
  formatTime,
  getCompletionExtraMoves,
  getStatsDifficultyKey,
} from './uploadUtils.ts'

export type VisualStatsView = 'overview' | 'history' | 'medals' | 'raw'

type TrendMetric = 'actions' | 'time'

type HistoryRange = 'recent12' | 'recent30' | 'all'

type RawStatsView = 'difficulties' | 'history' | 'matrix'

type MedalFilter = ChallengeMedal | 'all'

type MedalSort = 'recent' | 'best'

const MEDAL_MOTIFS_PER_PAGE = 5

function formatSeriesTimeDelta(delta: number): string {
  if (delta === 0) return 'Gleich'
  return `${formatTime(Math.abs(delta))} ${delta < 0 ? 'schneller' : 'langsamer'}`
}

function formatSeriesMovesDelta(delta: number): string {
  if (delta === 0) return 'Gleich'
  return `${Math.abs(delta)} Zuege ${delta < 0 ? 'weniger' : 'mehr'}`
}

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
  gallery?: SolvedGallery | null
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
  collections?: ImageCollection[]
  isLoadingCollections?: boolean
  onReplayGalleryEntry?: GalleryReplayRequestHandler
  onOpenGalleryTagFilter?: (tagLabel: string) => void
  onFetchRandomImage?: (query?: string) => Promise<void> | void
  onEditGalleryEntryTags?: (entryIds: string[], add?: string[], remove?: string[]) => Promise<void>
  onRetryGalleryTagging?: (entryId: string) => Promise<void>
  onCreateCollection?: (name: string, imageIds: string[], description?: string) => Promise<void>
  onAddCollectionImages?: (collectionId: string, imageIds: string[]) => Promise<void>
}

interface KpiCard {
  id: string
  label: string
  value: string
  detail: string
  helpText: string
  springValue?: number | null
  springFormatter?: (value: number) => string
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
  dayKey: string
  dayRunNumber: number
  dayRunCount: number
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
  challengeMedal: ChallengeMedal | null
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
  movingAverage: number | null
  source: TrendPoint
}

interface TrendDotProps {
  cx?: number | string
  cy?: number | string
  r?: number | string
  stroke?: string
  payload?: TrendSeriesChartPoint
}

interface TrendMedalMarker {
  id: string
  index: number
  value: number
  medal: ChallengeMedal
}

interface TrendReferenceStats {
  best: number | null
  median: number | null
  worst: number | null
}

interface TrendReferenceDisplay {
  shouldMerge: boolean
}

interface SolveTimeHistogramBreakdown {
  key: string
  label: string
  color: string
  count: number
  shareOfBucket: number
  shareOfDifficulty: number
}

interface SolveTimeHistogramDatum {
  id: string
  label: string
  displayIndex: number
  minSeconds: number
  maxSeconds: number
  total: number
  gapMarker: number
  isGap: boolean
  skippedBucketCount: number
  medianTime: number | null
  averageTime: number | null
  medianActions: number | null
  averageActions: number | null
  averageMoves: number | null
  cleanCount: number
  assistedCount: number
  isPeak: boolean
  breakdown: SolveTimeHistogramBreakdown[]
  [key: string]: unknown
}

interface SolveTimeHistogramSummary {
  data: SolveTimeHistogramDatum[]
  total: number
  median: number | null
  peakLabel: string | null
  axisMaximum: number | null
  compressedGapCount: number
  coreStep: number | null
}

interface ChartTooltipPayload {
  name?: string | number
  value?: unknown
  color?: string
  dataKey?: unknown
  payload?: TrendSeriesChartPoint | DonutSegment | ScoreBreakdownDatum | FavoriteDifficultyDatum | SolveTimeHistogramDatum
}

interface ChartTooltipProps {
  active?: boolean
  label?: string | number
  payload?: readonly ChartTooltipPayload[]
}

const VISUAL_STATS_VIEWS: Array<{
  id: VisualStatsView
  label: string
  description: string
  icon: typeof LayoutDashboard
}> = [
  { id: 'overview', label: 'Dashboard', description: 'KPI-Karten, Laufarten und aktuelle Bestwerte anzeigen.', icon: LayoutDashboard },
  { id: 'history', label: 'Verlauf & Trends', description: 'Zeit und Aktionen als Verlauf und Verteilung vergleichen.', icon: LineChartIcon },
  { id: 'medals', label: 'Medaillen-Aufstiege', description: 'Challenge-Medaillen und echte Aufstiege pro Motiv anzeigen.', icon: Medal },
  { id: 'raw', label: 'Rohdaten & Details', description: 'Tabellen, Rohdatenansichten und Exporte oeffnen.', icon: Table2 },
]

const TREND_METRICS: Array<{
  id: TrendMetric
  label: string
  description: string
}> = [
  {
    id: 'actions',
    label: 'Aktionen',
    description: 'Gesamtaktionen ueber die Zeit, getrennt nach Schwierigkeit.',
  },
  {
    id: 'time',
    label: 'Zeit',
    description: 'Laufzeiten ueber die Zeit, getrennt nach Schwierigkeit.',
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

const TREND_MOVING_AVERAGE_WINDOW = 5
const TREND_CHART_HEIGHT = 340
const TREND_REFERENCE_LABEL_COLLISION_DISTANCE = 24
const TREND_MEDAL_MATCH_WINDOW_MS = 60_000
const HISTOGRAM_CORE_BUCKET_STEP = 15
const HISTOGRAM_CORE_SHARE = 0.7
const HISTOGRAM_TAIL_BUCKET_STEPS = [30, 30, 60, 60, 120, 120, 300, 300, 600, 600, 1200, 1200, 1800, 3600]
const ACTION_HISTOGRAM_TARGET_CORE_BUCKETS = 5
const ACTION_HISTOGRAM_TAIL_STEP_FACTORS = [2, 2, 4, 4, 10, 10, 20, 20, 50, 50, 100]
const HISTOGRAM_GAP_POSITION_STEP = 0.5

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

const SCORE_BREAKDOWN_COLORS = {
  score: '#dc2626',
  corrections: '#ea580c',
  hints: '#b45309',
  auto: '#991b1b',
  assistance: '#78350f',
}

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

function getLocalDateKey(isoDate: string): string {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return 'unknown'

  return [
    parsed.getFullYear(),
    String(parsed.getMonth() + 1).padStart(2, '0'),
    String(parsed.getDate()).padStart(2, '0'),
  ].join('-')
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
      'Ghost-Aktivierungen',
      'Ghost-Sekunden',
      'Heatmap-Aktivierungen',
      'Heatmap-Sekunden',
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
      entry.hasDetailedProfile ? (entry.ghostUsageCount ?? 0) : '',
      entry.hasDetailedProfile ? Math.round((entry.ghostUsageDurationMs ?? 0) / 1000) : '',
      entry.hasDetailedProfile ? (entry.heatmapUsageCount ?? 0) : '',
      entry.hasDetailedProfile ? Math.round((entry.heatmapUsageDurationMs ?? 0) / 1000) : '',
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
      color: SCORE_BREAKDOWN_COLORS.score,
    },
    {
      key: 'corrections',
      label: 'Korrekturen',
      value: breakdown.correctionPenalty,
      displayValue: formatPenaltyValue(breakdown.correctionPenalty),
      detail: `${formatAverageCount(breakdown.corrections)} Korrekturen, 4 Punkte Abzug je Korrektur, maximal 48.`,
      color: SCORE_BREAKDOWN_COLORS.corrections,
    },
    {
      key: 'hints',
      label: 'Hinweise',
      value: breakdown.hintPenalty,
      displayValue: formatPenaltyValue(breakdown.hintPenalty),
      detail: `${formatAverageCount(breakdown.hints)} Hinweise, 8 Punkte Abzug je Hinweis, maximal 28.`,
      color: SCORE_BREAKDOWN_COLORS.hints,
    },
    {
      key: 'auto',
      label: 'Auto-Zuege',
      value: breakdown.autoPenalty,
      displayValue: breakdown.autoPenalty >= 36 ? '-36 max.' : formatPenaltyValue(breakdown.autoPenalty),
      detail: `${formatAverageCount(breakdown.autoMoves)} Auto-Zuege, 12 Punkte Abzug je Auto-Zug, maximal 36.`,
      color: SCORE_BREAKDOWN_COLORS.auto,
    },
    {
      key: 'assistance',
      label: 'Hilfe-Modus',
      value: breakdown.assistancePenalty,
      displayValue: formatPenaltyValue(breakdown.assistancePenalty),
      detail: breakdown.assistancePenalty > 0 ? '8 Punkte Abzug, sobald der Lauf nicht clean ist.' : 'Kein Abzug bei cleanem Lauf.',
      color: SCORE_BREAKDOWN_COLORS.assistance,
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
  favoriteDifficultyKey: string | null,
  difficultyColorMap: ReadonlyMap<string, string>
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

  const data: FavoriteDifficultyDatum[] = featuredRows.map((row, index) => {
    const key = getStatsDifficultyKey(row.option)
    const isFavorite = key === favoriteDifficultyKey

    return {
      key,
      label: row.option.label,
      solveCount: row.solveCount,
      share: Math.round((row.solveCount / totalSolves) * 100),
      medianTime: row.medianTime,
      medianMoves: row.medianMoves,
      isFavorite,
      color: difficultyColorMap.get(key) ?? STATS_DIFFICULTY_COLORS[index % STATS_DIFFICULTY_COLORS.length],
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

function getCompletionMedalMatchKey(
  entry: Pick<PuzzleCompletionRecord | SolvedGalleryEntry, 'config' | 'moves' | 'time' | 'actionMoves' | 'assistanceMode' | 'hasDetailedProfile'>
): string {
  return [
    `${entry.config.rows}x${entry.config.cols}`,
    entry.moves,
    entry.time,
    entry.actionMoves,
    entry.assistanceMode,
    entry.hasDetailedProfile ? 'profiled' : 'legacy',
  ].join('|')
}

function buildTrendMedalIndex(
  completionEntries: PuzzleCompletionRecord[],
  galleryEntries: SolvedGalleryEntry[]
): Map<string, ChallengeMedal> {
  const medalEntries = galleryEntries.filter(
    (entry): entry is SolvedGalleryEntry & { challengeMedal: ChallengeMedal } => Boolean(entry.challengeMedal)
  )

  if (completionEntries.length === 0 || medalEntries.length === 0) {
    return new Map()
  }

  const medalsByGalleryId = new Map(medalEntries.map((entry) => [entry.id, entry.challengeMedal]))
  const medalsByCompletionId = new Map<string, ChallengeMedal>()

  completionEntries.forEach((entry) => {
    const directMedal = medalsByGalleryId.get(entry.id)
    if (directMedal) {
      medalsByCompletionId.set(entry.id, directMedal)
      return
    }

    const entryMatchKey = getCompletionMedalMatchKey(entry)
    const entryCompletedAt = Date.parse(entry.completedAt)
    let bestMedal: ChallengeMedal | null = null
    let bestDistanceMs = Number.POSITIVE_INFINITY

    medalEntries.forEach((galleryEntry) => {
      if (getCompletionMedalMatchKey(galleryEntry) !== entryMatchKey) return

      const galleryCompletedAt = Date.parse(galleryEntry.completedAt)
      const distanceMs = Number.isNaN(entryCompletedAt) || Number.isNaN(galleryCompletedAt)
        ? 0
        : Math.abs(entryCompletedAt - galleryCompletedAt)

      if (distanceMs > TREND_MEDAL_MATCH_WINDOW_MS) return

      if (distanceMs < bestDistanceMs) {
        bestMedal = galleryEntry.challengeMedal
        bestDistanceMs = distanceMs
      }
    })

    if (bestMedal) {
      medalsByCompletionId.set(entry.id, bestMedal)
    }
  })

  return medalsByCompletionId
}

function buildTrendPoints(
  entries: PuzzleCompletionRecord[],
  medalsByCompletionId: Map<string, ChallengeMedal> = new Map()
): TrendPoint[] {
  const dayKeys = entries.map((entry) => getLocalDateKey(entry.completedAt))
  const dayTotals = dayKeys.reduce<Map<string, number>>((totals, dayKey) => {
    totals.set(dayKey, (totals.get(dayKey) ?? 0) + 1)
    return totals
  }, new Map())
  const dayCounters = new Map<string, number>()

  return entries.map((entry, index) => {
    const corrections = entry.hasDetailedProfile ? getCompletionExtraMoves(entry) : null
    const dayKey = dayKeys[index] ?? getLocalDateKey(entry.completedAt)
    const dayRunNumber = (dayCounters.get(dayKey) ?? 0) + 1
    dayCounters.set(dayKey, dayRunNumber)

    return {
      id: entry.id,
      index: index + 1,
      difficultyKey: getCompletionDifficultyKey(entry),
      date: entry.completedAt,
      dayKey,
      dayRunNumber,
      dayRunCount: dayTotals.get(dayKey) ?? 1,
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
      challengeMedal: medalsByCompletionId.get(entry.id) ?? null,
    }
  })
}

function getCompletionDifficultyKey(entry: Pick<PuzzleCompletionRecord, 'config'>): string {
  return getStatsDifficultyKey(entry.config)
}

function getTrendMetricValue(point: TrendPoint, metric: TrendMetric): number | null {
  switch (metric) {
    case 'time':
      return point.time
    case 'actions':
    default:
      return point.actions
  }
}

function buildTrendSeriesChartPoints(points: TrendPoint[], metric: TrendMetric): Record<string, TrendSeriesChartPoint[]> {
  const seriesPoints = points.reduce<Record<string, TrendSeriesChartPoint[]>>((result, point) => {
    const metricValue = getTrendMetricValue(point, metric)

    if (metricValue === null) return result

    const existingPoints = result[point.difficultyKey] ?? []
    result[point.difficultyKey] = [
      ...existingPoints,
      {
        id: point.id,
        index: point.index,
        value: metricValue,
        movingAverage: null,
        source: point,
      },
    ]

    return result
  }, {})

  return Object.fromEntries(
    Object.entries(seriesPoints).map(([seriesKey, series]) => [
      seriesKey,
      series.map((point, index) => {
        if (index + 1 < TREND_MOVING_AVERAGE_WINDOW) return point

        const window = series.slice(index + 1 - TREND_MOVING_AVERAGE_WINDOW, index + 1)
        const movingAverage = window.reduce((sum, windowPoint) => sum + windowPoint.value, 0) / window.length

        return { ...point, movingAverage }
      }),
    ])
  )
}

function getHistogramSeriesDataKey(difficultyKey: string): string {
  return `difficulty_${difficultyKey.replace('x', '_')}`
}

function formatHistogramBoundary(seconds: number): string {
  const roundedSeconds = Math.max(0, Math.round(seconds))
  const hours = Math.floor(roundedSeconds / 3600)
  const minutes = Math.floor((roundedSeconds % 3600) / 60)
  const remainingSeconds = roundedSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')} h`
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

function formatHistogramValue(value: number, metric: TrendMetric): string {
  return metric === 'time' ? formatHistogramBoundary(value) : `${Math.round(value)}`
}

function getDenseValueWindow(values: number[]): { firstValue: number; lastValue: number } {
  const sortedValues = [...values].sort((left, right) => left - right)
  const windowSize = Math.max(1, Math.ceil(sortedValues.length * HISTOGRAM_CORE_SHARE))
  let bestStartIndex = 0
  let bestWidth = Number.POSITIVE_INFINITY

  for (let startIndex = 0; startIndex + windowSize - 1 < sortedValues.length; startIndex += 1) {
    const endIndex = startIndex + windowSize - 1
    const width = sortedValues[endIndex] - sortedValues[startIndex]
    if (width < bestWidth) {
      bestWidth = width
      bestStartIndex = startIndex
    }
  }

  const firstValue = sortedValues[bestStartIndex] ?? 0
  return {
    firstValue,
    lastValue: sortedValues[bestStartIndex + windowSize - 1] ?? firstValue,
  }
}

function getNiceActionBucketStep(actions: number[]): number {
  const { firstValue, lastValue } = getDenseValueWindow(actions)
  const rawStep = Math.max(1, (lastValue - firstValue) / ACTION_HISTOGRAM_TARGET_CORE_BUCKETS)
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const normalizedStep = rawStep / magnitude
  const niceNormalizedStep = normalizedStep <= 1 ? 1 : normalizedStep <= 2 ? 2 : normalizedStep <= 5 ? 5 : 10
  return Math.max(1, niceNormalizedStep * magnitude)
}

function getHistogramDenseRange(values: number[], coreStep: number): { minSeconds: number; maxSeconds: number } {
  const { firstValue, lastValue } = getDenseValueWindow(values)
  const minSeconds = Math.floor(firstValue / coreStep) * coreStep
  const maxSeconds = Math.max(
    minSeconds + coreStep,
    (Math.floor(lastValue / coreStep) + 1) * coreStep
  )

  return { minSeconds, maxSeconds }
}

function buildHistogramBucketRanges(
  values: number[],
  coreStep: number,
  tailSteps: number[]
): Array<{ minSeconds: number; maxSeconds: number }> {
  const maximumValue = Math.max(...values)
  const denseRange = getHistogramDenseRange(values, coreStep)
  const coreRanges: Array<{ minSeconds: number; maxSeconds: number }> = []

  for (
    let minSeconds = denseRange.minSeconds;
    minSeconds < denseRange.maxSeconds;
    minSeconds += coreStep
  ) {
    coreRanges.push({
      minSeconds,
      maxSeconds: minSeconds + coreStep,
    })
  }

  const leftRanges: Array<{ minSeconds: number; maxSeconds: number }> = []
  let leftCursor = denseRange.minSeconds
  let leftStepIndex = 0
  while (leftCursor > 0) {
    const step = tailSteps[leftStepIndex] ?? tailSteps[tailSteps.length - 1]
    const minSeconds = Math.max(0, leftCursor - step)
    leftRanges.unshift({ minSeconds, maxSeconds: leftCursor })
    leftCursor = minSeconds
    leftStepIndex += 1
  }

  const rightRanges: Array<{ minSeconds: number; maxSeconds: number }> = []
  let rightCursor = denseRange.maxSeconds
  let rightStepIndex = 0
  while (rightCursor <= maximumValue) {
    const step = tailSteps[rightStepIndex] ?? tailSteps[tailSteps.length - 1]
    rightRanges.push({ minSeconds: rightCursor, maxSeconds: rightCursor + step })
    rightCursor += step
    rightStepIndex += 1
  }

  return [...leftRanges, ...coreRanges, ...rightRanges]
}

function buildSolveTimeHistogram(
  entries: PuzzleCompletionRecord[],
  visibleSeries: TrendDifficultySeries[],
  metric: TrendMetric
): SolveTimeHistogramSummary {
  const visibleSeriesMap = new Map(visibleSeries.map((series) => [series.key, series]))
  const histogramEntries = entries.filter((entry) => (
    visibleSeriesMap.has(getCompletionDifficultyKey(entry))
    && (metric === 'time' || entry.hasDetailedProfile)
    && Number.isFinite(metric === 'time' ? entry.time : entry.actionMoves)
    && (metric === 'time' ? entry.time : entry.actionMoves) >= 0
  ))

  if (histogramEntries.length === 0) {
    return {
      data: [],
      total: 0,
      median: null,
      peakLabel: null,
      axisMaximum: null,
      compressedGapCount: 0,
      coreStep: null,
    }
  }

  const values = histogramEntries.map((entry) => metric === 'time' ? entry.time : entry.actionMoves)
  const coreStep = metric === 'time' ? HISTOGRAM_CORE_BUCKET_STEP : getNiceActionBucketStep(values)
  const tailSteps = metric === 'time'
    ? HISTOGRAM_TAIL_BUCKET_STEPS
    : ACTION_HISTOGRAM_TAIL_STEP_FACTORS.map((factor) => factor * coreStep)
  const bucketRanges = buildHistogramBucketRanges(values, coreStep, tailSteps)
  const buckets: SolveTimeHistogramDatum[] = bucketRanges.map(({ minSeconds, maxSeconds }, index) => ({
        id: `solve-${metric}-${index}`,
        label: `${formatHistogramValue(minSeconds, metric)}-${formatHistogramValue(maxSeconds, metric)}`,
        displayIndex: index,
        minSeconds,
        maxSeconds,
        total: 0,
        gapMarker: 0,
        isGap: false,
        skippedBucketCount: 0,
        medianTime: null,
        averageTime: null,
        medianActions: null,
        averageActions: null,
        averageMoves: null,
        cleanCount: 0,
        assistedCount: 0,
        isPeak: false,
        breakdown: [],
  }))
  const bucketEntries = new Map<string, PuzzleCompletionRecord[]>()
  const difficultyTotals = histogramEntries.reduce<Map<string, number>>((totals, entry) => {
    const difficultyKey = getCompletionDifficultyKey(entry)
    totals.set(difficultyKey, (totals.get(difficultyKey) ?? 0) + 1)
    return totals
  }, new Map())

  histogramEntries.forEach((entry) => {
    const value = metric === 'time' ? entry.time : entry.actionMoves
    const bucketIndex = buckets.findIndex((bucket, index) => (
      value >= bucket.minSeconds
      && (value < bucket.maxSeconds || index === buckets.length - 1)
    ))
    if (bucketIndex < 0) return

    const bucket = buckets[bucketIndex]
    const difficultyKey = getCompletionDifficultyKey(entry)
    const dataKey = getHistogramSeriesDataKey(difficultyKey)

    bucket.total += 1
    bucket[dataKey] = (typeof bucket[dataKey] === 'number' ? bucket[dataKey] : 0) + 1
    bucketEntries.set(bucket.id, [...(bucketEntries.get(bucket.id) ?? []), entry])
  })

  buckets.forEach((bucket) => {
    const entriesInBucket = bucketEntries.get(bucket.id) ?? []
    bucket.medianTime = calculateMedian(entriesInBucket.map((entry) => entry.time))
    bucket.averageTime = calculateAverage(entriesInBucket.map((entry) => entry.time))
    bucket.medianActions = calculateMedian(entriesInBucket.map((entry) => entry.actionMoves))
    bucket.averageActions = calculateAverage(entriesInBucket.map((entry) => entry.actionMoves))
    bucket.averageMoves = calculateAverage(entriesInBucket.map((entry) => entry.moves))
    bucket.cleanCount = entriesInBucket.filter((entry) => (
      entry.hasDetailedProfile && entry.assistanceMode === 'clean'
    )).length
    bucket.assistedCount = entriesInBucket.filter((entry) => (
      entry.hasDetailedProfile && entry.assistanceMode !== 'clean'
    )).length
    bucket.breakdown = visibleSeries
      .map((series) => ({
        key: series.key,
        label: series.label,
        color: series.color,
        count: typeof bucket[getHistogramSeriesDataKey(series.key)] === 'number'
          ? bucket[getHistogramSeriesDataKey(series.key)] as number
          : 0,
        shareOfBucket: 0,
        shareOfDifficulty: 0,
      }))
      .filter((entry) => entry.count > 0)
      .map((entry) => ({
        ...entry,
        shareOfBucket: Math.round((entry.count / bucket.total) * 100),
        shareOfDifficulty: Math.round((entry.count / (difficultyTotals.get(entry.key) ?? entry.count)) * 100),
      }))
  })

  const peakBucket = buckets.reduce((peak, bucket) => bucket.total > peak.total ? bucket : peak, buckets[0])
  if (peakBucket) peakBucket.isPeak = true
  const compressedBuckets = buckets.reduce<SolveTimeHistogramDatum[]>((result, bucket) => {
    if (bucket.total > 0) {
      result.push(bucket)
      return result
    }

    const previousBucket = result[result.length - 1]
    if (previousBucket?.isGap) {
      previousBucket.maxSeconds = bucket.maxSeconds
      previousBucket.skippedBucketCount += 1
      return result
    }

    result.push({
      ...bucket,
      id: `solve-${metric}-gap-${bucket.id}`,
      label: '...',
      gapMarker: Math.max(1, Math.ceil((peakBucket?.total ?? 1) * 0.12)),
      isGap: true,
      skippedBucketCount: 1,
    })
    return result
  }, [])
  let displayIndex = 0
  compressedBuckets.forEach((bucket, index) => {
    if (index > 0) {
      const previousBucket = compressedBuckets[index - 1]
      displayIndex += bucket.isGap || previousBucket.isGap ? HISTOGRAM_GAP_POSITION_STEP : 1
    }
    bucket.displayIndex = displayIndex
  })

  return {
    data: compressedBuckets,
    total: histogramEntries.length,
    median: calculateMedian(values),
    peakLabel: peakBucket?.label ?? null,
    axisMaximum: buckets[buckets.length - 1]?.maxSeconds ?? null,
    compressedGapCount: compressedBuckets.filter((bucket) => bucket.isGap).length,
    coreStep,
  }
}

function getHistogramChartLayout(bucketCount: number): {
  barCategoryGap: string
  maxBarSize: number
} {
  if (bucketCount >= 8) return { barCategoryGap: '3%', maxBarSize: 44 }
  if (bucketCount >= 7) return { barCategoryGap: '6%', maxBarSize: 50 }
  if (bucketCount >= 6) return { barCategoryGap: '9%', maxBarSize: 56 }
  if (bucketCount >= 5) return { barCategoryGap: '12%', maxBarSize: 62 }
  if (bucketCount >= 4) return { barCategoryGap: '15%', maxBarSize: 68 }
  return { barCategoryGap: '18%', maxBarSize: 72 }
}

function getTrendTicks(points: Array<{ index: number }>): number[] {
  const maximumTicks = 8
  if (points.length <= maximumTicks) return points.map((point) => point.index)

  const lastIndex = points.length - 1
  const step = lastIndex / (maximumTicks - 1)
  return Array.from({ length: maximumTicks }, (_, index) => {
    const pointIndex = Math.round(index * step)
    return points[pointIndex]?.index ?? index + 1
  })
}

function getTrendAxisDomain(points: Array<{ index: number }>): [number, number] {
  if (points.length === 0) return [0, 1]

  const firstIndex = points[0]?.index ?? 1
  const lastIndex = points[points.length - 1]?.index ?? firstIndex

  return [
    Math.max(0, firstIndex - 0.5),
    lastIndex + 0.5,
  ]
}

function getTrendAxisLabel(point: TrendPoint | undefined, totalPoints: number): string {
  if (!point) return ''
  if (totalPoints <= 3) return `Lauf ${point.index}`
  if (point.dayRunCount <= 1) return point.label
  return point.dayRunNumber === 1 ? point.label : `#${point.dayRunNumber}`
}

function getTrendAxisSummary(points: TrendPoint[]): string {
  if (points.length === 0) return ''

  const dayCount = new Set(points.map((point) => point.dayKey)).size
  if (points.length === 1) {
    return 'X-Achse: ein einzelner Lauf; Datum und Uhrzeit stehen im Tooltip.'
  }

  if (dayCount === 1) {
    const dateLabel = points[0]?.label ?? 'diesem Tag'
    return `X-Achse: ${points.length} Einzellaeufe am ${dateLabel}, als Lauf 1-${points.length} gezeigt.`
  }

  return `X-Achse: ${points.length} Einzellaeufe ueber ${dayCount} Tage; Wiederholungen am selben Tag erscheinen als #2, #3 ...`
}

function getTrendReferenceStats(
  points: TrendPoint[],
  metric: TrendMetric,
  seriesKey: string | null
): TrendReferenceStats {
  if (!seriesKey) {
    return { best: null, median: null, worst: null }
  }

  const values = points
    .filter((point) => point.difficultyKey === seriesKey)
    .map((point) => getTrendMetricValue(point, metric))
    .filter((value): value is number => value !== null)

  if (values.length === 0) {
    return { best: null, median: null, worst: null }
  }

  return {
    best: Math.min(...values),
    median: calculateMedian(values),
    worst: Math.max(...values),
  }
}

function getTrendReferenceDisplay(
  stats: TrendReferenceStats,
  visibleValues: number[]
): TrendReferenceDisplay {
  if (stats.best === null || stats.median === null) {
    return { shouldMerge: false }
  }

  const domainMinimum = Math.min(...visibleValues, stats.best, stats.median, stats.worst ?? stats.median)
  const domainMaximum = Math.max(...visibleValues, stats.best, stats.median, stats.worst ?? stats.median)
  const domainRange = domainMaximum - domainMinimum
  const renderedDistance = domainRange === 0
    ? 0
    : Math.abs(stats.best - stats.median) / domainRange * TREND_CHART_HEIGHT
  const shouldMerge = renderedDistance <= TREND_REFERENCE_LABEL_COLLISION_DISTANCE

  return { shouldMerge }
}

function formatMergedTrendReferenceLabel(
  stats: TrendReferenceStats,
  formatter: (value: unknown) => string
): string {
  if (stats.best === null || stats.median === null) return ''

  if (stats.best === stats.median) {
    const label = stats.worst === stats.best
      ? 'Bestwert, Median & Hoechstwert'
      : 'Bestwert & Median'

    return `${label} ${formatter(stats.best)}`
  }

  return `Bestwert ${formatter(stats.best)} / Median ${formatter(stats.median)}`
}

function formatMedianTrendReferenceLabel(
  stats: TrendReferenceStats,
  formatter: (value: unknown) => string
): string {
  if (stats.median === null) return ''

  const label = stats.worst === stats.median ? 'Median & Hoechstwert' : 'Median'
  return `${label} ${formatter(stats.median)}`
}

function shouldRenderSeparateWorstTrendReference(stats: TrendReferenceStats): boolean {
  return stats.worst !== null && stats.worst !== stats.best && stats.worst !== stats.median
}

function getTrendValueFormatter(metric: TrendMetric): (value: unknown) => string {
  return (value) => {
    if (typeof value !== 'number') return '--'
    if (metric === 'time') return formatOptionalDuration(value)
    return `${value}`
  }
}

function formatTrendMovingAverage(value: number | null, metric: TrendMetric): string {
  if (value === null) return '--'
  if (metric === 'time') return formatOptionalDuration(Math.round(value))

  const roundedValue = Math.round(value * 10) / 10
  return `${roundedValue}`
}

function formatTrendDelta(fromValue: number | null, toValue: number | null, metric: TrendMetric): string | null {
  if (fromValue === null || toValue === null) return null

  const delta = toValue - fromValue
  if (metric === 'time') return formatSeriesTimeDelta(delta)
  if (delta === 0) return 'Gleich'

  return `${Math.abs(delta)} Aktionen ${delta < 0 ? 'weniger' : 'mehr'}`
}

function getTrendDomain(values: number[], referenceStats: TrendReferenceStats): [number | string, number | string] {
  const referenceValues = [referenceStats.best, referenceStats.median, referenceStats.worst]
    .filter((value): value is number => value !== null)
  const domainValues = [...values, ...referenceValues]

  if (domainValues.length === 0) return ['auto', 'auto']

  const minimum = Math.min(...domainValues)
  const maximum = Math.max(...domainValues)

  if (minimum === maximum) {
    const padding = Math.max(1, Math.ceil(maximum * 0.12))
    return [Math.max(0, minimum - padding), maximum + padding]
  }

  const padding = Math.max(1, Math.ceil((maximum - minimum) * 0.12))

  return [
    Math.max(0, Math.floor(minimum - padding)),
    Math.ceil(maximum + padding),
  ]
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
  const ghostRuns = profiledHistory.filter((entry) => (entry.ghostUsageCount ?? 0) > 0)
  const totalGhostSeconds = Math.round(
    profiledHistory.reduce((sum, entry) => sum + (entry.ghostUsageDurationMs ?? 0), 0) / 1000
  )
  const heatmapRuns = profiledHistory.filter((entry) => (entry.heatmapUsageCount ?? 0) > 0)
  const totalHeatmapSeconds = Math.round(
    profiledHistory.reduce((sum, entry) => sum + (entry.heatmapUsageDurationMs ?? 0), 0) / 1000
  )

  return [
    {
      id: 'games',
      label: 'Spiele',
      value: `${stats?.totalSolved ?? 0}`,
      detail: `${stats?.activeDays ?? 0} aktive Tage`,
      helpText: 'Anzahl aller abgeschlossenen und gespeicherten Puzzle-Siege. Aktive Tage zaehlen Kalendertage mit mindestens einem Sieg.',
      springValue: stats?.totalSolved ?? 0,
    },
    {
      id: 'success-rate',
      label: 'Erfolgsrate',
      value: (stats?.totalSolved ?? 0) > 0 ? '100%' : '--',
      detail: 'Statistik erfasst abgeschlossene Siege.',
      helpText: 'Aktuell werden nur geloeste Laeufe in den Stats gespeichert. Abgebrochene oder nicht gespeicherte Versuche zaehlen deshalb nicht in diese Quote.',
      springValue: (stats?.totalSolved ?? 0) > 0 ? 100 : null,
      springFormatter: (value) => `${Math.round(value)}%`,
    },
    {
      id: 'best-time',
      label: 'Beste Zeit',
      value: formatOptionalDuration(stats?.bestTime ?? null),
      detail: latestCompletion ? `Zuletzt ${formatDifficultyLabel(latestCompletion.config)}` : 'Noch kein Lauf',
      helpText: 'Schnellste gespeicherte Loesungszeit ueber alle Puzzle-Stufen hinweg. Der Zusatz zeigt die Stufe des letzten Siegs.',
      springValue: stats?.bestTime ?? null,
      springFormatter: (value) => formatOptionalDuration(Math.round(value)),
    },
    {
      id: 'average-actions',
      label: 'Durchschn. Aktionen',
      value: averageActionMoves === null ? '--' : `${averageActionMoves}`,
      detail: `${formatPercent(assistanceSummary.profileCoverage)} Datenqualitaet`,
      helpText: 'Durchschnitt der gespeicherten Gesamtaktionen in Laeufen mit vollem Laufprofil. Aktionen enthalten auch Korrekturen und wiederholte Schritte.',
      springValue: averageActionMoves,
    },
    {
      id: 'average-corrections',
      label: 'Durchschn. Korrekturen (Undos)',
      value: formatAverageCount(averageCorrections),
      detail: 'Aktionen minus Netto-Zuege.',
      helpText: 'Durchschnittliche Differenz aus Gesamtaktionen und Netto-Zuegen. Sie zeigt, wie viele zusaetzliche Korrekturschritte ein Lauf typischerweise enthaelt.',
      springValue: averageCorrections,
      springFormatter: formatAverageCount,
    },
    {
      id: 'clean-rate',
      label: 'Clean-Quote',
      value: formatPercent(assistanceSummary.cleanRate),
      detail: `${assistanceSummary.cleanSolvedCount} clean geloest`,
      helpText: 'Anteil der abgeschlossenen Laeufe ohne Hilfen (Hinweise, Ghost, Heatmap, Auto-Zuege oder Solver-Unterstuetzung). Aeltere Laeufe ohne Detailprofil koennen als Legacy erscheinen.',
      springValue: assistanceSummary.cleanRate,
      springFormatter: (value) => formatPercent(Math.round(value)),
    },
    {
      id: 'ghost-usage',
      label: 'Ghost-Nutzung',
      value: `${ghostRuns.length}`,
      detail: `${totalGhostSeconds}s Geisterbild`,
      helpText: 'Laeufe mit aktivierter Geisteransicht und aufsummierte sichtbare Dauer. Dies wird separat von Hinweisen und Auto-Zuegen erfasst.',
      springValue: ghostRuns.length,
    },
    {
      id: 'heatmap-usage',
      label: 'Heatmap-Nutzung',
      value: `${heatmapRuns.length}`,
      detail: `${totalHeatmapSeconds}s Heatmap`,
      helpText: 'Laeufe mit aktivierter Heatmap und aufsummierte sichtbare Dauer. Dies wird separat von Hinweisen und Auto-Zuegen erfasst.',
      springValue: heatmapRuns.length,
    },
  ]
}

function buildDonutSegments(assistanceSummary: AssistanceSummary): DonutSegment[] {
  return [
    { key: 'clean', label: 'Clean', value: assistanceSummary.cleanSolvedCount, color: ASSISTANCE_COLORS.clean },
    { key: 'hinted', label: 'Mit Hilfen', value: assistanceSummary.hintedSolvedCount, color: ASSISTANCE_COLORS.hinted },
    { key: 'auto', label: 'Auto/Solver', value: assistanceSummary.autoAssistedSolvedCount, color: ASSISTANCE_COLORS.auto },
    { key: 'legacy', label: 'Legacy', value: assistanceSummary.legacySolvedCount, color: ASSISTANCE_COLORS.legacy },
  ].filter((segment) => segment.value > 0)
}

function renderKpiCards(cards: KpiCard[]) {
  return (
    <div className="stats-visual-kpi-grid">
      {cards.map((card) => (
        <article
          key={card.id}
          className="stats-report-card stats-visual-kpi-card"
          tabIndex={0}
          data-app-tooltip={card.helpText}
        >
          <span className="stats-kpi-label-row">
            <span className="saved-games-kicker">{card.label}</span>
            <Info className="stats-kpi-help-icon" aria-hidden="true" />
          </span>
          <strong className="stats-report-card-value">
            <SpringNumber
              value={card.springValue}
              from={0}
              durationMs={1700}
              fallback={card.value}
              formatter={card.springFormatter}
            />
          </strong>
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
          {data.map((datum) => {
            return (
              <div key={datum.key} className="stats-score-breakdown-category">
                <span>{datum.label}</span>
                <button
                  type="button"
                  className="stats-score-breakdown-help-badge"
                  aria-label={`${datum.label}: ${datum.detail}`}
                  data-app-tooltip={`${datum.label}: ${datum.detail} Wert: ${datum.displayValue}.`}
                >
                  ?
                </button>
              </div>
            )
          })}
        </div>
        <div className="stats-score-breakdown-chart">
          <ResponsiveContainer width="100%" height={150}>
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
    <CursorTooltipPortal active>
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
    </CursorTooltipPortal>
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
      <ResponsiveContainer width="100%" height={150}>
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

function renderTrendDot({ cx, cy, r, stroke, payload }: TrendDotProps) {
  if (typeof cx !== 'number' || typeof cy !== 'number') return null

  const medal = payload?.source.challengeMedal ?? null
  const parsedRadius = typeof r === 'number' ? r : typeof r === 'string' ? Number.parseFloat(r) : null
  const pointRadius = parsedRadius && Number.isFinite(parsedRadius) ? parsedRadius : 4
  const dotColor = stroke ?? 'currentColor'

  return (
    <g className={`stats-trend-dot${medal ? ` has-medal is-${medal}` : ''}`}>
      <circle
        cx={cx}
        cy={cy}
        r={pointRadius}
        fill={dotColor}
        stroke={dotColor}
        strokeWidth={medal ? 2 : 1}
      />
    </g>
  )
}

function renderRechartsTooltip({ active, payload }: ChartTooltipProps, metric: TrendMetric) {
  if (!active || !payload || payload.length === 0) return null

  const visiblePayload = payload.filter((item) => typeof item.value === 'number')
  const chartPoint = visiblePayload[0]?.payload as TrendSeriesChartPoint | undefined
  const point = chartPoint?.source ?? null
  if (!point) return null

  const movingAverage = chartPoint?.movingAverage ?? null
  const activeColor = visiblePayload[0]?.color ?? 'currentColor'
  const primaryMetricRow = metric === 'time'
    ? { label: 'Zeit', value: formatOptionalDuration(point.time) }
    : { label: 'Aktionen', value: formatOptionalMoves(point.actions) }
  const secondaryMetricRow = metric === 'time'
    ? { label: 'Aktionen', value: formatOptionalMoves(point.actions) }
    : { label: 'Zeit', value: formatOptionalDuration(point.time) }

  return (
    <CursorTooltipPortal active>
      <div className="stats-recharts-tooltip">
        <strong>{point.difficulty}</strong>
        <span>{formatChartTooltipDate(point.date)}</span>
        <span>{point.runType}</span>
        {point.challengeMedal ? (
          <span className="stats-recharts-tooltip-medal">
            <i aria-hidden="true">{getChallengeMedalEmoji(point.challengeMedal)}</i>
            {formatChallengeMedalLabel(point.challengeMedal)}-Lauf
          </span>
        ) : null}
        <div className="stats-recharts-tooltip-list">
          <span>
            <i aria-hidden="true" style={{ backgroundColor: activeColor }} />
            {primaryMetricRow.label}: {primaryMetricRow.value}
          </span>
          <span>{secondaryMetricRow.label}: {secondaryMetricRow.value}</span>
          {movingAverage !== null ? (
            <span>5er-Trend: {formatTrendMovingAverage(movingAverage, metric)}</span>
          ) : null}
          <span>Netto-Zuege: {formatOptionalMoves(point.moves)}</span>
          <span>Korrekturen: {formatExtraMoves(point.corrections)}</span>
        </div>
        <small>
          {point.hints ?? 0} Hinweise, {point.autoMoves ?? 0} Auto-Zuege
        </small>
      </div>
    </CursorTooltipPortal>
  )
}

function renderSolveTimeHistogramTooltip(
  { active, payload }: ChartTooltipProps,
  total: number,
  overallMedian: number | null,
  metric: TrendMetric
) {
  if (!active || !payload || payload.length === 0) return null

  const bucket = payload[0]?.payload as SolveTimeHistogramDatum | undefined
  if (!bucket) return null

  if (bucket.isGap) {
    return (
      <CursorTooltipPortal active>
        <div className="stats-recharts-tooltip stats-histogram-tooltip stats-histogram-gap-tooltip">
          <strong>Leerer {metric === 'time' ? 'Zeitbereich' : 'Aktionsbereich'}</strong>
          <span>{formatHistogramValue(bucket.minSeconds, metric)}-{formatHistogramValue(bucket.maxSeconds, metric)}</span>
          <small>
            {bucket.skippedBucketCount} {bucket.skippedBucketCount === 1 ? 'leeres Intervall wurde' : 'leere Intervalle wurden'} kompakt zusammengefasst.
          </small>
        </div>
      </CursorTooltipPortal>
    )
  }

  if (bucket.total <= 0) return null

  const percentage = total > 0 ? Math.round((bucket.total / total) * 100) : 0
  const legacyCount = bucket.total - bucket.cleanCount - bucket.assistedCount
  const medianRelation = overallMedian === null
    ? null
    : bucket.maxSeconds <= overallMedian
      ? 'Dieser Bereich liegt unter dem Gesamtmedian.'
      : bucket.minSeconds >= overallMedian
        ? 'Dieser Bereich liegt ueber dem Gesamtmedian.'
        : 'Der Gesamtmedian liegt in diesem Bereich.'

  return (
    <CursorTooltipPortal active>
        <div className="stats-recharts-tooltip stats-histogram-tooltip">
          <strong>{bucket.label}</strong>
          <span>{bucket.total} {bucket.total === 1 ? 'Lauf' : 'Laeufe'} · {percentage}% aller sichtbaren Laeufe</span>
          <span>
            Intervallbreite: {metric === 'time'
              ? formatOptionalDuration(bucket.maxSeconds - bucket.minSeconds)
              : `${bucket.maxSeconds - bucket.minSeconds} Aktionen`}
          </span>
          {bucket.isPeak ? <small className="stats-histogram-tooltip-highlight">Haeufigster Bereich</small> : null}
        <div className="stats-recharts-tooltip-list stats-histogram-tooltip-summary">
          <span>
            Median im Bereich: {metric === 'time'
              ? formatOptionalDuration(bucket.medianTime)
              : formatOptionalMoves(bucket.medianActions)}
          </span>
          <span>
            Durchschnitt: {metric === 'time'
              ? formatOptionalDuration(bucket.averageTime)
              : formatOptionalMoves(bucket.averageActions)}
          </span>
          {metric === 'actions' ? <span>Durchschn. Zeit: {formatOptionalDuration(bucket.averageTime)}</span> : null}
          <span>Durchschn. Netto-Zuege: {formatOptionalMoves(bucket.averageMoves)}</span>
          <span>
            Laufarten: {bucket.cleanCount} clean · {bucket.assistedCount} unterstuetzt
            {legacyCount > 0 ? ` · ${legacyCount} Legacy` : ''}
          </span>
        </div>
        <div className="stats-recharts-tooltip-list">
          {bucket.breakdown.map((entry) => (
            <span key={entry.key}>
              <i aria-hidden="true" style={{ backgroundColor: entry.color }} />
              {entry.label}: {entry.count} · {entry.shareOfBucket}% des Balkens · {entry.shareOfDifficulty}% der Stufe
            </span>
          ))}
        </div>
        {medianRelation ? <small>{medianRelation}</small> : null}
      </div>
    </CursorTooltipPortal>
  )
}

function renderDonutTooltip({ active, payload }: ChartTooltipProps, total: number) {
  if (!active || !payload || payload.length === 0) return null

  const segment = payload[0]?.payload as DonutSegment | undefined
  if (!segment) return null
  const percentage = total > 0 ? Math.round((segment.value / total) * 100) : 0

  return (
    <CursorTooltipPortal active>
      <div className="stats-recharts-tooltip">
        <strong>{segment.label}</strong>
        <span>{segment.value} Laeufe</span>
        <span>{percentage}% der erfassten Siege</span>
      </div>
    </CursorTooltipPortal>
  )
}

function renderMedalDonutTooltip({ active, payload }: ChartTooltipProps, total: number) {
  if (!active || !payload || payload.length === 0) return null

  const segment = payload[0]?.payload as DonutSegment | undefined
  if (!segment) return null
  const percentage = total > 0 ? Math.round((segment.value / total) * 100) : 0

  return (
    <CursorTooltipPortal active>
      <div className="stats-recharts-tooltip">
        <strong>{segment.label}</strong>
        <span>{segment.value} {segment.value === 1 ? 'Motiv' : 'Motive'}</span>
        <span>{percentage}% der Motive mit Challenge-Medaille</span>
        <small>Pro Motiv zaehlt ausschliesslich die beste erreichte Medaille.</small>
      </div>
    </CursorTooltipPortal>
  )
}

export default function UploadStatsVisualReport({
  stats,
  gallery = null,
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
  collections = [],
  isLoadingCollections = false,
  onReplayGalleryEntry = () => undefined,
  onOpenGalleryTagFilter = () => undefined,
  onFetchRandomImage = async () => undefined,
  onEditGalleryEntryTags = async () => undefined,
  onRetryGalleryTagging = async () => undefined,
  onCreateCollection = async () => undefined,
  onAddCollectionImages = async () => undefined,
}: UploadStatsVisualReportProps) {
  const shouldReduceMotion = useReducedMotionPreference()
  const reportRef = useRef<HTMLElement>(null)
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('actions')
  const [trendRange, setTrendRange] = useState<HistoryRange>('all')
  const [histogramMetric, setHistogramMetric] = useState<TrendMetric>('time')
  const [histogramRange, setHistogramRange] = useState<HistoryRange>('all')
  const [showMovingAverage, setShowMovingAverage] = useState(false)
  const [medalFilter, setMedalFilter] = useState<MedalFilter>('all')
  const [medalSort, setMedalSort] = useState<MedalSort>('recent')
  const [medalPage, setMedalPage] = useState(1)
  const [selectedMedalSeries, setSelectedMedalSeries] = useState<Record<string, string>>({})
  const [selectedMedalDetail, setSelectedMedalDetail] = useState<GalleryDisplayEntry | null>(null)
  const [collectingMedalEntry, setCollectingMedalEntry] = useState<GalleryDisplayEntry | null>(null)
  const [isSavingMedalCollection, setIsSavingMedalCollection] = useState(false)
  const [retryingMedalTagEntryId, setRetryingMedalTagEntryId] = useState<string | null>(null)
  const [isEditingMedalTags, setIsEditingMedalTags] = useState(false)
  const medalCardsRef = useRef<HTMLDivElement>(null)
  const [focusedTrendDifficultyKey, setFocusedTrendDifficultyKey] = useState<string | null>(null)
  const [overviewDifficultyKey, setOverviewDifficultyKey] = useState<string | null>(null)
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
  const rangedTrendHistory = useMemo(
    () => getHistoryRangeEntries(completionHistory, trendRange),
    [completionHistory, trendRange]
  )
  const rangedHistogramHistory = useMemo(
    () => getHistoryRangeEntries(completionHistory, histogramRange),
    [completionHistory, histogramRange]
  )
  const trendMedalsByCompletionId = useMemo(
    () => buildTrendMedalIndex(completionHistory, gallery?.entries ?? []),
    [completionHistory, gallery]
  )
  const trendPoints = useMemo(
    () => buildTrendPoints(rangedTrendHistory, trendMedalsByCompletionId),
    [rangedTrendHistory, trendMedalsByCompletionId]
  )
  const assistanceSummary = useMemo(
    () => getDerivedAssistanceSummary(stats, completionHistory),
    [completionHistory, stats]
  )
  const trendSeriesOptions = useMemo<TrendDifficultySeries[]>(
    () => {
      const difficultyColorMap = buildStatsDifficultyColorMap(solvedDifficultyRows)

      return solvedDifficultyRows.map((row, index) => {
        const key = getStatsDifficultyKey(row.option)

        return {
          key,
          label: row.option.label,
          color: difficultyColorMap.get(key) ?? STATS_DIFFICULTY_COLORS[index % STATS_DIFFICULTY_COLORS.length],
        }
      })
    },
    [solvedDifficultyRows]
  )
  const trendSeriesColorMap = useMemo(
    () => new Map(trendSeriesOptions.map((series) => [series.key, series.color])),
    [trendSeriesOptions]
  )
  const effectiveOverviewDifficultyKey = trendSeriesOptions.some((series) => series.key === overviewDifficultyKey)
    ? overviewDifficultyKey
    : null
  const visibleTrendSeries = trendSeriesOptions
  const effectiveFocusedTrendKey = visibleTrendSeries.some((series) => series.key === focusedTrendDifficultyKey)
    ? focusedTrendDifficultyKey
    : null
  const focusedTrendSeries = visibleTrendSeries.find((series) => series.key === effectiveFocusedTrendKey) ?? null
  const trendChartPoints = useMemo(
    () => {
      if (effectiveFocusedTrendKey === null) return trendPoints

      return buildTrendPoints(
        rangedTrendHistory.filter((entry) => getCompletionDifficultyKey(entry) === effectiveFocusedTrendKey),
        trendMedalsByCompletionId
      )
    },
    [effectiveFocusedTrendKey, rangedTrendHistory, trendMedalsByCompletionId, trendPoints]
  )
  const trendChartSeries = focusedTrendSeries ? [focusedTrendSeries] : visibleTrendSeries
  const trendSeriesChartPoints = useMemo(
    () => buildTrendSeriesChartPoints(trendChartPoints, trendMetric),
    [trendChartPoints, trendMetric]
  )
  const trendTickLabels = useMemo(
    () => new Map(trendChartPoints.map((point) => [point.index, getTrendAxisLabel(point, trendChartPoints.length)])),
    [trendChartPoints]
  )
  const trendTicks = useMemo(() => getTrendTicks(trendChartPoints), [trendChartPoints])
  const trendXAxisDomain = useMemo(() => getTrendAxisDomain(trendChartPoints), [trendChartPoints])
  const trendAxisSummary = useMemo(() => getTrendAxisSummary(trendChartPoints), [trendChartPoints])
  const movingAverageCandidateSeries = trendChartSeries
  const canShowMovingAverage = movingAverageCandidateSeries.some((series) =>
    (trendSeriesChartPoints[series.key] ?? []).some((point) => point.movingAverage !== null)
  )
  const isMovingAverageVisible = showMovingAverage && canShowMovingAverage
  const selectedDifficultyEntries = useMemo(() => {
    if (effectiveOverviewDifficultyKey === null) {
      return completionHistory
    }

    return completionHistory.filter((entry) => getCompletionDifficultyKey(entry) === effectiveOverviewDifficultyKey)
  }, [completionHistory, effectiveOverviewDifficultyKey])
  const selectedOverviewDifficulty = trendSeriesOptions.find((series) => series.key === effectiveOverviewDifficultyKey) ?? null
  const selectedAssistanceSummary = useMemo(
    () => getDerivedAssistanceSummary(null, selectedDifficultyEntries),
    [selectedDifficultyEntries]
  )
  const kpiCards = useMemo(
    () => buildKpiCards(stats, latestCompletion, assistanceSummary, completionHistory),
    [assistanceSummary, completionHistory, latestCompletion, stats]
  )
  const donutSegments = useMemo(() => buildDonutSegments(selectedAssistanceSummary), [selectedAssistanceSummary])
  const medalDistribution = useMemo(
    () => buildMedalDistribution(gallery?.entries ?? []),
    [gallery]
  )
  const visibleMedalDistribution = useMemo(
    () => medalDistribution.filter((segment) => segment.value > 0),
    [medalDistribution]
  )
  const groupedMotifCards = useMemo(() => buildGroupedMotifCards(gallery?.entries ?? []), [gallery])
  const filteredMotifCards = useMemo(() => {
    const cards = medalFilter === 'all'
      ? groupedMotifCards
      : groupedMotifCards.filter((card) => card.bestMedal === medalFilter)

    return [...cards].sort((left, right) => {
      const dateDelta = Date.parse(right.latestAscentDate) - Date.parse(left.latestAscentDate)
      if (medalSort === 'best') {
        return getChallengeMedalRank(right.bestMedal) - getChallengeMedalRank(left.bestMedal) || dateDelta
      }
      return dateDelta
    })
  }, [groupedMotifCards, medalFilter, medalSort])
  const medalPageCount = Math.max(1, Math.ceil(filteredMotifCards.length / MEDAL_MOTIFS_PER_PAGE))
  const activeMedalPage = Math.min(medalPage, medalPageCount)
  const pagedMotifCards = useMemo(() => {
    const startIndex = (activeMedalPage - 1) * MEDAL_MOTIFS_PER_PAGE
    return filteredMotifCards.slice(startIndex, startIndex + MEDAL_MOTIFS_PER_PAGE)
  }, [activeMedalPage, filteredMotifCards])
  const galleryDisplayEntries = useMemo(
    () => buildGalleryDisplayEntries(gallery?.entries ?? [], { difficultyFilter: 'all', assistanceFilter: 'all' }),
    [gallery]
  )
  const allGalleryTagLabels = useMemo(
    () => Array.from(new Set((gallery?.entries ?? []).flatMap((entry) => (entry.tags ?? []).map((tag) => tag.label))))
      .sort((left, right) => left.localeCompare(right, 'de')),
    [gallery]
  )
  const similarMedalEntries = useMemo(
    () => selectedMedalDetail ? getSimilarGalleryEntries(selectedMedalDetail, galleryDisplayEntries) : [],
    [galleryDisplayEntries, selectedMedalDetail]
  )
  const totalMedalMotifs = medalDistribution.reduce((sum, segment) => sum + segment.value, 0)
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
    () => buildFavoriteDifficultyData(solvedDifficultyRows, favoriteDifficultyKey, trendSeriesColorMap),
    [favoriteDifficultyKey, solvedDifficultyRows, trendSeriesColorMap]
  )
  const focusedTrendStats = getTrendReferenceStats(trendChartPoints, trendMetric, focusedTrendSeries?.key ?? null)
  const visibleTrendValues = trendChartSeries.flatMap((series) =>
    (trendSeriesChartPoints[series.key] ?? []).map((point) => point.value)
  )
  const trendYAxisDomain = getTrendDomain(visibleTrendValues, focusedTrendStats)
  const hasTrendChartData = trendChartSeries.some((series) => (trendSeriesChartPoints[series.key] ?? []).length > 0)
  const medalTrendMarkers = trendChartSeries.flatMap<TrendMedalMarker>((series) =>
    (trendSeriesChartPoints[series.key] ?? [])
      .filter((point) => point.source.challengeMedal !== null)
      .map((point) => ({
        id: point.id,
        index: point.index,
        value: point.value,
        medal: point.source.challengeMedal as ChallengeMedal,
      }))
  )
  const focusedTrendReferenceDisplay = getTrendReferenceDisplay(focusedTrendStats, visibleTrendValues)
  const trendFormatter = getTrendValueFormatter(trendMetric)
  const selectedTrend = TREND_METRICS.find((metric) => metric.id === trendMetric) ?? TREND_METRICS[0]
  const compactTrendDelta = trendChartPoints.length >= 2 && trendChartPoints.length <= 3
    ? formatTrendDelta(
      getTrendMetricValue(trendChartPoints[0], trendMetric),
      getTrendMetricValue(trendChartPoints[trendChartPoints.length - 1], trendMetric),
      trendMetric
    )
    : null
  const averageQuality = averageScoreBreakdown?.score ?? null
  const solveTimeHistogram = useMemo(
    () => buildSolveTimeHistogram(rangedHistogramHistory, visibleTrendSeries, histogramMetric),
    [histogramMetric, rangedHistogramHistory, visibleTrendSeries]
  )
  const solveTimeHistogramLayout = getHistogramChartLayout(solveTimeHistogram.data.length)
  const solveTimeHistogramTickLabels = useMemo(
    () => new Map(solveTimeHistogram.data.map((bucket) => [bucket.displayIndex, bucket.label])),
    [solveTimeHistogram.data]
  )
  const solveTimeHistogramTicks = solveTimeHistogram.data.map((bucket) => bucket.displayIndex)
  const solveTimeHistogramLastIndex = solveTimeHistogramTicks[solveTimeHistogramTicks.length - 1] ?? 0

  const renderDifficultyFilterControls = () => {
    if (trendSeriesOptions.length === 0) return null

    return (
      <div className="stats-visual-series-legend" aria-label="Schwierigkeiten filtern" onKeyDown={handleDirectionalFocusNavigation}>
        <AnimatedChipButton
          className={`dashboard-filter-chip stats-visual-series-chip${effectiveOverviewDifficultyKey === null ? ' is-active' : ''}`}
          onClick={() => setOverviewDifficultyKey(null)}
          disabled={effectiveOverviewDifficultyKey === null}
          aria-pressed={effectiveOverviewDifficultyKey === null}
          data-app-tooltip="Alle Schwierigkeitsstufen anzeigen."
          data-app-tooltip-position="top"
        >
          Alle
        </AnimatedChipButton>
        {trendSeriesOptions.map((series) => {
          const isSelected = effectiveOverviewDifficultyKey === series.key
          return (
            <AnimatedChipButton
              key={series.key}
              className={`dashboard-filter-chip stats-visual-series-chip${isSelected ? ' is-active' : ''}`}
              style={{ '--series-color': series.color } as CSSProperties}
              onClick={() => setOverviewDifficultyKey(series.key)}
              disabled={isSelected}
              aria-pressed={isSelected}
              data-app-tooltip={`Nur ${series.label} anzeigen.`}
              data-app-tooltip-position="top"
            >
              <i aria-hidden="true" />
              {series.label}
            </AnimatedChipButton>
          )
        })}
      </div>
    )
  }

  const renderDifficultyColorLegend = (label: string, seriesList = trendSeriesOptions) => {
    if (trendSeriesOptions.length === 0) return null

    return (
      <div className="stats-chart-color-legend" aria-label={label}>
        <span className="stats-chart-color-legend-label">Schwierigkeiten</span>
        {seriesList.map((series) => {
          return (
            <span
              key={series.key}
              className="stats-chart-color-legend-item"
              style={{ '--series-color': series.color } as CSSProperties}
            >
              <i aria-hidden="true" />
              {series.label}
            </span>
          )
        })}
      </div>
    )
  }

  const renderTrendFocusControls = () => {
    if (visibleTrendSeries.length === 0) return null

    return (
      <div className="stats-visual-series-legend stats-visual-focus-controls" aria-label="Schwierigkeitsstufe fokussieren" onKeyDown={handleDirectionalFocusNavigation}>
        <span className="stats-visual-focus-label">Fokus</span>
        <AnimatedChipButton
          className={`dashboard-filter-chip stats-visual-series-chip${focusedTrendSeries === null ? ' is-active' : ''}`}
          onClick={() => setFocusedTrendDifficultyKey(null)}
          aria-pressed={focusedTrendSeries === null}
          data-app-tooltip="Alle sichtbaren Schwierigkeitsstufen gleichwertig vergleichen."
          data-app-tooltip-position="top"
        >
          Alle vergleichen
        </AnimatedChipButton>
        {visibleTrendSeries.map((series) => {
          const isFocused = focusedTrendSeries?.key === series.key

          return (
            <AnimatedChipButton
              key={series.key}
              className={`dashboard-filter-chip stats-visual-series-chip${isFocused ? ' is-active' : ''}`}
              style={{ '--series-color': series.color } as CSSProperties}
              onClick={() => setFocusedTrendDifficultyKey(series.key)}
              aria-pressed={isFocused}
              data-app-tooltip={`${series.label} hervorheben und die anderen sichtbaren Stufen abblenden.`}
              data-app-tooltip-position="top"
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

  const scrollToStatisticsTop = (source?: HTMLElement | null) => {
    const scrollSource = source ?? reportRef.current
    const overlay = scrollSource?.closest<HTMLElement>('.workspace-window-overlay')
    const statsScrollContainer = scrollSource?.closest<HTMLElement>('.dashboard-panel-scroll')
    const behavior = shouldReduceMotion ? 'auto' : 'smooth'

    if (overlay) {
      overlay.scrollTo({ top: 0, left: 0, behavior })
    } else if (statsScrollContainer) {
      statsScrollContainer.scrollTo({ top: 0, left: 0, behavior })
    } else {
      window.scrollTo({ top: 0, left: 0, behavior })
    }
  }
  const scrollRawStatisticsToTop = () => scrollToStatisticsTop()
  const medalListLabel = medalFilter === 'all'
    ? `${filteredMotifCards.length} ${filteredMotifCards.length === 1 ? 'Motiv' : 'Motive'}`
    : filteredMotifCards.length === 0
      ? `Keine ${formatChallengeMedalLabel(medalFilter)}-Motive`
      : `${filteredMotifCards.length} ${formatChallengeMedalLabel(medalFilter)}-${filteredMotifCards.length === 1 ? 'Motiv' : 'Motive'}`
  const collectingMedalImageIds = collectingMedalEntry ? [collectingMedalEntry.representativeEntry.id] : []
  const collectingMedalImageLabel = collectingMedalEntry
    ? `${formatDifficultyLabel(collectingMedalEntry.representativeEntry.config)} vom ${formatDate(collectingMedalEntry.representativeEntry.completedAt)}`
    : 'Dieses Motiv'

  const handleOpenMedalDetail = useCallback((motifKey: string, bestEntryId: string) => {
    const displayEntry = galleryDisplayEntries.find((entry) => entry.motifId === motifKey)
    const bestEntry = displayEntry?.allEntries.find((entry) => entry.id === bestEntryId)
    if (!displayEntry || !bestEntry) return

    setSelectedMedalDetail({ ...displayEntry, representativeEntry: bestEntry })
  }, [galleryDisplayEntries])

  const handleMedalTagFilter = useCallback((tagLabel: string) => {
    setSelectedMedalDetail(null)
    onOpenGalleryTagFilter(tagLabel)
  }, [onOpenGalleryTagFilter])

  const handleMedalTagImageSearch = useCallback((tagLabel: string) => {
    setSelectedMedalDetail(null)
    void onFetchRandomImage(tagLabel)
  }, [onFetchRandomImage])

  const handleRetryMedalTagging = useCallback(async (entry: SolvedGalleryEntry) => {
    setRetryingMedalTagEntryId(entry.id)
    try {
      await onRetryGalleryTagging(entry.id)
    } finally {
      setRetryingMedalTagEntryId((current) => current === entry.id ? null : current)
    }
  }, [onRetryGalleryTagging])

  const handleEditMedalTags = useCallback(async (entryIds: string[], add: string[] = [], remove: string[] = []) => {
    setIsEditingMedalTags(true)
    try {
      await onEditGalleryEntryTags(entryIds, add, remove)
    } finally {
      setIsEditingMedalTags(false)
    }
  }, [onEditGalleryEntryTags])

  const handleCreateMedalCollection = useCallback(async (name: string, imageIds: string[]) => {
    setIsSavingMedalCollection(true)
    try {
      await onCreateCollection(name, imageIds)
      setCollectingMedalEntry(null)
    } finally {
      setIsSavingMedalCollection(false)
    }
  }, [onCreateCollection])

  const handleAddMedalCollectionImages = useCallback(async (collectionId: string, imageIds: string[]) => {
    setIsSavingMedalCollection(true)
    try {
      await onAddCollectionImages(collectionId, imageIds)
      setCollectingMedalEntry(null)
    } finally {
      setIsSavingMedalCollection(false)
    }
  }, [onAddCollectionImages])

  useEffect(() => {
    setMedalPage(1)
  }, [medalFilter, medalSort])

  return (
    <section ref={reportRef} className="stats-visual-report" aria-label="Statistik visualisieren">
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
              data-app-tooltip={view.description}
              data-app-tooltip-position="top"
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
                    <strong className="stats-report-card-value">
                      <SpringNumber
                        value={selectedAssistanceSummary.cleanRate}
                        from={0}
                        durationMs={1700}
                        fallback={formatPercent(selectedAssistanceSummary.cleanRate)}
                        formatter={(value) => formatPercent(Math.round(value))}
                      />
                    </strong>
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
                      <ResponsiveContainer width="100%" height={150}>
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

                <article className="stats-report-card stats-visual-donut-card stats-visual-medal-card">
                  <div className="stats-visual-card-head">
                    <span className="saved-games-kicker">Challenge-Erfolge</span>
                    <strong className="stats-report-card-value">
                      <SpringNumber
                        value={totalMedalMotifs}
                        from={0}
                        durationMs={1700}
                        formatter={(value) => `${Math.round(value)} Motive`}
                      />
                    </strong>
                    <p className="stats-report-card-copy">
                      Verteilung der besten Challenge-Medaille pro Motiv. Niedrigere bereits erreichte Stufen werden nicht doppelt gezaehlt.
                    </p>
                  </div>
                  {visibleMedalDistribution.length === 0 ? (
                    <div className="stats-empty-state dashboard-empty-state">
                      <span className="empty-icon" aria-hidden="true"><Medal /></span>
                      <p>Noch keine Challenge-Medaillen vorhanden.</p>
                    </div>
                  ) : (
                    <div className="stats-recharts-donut-frame">
                      <ResponsiveContainer width="100%" height={150}>
                        <PieChart>
                          <Pie
                            data={visibleMedalDistribution}
                            dataKey="value"
                            nameKey="label"
                            innerRadius="58%"
                            outerRadius="82%"
                            paddingAngle={3}
                            stroke="transparent"
                          >
                            {visibleMedalDistribution.map((segment) => (
                              <Cell key={segment.key} fill={segment.color} />
                            ))}
                          </Pie>
                          <Tooltip content={(props) => renderMedalDonutTooltip(props, totalMedalMotifs)} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </article>

                <article className="stats-report-card stats-visual-focus-card stats-visual-latest-card">
                  <div className="stats-visual-card-head">
                    <span className="saved-games-kicker">Letzter Lauf</span>
                    <strong className="stats-report-card-value">
                      <SpringNumber
                        value={latestScoreBreakdown?.score ?? null}
                        from={0}
                        durationMs={1700}
                        formatter={(value) => `${Math.round(value)}/100`}
                      />
                    </strong>
                    <p className="stats-report-card-copy">
                      {latestCompletion
                        ? `${formatDifficultyLabel(latestCompletion.config)}, ${formatOptionalDuration(latestCompletion.time)}, ${latestCompletion.moves} Netto-Zuege, ${formatAssistanceModeLabel(latestCompletion.assistanceMode)}.`
                        : 'Nach dem naechsten Sieg erscheint hier die direkte Einordnung.'}
                    </p>
                  </div>
                  <div className="stats-visual-card-visual">
                    {renderScoreBreakdownChart(
                      latestScoreBreakdownData,
                      'Score-Aufschluesselung fuer den letzten Lauf'
                    )}
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
                      <SpringNumber
                        value={averageQuality}
                        from={0}
                        durationMs={1700}
                        formatter={(value) => `${Math.round(value)}/100`}
                      />
                    </strong>
                    <p className="stats-report-card-copy">
                      {selectedOverviewDifficulty
                        ? `Durchschnittlicher Score fuer ${selectedOverviewDifficulty.label} mit sichtbaren Abzuegen. Niedrige Abzuege bedeuten sauberere Laeufe.`
                        : 'Durchschnittlicher Score ueber alle Schwierigkeitsstufen mit sichtbaren Abzuegen. Niedrige Abzuege bedeuten sauberere Laeufe.'}
                    </p>
                  </div>
                  <div className="stats-visual-card-visual">
                    {renderScoreBreakdownChart(
                      averageScoreBreakdownData,
                      selectedOverviewDifficulty
                        ? `Durchschnittliche Score-Aufschluesselung fuer ${selectedOverviewDifficulty.label}`
                        : 'Durchschnittliche Score-Aufschluesselung ueber alle Schwierigkeitsstufen'
                    )}
                  </div>
                </article>
              </div>
            </>
          ) : null}

          {activeView === 'history' ? (
            <>
              <article className="stats-report-card stats-visual-line-card">
                <div className="stats-visual-toolbar stats-chart-toolbar stats-trend-toolbar">
                  <div className="dashboard-filter-row stats-visual-segmented stats-trend-toolbar-metric" aria-label="Verlaufsmetrik waehlen" onKeyDown={handleDirectionalFocusNavigation}>
                    {TREND_METRICS.map((metric) => (
                      <AnimatedChipButton
                        key={metric.id}
                        className={`dashboard-filter-chip${trendMetric === metric.id ? ' is-active' : ''}`}
                        onClick={() => setTrendMetric(metric.id)}
                        data-app-tooltip={`Verlaufsdiagramm: ${metric.description}`}
                        data-app-tooltip-position="top"
                      >
                        {metric.label}
                      </AnimatedChipButton>
                    ))}
                  </div>

                  <div className="dashboard-filter-row stats-trend-toolbar-average" aria-label="Trendglaettung waehlen" onKeyDown={handleDirectionalFocusNavigation}>
                    <AnimatedChipButton
                      className={`dashboard-filter-chip${isMovingAverageVisible ? ' is-active' : ''}`}
                      onClick={() => setShowMovingAverage((current) => !current)}
                      disabled={!canShowMovingAverage}
                      aria-pressed={isMovingAverageVisible}
                      data-app-tooltip={canShowMovingAverage
                        ? 'Gleitenden Durchschnitt aus jeweils 5 Laeufen derselben Stufe anzeigen.'
                        : 'Der 5er-Trend braucht mindestens 5 Laeufe derselben Stufe im Ausschnitt.'}
                      data-app-tooltip-position="top"
                    >
                      5er-Trend
                    </AnimatedChipButton>
                  </div>

                  <div className="dashboard-filter-row stats-trend-toolbar-range" aria-label="Verlaufszeitraum waehlen" onKeyDown={handleDirectionalFocusNavigation}>
                    {HISTORY_RANGES.map((range) => (
                      <AnimatedChipButton
                        key={range.id}
                        className={`dashboard-filter-chip${trendRange === range.id ? ' is-active' : ''}`}
                        onClick={() => setTrendRange(range.id)}
                        data-app-tooltip={`Verlaufsdiagramm: ${range.label}.`}
                        data-app-tooltip-position="top"
                      >
                        {range.label}
                      </AnimatedChipButton>
                    ))}
                  </div>
                </div>

                <div className="stats-visual-line-head">
                  <span>
                    <strong>{selectedTrend.label}</strong>
                    <span> {selectedTrend.description}</span>
                  </span>
                  <span>
                    <strong>{trendChartPoints.length}</strong>
                    <span> Laeufe im Ausschnitt</span>
                  </span>
                </div>

                {trendChartPoints.length > 0 && trendChartPoints.length <= 3 ? (
                  <div className="stats-trend-compact-runs" aria-label="Kompakter Einzellaufvergleich">
                    <div className="stats-trend-compact-runs-list">
                      {trendChartPoints.map((point) => {
                        const metricValue = getTrendMetricValue(point, trendMetric)
                        const seriesColor = trendSeriesColorMap.get(point.difficultyKey) ?? 'var(--primary-color)'

                        return (
                          <span
                            key={point.id}
                            className="stats-trend-compact-run"
                            style={{ '--series-color': seriesColor } as CSSProperties}
                          >
                            <i aria-hidden="true" />
                            <strong>Lauf {point.index}</strong>
                            <span>{point.label}</span>
                            <span>{trendFormatter(metricValue)}</span>
                          </span>
                        )
                      })}
                    </div>
                    {compactTrendDelta ? (
                      <p>
                        <strong>Seit Lauf 1:</strong> {compactTrendDelta}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {trendChartPoints.length === 0 || trendChartSeries.length === 0 || !hasTrendChartData ? (
                  <div className="stats-empty-state dashboard-empty-state">
                    <span className="empty-icon" aria-hidden="true"><Activity /></span>
                    <p>Keine Werte fuer diese Visualisierung.</p>
                    <p className="empty-hint">Waehle einen anderen Zeitraum oder spiele weitere Runden.</p>
                  </div>
                ) : (
                  <div
                    className="stats-recharts-line-frame"
                    data-visible-series-count={trendChartSeries.length}
                    data-trend-point-count={trendChartPoints.length}
                    data-y-domain={trendYAxisDomain.join(':')}
                    data-reference-worst={focusedTrendStats.worst ?? ''}
                  >
                    <ResponsiveContainer width="100%" height={340}>
                      <LineChart margin={{ top: 30, right: 22, left: 4, bottom: 12 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="index"
                          type="number"
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                          domain={trendXAxisDomain}
                          ticks={trendTicks}
                          tickFormatter={(value) => trendTickLabels.get(Number(value)) ?? ''}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          width={64}
                          domain={trendYAxisDomain}
                          tickFormatter={(value) => trendFormatter(typeof value === 'number' ? value : null)}
                        />
                        <Tooltip
                          content={(props) => renderRechartsTooltip(props, trendMetric)}
                          shared={false}
                        />
                        {focusedTrendReferenceDisplay.shouldMerge && focusedTrendStats.best !== null && focusedTrendStats.median !== null ? (
                          <>
                            <ReferenceLine
                              y={focusedTrendStats.best}
                              stroke="var(--success-color, #34d399)"
                              strokeDasharray="6 6"
                            />
                            {focusedTrendStats.best !== focusedTrendStats.median ? (
                              <ReferenceLine
                                y={focusedTrendStats.median}
                                stroke="var(--text-muted)"
                                strokeDasharray="4 8"
                              />
                            ) : null}
                            <ReferenceLine
                              y={focusedTrendStats.median}
                              stroke="transparent"
                              label={{
                                value: formatMergedTrendReferenceLabel(focusedTrendStats, trendFormatter),
                                fill: 'var(--text-secondary)',
                                fontSize: 12,
                              }}
                            />
                          </>
                        ) : focusedTrendStats.best !== null ? (
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
                        {!focusedTrendReferenceDisplay.shouldMerge && focusedTrendStats.median !== null ? (
                          <ReferenceLine
                            y={focusedTrendStats.median}
                            stroke="var(--text-muted)"
                            strokeDasharray="4 8"
                            label={{
                              value: formatMedianTrendReferenceLabel(focusedTrendStats, trendFormatter),
                              fill: 'var(--text-secondary)',
                              fontSize: 12,
                            }}
                          />
                        ) : null}
                        {shouldRenderSeparateWorstTrendReference(focusedTrendStats) ? (
                          <ReferenceLine
                            y={focusedTrendStats.worst as number}
                            stroke="var(--warning-color, #f59e0b)"
                            strokeDasharray="2 6"
                            label={{
                              value: `Hoechstwert ${trendFormatter(focusedTrendStats.worst)}`,
                              fill: 'var(--text-secondary)',
                              fontSize: 12,
                            }}
                          />
                        ) : null}
                        {trendChartSeries.map((line) => {
                          const isFocused = focusedTrendSeries === null || focusedTrendSeries.key === line.key
                          const rawOpacity = focusedTrendSeries === null ? 0.72 : 0.88

                          return (
                            <Line
                              key={`${line.key}-raw`}
                              type="linear"
                              data={trendSeriesChartPoints[line.key] ?? []}
                              dataKey="value"
                              name={line.label}
                              stroke={line.color}
                              strokeWidth={isMovingAverageVisible ? 0 : isFocused ? 3 : 2}
                              opacity={rawOpacity}
                              dot={renderTrendDot}
                              activeDot={{ r: 6, strokeWidth: 2 }}
                              isAnimationActive={!shouldReduceMotion}
                              animationDuration={shouldReduceMotion ? 0 : 520}
                              animationEasing="ease-out"
                            />
                          )
                        })}
                        {isMovingAverageVisible ? trendChartSeries.map((line) => {
                          const isFocused = focusedTrendSeries === null || focusedTrendSeries.key === line.key

                          return (
                            <Line
                              key={`${line.key}-moving-average`}
                              type="monotone"
                              data={trendSeriesChartPoints[line.key] ?? []}
                              dataKey="movingAverage"
                              name={`${line.label} 5er-Trend`}
                              stroke={line.color}
                              strokeWidth={isFocused ? 4 : 2.5}
                              opacity={focusedTrendSeries === null ? 0.9 : isFocused ? 1 : 0.16}
                              dot={false}
                              activeDot={{ r: 5, strokeWidth: 2 }}
                              connectNulls={false}
                              legendType="none"
                              isAnimationActive={!shouldReduceMotion}
                              animationDuration={shouldReduceMotion ? 0 : 560}
                              animationEasing="ease-out"
                            />
                          )
                        }) : null}
                        {medalTrendMarkers.map((marker) => (
                          <ReferenceDot
                            key={`trend-medal-${marker.id}-${marker.medal}`}
                            x={marker.index}
                            y={marker.value}
                            r={7}
                            fill={MEDAL_STATS_COLORS[marker.medal]}
                            stroke="rgba(255, 255, 255, 0.82)"
                            strokeWidth={1.5}
                            className={`stats-trend-medal-reference is-${marker.medal}`}
                            ifOverflow="visible"
                            label={{
                              value: getChallengeMedalEmoji(marker.medal),
                              position: 'top',
                              fill: 'var(--text-main)',
                              fontSize: 13,
                              fontWeight: 900,
                              className: 'stats-trend-medal-reference-label',
                            }}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {renderDifficultyColorLegend('Farblegende Trenddiagramm', trendChartSeries)}
                {renderTrendFocusControls()}

                <div className="stats-visual-line-legend">
                  <span>{completionHistory.length} Laeufe gesamt</span>
                  <span>{trendChartSeries.length} von {trendSeriesOptions.length} Stufen sichtbar</span>
                  {medalTrendMarkers.length > 0 ? (
                    <span>{medalTrendMarkers.length} {medalTrendMarkers.length === 1 ? 'Medaillenlauf' : 'Medaillenlaeufe'} im Diagramm markiert</span>
                  ) : null}
                  {trendAxisSummary ? <span>{trendAxisSummary}</span> : null}
                  <span>{isMovingAverageVisible ? 'Rohlaeufe als Punkte, 5er-Trend als Linie' : 'Rohlaeufe mit geraden Verbindungen'}</span>
                  <span>{focusedTrendSeries ? `Fokus: ${focusedTrendSeries.label}` : 'Alle sichtbaren Stufen gleichwertig'}</span>
                </div>
                <div className="stats-chart-footer-navigation" onKeyDown={handleDirectionalFocusNavigation}>
                  <AnimatedButton
                    className="secondary stats-chart-footer-button"
                    interaction="chip"
                    onClick={(event) => scrollToStatisticsTop(event.currentTarget)}
                    data-app-tooltip="Zum Anfang der Statistikseite springen."
                    data-app-tooltip-position="top"
                  >
                    <ArrowUp size={16} aria-hidden="true" />
                    Zum Seitenanfang
                  </AnimatedButton>
                  <AnimatedButton
                    className="secondary stats-chart-footer-button"
                    interaction="chip"
                    onClick={onBackToStart}
                    data-app-tooltip="Zur Auswahluebersicht zurueckkehren."
                    data-app-tooltip-position="top"
                  >
                    <Home size={16} aria-hidden="true" />
                    Zur Auswahl
                  </AnimatedButton>
                </div>
              </article>

              <article className="stats-report-card stats-visual-line-card stats-visual-histogram-card">
                <div className="stats-visual-toolbar stats-chart-toolbar">
                  <div className="dashboard-filter-row stats-visual-segmented" aria-label="Verteilungsmetrik waehlen" onKeyDown={handleDirectionalFocusNavigation}>
                    {TREND_METRICS.map((metric) => (
                      <AnimatedChipButton
                        key={metric.id}
                        className={`dashboard-filter-chip${histogramMetric === metric.id ? ' is-active' : ''}`}
                        onClick={() => setHistogramMetric(metric.id)}
                        data-app-tooltip={`Verteilungsdiagramm: ${metric.description}`}
                        data-app-tooltip-position="top"
                      >
                        {metric.label}
                      </AnimatedChipButton>
                    ))}
                  </div>

                  <div className="dashboard-filter-row" aria-label="Verteilungszeitraum waehlen" onKeyDown={handleDirectionalFocusNavigation}>
                    {HISTORY_RANGES.map((range) => (
                      <AnimatedChipButton
                        key={range.id}
                        className={`dashboard-filter-chip${histogramRange === range.id ? ' is-active' : ''}`}
                        onClick={() => setHistogramRange(range.id)}
                        data-app-tooltip={`Verteilungsdiagramm: ${range.label}.`}
                        data-app-tooltip-position="top"
                      >
                        {range.label}
                      </AnimatedChipButton>
                    ))}
                  </div>
                </div>

                <div className="stats-visual-line-head">
                  <span>
                    <strong>Verteilung der {histogramMetric === 'time' ? 'Loesungszeiten' : 'Aktionen'}</strong>
                    <span> Haeufigkeit je {histogramMetric === 'time' ? 'Zeitbereich' : 'Aktionsbereich'}, aufgeteilt nach Schwierigkeit.</span>
                  </span>
                  <span>
                    <strong>{solveTimeHistogram.total}</strong>
                    <span> sichtbare Laeufe</span>
                  </span>
                </div>

                {solveTimeHistogram.data.length === 0 ? (
                  <div className="stats-empty-state dashboard-empty-state">
                    <span className="empty-icon" aria-hidden="true"><Activity /></span>
                    <p>Keine {histogramMetric === 'time' ? 'Laufzeiten' : 'Aktionsdaten'} fuer diese Verteilung.</p>
                    <p className="empty-hint">Waehle einen anderen Zeitraum oder blende weitere Stufen ein.</p>
                  </div>
                ) : (
                  <div
                    className="stats-recharts-line-frame stats-recharts-histogram-frame"
                    data-bucket-count={solveTimeHistogram.data.length}
                    data-gap-count={solveTimeHistogram.compressedGapCount}
                    data-gap-position-step={HISTOGRAM_GAP_POSITION_STEP}
                    data-core-bucket-step={solveTimeHistogram.coreStep}
                    data-bar-category-gap={solveTimeHistogramLayout.barCategoryGap}
                  >
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart
                        data={solveTimeHistogram.data}
                        margin={{ top: 18, right: 22, left: 4, bottom: 12 }}
                        barCategoryGap={solveTimeHistogramLayout.barCategoryGap}
                        barGap={0}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="displayIndex"
                          type="number"
                          tickLine={false}
                          axisLine={false}
                          domain={[-0.5, solveTimeHistogramLastIndex + 0.5]}
                          ticks={solveTimeHistogramTicks}
                          tickFormatter={(value) => solveTimeHistogramTickLabels.get(Number(value)) ?? ''}
                          angle={solveTimeHistogram.data.length > 6 ? -18 : 0}
                          textAnchor={solveTimeHistogram.data.length > 6 ? 'end' : 'middle'}
                          height={solveTimeHistogram.data.length > 6 ? 54 : 34}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                          width={42}
                        />
                        <Tooltip
                          content={(props) => renderSolveTimeHistogramTooltip(
                            props,
                            solveTimeHistogram.total,
                            solveTimeHistogram.median,
                            histogramMetric
                          )}
                          cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                        />
                        {visibleTrendSeries.map((series) => (
                          <Bar
                            key={series.key}
                            dataKey={getHistogramSeriesDataKey(series.key)}
                            name={series.label}
                            stackId="solve-times"
                            fill={series.color}
                            radius={[4, 4, 0, 0]}
                            maxBarSize={solveTimeHistogramLayout.maxBarSize}
                          />
                        ))}
                        <Bar
                          dataKey="gapMarker"
                          name={histogramMetric === 'time' ? 'Leerer Zeitbereich' : 'Leerer Aktionsbereich'}
                          stackId="solve-times"
                          fill="var(--text-muted)"
                          radius={[999, 999, 0, 0]}
                          maxBarSize={8}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {renderDifficultyColorLegend('Farblegende Histogramm')}
                <div className="stats-visual-line-legend">
                  <span>
                    Median: {histogramMetric === 'time'
                      ? formatOptionalDuration(solveTimeHistogram.median)
                      : formatOptionalMoves(solveTimeHistogram.median)}
                  </span>
                  <span>Haeufigster Bereich: {solveTimeHistogram.peakLabel ?? '--'}</span>
                  <span>
                    Hauptbereich: {histogramMetric === 'time'
                      ? '15-Sekunden-Intervalle'
                      : `${solveTimeHistogram.coreStep ?? '--'}-Aktions-Intervalle`}, danach zunehmend groesser
                  </span>
                  <span>
                    {histogramMetric === 'time' ? 'Zeitleiste' : 'Aktionsskala'} bis: {histogramMetric === 'time'
                      ? formatOptionalDuration(solveTimeHistogram.axisMaximum)
                      : formatOptionalMoves(solveTimeHistogram.axisMaximum)}
                  </span>
                  {solveTimeHistogram.compressedGapCount > 0 ? (
                    <span>
                      {solveTimeHistogram.compressedGapCount} {solveTimeHistogram.compressedGapCount === 1 ? 'Leerluecke' : 'Leerluecken'} als ... verdichtet
                    </span>
                  ) : null}
                  <span>Farben entsprechen den Schwierigkeitsreihen oben</span>
                </div>
                <div className="stats-chart-footer-navigation" onKeyDown={handleDirectionalFocusNavigation}>
                  <AnimatedButton
                    className="secondary stats-chart-footer-button"
                    interaction="chip"
                    onClick={(event) => scrollToStatisticsTop(event.currentTarget)}
                    data-app-tooltip="Zum Anfang der Statistikseite springen."
                    data-app-tooltip-position="top"
                  >
                    <ArrowUp size={16} aria-hidden="true" />
                    Zum Seitenanfang
                  </AnimatedButton>
                  <AnimatedButton
                    className="secondary stats-chart-footer-button"
                    interaction="chip"
                    onClick={onBackToStart}
                    data-app-tooltip="Zur Auswahluebersicht zurueckkehren."
                    data-app-tooltip-position="top"
                  >
                    <Home size={16} aria-hidden="true" />
                    Zur Auswahl
                  </AnimatedButton>
                </div>
              </article>
            </>
          ) : null}

          {activeView === 'medals' ? (
            <article className="stats-report-card stats-visual-line-card stats-visual-medal-trend-card">
                <div className="stats-visual-line-head">
                  <span>
                    <strong>Medaillen-Aufstiege</strong>
                    <span> Neueste Erfolge und echte Upgrades pro Motiv.</span>
                  </span>
                  <span>
                    <strong>{totalMedalMotifs}</strong>
                    <span> Motive mit Medaille</span>
                  </span>
                </div>

                <div
                  className="stats-medal-summary"
                  aria-label="Aktuelle beste Medaillen pro Motiv"
                  onKeyDown={handleDirectionalFocusNavigation}
                >
                  <AnimatedChipButton
                    className={`stats-medal-summary-item is-all${medalFilter === 'all' ? ' is-filter-active' : ' is-inactive'}`}
                    onClick={() => setMedalFilter('all')}
                    aria-pressed={medalFilter === 'all'}
                  >
                    <span className="stats-medal-summary-emoji" aria-hidden="true">
                      <Medal />
                    </span>
                    <span>
                      <strong>Alle</strong>
                      <small>{totalMedalMotifs} {totalMedalMotifs === 1 ? 'Motiv' : 'Motive'}</small>
                    </span>
                  </AnimatedChipButton>
                  {MEDAL_STATS_ORDER.map((medal) => {
                    const count = medalDistribution.find((segment) => segment.key === medal)?.value ?? 0
                    const isActive = medalFilter === medal
                    return (
                      <AnimatedChipButton
                        key={medal}
                        className={`stats-medal-summary-item is-${medal}${isActive ? ' is-filter-active' : ''}${medalFilter !== 'all' && !isActive ? ' is-inactive' : ''}`}
                        style={{ '--medal-color': MEDAL_STATS_COLORS[medal] } as CSSProperties}
                        onClick={() => setMedalFilter(isActive ? 'all' : medal)}
                        aria-pressed={isActive}
                      >
                        <span className="stats-medal-summary-emoji" aria-hidden="true">
                          {getChallengeMedalEmoji(medal)}
                        </span>
                        <span>
                          <strong>{formatChallengeMedalLabel(medal)}</strong>
                          <small>{count} {count === 1 ? 'Motiv' : 'Motive'}</small>
                        </span>
                      </AnimatedChipButton>
                    )
                  })}
                </div>

                <div className="stats-medal-toolbar">
                  <span className="stats-medal-toolbar-label">Sortierung:</span>
                  <div className="dashboard-filter-row" aria-label="Medaillen-Motive sortieren" onKeyDown={handleDirectionalFocusNavigation}>
                    <AnimatedChipButton
                      className={`dashboard-filter-chip${medalSort === 'recent' ? ' is-active' : ''}`}
                      onClick={() => setMedalSort('recent')}
                      aria-pressed={medalSort === 'recent'}
                    >
                      Neuester Aufstieg
                    </AnimatedChipButton>
                    <AnimatedChipButton
                      className={`dashboard-filter-chip${medalSort === 'best' ? ' is-active' : ''}`}
                      onClick={() => setMedalSort('best')}
                      aria-pressed={medalSort === 'best'}
                    >
                      Beste Medaille
                    </AnimatedChipButton>
                  </div>
                </div>

                <div ref={medalCardsRef} className="stats-medal-list-head">
                  <strong>{medalListLabel}</strong>
                  {medalFilter !== 'all' ? <span>von {totalMedalMotifs} Motiven insgesamt</span> : null}
                </div>

                {groupedMotifCards.length === 0 ? (
                  <div className="stats-empty-state dashboard-empty-state">
                    <span className="empty-icon" aria-hidden="true"><Medal /></span>
                    <p>Noch keine Medaillen-Aufstiege vorhanden.</p>
                    <p className="empty-hint">Schliesse eine Challenge ab, damit die Motivkarten erscheinen.</p>
                  </div>
                ) : filteredMotifCards.length === 0 ? (
                  <div className="stats-empty-state dashboard-empty-state">
                    <span className="empty-icon" aria-hidden="true"><Medal /></span>
                    <p>Keine Motive mit {formatChallengeMedalLabel(medalFilter as ChallengeMedal)} gefunden.</p>
                    <AnimatedButton className="secondary" onClick={() => setMedalFilter('all')}>
                      Filter zuruecksetzen
                    </AnimatedButton>
                  </div>
                ) : (
                  <>
                    <div
                      className="stats-medal-motif-cards"
                      aria-label="Medaillen-Motive"
                      onKeyDown={handleDirectionalFocusNavigation}
                    >
                    {pagedMotifCards.map((card) => {
                      const activeSeriesId = selectedMedalSeries[card.motifKey] ?? card.series[0]?.targetId
                      const activeSeries = card.series.find((series) => series.targetId === activeSeriesId) ?? card.series[0]
                      const activeSeriesIndex = activeSeries
                        ? card.series.findIndex((series) => series.targetId === activeSeries.targetId)
                        : -1
                      const isSeriesTargetTie = activeSeries?.timeDeltaToTarget === 0 && activeSeries.movesDeltaToTarget === 0

                      return (
                      <article
                        key={card.motifKey}
                        className={`stats-medal-motif-card is-${card.bestMedal} stats-series-tone-${Math.max(0, activeSeriesIndex) % 4}`}
                        style={{ '--medal-color': MEDAL_STATS_COLORS[card.bestMedal] } as CSSProperties}
                      >
                        <button
                          type="button"
                          className="stats-medal-motif-preview"
                          onClick={() => handleOpenMedalDetail(card.motifKey, card.bestEntryId)}
                          aria-label={`Vollstaendige Detailkarte fuer das ${card.bestMedalLabel}-Motiv oeffnen`}
                          data-app-tooltip="Vollstaendige Galerie-Detailkarte oeffnen."
                          data-app-tooltip-position="top"
                        >
                          {card.previewImage ? <img src={card.previewImage} alt="" /> : <Medal />}
                        </button>
                        {activeSeries ? (
                          <>
                            <div className="stats-medal-series-comparison" aria-label="Vergleich der ausgewaehlten Challenge-Serie">
                              <div className="stats-medal-series-metric is-target">
                                <div className="stats-medal-series-primary">
                                  <small>Vorlage</small>
                                  <strong>{activeSeries.targetDifficultyLabel ?? 'Vorlage nicht vorhanden'}</strong>
                                </div>
                                <div className="stats-medal-series-values">
                                  <span>
                                    <small>Zeit</small>
                                    <strong>{activeSeries.targetTime !== null ? formatTime(activeSeries.targetTime) : '--'}</strong>
                                  </span>
                                  <span>
                                    <small>Netto</small>
                                    <strong>{activeSeries.targetMoves !== null ? `${activeSeries.targetMoves} Zuege` : '--'}</strong>
                                  </span>
                                </div>
                              </div>
                              <div className="stats-medal-series-metric is-best">
                                <div className="stats-medal-series-primary">
                                  <small>Bester Versuch</small>
                                  <strong>{getChallengeMedalEmoji(activeSeries.bestMedal)} {formatChallengeMedalLabel(activeSeries.bestMedal)}</strong>
                                </div>
                                <div className="stats-medal-series-values">
                                  <span>
                                    <small>Zeit</small>
                                    <strong>{formatTime(activeSeries.bestAttemptTime)}</strong>
                                  </span>
                                  <span>
                                    <small>Netto</small>
                                    <strong>{activeSeries.bestAttemptMoves} Zuege</strong>
                                  </span>
                                </div>
                              </div>
                              <div className="stats-medal-series-metric is-gap">
                                <div className="stats-medal-series-primary">
                                  <small>Abstand zur Vorlage</small>
                                  <strong>{isSeriesTargetTie ? 'Gleichstand' : 'Vergleich'}</strong>
                                </div>
                                <div className="stats-medal-series-values">
                                  <span>
                                    <small>Zeit</small>
                                    <strong>{activeSeries.timeDeltaToTarget !== null ? formatSeriesTimeDelta(activeSeries.timeDeltaToTarget) : 'Nicht vergleichbar'}</strong>
                                  </span>
                                  <span>
                                    <small>Netto</small>
                                    <strong>{activeSeries.movesDeltaToTarget !== null ? formatSeriesMovesDelta(activeSeries.movesDeltaToTarget) : 'Nicht vergleichbar'}</strong>
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="stats-medal-motif-facts">
                              <div className="stats-medal-series-toolbar">
                                <span>
                                  Ausgewaehlte Serie {activeSeriesIndex + 1} von {card.series.length}
                                </span>
                                {card.series.length > 1 ? (
                                  <div
                                    className="stats-medal-series-switcher"
                                    aria-label="Challenge-Serie dieses Motivs auswaehlen"
                                    onKeyDown={handleDirectionalFocusNavigation}
                                  >
                                    {card.series.map((series, index) => (
                                      <button
                                      key={series.targetId}
                                      type="button"
                                      className={`stats-series-tone-${index % 4}${series.targetId === activeSeries.targetId ? ' is-active' : ''}`}
                                        aria-pressed={series.targetId === activeSeries.targetId}
                                        onClick={() => setSelectedMedalSeries((current) => ({
                                          ...current,
                                          [card.motifKey]: series.targetId,
                                        }))}
                                      >
                                        Serie {index + 1}
                                      </button>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                              <div className="stats-medal-series-progress" aria-label="Vergleich der Versuche mit der ausgewaehlten Vorlage">
                                <strong>
                                  {activeSeries.attemptCount} {activeSeries.attemptCount === 1 ? 'Versuch' : 'Versuche'} gegen diese Vorlage
                                </strong>
                                <span>
                                  Bester Versuch zur Vorlage:
                                  {' '}
                                  {activeSeries.timeDeltaToTarget !== null
                                    ? formatSeriesTimeDelta(activeSeries.timeDeltaToTarget)
                                    : 'Zeit nicht vergleichbar'}
                                  {' · '}
                                  {activeSeries.movesDeltaToTarget !== null
                                    ? formatSeriesMovesDelta(activeSeries.movesDeltaToTarget)
                                    : 'Zuege nicht vergleichbar'}
                                </span>
                              </div>
                            </div>
                          </>
                        ) : null}
                      </article>
                      )
                    })}
                    </div>
                    <UploadPageNavigation
                      activePage={activeMedalPage}
                      ariaLabel="Medaillen-Motivseiten"
                      onPageChange={setMedalPage}
                      pageCount={medalPageCount}
                      scrollTargetRef={medalCardsRef}
                    />
                  </>
                )}
                <div className="stats-visual-line-legend">
                  <span>Pro Motiv eine Karte; jede Challenge-Serie vergleicht Vorlage, besten Versuch und Abstand</span>
                  <span>Bei mehreren Serien kann die dargestellte Challenge direkt in der Karte gewechselt werden</span>
                </div>
                <div className="stats-chart-footer-navigation" onKeyDown={handleDirectionalFocusNavigation}>
                  <AnimatedButton
                    className="secondary stats-chart-footer-button"
                    interaction="chip"
                    onClick={(event) => scrollToStatisticsTop(event.currentTarget)}
                    data-app-tooltip="Zum Anfang der Statistikseite springen."
                    data-app-tooltip-position="top"
                  >
                    <ArrowUp size={16} aria-hidden="true" />
                    Zum Seitenanfang
                  </AnimatedButton>
                  <AnimatedButton
                    className="secondary stats-chart-footer-button"
                    interaction="chip"
                    onClick={onBackToStart}
                    data-app-tooltip="Zur Auswahluebersicht zurueckkehren."
                    data-app-tooltip-position="top"
                  >
                    <Home size={16} aria-hidden="true" />
                    Zur Auswahl
                  </AnimatedButton>
                </div>
              </article>
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
                        data-app-tooltip={view.description}
                        data-app-tooltip-position="top"
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
                    disabled={rawStatsView === 'history' ? filteredHistory.length === 0 : completionHistory.length === 0}
                    busy={isSavingRawExport}
                    busyLabel="Speichere CSV ..."
                    data-app-tooltip="Aktuelle Rohdatenansicht als CSV in statistik-exporte speichern."
                    data-app-tooltip-position="top"
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
                    disabled={!stats && completionHistory.length === 0}
                    busy={isSavingRawExport}
                    busyLabel="Speichere JSON ..."
                    data-app-tooltip="Alle Statistik-Rohdaten als JSON in statistik-exporte speichern."
                    data-app-tooltip-position="top"
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
                      onReloadView={scrollRawStatisticsToTop}
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
                      onReloadView={scrollRawStatisticsToTop}
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
                      onReloadView={scrollRawStatisticsToTop}
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

      {selectedMedalDetail ? (
        <UploadGalleryDetailDialog
          entry={selectedMedalDetail}
          onReplayEntry={onReplayGalleryEntry}
          onCollectEntry={(entry) => {
            setSelectedMedalDetail(null)
            setCollectingMedalEntry(entry)
          }}
          onTagFilter={handleMedalTagFilter}
          onFetchRandomImage={handleMedalTagImageSearch}
          onOpenSimilarEntry={setSelectedMedalDetail}
          similarEntries={similarMedalEntries}
          onRetryTagging={handleRetryMedalTagging}
          isRetryingTagging={retryingMedalTagEntryId === selectedMedalDetail.representativeEntry.id}
          allTagLabels={allGalleryTagLabels}
          onEditTags={handleEditMedalTags}
          isEditingTags={isEditingMedalTags}
          onClose={() => setSelectedMedalDetail(null)}
        />
      ) : null}

      {collectingMedalEntry ? (
        <UploadCollectionPickerDialog
          collections={collections}
          imageIds={collectingMedalImageIds}
          imageLabel={collectingMedalImageLabel}
          isBusy={isSavingMedalCollection || isLoadingCollections}
          onCreateCollection={handleCreateMedalCollection}
          onAddToCollection={handleAddMedalCollectionImages}
          onClose={() => {
            if (!isSavingMedalCollection) {
              setCollectingMedalEntry(null)
            }
          }}
        />
      ) : null}
    </section>
  )
}
