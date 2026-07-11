import type { RefObject } from 'react'
import SpringNumber from '../../motion/SpringNumber.tsx'
import { PuzzleCompletionRecord, PuzzleStats } from '../../types/index'
import { formatDifficultyLabel } from '../../utils/puzzleDifficulty.ts'
import {
  ComparisonTrend,
  ComparisonTone,
  compareAssistance,
  compareGapToBest,
  compareLowerIsBetterMetric,
  countExtraMoves,
  isSamePuzzleConfig,
  resolveComparisonTone,
  toComparableRun,
} from '../../utils/puzzleRunComparison.ts'
import UploadStatsSection from './UploadStatsSection.tsx'
import {
  formatAssistanceModeLabel,
  formatDuration,
  formatExtraMoves,
  formatOptionalDuration,
  formatOptionalMoves,
} from './uploadUtils.ts'

interface UploadStatsRunComparisonProps {
  stats: PuzzleStats | null
  latestCompletion: PuzzleCompletionRecord | null
  completionHistory: PuzzleCompletionRecord[]
  onReloadView: () => void
  onBackToStart: () => void
  summaryButtonRef?: RefObject<HTMLButtonElement>
}

interface ComparisonBadge {
  label: string
  tone: ComparisonTone
}

interface RunVerdict {
  title: string
  copy: string
  tone: ComparisonTone
}

interface ComparisonTableRow {
  label: string
  current: string
  previous: string
  insight: string
  tone: ComparisonTone
  detail?: string
}

function formatCount(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`
}

function formatUsageDuration(durationMs: number): string {
  return `${Math.round(durationMs / 1000)}s`
}

function formatShortDuration(seconds: number): string {
  if (seconds < 60) {
    return formatCount(seconds, 'Sek.', 'Sek.')
  }

  return formatDuration(seconds)
}

function getToneClass(tone: ComparisonTone): string {
  switch (tone) {
    case 'positive':
      return ' is-positive'
    case 'negative':
      return ' is-negative'
    default:
      return ''
  }
}

function getComparisonCellClassName(tone: ComparisonTone): string {
  return `stats-run-comparison-insight${tone === 'positive' ? ' is-positive' : tone === 'negative' ? ' is-negative' : ''}`
}

function formatTrendPhrase(
  trend: ComparisonTrend,
  betterLabel: string,
  worseLabel: string,
  sameLabel: string,
  unknownLabel: string
): string {
  switch (trend) {
    case 'better':
      return betterLabel
    case 'worse':
      return worseLabel
    case 'same':
      return sameLabel
    default:
      return unknownLabel
  }
}

function formatBadgeSummary(badges: ComparisonBadge[], fallback: string): string {
  return badges.length > 0 ? badges.map((badge) => badge.label).join(' / ') : fallback
}

function createRunVerdict(
  previousCompletion: PuzzleCompletionRecord | null,
  timeTrend: ComparisonTrend,
  movesTrend: ComparisonTrend,
  assistanceTrend: ComparisonTrend,
  currentAssistanceModeLabel: string,
  difficultyLabel: string
): RunVerdict {
  if (!previousCompletion) {
    return {
      title: `Neuer Vergleich für ${difficultyLabel}`,
      copy: 'Dieser Lauf ist schon gegen die aktuellen Rekorde eingeordnet. Der Direktvergleich startet, sobald ein weiterer Abschluss derselben Stufe dazukommt.',
      tone: 'neutral',
    }
  }

  const timePhrase = formatTrendPhrase(timeTrend, 'schneller', 'langsamer', 'gleich schnell', 'zeitlich eingeordnet')
  const movesPhrase = formatTrendPhrase(movesTrend, 'sparsamer', 'mit mehr Zügen', 'gleich sparsam', 'nach Zügen eingeordnet')
  const assistancePhrase = formatTrendPhrase(
    assistanceTrend,
    'sauberer',
    'mit mehr Hilfe',
    currentAssistanceModeLabel === 'Clean' ? 'weiterhin clean' : 'gleich sauber',
    currentAssistanceModeLabel === 'Legacy-Daten' ? 'ohne volles Hilfsprofil' : currentAssistanceModeLabel
  )
  const positiveCount = [timeTrend, movesTrend, assistanceTrend].filter((trend) => trend === 'better').length
  const negativeCount = [timeTrend, movesTrend, assistanceTrend].filter((trend) => trend === 'worse').length
  const tone = positiveCount > 0 && negativeCount === 0
    ? 'positive'
    : negativeCount > 0 && positiveCount === 0
      ? 'negative'
      : 'neutral'

  return {
    title: `${capitalizeFirst(timePhrase)}, ${movesPhrase} und ${assistancePhrase}`,
    copy: 'Die wichtigsten Unterschiede stehen direkt in der Tabelle. Grüne Punkte markieren Verbesserungen, rote Punkte Verschlechterungen, neutrale Punkte gleich gebliebene Werte oder fehlende Vergleichsdaten.',
    tone,
  }
}

function capitalizeFirst(value: string): string {
  return value.length === 0 ? value : `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}

function createTimeDeltaBadge(delta: number | null): ComparisonBadge | null {
  if (delta === null) {
    return null
  }

  if (delta === 0) {
    return {
      label: 'Zeit wie zuletzt',
      tone: 'neutral',
    }
  }

  return {
    label: `${formatShortDuration(Math.abs(delta))} ${delta < 0 ? 'schneller' : 'langsamer'}`,
    tone: delta < 0 ? 'positive' : 'negative',
  }
}

function createMovesDeltaBadge(
  delta: number | null,
  singular: string,
  plural: string
): ComparisonBadge | null {
  if (delta === null) {
    return null
  }

  if (delta === 0) {
    return {
      label: 'Wie zuletzt',
      tone: 'neutral',
    }
  }

  return {
    label: `${formatCount(Math.abs(delta), singular, plural)} ${delta < 0 ? 'weniger' : 'mehr'}`,
    tone: delta < 0 ? 'positive' : 'negative',
  }
}

function createBestGapBadge(
  currentGap: number | null,
  deltaToPreviousGap: number | null,
  trend: 'better' | 'worse' | 'same' | 'unknown',
  zeroLabel: string,
  targetLabel: string,
  singular: string,
  plural: string,
  isTime: boolean = false
): ComparisonBadge | null {
  if (currentGap === null) {
    return null
  }

  if (currentGap === 0) {
    return {
      label: zeroLabel,
      tone: 'positive',
    }
  }

  if (deltaToPreviousGap !== null && trend !== 'unknown' && trend !== 'same') {
    const deltaLabel = isTime
      ? formatShortDuration(Math.abs(deltaToPreviousGap))
      : formatCount(Math.abs(deltaToPreviousGap), singular, plural)

    return {
      label: `${deltaLabel} ${trend === 'better' ? 'näher an' : 'weiter weg von'} ${targetLabel}`,
      tone: trend === 'better' ? 'positive' : 'negative',
    }
  }

  const remainingLabel = isTime
    ? formatShortDuration(currentGap)
    : formatCount(currentGap, singular, plural)

  return {
    label: `${remainingLabel} bis ${targetLabel}`,
    tone: 'neutral',
  }
}

function createAssistanceBadge(
  trend: 'better' | 'worse' | 'same' | 'unknown'
): ComparisonBadge | null {
  switch (trend) {
    case 'better':
      return { label: 'Sauberer als zuletzt', tone: 'positive' }
    case 'worse':
      return { label: 'Mehr Hilfe als zuletzt', tone: 'negative' }
    case 'same':
      return { label: 'Gleich sauber wie zuletzt', tone: 'neutral' }
    default:
      return null
  }
}

function formatAssistanceBreakdown(run: {
  hintCount: number
  suggestedMoveCount: number
  ghostUsageCount: number
  ghostUsageDurationMs: number
  heatmapUsageCount: number
  heatmapUsageDurationMs: number
}): string {
  return [
    formatCount(run.hintCount, 'Hinweis', 'Hinweise'),
    formatCount(run.suggestedMoveCount, 'Auto-Zug', 'Auto-Züge'),
    `${run.ghostUsageCount}x Ghost (${formatUsageDuration(run.ghostUsageDurationMs)})`,
    `${run.heatmapUsageCount}x Heatmap (${formatUsageDuration(run.heatmapUsageDurationMs)})`,
  ].join(', ')
}

export default function UploadStatsRunComparison({
  stats,
  latestCompletion,
  completionHistory,
  onReloadView,
  onBackToStart,
  summaryButtonRef,
}: UploadStatsRunComparisonProps) {
  if (!latestCompletion) {
    return null
  }

  const difficultyLabel = formatDifficultyLabel(latestCompletion.config)
  const previousCompletion = completionHistory.find(
    (entry) => entry.id !== latestCompletion.id && isSamePuzzleConfig(entry.config, latestCompletion.config)
  ) ?? null
  const difficultyStats = stats?.byDifficulty.find((entry) => (
    isSamePuzzleConfig(entry.config, latestCompletion.config)
  )) ?? null

  const currentRun = toComparableRun(latestCompletion)
  const previousRun = previousCompletion ? toComparableRun(previousCompletion) : null
  const currentExtraMoves = currentRun.hasDetailedProfile ? countExtraMoves(currentRun) : null
  const previousExtraMoves = previousRun?.hasDetailedProfile ? countExtraMoves(previousRun) : null

  const timeComparison = compareLowerIsBetterMetric(currentRun.time, previousRun?.time ?? null)
  const movesComparison = compareLowerIsBetterMetric(currentRun.moves, previousRun?.moves ?? null)
  const timeGapComparison = compareGapToBest(
    currentRun.time,
    previousRun?.time ?? null,
    difficultyStats?.bestTime ?? null
  )
  const movesGapComparison = compareGapToBest(
    currentRun.moves,
    previousRun?.moves ?? null,
    difficultyStats?.bestMoves ?? null
  )
  const extraComparison = currentExtraMoves === null
    ? null
    : compareLowerIsBetterMetric(currentExtraMoves, previousExtraMoves)
  const assistanceComparison = compareAssistance(currentRun, previousRun)

  const timeBadges = [
    createTimeDeltaBadge(timeComparison.deltaToPrevious),
    createBestGapBadge(
      timeGapComparison.currentGap,
      timeGapComparison.deltaToPreviousGap,
      timeGapComparison.trend,
      'Bestzeit erreicht',
      'Bestzeit',
      'Sek.',
      'Sek.',
      true
    ),
  ].filter((badge): badge is ComparisonBadge => badge !== null)

  const movesBadges = [
    createMovesDeltaBadge(movesComparison.deltaToPrevious, 'Zug', 'Züge'),
    createBestGapBadge(
      movesGapComparison.currentGap,
      movesGapComparison.deltaToPreviousGap,
      movesGapComparison.trend,
      'Rekord erreicht',
      'Rekord',
      'Zug',
      'Züge'
    ),
  ].filter((badge): badge is ComparisonBadge => badge !== null)

  const extraBadges = [
    extraComparison
      ? createMovesDeltaBadge(extraComparison.deltaToPrevious, 'Korrektur', 'Korrekturen')
      : null,
  ].filter((badge): badge is ComparisonBadge => badge !== null)

  const assistanceBadges = [
    createAssistanceBadge(assistanceComparison.trend),
  ].filter((badge): badge is ComparisonBadge => badge !== null)

  const timeTone = resolveComparisonTone(timeComparison.trend, timeGapComparison.trend)
  const movesTone = resolveComparisonTone(movesComparison.trend, movesGapComparison.trend)
  const extraTone = resolveComparisonTone(extraComparison?.trend ?? 'unknown')
  const assistanceTone = resolveComparisonTone(assistanceComparison.trend)
  const currentAssistanceLabel = currentRun.hasDetailedProfile
    ? formatAssistanceModeLabel(currentRun.assistanceMode)
    : 'Legacy-Daten'
  const verdict = createRunVerdict(
    previousCompletion,
    timeComparison.trend,
    movesComparison.trend,
    assistanceComparison.trend,
    currentAssistanceLabel,
    difficultyLabel
  )
  const comparisonRows: ComparisonTableRow[] = [
    {
      label: 'Zeit',
      current: formatDuration(currentRun.time),
      previous: previousCompletion
        ? formatDuration(previousCompletion.time)
        : `Rekord ${formatOptionalDuration(difficultyStats?.bestTime ?? null)}`,
      insight: formatBadgeSummary(timeBadges, previousCompletion ? 'Zeit wie zuletzt' : 'Noch kein Vorlauf'),
      tone: timeTone,
    },
    {
      label: 'Züge',
      current: `${currentRun.moves}`,
      previous: previousRun
        ? `${previousRun.moves}`
        : `Rekord ${formatOptionalMoves(difficultyStats?.bestMoves ?? null)}`,
      insight: formatBadgeSummary(movesBadges, previousCompletion ? 'Züge wie zuletzt' : 'Noch kein Vorlauf'),
      tone: movesTone,
      detail: 'Reine Puzzle-Züge bis zur Lösung.',
    },
    {
      label: 'Rücknahmen',
      current: formatExtraMoves(currentExtraMoves),
      previous: previousRun
        ? previousExtraMoves === null ? 'Vorlauf ohne Profil' : formatExtraMoves(previousExtraMoves)
        : '--',
      insight: formatBadgeSummary(extraBadges, currentExtraMoves === null ? 'Ohne Laufprofil' : 'Keine Veränderung'),
      tone: extraTone,
      detail: 'Rücknahmen sind Zusatzaktionen über die eigentlichen Puzzle-Züge hinaus.',
    },
    {
      label: 'Hilfen & Sauberkeit',
      current: currentAssistanceLabel,
      previous: previousRun?.hasDetailedProfile
        ? formatAssistanceModeLabel(previousRun.assistanceMode)
        : previousRun ? 'Legacy-Daten' : '--',
      insight: formatBadgeSummary(assistanceBadges, currentRun.hasDetailedProfile ? 'Kein Hilfsvergleich' : 'Ohne Hilfsprofil'),
      tone: assistanceTone,
      detail: currentRun.hasDetailedProfile
        ? `Jetzt ${formatAssistanceBreakdown(currentRun)}.${previousRun?.hasDetailedProfile
          ? ` Davor ${formatAssistanceBreakdown(previousRun)}.`
          : ''}`
        : 'Der neueste Lauf enthält kein volles Hilfsprofil.',
    },
  ]

  const comparisonCopy = previousCompletion
    ? 'Der neueste Lauf wird gegen den vorherigen Abschluss derselben Stufe und gegen die aktuellen Rekorde gestellt.'
    : 'Der neueste Lauf wird bereits gegen die Rekorde dieser Stufe eingeordnet.'

  return (
    <UploadStatsSection
      id="stats-report-run-comparison"
      kicker="Laufvergleich"
      title="Letzten Lauf direkt einordnen"
      copy={comparisonCopy}
      summaryMeta={
        <>
          <span className="stats-report-summary-pill">Zuletzt {difficultyLabel}</span>
          <span className="stats-report-summary-pill">
            {previousCompletion ? 'Voriger Lauf vorhanden' : 'Noch kein Vorlauf'}
          </span>
          <span className="stats-report-summary-pill">
            {currentRun.hasDetailedProfile
              ? formatAssistanceModeLabel(currentRun.assistanceMode)
              : 'Legacy-Daten'}
          </span>
        </>
      }
      collapsible
      defaultOpen
      onReloadView={onReloadView}
      onBackToStart={onBackToStart}
      summaryButtonRef={summaryButtonRef}
    >
      <div className="stats-run-comparison-layout">
        <section className={`stats-report-card stats-report-run-verdict${getToneClass(verdict.tone)}`}>
          <div className="stats-run-verdict-main">
            <span className="saved-games-kicker">Fazit</span>
            <strong>{verdict.title}</strong>
            <p>{verdict.copy}</p>
          </div>

          <div className="stats-run-verdict-metrics" aria-label="Aktuelle Werte">
            <span>
              <small>Stufe</small>
              <strong>{difficultyLabel}</strong>
            </span>
            <span>
              <small>Zeit</small>
              <strong>
                <SpringNumber value={currentRun.time} from={0} durationMs={1700} formatter={(value) => formatDuration(Math.round(value))} />
              </strong>
            </span>
            <span>
              <small>Züge</small>
              <strong>
                <SpringNumber value={currentRun.moves} from={0} durationMs={1700} />
              </strong>
            </span>
            <span>
              <small>Rücknahmen</small>
              <strong>
                <SpringNumber
                  value={currentExtraMoves}
                  from={0}
                  durationMs={1700}
                  fallback="--"
                  formatter={(value) => formatExtraMoves(Math.round(value))}
                />
              </strong>
            </span>
          </div>
        </section>

        <div className="stats-run-comparison-table-shell">
          <table className="stats-run-comparison-table">
            <caption>Direktvergleich des letzten Laufs</caption>
            <thead>
              <tr>
                <th scope="col">Wert</th>
                <th scope="col">Dieser Lauf</th>
                <th scope="col">Vergleich</th>
                <th scope="col">Einordnung</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">
                    <span>{row.label}</span>
                    {row.detail ? <small>{row.detail}</small> : null}
                  </th>
                  <td>{row.current}</td>
                  <td>{row.previous}</td>
                  <td>
                    <span className={getComparisonCellClassName(row.tone)}>{row.insight}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </UploadStatsSection>
  )
}
