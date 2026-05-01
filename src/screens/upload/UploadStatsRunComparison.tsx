import type { RefObject } from 'react'
import { PuzzleCompletionRecord, PuzzleStats } from '../../types/index'
import { formatDifficultyLabel } from '../../utils/puzzleDifficulty.ts'
import {
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

function formatCount(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`
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
      label: `${deltaLabel} ${trend === 'better' ? 'naeher an' : 'weiter weg von'} ${targetLabel}`,
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

function formatAssistanceBreakdown(hintCount: number, suggestedMoveCount: number): string {
  return `${formatCount(hintCount, 'Hinweis', 'Hinweise')}, ${formatCount(
    suggestedMoveCount,
    'Auto-Zug',
    'Auto-Zuege'
  )}`
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
  const actionComparison = currentRun.hasDetailedProfile
    ? compareLowerIsBetterMetric(
        currentRun.actionMoves,
        previousRun?.hasDetailedProfile ? previousRun.actionMoves : null
      )
    : null
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
    createMovesDeltaBadge(movesComparison.deltaToPrevious, 'Zug', 'Zuege'),
    createBestGapBadge(
      movesGapComparison.currentGap,
      movesGapComparison.deltaToPreviousGap,
      movesGapComparison.trend,
      'Rekord erreicht',
      'Rekord',
      'Zug',
      'Zuege'
    ),
  ].filter((badge): badge is ComparisonBadge => badge !== null)

  const extraBadges = [
    extraComparison
      ? createMovesDeltaBadge(extraComparison.deltaToPrevious, 'Umweg', 'Umwege')
      : null,
    actionComparison
      ? createMovesDeltaBadge(actionComparison.deltaToPrevious, 'Aktion', 'Aktionen')
      : null,
  ].filter((badge): badge is ComparisonBadge => badge !== null)

  const assistanceBadges = [
    createAssistanceBadge(assistanceComparison.trend),
  ].filter((badge): badge is ComparisonBadge => badge !== null)

  const timeTone = resolveComparisonTone(timeComparison.trend, timeGapComparison.trend)
  const movesTone = resolveComparisonTone(movesComparison.trend, movesGapComparison.trend)
  const extraTone = resolveComparisonTone(
    extraComparison?.trend ?? 'unknown',
    actionComparison?.trend ?? 'unknown'
  )
  const assistanceTone = resolveComparisonTone(assistanceComparison.trend)

  const comparisonCopy = previousCompletion
    ? 'Der neueste Lauf wird direkt gegen den vorherigen Abschluss derselben Stufe und gegen die aktuellen Rekorde gestellt. So erkennst du sofort, ob du schneller, sparsamer oder sauberer warst.'
    : 'Der neueste Lauf wird bereits gegen die Rekorde dieser Stufe eingeordnet. Sobald der naechste Abschluss auf derselben Stufe dazukommt, erscheint hier automatisch auch der Direktvergleich zum vorigen Lauf.'

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
      <div className="stats-report-card-grid stats-report-run-card-grid">
        <article className={`stats-report-card stats-report-run-card${getToneClass(timeTone)}`}>
          <span className="saved-games-kicker">Zeit</span>
          <strong className="stats-report-card-value">{formatDuration(currentRun.time)}</strong>
          {timeBadges.length > 0 ? (
            <div className="stats-data-badges">
              {timeBadges.map((badge) => (
                <span
                  key={badge.label}
                  className={`stats-data-badge${badge.tone === 'positive' ? ' is-positive' : badge.tone === 'negative' ? ' is-negative' : ''}`}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          ) : null}
          <p className="stats-report-card-copy">
            {previousCompletion
              ? `Voriger Lauf: ${formatDuration(previousCompletion.time)} auf derselben Stufe.`
              : `Aktuelle Bestzeit auf ${difficultyLabel}: ${formatOptionalDuration(difficultyStats?.bestTime ?? null)}.`}
          </p>
        </article>

        <article className={`stats-report-card stats-report-run-card${getToneClass(movesTone)}`}>
          <span className="saved-games-kicker">Netto-Zuege</span>
          <strong className="stats-report-card-value">{currentRun.moves}</strong>
          {movesBadges.length > 0 ? (
            <div className="stats-data-badges">
              {movesBadges.map((badge) => (
                <span
                  key={badge.label}
                  className={`stats-data-badge${badge.tone === 'positive' ? ' is-positive' : badge.tone === 'negative' ? ' is-negative' : ''}`}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          ) : null}
          <p className="stats-report-card-copy">
            {currentRun.hasDetailedProfile
              ? `${currentRun.actionMoves} Aktionen, ${formatExtraMoves(currentExtraMoves)} Umwege.`
              : 'Nur Basiswerte fuer diesen Lauf vorhanden.'}
          </p>
        </article>

        <article className={`stats-report-card stats-report-run-card${getToneClass(extraTone)}`}>
          <span className="saved-games-kicker">Umwege</span>
          <strong className="stats-report-card-value">
            {currentExtraMoves === null ? '--' : formatExtraMoves(currentExtraMoves)}
          </strong>
          {extraBadges.length > 0 ? (
            <div className="stats-data-badges">
              {extraBadges.map((badge) => (
                <span
                  key={badge.label}
                  className={`stats-data-badge${badge.tone === 'positive' ? ' is-positive' : badge.tone === 'negative' ? ' is-negative' : ''}`}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          ) : null}
          <p className="stats-report-card-copy">
            {currentExtraMoves === null
              ? 'Ohne volles Laufprofil laesst sich die Effizienz ueber Zusatzaktionen nicht sauber vergleichen.'
              : previousExtraMoves === null
                ? `${currentRun.actionMoves} Aktionen insgesamt in diesem Lauf.`
                : `Voriger Lauf: ${formatExtraMoves(previousExtraMoves)} Umwege bei ${previousRun?.actionMoves ?? '--'} Aktionen.`}
          </p>
        </article>

        <article className={`stats-report-card stats-report-run-card${getToneClass(assistanceTone)}`}>
          <span className="saved-games-kicker">Laufart</span>
          <strong className="stats-report-card-value">
            {currentRun.hasDetailedProfile ? formatAssistanceModeLabel(currentRun.assistanceMode) : 'Legacy'}
          </strong>
          {assistanceBadges.length > 0 ? (
            <div className="stats-data-badges">
              {assistanceBadges.map((badge) => (
                <span
                  key={badge.label}
                  className={`stats-data-badge${badge.tone === 'positive' ? ' is-positive' : badge.tone === 'negative' ? ' is-negative' : ''}`}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          ) : null}
          <p className="stats-report-card-copy">
            {currentRun.hasDetailedProfile
              ? `Jetzt ${formatAssistanceBreakdown(currentRun.hintCount, currentRun.suggestedMoveCount)}.${previousRun?.hasDetailedProfile
                ? ` Davor ${formatAssistanceBreakdown(previousRun.hintCount, previousRun.suggestedMoveCount)}.`
                : ''}`
              : 'Der neueste Lauf enthaelt kein volles Hilfsprofil.'}
          </p>
        </article>
      </div>
    </UploadStatsSection>
  )
}
