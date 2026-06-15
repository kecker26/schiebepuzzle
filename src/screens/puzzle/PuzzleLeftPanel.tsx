import { AnimatePresence } from 'motion/react'
import type { ChangeEvent, RefObject } from 'react'
import { Medal, Trophy } from 'lucide-react'
import PuzzleScreenIcon from '../../components/PuzzleScreenIcon.tsx'
import AnimatedButton from '../../motion/AnimatedButton.tsx'
import AnimatedReveal from '../../motion/AnimatedReveal.tsx'
import AnimatedStateSwap from '../../motion/AnimatedStateSwap.tsx'
import AnimatedStaggerGroup from '../../motion/AnimatedStaggerGroup.tsx'
import BusyIndicator from '../../motion/BusyIndicator.tsx'
import SpringNumber from '../../motion/SpringNumber.tsx'
import { type PuzzleProgressMetrics } from '../../services/PuzzleSolver.ts'
import {
  type GalleryChallengeTarget,
  type GhostPreviewMode,
  type HeatmapMode,
  type PuzzleAssistanceMode,
} from '../../types/index'
import { deriveLiveChallengeForecast, formatChallengeMedalLabel } from '../../utils/galleryChallenge.ts'
import { formatDifficultyLabel } from '../../utils/puzzleDifficulty.ts'
import {
  formatElapsedTime,
  getProgressStatusLabel,
  type HintDirection,
  type SuggestedHintPreview,
} from './puzzleScreenUtils.ts'

interface PuzzleLeftPanelProps {
  config: { rows: number; cols: number }
  moveCount: number
  actionMoves: number
  optimalMoveSummary: string
  isImprovingStartSolution?: boolean
  challengeTarget?: GalleryChallengeTarget | null
  assistanceMode: PuzzleAssistanceMode
  elapsedTime: number
  progressMetrics: PuzzleProgressMetrics | null
  hintPreview: SuggestedHintPreview | null
  isComputingSuggestion: boolean
  isInteractionLocked: boolean
  isPaused: boolean
  isPreviewVisible: boolean
  isGhostPreviewVisible: boolean
  isHeatmapOverlayVisible: boolean
  areTileNumbersVisible: boolean
  ghostPreviewMode: GhostPreviewMode
  ghostPreviewWeight: number
  heatmapMode: HeatmapMode
  heatmapIntensity: number
  areHeatmapDistancesVisible: boolean
  moveHistoryLength: number
  redoHistoryLength: number
  onShowHint: () => void
  onTogglePause: () => void
  onSuggestedMove: () => void
  onTogglePreview: () => void
  onToggleGhostPreview: () => void
  onToggleHeatmapOverlay: () => void
  onShowTileNumbers: () => void
  onGhostPreviewModeChange: (mode: GhostPreviewMode) => void
  onGhostPreviewWeightChange: (event: ChangeEvent<HTMLInputElement>) => void
  onHeatmapModeChange: (mode: HeatmapMode) => void
  onHeatmapIntensityChange: (event: ChangeEvent<HTMLInputElement>) => void
  onToggleHeatmapDistances: () => void
  onUndo: () => void
  onRedo: () => void
  onQuit: () => void
  onOpenHelp: () => void
  actionButtonRefs: {
    hint: RefObject<HTMLButtonElement>
    suggestedMove: RefObject<HTMLButtonElement>
    preview: RefObject<HTMLButtonElement>
    ghostPreview: RefObject<HTMLButtonElement>
    heatmap: RefObject<HTMLButtonElement>
    tileNumbers: RefObject<HTMLButtonElement>
    undo: RefObject<HTMLButtonElement>
    redo: RefObject<HTMLButtonElement>
    helpTrigger: RefObject<HTMLButtonElement>
    quit: RefObject<HTMLButtonElement>
    pause: RefObject<HTMLButtonElement>
  }
}

const GHOST_PREVIEW_MODE_OPTIONS: Array<{
  value: GhostPreviewMode
  label: string
  sliderLabel: string
  description: string
}> = [
  {
    value: 'image',
    label: 'Vollbild',
    sliderLabel: 'Originalbild',
    description: 'Zeigt das Motiv flaechig und halbtransparent ueber den noch offenen Kacheln.',
  },
  {
    value: 'contours',
    label: 'Konturen',
    sliderLabel: 'Konturen',
    description: 'Hebt groessere Formen und Bilduebergaenge hervor, ohne das ganze Foto voll auszuspielen.',
  },
  {
    value: 'edges',
    label: 'Kanten',
    sliderLabel: 'Kanten',
    description: 'Reduziert die Hilfe auf harte Linien und markante Umrisse fuer eine sparsame Orientierung.',
  },
]

const HEATMAP_MODE_OPTIONS: Array<{
  value: HeatmapMode
  label: string
  description: string
}> = [
  {
    value: 'classic',
    label: 'Farbflaechen',
    description: 'Faerbt falsch platzierte Kacheln entsprechend ihrer Entfernung zum Ziel. X+ zeigt rechts, Y+ zeigt oben.',
  },
  {
    value: 'arrows',
    label: 'Pfeile',
    description: 'Zeigt auf jeder falsch platzierten Kachel die direkte Richtung zur Zielposition.',
  },
  {
    value: 'delta',
    label: 'Verlauf',
    description: 'Vergleicht die Zieldistanz jeder Kachel mit den letzten bis zu fuenf Zuegen.',
  },
]

function HintDirectionIcon({ direction }: { direction: HintDirection }) {
  const rotation =
    direction === 'up'
      ? 'rotate(0 12 12)'
      : direction === 'right'
        ? 'rotate(90 12 12)'
        : direction === 'down'
          ? 'rotate(180 12 12)'
          : 'rotate(270 12 12)'

  return (
    <svg viewBox="0 0 24 24" focusable="false">
      <g transform={rotation}>
        <path d="M12 4v15" />
        <path d="M7 9l5-5 5 5" />
      </g>
    </svg>
  )
}

function HintPositionGrid({
  config,
  hintPreview,
}: {
  config: { rows: number; cols: number }
  hintPreview: SuggestedHintPreview
}) {
  const cells = Array.from({ length: config.rows * config.cols }, (_, index) => index)

  return (
    <div
      className="puzzle-hint-position-grid"
      style={{
        gridTemplateColumns: `repeat(${config.cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${config.rows}, minmax(0, 1fr))`,
      }}
      aria-hidden="true"
    >
      {cells.map((index) => {
        const row = Math.floor(index / config.cols)
        const col = index % config.cols
        const isCurrent = row === hintPreview.currentRow && col === hintPreview.currentCol
        const isTarget = row === hintPreview.targetRow && col === hintPreview.targetCol

        return (
          <span
            key={index}
            className={
              'puzzle-hint-position-cell'
              + (isCurrent ? ' is-current' : '')
              + (isTarget ? ' is-target' : '')
            }
          />
        )
      })}
    </div>
  )
}

function formatSignedDelta(delta: number, suffix: string = ''): string {
  if (delta === 0) return `±0${suffix}`
  return `${delta > 0 ? '+' : '-'}${Math.abs(delta)}${suffix}`
}

export default function PuzzleLeftPanel({
  config,
  moveCount,
  actionMoves,
  optimalMoveSummary,
  isImprovingStartSolution = false,
  challengeTarget,
  assistanceMode,
  elapsedTime,
  progressMetrics,
  hintPreview,
  isComputingSuggestion,
  isInteractionLocked,
  isPaused,
  isPreviewVisible,
  isGhostPreviewVisible,
  isHeatmapOverlayVisible,
  areTileNumbersVisible,
  ghostPreviewMode,
  ghostPreviewWeight,
  heatmapMode,
  heatmapIntensity,
  areHeatmapDistancesVisible,
  moveHistoryLength,
  redoHistoryLength,
  onShowHint,
  onTogglePause,
  onSuggestedMove,
  onTogglePreview,
  onToggleGhostPreview,
  onToggleHeatmapOverlay,
  onShowTileNumbers,
  onGhostPreviewModeChange,
  onGhostPreviewWeightChange,
  onHeatmapModeChange,
  onHeatmapIntensityChange,
  onToggleHeatmapDistances,
  onUndo,
  onRedo,
  onQuit,
  onOpenHelp,
  actionButtonRefs,
}: PuzzleLeftPanelProps) {
  const difficultyLabel = formatDifficultyLabel(config)
  const playableTileCount = Math.max(0, config.rows * config.cols - 1)
  const remainingCorrectableTiles = progressMetrics
    ? Math.max(0, progressMetrics.totalTiles - progressMetrics.correctTiles)
    : playableTileCount
  const progressStatusLabel = getProgressStatusLabel(progressMetrics?.progressPercent)
  const canUseBoardTools = progressMetrics !== null && !isPaused
  const canTriggerSuggestion = canUseBoardTools && !isInteractionLocked
  const activeGhostPreviewMode =
    GHOST_PREVIEW_MODE_OPTIONS.find((option) => option.value === ghostPreviewMode) ?? GHOST_PREVIEW_MODE_OPTIONS[0]
  const activeHeatmapMode =
    HEATMAP_MODE_OPTIONS.find((option) => option.value === heatmapMode) ?? HEATMAP_MODE_OPTIONS[0]
  const challengeMovesDelta = challengeTarget ? moveCount - challengeTarget.moves : 0
  const challengeTimeDelta = challengeTarget ? elapsedTime - challengeTarget.time : 0
  const challengeForecast = challengeTarget
    ? deriveLiveChallengeForecast({ moves: moveCount, time: elapsedTime, assistanceMode }, challengeTarget)
    : null
  const challengeForecastLabel = challengeForecast?.medal
    ? formatChallengeMedalLabel(challengeForecast.medal)
    : 'Keine Medaille'

  return (
    <AnimatedStaggerGroup
      as="aside"
      className="puzzle-top-controls puzzle-side-panel puzzle-side-panel-left"
      aria-label="Werkzeuge, Rundenstatus und Hilfen"
      level="medium"
    >
      <AnimatedReveal className="puzzle-header" level="medium">
        <div className="puzzle-brand">
          <span className="puzzle-kicker">Aktive Runde</span>
          <div className="puzzle-title-row">
            <h2>Schiebepuzzle</h2>
            <span className="puzzle-difficulty-pill">{difficultyLabel}</span>
            <button
              type="button"
              className="puzzle-help-trigger"
              ref={actionButtonRefs.helpTrigger}
              onClick={onOpenHelp}
              aria-label="Hilfe und Tastenkuerzel anzeigen"
              aria-keyshortcuts="F1"
              data-puzzle-allow-hotkeys="true"
              data-app-tooltip="Kontextbezogene Hilfe und alle Puzzle-Shortcuts anzeigen."
              data-app-tooltip-align="start"
            >
              ?
            </button>
          </div>
          <p className="puzzle-subtitle">
            {progressMetrics
              ? `${progressStatusLabel}. Noch ${remainingCorrectableTiles} Kacheln offen.`
              : `${difficultyLabel} mit ${playableTileCount} Kacheln.`}
          </p>
          <div className="puzzle-header-shortcuts" aria-label="Wichtige Tastaturbefehle">
            <span className="puzzle-header-shortcut">
              <span className="puzzle-header-shortcut-key" aria-hidden="true">P</span>
              <span className="puzzle-header-shortcut-copy">Pause</span>
            </span>
            <span className="puzzle-header-shortcut">
              <span className="puzzle-header-shortcut-key" aria-hidden="true">B</span>
              <span className="puzzle-header-shortcut-copy">Brettfokus</span>
            </span>
            <span className="puzzle-header-shortcut">
              <span className="puzzle-header-shortcut-key" aria-hidden="true">Pfeile / WASD</span>
              <span className="puzzle-header-shortcut-copy">Bewegen</span>
            </span>
            <span className="puzzle-header-shortcut">
              <span className="puzzle-header-shortcut-key" aria-hidden="true">F1 / ?</span>
              <span className="puzzle-header-shortcut-copy">Hilfe</span>
            </span>
          </div>
          {challengeTarget && (
            <div
              className={`puzzle-challenge-badge is-${challengeForecast?.medal ?? 'none'}`}
              aria-label={`Challenge aktiv. Beste noch erreichbare Medaille: ${challengeForecastLabel}.`}
            >
              <span className="puzzle-challenge-badge-label">
                <Trophy aria-hidden="true" size={14} strokeWidth={2.3} />
                Live-Zielvergleich
              </span>
              <AnimatedStateSwap
                stateKey={challengeForecast?.medal ?? 'none'}
                className="puzzle-challenge-forecast-swap"
              >
                <span className="puzzle-challenge-badge-status">
                  <Medal aria-hidden="true" size={18} strokeWidth={2.4} />
                  Beste noch erreichbar: {challengeForecastLabel}
                </span>
              </AnimatedStateSwap>
              <span className={`puzzle-challenge-badge-detail${challengeForecast?.movesReached ? ' is-positive' : ' is-negative'}`}>
                Netto-Zuege: {moveCount} / {challengeTarget.moves} ({formatSignedDelta(challengeMovesDelta)})
              </span>
              <span className={`puzzle-challenge-badge-detail${challengeForecast?.timeReached ? ' is-positive' : ' is-negative'}`}>
                Zeit: {formatElapsedTime(elapsedTime)} / {formatElapsedTime(challengeTarget.time)} ({formatSignedDelta(challengeTimeDelta, 's')})
              </span>
              <span className={`puzzle-challenge-badge-detail${challengeForecast?.isClean ? ' is-positive' : ' is-negative'}`}>
                {challengeForecast?.isClean
                  ? challengeForecast?.goldAvailable
                    ? 'Ohne Hilfe: Gold bleibt erreichbar'
                    : challengeForecast?.medal === 'diamond'
                      ? 'Vorlage ist optimal: Gold wird uebersprungen, Diamant bleibt erreichbar'
                      : 'Vorlage ist optimal: Gold ist nicht erreichbar'
                  : 'Hilfe genutzt: Gold und Diamant sind fuer diesen Lauf nicht mehr erreichbar'}
              </span>
              {!challengeForecast?.diamondAvailable ? (
                <span className="puzzle-challenge-badge-detail is-muted">
                  Diamant ist ohne exakte optimale Zugzahl nicht verfuegbar.
                </span>
              ) : null}
              <span className="puzzle-challenge-badge-detail is-muted">
                Aktionen: {actionMoves} / {challengeTarget.actionMoves}
              </span>
            </div>
          )}
        </div>

        <div className="puzzle-stats" aria-label="Aktuelle Spielstatistik">
            <div className="puzzle-stat-card">
            <div className="puzzle-stat-head">
              <span className="puzzle-stat-icon-shell" aria-hidden="true">
                <PuzzleScreenIcon name="route" className="puzzle-stat-icon" />
              </span>
              <span className="puzzle-stat-label">Deine Zuege</span>
            </div>
            <strong className="puzzle-stat-value">
              <SpringNumber value={moveCount} />
            </strong>
            <span className="puzzle-stat-detail" data-app-tooltip="Deine gespielten Aktionen im Vergleich zum berechneten Optimalweg." data-app-tooltip-align="start">
              {isImprovingStartSolution ? <BusyIndicator /> : null}
              {optimalMoveSummary}
            </span>
          </div>
          <div className="puzzle-stat-card" data-app-tooltip="Laufzeit dieser Runde. Sie wird beim Sieg in Statistik und Galerie gespeichert." data-app-tooltip-align="start">
            <div className="puzzle-stat-head">
              <span className="puzzle-stat-icon-shell" aria-hidden="true">
                <PuzzleScreenIcon name="timer" className="puzzle-stat-icon" />
              </span>
              <span className="puzzle-stat-label">Zeit</span>
            </div>
            <strong className="puzzle-stat-value">
              <SpringNumber value={elapsedTime} formatter={(value) => formatElapsedTime(Math.round(value))} />
            </strong>
            <span className="puzzle-stat-detail">Aktuelle Runde</span>
          </div>
        </div>
      </AnimatedReveal>

      <div className="puzzle-primary-stack">
        <AnimatePresence initial={false}>
          {progressMetrics && (
            <AnimatedReveal
              key="puzzle-progress"
              className="puzzle-progress-panel"
              interaction="surface"
              level="medium"
              aria-live="polite"
            >
              <div className="puzzle-progress-copy">
                <div className="puzzle-progress-topline">
                  <span className="puzzle-panel-kicker">
                    <span className="puzzle-panel-kicker-icon-shell" aria-hidden="true">
                      <PuzzleScreenIcon name="crosshair" className="puzzle-panel-kicker-icon" />
                    </span>
                    <span className="puzzle-progress-kicker">Loesungsnaehe</span>
                  </span>
                  <span className="puzzle-progress-state">{progressStatusLabel}</span>
                </div>
                <div className="puzzle-progress-values">
                  <strong className="puzzle-progress-value">{progressMetrics.progressPercent}%</strong>
                  <span className="puzzle-progress-detail">
                    {progressMetrics.correctTiles} von {progressMetrics.totalTiles} Kacheln korrekt
                  </span>
                </div>
              </div>
              <div className="puzzle-progress-track-wrap">
                <div className="puzzle-progress-track" aria-hidden="true">
                  <div
                    className="puzzle-progress-fill"
                    style={{ width: `${progressMetrics.progressPercent}%` }}
                  />
                </div>
                <div className="puzzle-progress-scale" aria-hidden="true">
                  <span>Start</span>
                  <span>Mitte</span>
                  <span>Ziel</span>
                </div>
              </div>
            </AnimatedReveal>
          )}
        </AnimatePresence>

        <AnimatedReveal
          className={`puzzle-hint-panel${hintPreview ? ' is-active' : ''}${isComputingSuggestion ? ' is-computing' : ''}`}
          interaction="surface"
          level="medium"
        >
          <div className="puzzle-hint-header">
            <span className="puzzle-panel-kicker">
              <span className="puzzle-panel-kicker-icon-shell" aria-hidden="true">
                <PuzzleScreenIcon name="lightbulb" className="puzzle-panel-kicker-icon" />
              </span>
              <span className="puzzle-hint-kicker">Naechster Hinweis</span>
            </span>
            {hintPreview && (
              <span
                className="puzzle-hint-details"
                data-app-tooltip={`${hintPreview.sourceLabel}. Sicherheit ${hintPreview.confidenceLabel}.`}
                data-app-tooltip-align="start"
              >
                Hinweisdetails
              </span>
            )}
          </div>

          {hintPreview ? (
            <>
              <div className="puzzle-hint-direction-row">
                <span className="puzzle-hint-arrow" aria-hidden="true">
                  <HintDirectionIcon direction={hintPreview.direction} />
                </span>
                <div className="puzzle-hint-copy">
                  <strong>{hintPreview.actionLabel}</strong>
                  <span>{hintPreview.description}</span>
                  <span className="puzzle-hint-strategy-label">{hintPreview.strategyLabel}</span>
                </div>
              </div>
              {hintPreview.objectiveLabel && (
                <div className="puzzle-hint-objective">
                  <span className="puzzle-hint-objective-kicker">Teilziel</span>
                  <strong>{hintPreview.objectiveLabel}</strong>
                  {hintPreview.objectiveDetail && <span>{hintPreview.objectiveDetail}</span>}
                </div>
              )}
              <div className="puzzle-hint-position-card">
                <HintPositionGrid config={config} hintPreview={hintPreview} />
                <div className="puzzle-hint-position-copy">
                  <span><strong>Aktuell:</strong> {hintPreview.currentPositionLabel}</span>
                  <span><strong>Ziel:</strong> {hintPreview.targetPositionLabel}</span>
                  <span>
                    <strong>Entfernung:</strong>{' '}
                    {hintPreview.distance} {hintPreview.distance === 1 ? 'Feld' : 'Felder'}
                  </span>
                </div>
              </div>
            </>
          ) : isComputingSuggestion ? (
            <div className="puzzle-hint-empty puzzle-hint-empty--computing" aria-live="polite">
              <span className="puzzle-hint-spinner" aria-hidden="true" />
              <span>Berechne den naechsten Zug ...</span>
            </div>
          ) : (
            <p className="puzzle-hint-empty">
              <span>Markiert die beste Kachel direkt auf dem Brett. Nutze den Hinweis, wenn du kurz festhaengst.</span>
            </p>
          )}

          <AnimatedStaggerGroup className="puzzle-hint-actions" level="subtle">
            <AnimatedButton
              ref={actionButtonRefs.hint}
              className="secondary"
              onClick={onShowHint}
              disabled={!canTriggerSuggestion}
              aria-busy={isComputingSuggestion}
              aria-keyshortcuts="H"
              data-puzzle-allow-hotkeys="true"
              data-app-tooltip="Berechnet und markiert eine hilfreiche naechste Kachel. Zaehlt als Hilfe im Laufprofil."
              data-app-tooltip-align="start"
              reveal
              revealLevel="subtle"
            >
              <span className="puzzle-button-label">
                {isComputingSuggestion
                  ? 'Suche Hinweis ...'
                  : hintPreview
                    ? 'Hinweis erneuern'
                    : 'Hinweis zeigen'}
              </span>
              <span className="puzzle-button-hotkey" aria-hidden="true">H</span>
            </AnimatedButton>
            <AnimatedButton
              ref={actionButtonRefs.suggestedMove}
              className="puzzle-tool-primary"
              onClick={onSuggestedMove}
              disabled={!canTriggerSuggestion}
              aria-busy={isComputingSuggestion}
              aria-keyshortcuts="Enter"
              data-puzzle-allow-hotkeys="true"
              data-app-tooltip="Fuehrt den empfohlenen Zug aus. Wird als Auto-Zug in der Statistik erfasst."
              data-app-tooltip-align="end"
              reveal
              revealLevel="subtle"
            >
              <span className="puzzle-button-label">
                {isComputingSuggestion
                  ? 'Berechne Zug ...'
                  : hintPreview
                    ? 'Zug ausfuehren'
                    : 'Zug spielen'}
              </span>
              <span className="puzzle-button-hotkey" aria-hidden="true">Enter</span>
            </AnimatedButton>
          </AnimatedStaggerGroup>
        </AnimatedReveal>
      </div>

      <AnimatedReveal className="puzzle-tools-shell" interaction="surface" level="subtle">
        <div className="puzzle-tools-shell-header">
          <span className="puzzle-tools-shell-kicker">Werkzeuge</span>
          <p className="puzzle-tools-shell-copy">Vorschau, Overlays und Verlauf fuer die aktuelle Runde.</p>
        </div>
        <AnimatedStaggerGroup className="puzzle-tools" level="subtle">
          <AnimatedButton
            ref={actionButtonRefs.preview}
            className="secondary puzzle-tool-toggle"
            onClick={onTogglePreview}
            disabled={isPaused}
            aria-keyshortcuts="Space"
            data-puzzle-allow-hotkeys="true"
            data-app-tooltip={isPreviewVisible ? 'Referenzbild rechts ausblenden.' : 'Referenzbild rechts anzeigen.'}
            data-app-tooltip-align="start"
            reveal
            revealLevel="subtle"
          >
            <span className="puzzle-button-label">{isPreviewVisible ? 'Vorschau aus' : 'Vorschau ein'}</span>
            <span className="puzzle-button-hotkey" aria-hidden="true">Leertaste</span>
          </AnimatedButton>
          <AnimatedButton
            ref={actionButtonRefs.ghostPreview}
            className={'secondary puzzle-tool-overlay-toggle' + (isGhostPreviewVisible ? ' is-active' : '')}
            onClick={onToggleGhostPreview}
            disabled={!canUseBoardTools}
            aria-pressed={isGhostPreviewVisible}
            aria-keyshortcuts="G"
            data-puzzle-allow-hotkeys="true"
            data-app-tooltip={isGhostPreviewVisible ? 'Geisterbild vom Brett ausblenden.' : 'Zielbild transparent ueber das Brett legen.'}
            data-app-tooltip-align="start"
            reveal
            revealLevel="subtle"
          >
            <span className="puzzle-button-label">{isGhostPreviewVisible ? 'Geisterbild aus' : 'Geisterbild ein'}</span>
            <span className="puzzle-button-hotkey" aria-hidden="true">G</span>
          </AnimatedButton>
          <AnimatedButton
            ref={actionButtonRefs.heatmap}
            className={'secondary puzzle-tool-overlay-toggle' + (isHeatmapOverlayVisible ? ' is-active' : '')}
            onClick={onToggleHeatmapOverlay}
            disabled={!canUseBoardTools}
            aria-pressed={isHeatmapOverlayVisible}
            aria-keyshortcuts="M"
            data-puzzle-allow-hotkeys="true"
            data-app-tooltip={isHeatmapOverlayVisible ? 'Heatmap fuer falsch platzierte Kacheln ausblenden.' : 'Falsch platzierte Kacheln farblich hervorheben.'}
            data-app-tooltip-align="start"
            reveal
            revealLevel="subtle"
          >
            <span className="puzzle-button-label">{isHeatmapOverlayVisible ? 'Heatmap aus' : 'Heatmap ein'}</span>
            <span className="puzzle-button-hotkey" aria-hidden="true">M</span>
          </AnimatedButton>
          <AnimatedButton
            ref={actionButtonRefs.tileNumbers}
            className={'secondary puzzle-tool-overlay-toggle' + (areTileNumbersVisible ? ' is-active' : '')}
            onClick={onShowTileNumbers}
            disabled={!canUseBoardTools}
            aria-pressed={areTileNumbersVisible}
            aria-keyshortcuts="N"
            data-puzzle-allow-hotkeys="true"
            data-app-tooltip="Kachelnummern kurz einblenden, um Positionen schneller abzugleichen."
            data-app-tooltip-align="end"
            reveal
            revealLevel="subtle"
          >
            <span className="puzzle-button-label">{areTileNumbersVisible ? 'Nummern an' : 'Nummern 5s'}</span>
            <span className="puzzle-button-hotkey" aria-hidden="true">N</span>
          </AnimatedButton>
          <AnimatedButton
            ref={actionButtonRefs.undo}
            className="secondary puzzle-tool-secondary"
            onClick={onUndo}
            disabled={moveHistoryLength === 0 || isInteractionLocked}
            aria-keyshortcuts="Control+Z"
            data-puzzle-allow-hotkeys="true"
            data-app-tooltip="Letzten Zug rueckgaengig machen."
            data-app-tooltip-align="start"
            reveal
            revealLevel="subtle"
          >
            <span className="puzzle-button-label">Zug zurueck</span>
            <span className="puzzle-button-hotkey" aria-hidden="true">Strg+Z</span>
          </AnimatedButton>
          <AnimatedButton
            ref={actionButtonRefs.redo}
            className="secondary puzzle-tool-secondary"
            onClick={onRedo}
            disabled={redoHistoryLength === 0 || isInteractionLocked}
            aria-keyshortcuts="Control+Y"
            data-puzzle-allow-hotkeys="true"
            data-app-tooltip="Rueckgaengig gemachten Zug wiederholen."
            data-app-tooltip-align="end"
            reveal
            revealLevel="subtle"
          >
            <span className="puzzle-button-label">Zug vor</span>
            <span className="puzzle-button-hotkey" aria-hidden="true">Strg+Y</span>
          </AnimatedButton>
        </AnimatedStaggerGroup>
      </AnimatedReveal>

      <AnimatePresence initial={false}>
        {isGhostPreviewVisible && (
          <AnimatedReveal
            key="puzzle-ghost-slider"
            className="puzzle-ghost-slider"
            interaction="surface"
            level="medium"
            aria-live="polite"
            data-app-tooltip={`${activeGhostPreviewMode.sliderLabel}: ${ghostPreviewWeight}% gegenueber Puzzle ${100 - ghostPreviewWeight}%.`}
            data-app-tooltip-align="start"
          >
            <div className="puzzle-ghost-slider-header">
              <span className="puzzle-panel-kicker">
                <span className="puzzle-panel-kicker-icon-shell" aria-hidden="true">
                  <PuzzleScreenIcon name="layers" className="puzzle-panel-kicker-icon" />
                </span>
                <span className="puzzle-ghost-slider-kicker">Geisteransicht</span>
              </span>
              <strong>{activeGhostPreviewMode.sliderLabel} {ghostPreviewWeight}%</strong>
            </div>
            <div className="puzzle-ghost-mode-selector" role="group" aria-label="Darstellung der Geisteransicht">
              {GHOST_PREVIEW_MODE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`puzzle-ghost-mode-button${ghostPreviewMode === option.value ? ' is-active' : ''}`}
                  onClick={() => onGhostPreviewModeChange(option.value)}
                  aria-pressed={ghostPreviewMode === option.value}
                  data-app-tooltip={option.description}
                  data-app-tooltip-position="top"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={ghostPreviewWeight}
              onChange={onGhostPreviewWeightChange}
              className="puzzle-ghost-slider-input"
              aria-label={`Gewichtung von ${activeGhostPreviewMode.sliderLabel} in der Geisteransicht`}
            />
            <div className="puzzle-ghost-slider-scale" aria-hidden="true">
              <span>Puzzle {100 - ghostPreviewWeight}%</span>
              <span>{activeGhostPreviewMode.sliderLabel} {ghostPreviewWeight}%</span>
            </div>
            <p className="puzzle-ghost-mode-copy">{activeGhostPreviewMode.description}</p>
          </AnimatedReveal>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {isHeatmapOverlayVisible && (
          <AnimatedReveal
            key="puzzle-heatmap-controls"
            className="puzzle-ghost-slider puzzle-heatmap-controls"
            interaction="surface"
            level="medium"
            aria-live="polite"
            data-app-tooltip={`Heatmap-Intensitaet: ${heatmapIntensity}%.`}
            data-app-tooltip-align="start"
          >
            <div className="puzzle-ghost-slider-header">
              <span className="puzzle-panel-kicker">
                <span className="puzzle-panel-kicker-icon-shell" aria-hidden="true">
                  <PuzzleScreenIcon name="activity" className="puzzle-panel-kicker-icon" />
                </span>
                <span className="puzzle-ghost-slider-kicker">Heatmap</span>
              </span>
              <strong>{activeHeatmapMode.label} {heatmapIntensity}%</strong>
            </div>
            <div className="puzzle-ghost-mode-selector" role="group" aria-label="Darstellung der Heatmap">
              {HEATMAP_MODE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`puzzle-ghost-mode-button${heatmapMode === option.value ? ' is-active' : ''}`}
                  onClick={() => onHeatmapModeChange(option.value)}
                  aria-pressed={heatmapMode === option.value}
                  data-app-tooltip={option.description}
                  data-app-tooltip-position="top"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <input
              type="range"
              min="25"
              max="100"
              step="1"
              value={heatmapIntensity}
              onChange={onHeatmapIntensityChange}
              className="puzzle-ghost-slider-input"
              aria-label="Intensitaet der Heatmap"
            />
            <div className="puzzle-ghost-slider-scale" aria-hidden="true">
              <span>Dezent</span>
              <span>Intensiv</span>
            </div>
            <button
              type="button"
              className={`puzzle-heatmap-distance-toggle${areHeatmapDistancesVisible ? ' is-active' : ''}`}
              onClick={onToggleHeatmapDistances}
              aria-pressed={areHeatmapDistancesVisible}
            >
              X/Y-Distanzen {areHeatmapDistancesVisible ? 'ausblenden' : 'anzeigen'}
            </button>
            <p className="puzzle-ghost-mode-copy">{activeHeatmapMode.description}</p>
          </AnimatedReveal>
        )}
      </AnimatePresence>

      <AnimatedReveal className="puzzle-side-footer" level="subtle">
        <AnimatedButton
          ref={actionButtonRefs.pause}
          onClick={onTogglePause}
          className={'secondary puzzle-pause-toggle' + (isPaused ? ' is-active' : '')}
          aria-keyshortcuts="P"
          aria-pressed={isPaused}
          data-puzzle-allow-hotkeys="true"
          data-app-tooltip={isPaused ? 'Runde fortsetzen und Brett wieder anzeigen.' : 'Timer anhalten und Brett verdecken.'}
          data-app-tooltip-position="top"
          reveal
          revealLevel="subtle"
        >
          <PuzzleScreenIcon name={isPaused ? 'play' : 'pause'} />
          <span className="puzzle-button-label">{isPaused ? 'Weiterspielen' : 'Pause'}</span>
          <span className="puzzle-button-hotkey" aria-hidden="true">P</span>
        </AnimatedButton>
        <AnimatedButton
          ref={actionButtonRefs.quit}
          onClick={onQuit}
          className="puzzle-tool-primary quit-btn"
          aria-keyshortcuts="Escape"
          data-puzzle-allow-hotkeys="true"
          data-app-tooltip="Runde abbrechen und zur Auswahl zurueckkehren."
          data-app-tooltip-position="top"
          reveal
          revealLevel="subtle"
        >
          <span className="puzzle-button-label">Abbrechen</span>
          <span className="puzzle-button-hotkey" aria-hidden="true">Esc</span>
        </AnimatedButton>
      </AnimatedReveal>
    </AnimatedStaggerGroup>
  )
}
