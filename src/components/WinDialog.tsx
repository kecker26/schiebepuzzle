import { useCallback, useId, useRef, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Medal, MousePointer2, Route, Sparkles, Timer, Trophy } from 'lucide-react'
import AnimatedButton from '../motion/AnimatedButton.tsx'
import BusyIndicator from '../motion/BusyIndicator.tsx'
import AnimatedDialog from '../motion/AnimatedDialog.tsx'
import AnimatedReveal from '../motion/AnimatedReveal.tsx'
import AnimatedStaggerGroup from '../motion/AnimatedStaggerGroup.tsx'
import '../styles/components/windialog.css'
import {
  PuzzleAssistanceMode,
  PuzzleConfig,
  RecordPuzzleCompletionResult,
  WinStats,
} from '../types/index'
import { formatDifficultyLabel } from '../utils/puzzleDifficulty.ts'
import {
  ComparisonTone,
  compareAssistance,
  compareGapToBest,
  compareLowerIsBetterMetric,
  countExtraMoves,
  resolveComparisonTone,
  toComparableRun,
} from '../utils/puzzleRunComparison.ts'

interface WinDialogProps {
  stats: WinStats
  config: PuzzleConfig
  nextDifficultyLabel: string | null
  completionResult: RecordPuzzleCompletionResult | null
  completionStatsError: string | null
  isRecordingStats: boolean
  onRetryStats: () => void
  onReplaySameImage: () => void
  onGoToSelectionScreen: () => void
  onChooseNewImage: () => void
  onNextDifficulty: () => void
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatAssistanceLabel(mode: PuzzleAssistanceMode): string {
  switch (mode) {
    case 'clean':
      return 'Sauber'
    case 'hinted':
      return 'Mit Hinweisen'
    case 'auto-assisted':
      return 'Mit Auto-Zuegen'
  }
}

interface WinComparisonBadge {
  label: string
  tone: ComparisonTone
}

interface WinComparisonCard {
  label: string
  value: string
  copy: string
  tone: ComparisonTone
  badges: WinComparisonBadge[]
}

function formatCount(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`
}

function formatShortDuration(seconds: number): string {
  if (seconds < 60) {
    return formatCount(seconds, 'Sek.', 'Sek.')
  }

  return formatTime(seconds)
}

function formatAssistanceBreakdown(hintCount: number, suggestedMoveCount: number): string {
  return `${formatCount(hintCount, 'Hinweis', 'Hinweise')}, ${formatCount(
    suggestedMoveCount,
    'Auto-Zug',
    'Auto-Zuege'
  )}`
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

function createTimeBadge(delta: number | null): WinComparisonBadge | null {
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

function createMovesBadge(delta: number | null): WinComparisonBadge | null {
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
    label: `${formatCount(Math.abs(delta), 'Zug', 'Zuege')} ${delta < 0 ? 'weniger' : 'mehr'}`,
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
): WinComparisonBadge | null {
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
      label: `${deltaLabel} ${trend === 'better' ? 'naeher am' : 'weiter weg vom'} ${targetLabel}`,
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
): WinComparisonBadge | null {
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

function getStatusMessage(
  difficultyLabel: string,
  completionResult: RecordPuzzleCompletionResult | null,
  completionStatsError: string | null,
  isRecordingStats: boolean
): string {
  if (isRecordingStats) {
    return 'Statistiken werden aktualisiert ...'
  }

  if (completionStatsError) {
    return completionStatsError
  }

  if (!completionResult) {
    return `Runde auf ${difficultyLabel} abgeschlossen.`
  }

  const difficultyStats = completionResult.difficultyStats
  const highlights: string[] = []

  if (completionResult.isNewBestTime) {
    highlights.push('Neue Bestzeit auf dieser Stufe.')
  }

  if (completionResult.isNewBestMoves) {
    highlights.push('Neuer Zug-Rekord auf dieser Stufe.')
  }

  if (completionResult.isNewBestCleanMoves) {
    highlights.push('Neuer Clean-Rekord.')
  }

  if (highlights.length > 0) {
    return highlights.join(' ')
  }

  if (difficultyStats.bestTime !== null && difficultyStats.bestMoves !== null) {
    return `Bestzeit ${formatTime(difficultyStats.bestTime)}. Bester Lauf ${difficultyStats.bestMoves} Zuege.`
  }

  if (difficultyStats.bestTime !== null) {
    return `Bestzeit auf dieser Stufe: ${formatTime(difficultyStats.bestTime)}.`
  }

  if (difficultyStats.bestMoves !== null) {
    return `Bester Lauf auf dieser Stufe: ${difficultyStats.bestMoves} Zuege.`
  }

  return `Runde auf ${difficultyLabel} abgeschlossen.`
}

export default function WinDialog({
  stats,
  config,
  nextDifficultyLabel,
  completionResult,
  completionStatsError,
  isRecordingStats,
  onRetryStats,
  onReplaySameImage,
  onGoToSelectionScreen,
  onChooseNewImage,
  onNextDifficulty,
}: WinDialogProps) {
  const replayButtonRef = useRef<HTMLButtonElement>(null)
  const keyboardHintId = useId()
  const difficultyLabel = formatDifficultyLabel(config)
  const currentRun = toComparableRun(stats)
  const previousRun = completionResult?.previousCompletion
    ? toComparableRun(completionResult.previousCompletion)
    : null
  const difficultyStats = completionResult?.difficultyStats ?? null
  const extraMoves = countExtraMoves(currentRun)
  const statusMessage = getStatusMessage(
    difficultyLabel,
    completionResult,
    completionStatsError,
    isRecordingStats
  )
  const finalBoardTileCount = config.rows * config.cols
  const finalBoardStyle = {
    '--win-board-rows': config.rows,
    '--win-board-cols': config.cols,
  } as CSSProperties
  const isStatusError = Boolean(!isRecordingStats && completionStatsError)
  const isStatusPending = Boolean(isRecordingStats)
  const achievementBadges = [
    completionResult?.isNewBestTime ? 'Bestzeit' : null,
    completionResult?.isNewBestMoves ? 'Zug-Rekord' : null,
    completionResult?.isNewBestCleanMoves ? 'Clean-Rekord' : null,
  ].filter((badge): badge is string => badge !== null)
  const hasAchievement = achievementBadges.length > 0
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
  const assistanceComparison = compareAssistance(currentRun, previousRun)
  const comparisonCards: WinComparisonCard[] = completionResult
    ? [
        {
          label: 'Zeit',
          value: formatTime(currentRun.time),
          copy: previousRun
            ? `Voriger Lauf: ${formatTime(previousRun.time)} auf derselben Stufe.`
            : `Aktuelle Bestzeit: ${difficultyStats?.bestTime !== null && difficultyStats?.bestTime !== undefined ? formatTime(difficultyStats.bestTime) : '--'}.`,
          tone: resolveComparisonTone(timeComparison.trend, timeGapComparison.trend),
          badges: [
            createTimeBadge(timeComparison.deltaToPrevious),
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
          ].filter((badge): badge is WinComparisonBadge => badge !== null),
        },
        {
          label: 'Netto-Zuege',
          value: `${currentRun.moves}`,
          copy: `${currentRun.actionMoves} Aktionen, ${extraMoves} Korrekturen in diesem Lauf.`,
          tone: resolveComparisonTone(movesComparison.trend, movesGapComparison.trend),
          badges: [
            createMovesBadge(movesComparison.deltaToPrevious),
            createBestGapBadge(
              movesGapComparison.currentGap,
              movesGapComparison.deltaToPreviousGap,
              movesGapComparison.trend,
              'Rekord erreicht',
              'Rekord',
              'Zug',
              'Zuege'
            ),
          ].filter((badge): badge is WinComparisonBadge => badge !== null),
        },
        {
          label: 'Laufart',
          value: formatAssistanceLabel(currentRun.assistanceMode),
          copy: previousRun?.hasDetailedProfile
            ? `Jetzt ${formatAssistanceBreakdown(currentRun.hintCount, currentRun.suggestedMoveCount)}. Davor ${formatAssistanceBreakdown(previousRun.hintCount, previousRun.suggestedMoveCount)}.`
            : `Dieser Lauf nutzte ${formatAssistanceBreakdown(currentRun.hintCount, currentRun.suggestedMoveCount)}.`,
          tone: resolveComparisonTone(assistanceComparison.trend),
          badges: [
            createAssistanceBadge(assistanceComparison.trend),
            currentRun.assistanceMode === 'clean'
              ? { label: 'Ohne Hilfe abgeschlossen', tone: 'positive' as const }
              : null,
          ].filter((badge): badge is WinComparisonBadge => badge !== null),
        },
      ]
    : []

  const handleActionKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
      return
    }

    const dialogElement = event.currentTarget.closest<HTMLElement>('.win-dialog')
    if (!dialogElement) {
      return
    }

    const buttons = Array.from(
      dialogElement.querySelectorAll<HTMLButtonElement>('button[data-win-dialog-action="true"]:not([disabled])')
    )
    const currentIndex = buttons.indexOf(event.currentTarget)
    if (currentIndex < 0) {
      return
    }

    const focusButtonAtIndex = (nextIndex: number) => {
      const targetButton = buttons[nextIndex]
      if (!targetButton) {
        return
      }

      event.preventDefault()
      targetButton.focus({ preventScroll: true })
    }

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        if (currentIndex > 0) {
          focusButtonAtIndex(currentIndex - 1)
        }
        return
      case 'ArrowRight':
      case 'ArrowDown':
        if (currentIndex < buttons.length - 1) {
          focusButtonAtIndex(currentIndex + 1)
        }
        return
      case 'Home':
        focusButtonAtIndex(0)
        return
      case 'End':
        focusButtonAtIndex(buttons.length - 1)
        return
    }
  }, [])

  return (
    <AnimatedDialog
      overlayClassName="win-overlay"
      dialogClassName="win-dialog"
      titleId="win-title"
      trapFocus
      restoreFocus
      lockScroll
      initialFocusRef={replayButtonRef}
    >
      <AnimatedStaggerGroup level="medium">
        <AnimatedReveal className="win-hero" interaction="surface" level="medium">
          <div className="win-hero-aura" aria-hidden="true" />
          <div className="win-hero-row">
            <div className="win-icon-shell" aria-hidden="true">
              {hasAchievement ? (
                <Trophy className="win-icon-symbol" strokeWidth={2.4} absoluteStrokeWidth />
              ) : (
                <Sparkles className="win-icon-symbol" strokeWidth={2.4} absoluteStrokeWidth />
              )}
            </div>
            <div className="win-hero-copy">
              <span className="win-kicker">Puzzle geloest</span>
              <h2 id="win-title">Gewonnen!</h2>
              <p className="win-message">
                Bild geloest in {formatTime(stats.time)} und {stats.moves} Zuegen.
              </p>
              <div className="win-hero-tags">
                <span className="win-tag win-tag-accent">{difficultyLabel}</span>
                <span className="win-tag">{formatAssistanceLabel(stats.assistanceMode)}</span>
                {achievementBadges.map((badge) => (
                  <span key={badge} className="win-tag win-tag-success">
                    {badge}
                  </span>
                ))}
              </div>
            </div>
            <div
              className={`win-final-board${Math.max(config.rows, config.cols) >= 5 ? ' is-dense' : ''}`}
              style={finalBoardStyle}
              aria-hidden="true"
            >
              {Array.from({ length: finalBoardTileCount }, (_, index) => (
                <span key={index} style={{ '--win-tile-index': index } as CSSProperties} />
              ))}
            </div>
          </div>
        </AnimatedReveal>

        <AnimatedStaggerGroup className="stats-display" level="subtle">
          <AnimatedReveal className="stat-item" interaction="surface" level="subtle">
            <span className="stat-label">
              <Route className="stat-icon" strokeWidth={2.2} absoluteStrokeWidth />
              <span>Netto-Zuege</span>
            </span>
            <span className="stat-value">{stats.moves}</span>
          </AnimatedReveal>
          <AnimatedReveal className="stat-item" interaction="surface" level="subtle">
            <span className="stat-label">
              <Timer className="stat-icon" strokeWidth={2.2} absoluteStrokeWidth />
              <span>Zeit</span>
            </span>
            <span className="stat-value">{formatTime(stats.time)}</span>
          </AnimatedReveal>
          <AnimatedReveal className="stat-item" interaction="surface" level="subtle">
            <span className="stat-label">
              <MousePointer2 className="stat-icon" strokeWidth={2.2} absoluteStrokeWidth />
              <span>Aktionen</span>
            </span>
            <span className="stat-value">{stats.actionMoves}</span>
          </AnimatedReveal>
          <AnimatedReveal className="stat-item" interaction="surface" level="subtle">
            <span className="stat-label">
              <Medal className="stat-icon" strokeWidth={2.2} absoluteStrokeWidth />
              <span>Korrekturen</span>
            </span>
            <span className="stat-value">{extraMoves}</span>
          </AnimatedReveal>
        </AnimatedStaggerGroup>

        {comparisonCards.length > 0 ? (
          <AnimatedReveal className="win-comparison" interaction="surface" level="medium">
            <div className="win-comparison-head">
              <span className="win-kicker">Direkter Vergleich</span>
              <p className="win-comparison-copy">
                Gegen den letzten Lauf und die Rekorde auf {difficultyLabel}.
              </p>
            </div>
            <AnimatedStaggerGroup className="win-comparison-grid" level="subtle">
              {comparisonCards.map((card) => (
                <AnimatedReveal
                  key={card.label}
                  className={`win-comparison-item${getToneClass(card.tone)}`}
                  interaction="surface"
                  level="subtle"
                >
                  <span className="win-comparison-label">{card.label}</span>
                  <span className="win-comparison-value">{card.value}</span>
                  {card.badges.length > 0 ? (
                    <div className="win-comparison-badges">
                      {card.badges.map((badge) => (
                        <span
                          key={badge.label}
                          className={`win-comparison-badge${badge.tone === 'positive' ? ' is-positive' : badge.tone === 'negative' ? ' is-negative' : ''}`}
                        >
                          {badge.label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <p className="win-comparison-card-copy">{card.copy}</p>
                </AnimatedReveal>
              ))}
            </AnimatedStaggerGroup>
          </AnimatedReveal>
        ) : null}

        <AnimatedReveal
          className={`win-status${isStatusError ? ' is-error' : ''}${isStatusPending ? ' is-pending' : ''}`}
          interaction="surface"
          level="medium"
        >
          <p className="win-status-copy">
            {isStatusPending ? <BusyIndicator /> : null}
            {statusMessage}
          </p>
          {isStatusError && (
            <AnimatedButton
              className="win-retry-btn"
              onClick={onRetryStats}
              onKeyDown={handleActionKeyDown}
              data-win-dialog-action="true"
              data-app-tooltip="Speichern der Siegstatistik erneut anstossen."
              data-app-tooltip-position="top"
              reveal
              revealLevel="subtle"
            >
              Erneut versuchen
            </AnimatedButton>
          )}
        </AnimatedReveal>

        <AnimatedStaggerGroup className="win-actions" level="subtle">
          <AnimatedButton
            ref={replayButtonRef}
            onClick={onReplaySameImage}
            onKeyDown={handleActionKeyDown}
            data-page-primary-focus="true"
            data-win-dialog-action="true"
            className="win-primary-btn"
            data-app-tooltip="Gleiches Motiv erneut spielen und im Zuschnitt anpassen."
            data-app-tooltip-position="top"
            reveal
            revealLevel="subtle"
          >
            Nochmal spielen
          </AnimatedButton>
          <AnimatedStaggerGroup className="win-actions-secondary" level="subtle">
            <AnimatedButton
              onClick={onNextDifficulty}
              onKeyDown={handleActionKeyDown}
              className="win-secondary-btn"
              data-win-dialog-action="true"
              disabled={!nextDifficultyLabel}
              data-app-tooltip={nextDifficultyLabel ? `Naechste Schwierigkeit starten: ${nextDifficultyLabel}.` : 'Keine hoehere Schwierigkeit verfuegbar.'}
              data-app-tooltip-position="top"
              reveal
              revealLevel="subtle"
            >
              {nextDifficultyLabel ? `Weiter: ${nextDifficultyLabel}` : 'Haerteste Stufe'}
            </AnimatedButton>
            <AnimatedButton
              onClick={onGoToSelectionScreen}
              onKeyDown={handleActionKeyDown}
              className="win-secondary-btn"
              data-win-dialog-action="true"
              data-app-tooltip="Zur Bildauswahl und den Datenbereichen wechseln."
              data-app-tooltip-position="top"
              reveal
              revealLevel="subtle"
            >
              Zur Auswahl
            </AnimatedButton>
            <AnimatedButton
              onClick={onChooseNewImage}
              onKeyDown={handleActionKeyDown}
              className="win-secondary-btn"
              data-win-dialog-action="true"
              data-app-tooltip="Zur Startseite der App wechseln."
              data-app-tooltip-position="top"
              reveal
              revealLevel="subtle"
            >
              Zur Startseite
            </AnimatedButton>
          </AnimatedStaggerGroup>
          <p id={keyboardHintId} className="win-actions-hint">
            Tastatur: Tab, Shift+Tab, Pfeile, Pos1 und Ende wechseln zwischen den Aktionen.
          </p>
        </AnimatedStaggerGroup>
      </AnimatedStaggerGroup>
    </AnimatedDialog>
  )
}
