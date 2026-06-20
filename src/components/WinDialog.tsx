import { useCallback, useId, useMemo, useRef, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Medal, MousePointer2, Route, Sparkles, Target, Timer, Trophy } from 'lucide-react'
import AnimatedButton from '../motion/AnimatedButton.tsx'
import AnimatedDialog from '../motion/AnimatedDialog.tsx'
import AnimatedReveal from '../motion/AnimatedReveal.tsx'
import AnimatedStaggerGroup from '../motion/AnimatedStaggerGroup.tsx'
import '../styles/components/windialog.css'
import {
  GalleryImageTag,
  GalleryChallengeTarget,
  ChallengeMedal,
  PuzzleAssistanceMode,
  PuzzleConfig,
  RecordPuzzleCompletionResult,
  WinStats,
} from '../types/index'
import type { TagCategoryCatalog } from '../services/tagCategories/tagCategoryTypes.ts'
import WinParticleEffect from './win-effects/WinParticleEffect.tsx'
import { resolveChallengeWinParticleSelection, resolveWinParticleSelection } from './win-effects/winParticleEffects.ts'
import { formatDifficultyLabel } from '../utils/puzzleDifficulty.ts'
import {
  formatChallengeMedalLabel,
  getChallengeMedalExplanation,
  getChallengeMedalRank,
  getNextChallengeMedalGoal,
  isChallengeCleanRun,
} from '../utils/galleryChallenge.ts'
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
  imageTags?: GalleryImageTag[]
  rejectedAiTags?: string[]
  tagCategoryCatalog?: TagCategoryCatalog | null
  challengeTarget?: GalleryChallengeTarget | null
  challengeMedal?: ChallengeMedal | null
  challengePreviousBestMedal?: ChallengeMedal | null
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
      return 'Mit Hilfen'
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

function formatUsageDuration(durationMs: number): string {
  return `${Math.round(durationMs / 1000)}s`
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
    formatCount(run.suggestedMoveCount, 'Auto-Zug', 'Auto-Zuege'),
    `${run.ghostUsageCount}x Ghost (${formatUsageDuration(run.ghostUsageDurationMs)})`,
    `${run.heatmapUsageCount}x Heatmap (${formatUsageDuration(run.heatmapUsageDurationMs)})`,
  ].join(', ')
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

function createTimeBadge(delta: number | null, difficultyLabel: string): WinComparisonBadge | null {
  if (delta === null) {
    return null
  }

  if (delta === 0) {
    return {
      label: `Gleich schnell wie letzter ${difficultyLabel}-Lauf`,
      tone: 'neutral',
    }
  }

  return {
    label: `${formatShortDuration(Math.abs(delta))} ${delta < 0 ? 'schneller' : 'langsamer'} als letzter ${difficultyLabel}-Lauf`,
    tone: delta < 0 ? 'positive' : 'negative',
  }
}

function createMovesBadge(delta: number | null, difficultyLabel: string): WinComparisonBadge | null {
  if (delta === null) {
    return null
  }

  if (delta === 0) {
    return {
      label: `Gleich viele Zuege wie letzter ${difficultyLabel}-Lauf`,
      tone: 'neutral',
    }
  }

  return {
    label: `${formatCount(Math.abs(delta), 'Zug', 'Zuege')} ${delta < 0 ? 'weniger' : 'mehr'} als letzter ${difficultyLabel}-Lauf`,
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
  trend: 'better' | 'worse' | 'same' | 'unknown',
  difficultyLabel: string
): WinComparisonBadge | null {
  switch (trend) {
    case 'better':
      return { label: `Sauberer als letzter ${difficultyLabel}-Lauf`, tone: 'positive' }
    case 'worse':
      return { label: `Mehr Hilfe als letzter ${difficultyLabel}-Lauf`, tone: 'negative' }
    case 'same':
      return { label: `Gleiche Hilfeart wie letzter ${difficultyLabel}-Lauf`, tone: 'neutral' }
    default:
      return null
  }
}

export default function WinDialog({
  stats,
  config,
  nextDifficultyLabel,
  completionResult,
  imageTags = [],
  rejectedAiTags = [],
  tagCategoryCatalog = null,
  challengeTarget = null,
  challengeMedal = null,
  challengePreviousBestMedal = null,
  onReplaySameImage,
  onGoToSelectionScreen,
  onChooseNewImage,
  onNextDifficulty,
}: WinDialogProps) {
  const replayButtonRef = useRef<HTMLButtonElement>(null)
  const motifParticleSelection = useMemo(
    () => resolveWinParticleSelection(imageTags, rejectedAiTags, tagCategoryCatalog),
    [imageTags, rejectedAiTags, tagCategoryCatalog]
  )
  const particleSelection = useMemo(
    () => challengeMedal
      ? resolveChallengeWinParticleSelection(challengeMedal, motifParticleSelection.primary)
      : motifParticleSelection,
    [challengeMedal, motifParticleSelection]
  )
  const keyboardHintId = useId()
  const difficultyLabel = formatDifficultyLabel(config)
  const currentRun = toComparableRun(stats)
  const previousRun = completionResult?.previousCompletion
    ? toComparableRun(completionResult.previousCompletion)
    : null
  const difficultyStats = completionResult?.difficultyStats ?? null
  const extraMoves = countExtraMoves(currentRun)
  const finalBoardTileCount = config.rows * config.cols
  const finalBoardStyle = {
    '--win-board-rows': config.rows,
    '--win-board-cols': config.cols,
  } as CSSProperties
  const achievementBadges = [
    completionResult?.isNewBestTime ? 'Bestzeit' : null,
    completionResult?.isNewBestMoves ? 'Zug-Rekord' : null,
    completionResult?.isNewBestCleanMoves ? 'Clean-Rekord' : null,
  ].filter((badge): badge is string => badge !== null)
  const hasAchievement = achievementBadges.length > 0
  const challengeMovesDelta = challengeTarget ? stats.moves - challengeTarget.moves : null
  const challengeTimeDelta = challengeTarget ? stats.time - challengeTarget.time : null
  const challengeMedalLabel = challengeMedal ? formatChallengeMedalLabel(challengeMedal) : null
  const isCleanChallengeRun = challengeTarget ? isChallengeCleanRun(stats) : false
  const challengeExplanation = challengeTarget
    ? getChallengeMedalExplanation(stats, challengeTarget, challengeMedal)
    : null
  const nextChallengeMedalGoal = challengeTarget
    ? getNextChallengeMedalGoal(stats, challengeTarget, challengeMedal)
    : null
  const challengeUpgradeLabel = challengeMedal
    ? challengePreviousBestMedal === null
      ? `Erste Challenge-Medaille: ${challengeMedalLabel}`
      : getChallengeMedalRank(challengeMedal) > getChallengeMedalRank(challengePreviousBestMedal)
        ? `Aufstieg: ${formatChallengeMedalLabel(challengePreviousBestMedal)} zu ${challengeMedalLabel}`
        : `Medaille bestaetigt: ${challengeMedalLabel}`
    : challengeTarget
      ? isCleanChallengeRun
        ? 'Challenge abgeschlossen: keine Medaille'
        : 'Mit Hilfe: als verwandter Uebungslauf gespeichert'
      : null
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
  const visualAidBadges = [
    currentRun.ghostUsageCount > 0
      ? `Ghost ${currentRun.ghostUsageCount}x / ${formatUsageDuration(currentRun.ghostUsageDurationMs)}`
      : null,
    currentRun.heatmapUsageCount > 0
      ? `Heatmap ${currentRun.heatmapUsageCount}x / ${formatUsageDuration(currentRun.heatmapUsageDurationMs)}`
      : null,
  ].filter((badge): badge is string => badge !== null)
  const comparisonCards: WinComparisonCard[] = completionResult
    ? [
        {
          label: 'Aktueller Lauf - Zeit',
          value: formatTime(currentRun.time),
          copy: previousRun
            ? `Letzter abgeschlossener ${difficultyLabel}-Lauf: ${formatTime(previousRun.time)}.`
            : `Noch kein vorheriger ${difficultyLabel}-Lauf. Stufen-Bestzeit: ${difficultyStats?.bestTime !== null && difficultyStats?.bestTime !== undefined ? formatTime(difficultyStats.bestTime) : '--'}.`,
          tone: resolveComparisonTone(timeComparison.trend, timeGapComparison.trend),
          badges: [
            createTimeBadge(timeComparison.deltaToPrevious, difficultyLabel),
            createBestGapBadge(
              timeGapComparison.currentGap,
              timeGapComparison.deltaToPreviousGap,
              timeGapComparison.trend,
              'Stufen-Bestzeit erreicht',
              'Stufen-Bestzeit',
              'Sek.',
              'Sek.',
              true
            ),
          ].filter((badge): badge is WinComparisonBadge => badge !== null),
        },
        {
          label: 'Aktueller Lauf - Netto-Zuege',
          value: `${currentRun.moves}`,
          copy: `${currentRun.actionMoves} Aktionen, ${extraMoves} Korrekturen in diesem Lauf.`,
          tone: resolveComparisonTone(movesComparison.trend, movesGapComparison.trend),
          badges: [
            createMovesBadge(movesComparison.deltaToPrevious, difficultyLabel),
            createBestGapBadge(
              movesGapComparison.currentGap,
              movesGapComparison.deltaToPreviousGap,
              movesGapComparison.trend,
              'Stufen-Zugrekord erreicht',
              'Stufen-Zugrekord',
              'Zug',
              'Zuege'
            ),
          ].filter((badge): badge is WinComparisonBadge => badge !== null),
        },
        {
          label: 'Aktueller Lauf - Laufart',
          value: formatAssistanceLabel(currentRun.assistanceMode),
          copy: previousRun?.hasDetailedProfile
            ? `Aktueller Lauf: ${formatAssistanceBreakdown(currentRun)}. Letzter ${difficultyLabel}-Lauf: ${formatAssistanceBreakdown(previousRun)}.`
            : `Aktueller Lauf: ${formatAssistanceBreakdown(currentRun)}. Kein vergleichbares Detailprofil vom letzten ${difficultyLabel}-Lauf.`,
          tone: resolveComparisonTone(assistanceComparison.trend),
          badges: [
            createAssistanceBadge(assistanceComparison.trend, difficultyLabel),
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
      overlayDecoration={<WinParticleEffect selection={particleSelection} />}
    >
      <AnimatedStaggerGroup level="medium">
        <AnimatedReveal className="win-hero" interaction="surface" level="medium">
          <div className="win-hero-aura" aria-hidden="true" />
          <div className="win-hero-row">
            <div className="win-icon-shell" aria-hidden="true">
              {hasAchievement || challengeTarget ? (
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
                {visualAidBadges.map((badge) => (
                  <span key={badge} className="win-tag">
                    {badge}
                  </span>
                ))}
                {achievementBadges.map((badge) => (
                  <span key={badge} className="win-tag win-tag-success">
                    {badge}
                  </span>
                ))}
                {challengeMedalLabel ? (
                  <span className={`win-tag win-tag-challenge is-${challengeMedal}`}>
                    Challenge: {challengeMedalLabel}
                  </span>
                ) : null}
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

        {challengeTarget ? (
          <AnimatedReveal
            className={`win-challenge-summary is-${challengeMedal ?? 'none'}`}
            interaction="surface"
            level="medium"
          >
            <div className="win-challenge-medal" aria-hidden="true">
              {challengeMedal ? (
                <Medal strokeWidth={2.2} absoluteStrokeWidth />
              ) : (
                <Target strokeWidth={2.2} absoluteStrokeWidth />
              )}
            </div>
            <div className="win-challenge-copy">
              <span className="win-kicker">
                {isCleanChallengeRun ? 'Challenge abgeschlossen' : 'Uebung abgeschlossen'}
              </span>
              <h3>{challengeMedalLabel ? `${challengeMedalLabel}-Medaille` : 'Keine Medaille'}</h3>
              <p>{challengeExplanation}</p>
              {challengeUpgradeLabel ? (
                <span className="win-challenge-upgrade">{challengeUpgradeLabel}</span>
              ) : null}
            </div>
            <div className="win-challenge-grid" aria-label="Vergleich mit der Challenge-Vorlage">
              <span>Zeit</span>
              <strong>{formatTime(stats.time)} / {formatTime(challengeTarget.time)}</strong>
              <em>{challengeTimeDelta !== null && challengeTimeDelta < 0 ? `${Math.abs(challengeTimeDelta)} Sek. schneller` : challengeTimeDelta === 0 ? 'Gleichstand' : `${challengeTimeDelta} Sek. langsamer`}</em>
              <span>Netto-Zuege</span>
              <strong>{stats.moves} / {challengeTarget.moves}</strong>
              <em>{challengeMovesDelta !== null && challengeMovesDelta < 0 ? `${Math.abs(challengeMovesDelta)} weniger` : challengeMovesDelta === 0 ? 'Gleichstand' : `${challengeMovesDelta} mehr`}</em>
            </div>
            {nextChallengeMedalGoal ? (
              <div className="win-challenge-next-goal">
                <span>
                  {nextChallengeMedalGoal.medal
                    ? `Fuer ${formatChallengeMedalLabel(nextChallengeMedalGoal.medal)}`
                    : 'Medaillenstatus'}
                </span>
                <strong>{nextChallengeMedalGoal.label}</strong>
              </div>
            ) : null}
          </AnimatedReveal>
        ) : null}

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
              <span className="win-kicker">Stufenvergleich</span>
              <p className="win-comparison-copy">
                Dieser Lauf gegen den zuletzt abgeschlossenen {difficultyLabel}-Lauf und deine persoenlichen Rekorde auf dieser Stufe.
              </p>
              {challengeTarget ? (
                <p className="win-comparison-context-note">
                  Die Challenge-Vorlage wird oben separat verglichen und ist nicht die Referenz dieser Karten.
                </p>
              ) : null}
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
