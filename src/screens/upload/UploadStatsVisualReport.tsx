import { type RefObject, useMemo, useState } from 'react'
import {
  Activity,
  BarChart3,
  LayoutDashboard,
  LineChart,
  ShieldCheck,
  Table2,
  Trophy,
} from 'lucide-react'
import { handleDirectionalFocusNavigation } from '../../app/directionalFocusNavigation.ts'
import AnimatedButton from '../../motion/AnimatedButton.tsx'
import AnimatedChipButton from '../../motion/AnimatedChipButton.tsx'
import AnimatedSwapPane from '../../motion/AnimatedSwapPane.tsx'
import { PuzzleCompletionRecord, PuzzleDifficultyStats, PuzzleStats } from '../../types/index'
import { formatDifficultyLabel, formatPuzzleSize } from '../../utils/puzzleDifficulty.ts'
import UploadStatsComparisonMatrix from './UploadStatsComparisonMatrix.tsx'
import UploadStatsDifficultyTable from './UploadStatsDifficultyTable.tsx'
import UploadStatsHistorySection from './UploadStatsHistorySection.tsx'
import UploadStatsRunComparison from './UploadStatsRunComparison.tsx'
import {
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
  formatProfileSourceLabel,
  getCompletionExtraMoves,
} from './uploadUtils.ts'

export type VisualStatsView = 'overview' | 'difficulties' | 'history' | 'records' | 'assistance' | 'raw'

type HistoryMetric = 'time' | 'moves' | 'extraMoves'

type HistoryRange = 'recent12' | 'recent30' | 'all'

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
  { id: 'difficulties', label: 'Stufen', icon: BarChart3 },
  { id: 'history', label: 'Verlauf', icon: LineChart },
  { id: 'records', label: 'Rekorde', icon: Trophy },
  { id: 'assistance', label: 'Sauberkeit', icon: ShieldCheck },
  { id: 'raw', label: 'Rohdaten', icon: Table2 },
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

function getLineChartPoints(entries: PuzzleCompletionRecord[], metric: HistoryMetric): {
  points: string
  values: Array<{ entry: PuzzleCompletionRecord; value: number; x: number; y: number }>
  min: number
  max: number
} {
  const values = entries
    .map((entry) => ({ entry, value: getMetricValue(entry, metric) }))
    .filter((item): item is { entry: PuzzleCompletionRecord; value: number } => item.value !== null)

  if (values.length === 0) {
    return { points: '', values: [], min: 0, max: 0 }
  }

  const rawValues = values.map((item) => item.value)
  const min = Math.min(...rawValues)
  const max = Math.max(...rawValues)
  const range = Math.max(1, max - min)

  const plottedValues = values.map((item, index) => {
    const x = values.length === 1 ? 50 : 8 + (index / (values.length - 1)) * 86
    const y = max === min ? 52 : 82 - ((item.value - min) / range) * 58
    return { ...item, x, y }
  })

  return {
    points: plottedValues.map((item) => `${item.x.toFixed(2)},${item.y.toFixed(2)}`).join(' '),
    values: plottedValues,
    min,
    max,
  }
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

function renderMetricCards(stats: PuzzleStats | null, latestCompletion: PuzzleCompletionRecord | null) {
  const cleanRate = getCleanRate(stats)
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
      detail: `${stats?.cleanSolvedCount ?? 0} clean geloest`,
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
  const [historyMetric, setHistoryMetric] = useState<HistoryMetric>('time')
  const [historyRange, setHistoryRange] = useState<HistoryRange>('recent12')

  const difficultyRows = useMemo(
    () => buildDifficultyReportRows(standardDifficultyStats, completionHistory),
    [completionHistory, standardDifficultyStats]
  )
  const solvedDifficultyRows = difficultyRows.filter((row) => row.solveCount > 0)
  const maxSolveCount = Math.max(1, ...difficultyRows.map((row) => row.solveCount))
  const rangedHistory = useMemo(
    () => getHistoryRangeEntries(completionHistory, historyRange),
    [completionHistory, historyRange]
  )
  const lineChart = useMemo(
    () => getLineChartPoints(rangedHistory, historyMetric),
    [historyMetric, rangedHistory]
  )
  const lineChartMetricLabel = getMetricAxisLabel(historyMetric)
  const firstLineChartEntry = lineChart.values[0]?.entry ?? null
  const lastLineChartEntry = lineChart.values[lineChart.values.length - 1]?.entry ?? null
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
  const cleanRate = getCleanRate(stats)
  const profileCoverage = stats && stats.totalSolved > 0
    ? Math.round((stats.profiledSolvedCount / stats.totalSolved) * 100)
    : null
  const latestExtraMoves = latestCompletion?.hasDetailedProfile
    ? getCompletionExtraMoves(latestCompletion)
    : null
  const latestRunScopeLabel = latestCompletion
    ? `Letzter gespeicherter Sieg: ${formatDifficultyLabel(latestCompletion.config)} vom ${formatDate(latestCompletion.completedAt)}.`
    : 'Noch kein gespeicherter Sieg vorhanden.'
  const assistedCount = stats
    ? Math.max(0, stats.assistedSolvedCount - stats.autoAssistedSolvedCount)
    : 0
  const assistanceTotal = Math.max(1, stats?.totalSolved ?? 0)
  const assistanceSegments = [
    { label: 'Clean', value: stats?.cleanSolvedCount ?? 0, className: 'is-clean' },
    { label: 'Hinweise', value: assistedCount, className: 'is-hinted' },
    { label: 'Auto-Zug', value: stats?.autoAssistedSolvedCount ?? 0, className: 'is-auto' },
    { label: 'Legacy', value: stats?.legacySolvedCount ?? 0, className: 'is-legacy' },
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
    {
      label: 'Beste Serie',
      value: `${stats?.bestStreak ?? 0}`,
      detail: `${stats?.currentStreak ?? 0} aktuelle Serie`,
      tone: 'neutral',
    },
    {
      label: 'Lieblingsstufe',
      value: favoriteDifficulty ? formatDifficultyLabel(favoriteDifficulty.config) : '--',
      detail: favoriteDifficulty ? `${favoriteDifficulty.solveCount} Siege` : 'Noch kein Favorit',
      tone: 'neutral',
    },
  ]
  const rawOverviewCards = [
    {
      label: 'Laeufe',
      value: `${completionHistory.length}`,
      detail: `${solvedDifficultyRows.length} von ${difficultyRows.length} Stufen geloest`,
    },
    {
      label: 'Letzter Lauf',
      value: latestCompletion ? formatOptionalDuration(latestCompletion.time) : '--',
      detail: latestCompletion
        ? `${formatDifficultyLabel(latestCompletion.config)}, ${latestCompletion.moves} Netto-Zuege`
        : 'Noch kein Abschluss',
    },
    {
      label: 'Detailprofile',
      value: formatPercent(profileCoverage),
      detail: `${stats?.profiledSolvedCount ?? 0} voll erfasst, ${stats?.legacySolvedCount ?? 0} Legacy`,
    },
    {
      label: 'Sauberkeit',
      value: formatPercent(cleanRate),
      detail: `${stats?.cleanSolvedCount ?? 0} clean, ${stats?.assistedSolvedCount ?? 0} unterstuetzt`,
    },
  ]
  const rawFieldGroups = [
    {
      title: 'Letzter Lauf',
      description: latestRunScopeLabel,
      items: [
        { label: 'Datum', value: latestCompletion ? formatDate(latestCompletion.completedAt) : '--' },
        { label: 'Stufe', value: latestCompletion ? formatDifficultyLabel(latestCompletion.config) : '--' },
        { label: 'Zeit', value: latestCompletion ? formatOptionalDuration(latestCompletion.time) : '--' },
        { label: 'Netto-Zuege', value: latestCompletion ? formatOptionalMoves(latestCompletion.moves) : '--' },
      ],
    },
    {
      title: 'Hilfen im letzten Lauf',
      description: 'Bezieht sich auf denselben letzten Sieg wie links, inklusive Auto-Zuegen und Umwegen.',
      items: [
        {
          label: 'Laufart',
          value: latestCompletion
            ? latestCompletion.hasDetailedProfile
              ? formatAssistanceModeLabel(latestCompletion.assistanceMode)
              : 'Legacy'
            : '--',
        },
        {
          label: 'Aktionen',
          value: latestCompletion?.hasDetailedProfile
            ? formatOptionalMoves(latestCompletion.actionMoves)
            : '--',
        },
        { label: 'Umwege', value: formatExtraMoves(latestExtraMoves) },
        {
          label: 'Hilfen',
          value: latestCompletion?.hasDetailedProfile
            ? `${latestCompletion.hintCount} Hinweise, ${latestCompletion.suggestedMoveCount} Auto-Zuege`
            : '--',
        },
        {
          label: 'Datenquelle',
          value: latestCompletion ? formatProfileSourceLabel(latestCompletion.hasDetailedProfile) : '--',
        },
      ],
    },
    {
      title: 'Gesamtstatistik',
      description: `Aggregiert ueber alle ${stats?.totalSolved ?? 0} gespeicherten Siege.`,
      items: [
        { label: 'Clean-Quote', value: formatPercent(cleanRate) },
        { label: 'Profilabdeckung', value: formatPercent(profileCoverage) },
        {
          label: 'Lieblingsstufe',
          value: favoriteDifficulty ? formatDifficultyLabel(favoriteDifficulty.config) : '--',
        },
        {
          label: 'Datenstand',
          value: stats?.lastUpdatedAt ? formatDate(stats.lastUpdatedAt) : '--',
        },
      ],
    },
  ]

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
              {renderMetricCards(stats, latestCompletion)}

              <div className="stats-visual-overview-grid">
                <article className="stats-report-card stats-visual-focus-card">
                  <span className="saved-games-kicker">Letzter Lauf</span>
                  <strong className="stats-report-card-value">
                    {latestCompletion ? formatOptionalDuration(latestCompletion.time) : '--'}
                  </strong>
                  <p className="stats-report-card-copy">
                    {latestCompletion
                      ? `${formatDifficultyLabel(latestCompletion.config)}, ${latestCompletion.moves} Netto-Zuege, ${formatAssistanceModeLabel(latestCompletion.assistanceMode)}.`
                      : 'Nach dem naechsten Sieg erscheint hier die direkte Einordnung.'}
                  </p>
                </article>

                <article className="stats-report-card stats-visual-focus-card">
                  <span className="saved-games-kicker">Beste Entwicklung</span>
                  <strong className="stats-report-card-value">
                    {fastestDifficulty ? formatDifficultyLabel(fastestDifficulty.config) : '--'}
                  </strong>
                  <p className="stats-report-card-copy">
                    {fastestDifficulty
                      ? `${formatOptionalDuration(fastestDifficulty.averageTime)} im Schnitt bei ${fastestDifficulty.solveCount} Siegen.`
                      : 'Sobald mehrere Stufen geloest sind, wird der schnellste Schnitt sichtbar.'}
                  </p>
                </article>

                <article className="stats-report-card stats-visual-focus-card">
                  <span className="saved-games-kicker">Sauberkeit</span>
                  <strong className="stats-report-card-value">{formatPercent(cleanRate)}</strong>
                  <div className="stats-visual-stacked-bar" aria-label={`Clean-Quote ${formatPercent(cleanRate)}`}>
                    {assistanceSegments.map((segment) => (
                      <span
                        key={segment.label}
                        className={`stats-visual-stacked-segment ${segment.className}`}
                        style={{ width: `${Math.max(0, (segment.value / assistanceTotal) * 100)}%` }}
                        title={`${segment.label}: ${segment.value}`}
                      />
                    ))}
                  </div>
                  <p className="stats-report-card-copy">
                    {stats?.cleanSolvedCount ?? 0} clean, {stats?.assistedSolvedCount ?? 0} unterstuetzt.
                  </p>
                </article>
              </div>
            </>
          ) : null}

          {activeView === 'difficulties' ? (
            <div className="stats-visual-difficulty-list">
              {difficultyRows.map((row) => (
                <article key={row.option.key} className={`stats-visual-difficulty-row${row.solveCount === 0 ? ' is-muted' : ''}`}>
                  <div className="stats-visual-difficulty-title">
                    <strong>{row.option.label}</strong>
                    <span>{formatPuzzleSize({ rows: row.option.rows, cols: row.option.cols })}</span>
                  </div>

                  <div className="stats-visual-bar-track" aria-label={`${row.solveCount} Siege`}>
                    <span className="stats-visual-bar-fill" style={{ width: `${getPercent(row.solveCount, maxSolveCount)}%` }} />
                  </div>

                  <div className="stats-visual-difficulty-metrics">
                    <span><strong>{row.solveCount}</strong> Siege</span>
                    <span><strong>{formatOptionalDuration(row.bestTime)}</strong> Bestzeit</span>
                    <span><strong>{formatOptionalDuration(row.medianTime)}</strong> Median</span>
                    <span><strong>{formatPercent(row.cleanRate)}</strong> clean</span>
                  </div>
                </article>
              ))}
            </div>
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
                        <polyline points={lineChart.points} className="stats-visual-chart-line" />
                      </svg>
                      <div className="stats-visual-chart-points" aria-label={`${lineChartMetricLabel} im Verlauf`}>
                        {lineChart.values.map((point) => (
                          <button
                            key={point.entry.id}
                            type="button"
                            className="stats-visual-chart-point"
                            style={{ left: `${point.x}%`, top: `${point.y}%` }}
                            aria-label={`${formatDifficultyLabel(point.entry.config)}, ${formatMetricValue(point.value, historyMetric)}, ${formatShortDate(point.entry.completedAt)}`}
                          >
                            <span className="stats-visual-chart-tooltip" role="tooltip">
                              <strong>{formatMetricValue(point.value, historyMetric)}</strong>
                              <span>{formatDifficultyLabel(point.entry.config)}</span>
                              <span>{formatShortDate(point.entry.completedAt)}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="stats-visual-axis-date stats-visual-axis-date-start">
                      {firstLineChartEntry ? formatShortDate(firstLineChartEntry.completedAt) : '--'}
                    </div>
                    <div className="stats-visual-axis-date stats-visual-axis-date-end">
                      {lastLineChartEntry ? formatShortDate(lastLineChartEntry.completedAt) : '--'}
                    </div>
                  </div>
                )}

                <div className="stats-visual-line-legend">
                  <span>{rangedHistory.length} Laeufe im Ausschnitt</span>
                  <span>{completionHistory.length} Laeufe gesamt</span>
                </div>
              </article>
            </>
          ) : null}

          {activeView === 'records' ? (
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

          {activeView === 'assistance' ? (
            <div className="stats-visual-assistance-grid">
              <article className="stats-report-card stats-visual-assistance-card">
                <span className="saved-games-kicker">Laufarten gesamt</span>
                <strong className="stats-report-card-value">{formatPercent(cleanRate)}</strong>
                <div className="stats-visual-stacked-bar is-large">
                  {assistanceSegments.map((segment) => (
                    <span
                      key={segment.label}
                      className={`stats-visual-stacked-segment ${segment.className}`}
                      style={{ width: `${Math.max(0, (segment.value / assistanceTotal) * 100)}%` }}
                    />
                  ))}
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
                  return (
                    <article key={row.option.key} className={`stats-visual-assistance-row${row.solveCount === 0 ? ' is-muted' : ''}`}>
                      <div>
                        <strong>{row.option.label}</strong>
                        <span>{row.solveCount} Siege</span>
                      </div>
                      <div className="stats-visual-stacked-bar">
                        <span className="stats-visual-stacked-segment is-clean" style={{ width: `${(row.cleanSolveCount / total) * 100}%` }} />
                        <span className="stats-visual-stacked-segment is-hinted" style={{ width: `${Math.max(0, (row.assistedSolveCount - row.autoAssistedSolveCount) / total) * 100}%` }} />
                        <span className="stats-visual-stacked-segment is-auto" style={{ width: `${(row.autoAssistedSolveCount / total) * 100}%` }} />
                        <span className="stats-visual-stacked-segment is-legacy" style={{ width: `${(row.legacySolveCount / total) * 100}%` }} />
                      </div>
                      <span>{formatPercent(row.cleanRate)}</span>
                    </article>
                  )
                })}
              </div>
            </div>
          ) : null}

          {activeView === 'raw' ? (
            <div className="stats-visual-raw-stack">
              <div className="stats-raw-overview-grid">
                {rawOverviewCards.map((card) => (
                  <article key={card.label} className="stats-report-card stats-raw-overview-card">
                    <span className="saved-games-kicker">{card.label}</span>
                    <strong className="stats-report-card-value">{card.value}</strong>
                    <p className="stats-report-card-copy">{card.detail}</p>
                  </article>
                ))}
              </div>

              <div className="stats-raw-field-groups" aria-label="Rohdaten kompakt">
                {rawFieldGroups.map((group) => (
                  <article key={group.title} className="stats-raw-field-group">
                    <div className="stats-raw-field-group-head">
                      <span className="saved-games-kicker">{group.title}</span>
                      <p>{group.description}</p>
                    </div>
                    <dl className="stats-raw-field-list">
                      {group.items.map((item) => (
                        <div key={`${group.title}-${item.label}`} className="stats-raw-field-row">
                          <dt>{item.label}</dt>
                          <dd>{item.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </article>
                ))}
              </div>

              <UploadStatsComparisonMatrix
                stats={stats}
                latestCompletion={latestCompletion}
                favoriteDifficulty={favoriteDifficulty}
                fastestDifficulty={fastestDifficulty}
                completionHistory={completionHistory}
                standardDifficultyStats={standardDifficultyStats}
                onReloadView={onReloadView}
                onBackToStart={onBackToStart}
                defaultOpen={false}
              />

              <UploadStatsDifficultyTable
                stats={stats}
                completionHistory={completionHistory}
                standardDifficultyStats={standardDifficultyStats}
                onReloadView={onReloadView}
                onBackToStart={onBackToStart}
                defaultOpen={false}
              />

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
                defaultOpen={false}
              />
            </div>
          ) : null}
        </div>
      </AnimatedSwapPane>

      {latestCompletion && activeView !== 'raw' ? (
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
