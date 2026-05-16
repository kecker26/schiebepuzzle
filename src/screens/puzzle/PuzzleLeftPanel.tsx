import { AnimatePresence } from 'motion/react'
import type { ChangeEvent, RefObject } from 'react'
import PuzzleScreenIcon from '../../components/PuzzleScreenIcon.tsx'
import AnimatedButton from '../../motion/AnimatedButton.tsx'
import AnimatedReveal from '../../motion/AnimatedReveal.tsx'
import AnimatedStaggerGroup from '../../motion/AnimatedStaggerGroup.tsx'
import { type PuzzleProgressMetrics } from '../../services/PuzzleSolver.ts'
import { type GhostPreviewMode } from '../../types/index'
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
  optimalMoveSummary: string
  challengeSummary?: string | null
  elapsedTime: number
  progressMetrics: PuzzleProgressMetrics | null
  hintPreview: SuggestedHintPreview | null
  isComputingSuggestion: boolean
  isInteractionLocked: boolean
  isPreviewVisible: boolean
  isGhostPreviewVisible: boolean
  isHeatmapOverlayVisible: boolean
  areTileNumbersVisible: boolean
  ghostPreviewMode: GhostPreviewMode
  ghostPreviewWeight: number
  moveHistoryLength: number
  redoHistoryLength: number
  onShowHint: () => void
  onSuggestedMove: () => void
  onTogglePreview: () => void
  onToggleGhostPreview: () => void
  onToggleHeatmapOverlay: () => void
  onShowTileNumbers: () => void
  onGhostPreviewModeChange: (mode: GhostPreviewMode) => void
  onGhostPreviewWeightChange: (event: ChangeEvent<HTMLInputElement>) => void
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

export default function PuzzleLeftPanel({
  config,
  moveCount,
  optimalMoveSummary,
  challengeSummary,
  elapsedTime,
  progressMetrics,
  hintPreview,
  isComputingSuggestion,
  isInteractionLocked,
  isPreviewVisible,
  isGhostPreviewVisible,
  isHeatmapOverlayVisible,
  areTileNumbersVisible,
  ghostPreviewMode,
  ghostPreviewWeight,
  moveHistoryLength,
  redoHistoryLength,
  onShowHint,
  onSuggestedMove,
  onTogglePreview,
  onToggleGhostPreview,
  onToggleHeatmapOverlay,
  onShowTileNumbers,
  onGhostPreviewModeChange,
  onGhostPreviewWeightChange,
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
  const canUseBoardTools = progressMetrics !== null
  const canTriggerSuggestion = canUseBoardTools && !isInteractionLocked
  const activeGhostPreviewMode =
    GHOST_PREVIEW_MODE_OPTIONS.find((option) => option.value === ghostPreviewMode) ?? GHOST_PREVIEW_MODE_OPTIONS[0]

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
              title="Hilfe und Tastenkuerzel anzeigen (F1 oder ?)"
              aria-label="Hilfe und Tastenkuerzel anzeigen"
              aria-keyshortcuts="F1"
              data-puzzle-allow-hotkeys="true"
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
          {challengeSummary && (
            <div className="puzzle-challenge-badge" role="status" aria-label="Challenge-Start aktiv">
              <span className="puzzle-challenge-badge-label">Challenge-Start</span>
              <span className="puzzle-challenge-badge-detail">{challengeSummary}</span>
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
            <strong className="puzzle-stat-value">{moveCount}</strong>
            <span className="puzzle-stat-detail">{optimalMoveSummary}</span>
          </div>
          <div className="puzzle-stat-card">
            <div className="puzzle-stat-head">
              <span className="puzzle-stat-icon-shell" aria-hidden="true">
                <PuzzleScreenIcon name="timer" className="puzzle-stat-icon" />
              </span>
              <span className="puzzle-stat-label">Zeit</span>
            </div>
            <strong className="puzzle-stat-value">{formatElapsedTime(elapsedTime)}</strong>
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
              <span className={`puzzle-hint-confidence puzzle-hint-confidence--${hintPreview.confidenceTone}`}>
                Sicherheit {hintPreview.confidenceLabel}
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
                  <strong>{hintPreview.tileLabel}</strong>
                  <span>{hintPreview.description}</span>
                </div>
              </div>
              <div className="puzzle-hint-route" aria-hidden="true">
                <span>{hintPreview.tileLabel}</span>
                <span className="puzzle-hint-route-line" />
                <span>{hintPreview.directionLabel}</span>
              </div>
              <div className="puzzle-hint-meta">
                <span className="puzzle-hint-chip">Bewege {hintPreview.directionLabel}</span>
                <span className="puzzle-hint-chip">{hintPreview.sourceLabel}</span>
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
              title="Spielt den empfohlenen Zug oder berechnet ihn neu (Enter)"
              aria-keyshortcuts="Enter"
              data-puzzle-allow-hotkeys="true"
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
            title={
              isPreviewVisible
                ? 'Blendet die Bildvorschau aus (Leertaste)'
                : 'Zeigt die Bildvorschau an (Leertaste)'
            }
            aria-keyshortcuts="Space"
            data-puzzle-allow-hotkeys="true"
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
            title={
              isGhostPreviewVisible
                ? 'Blendet die Geistervorschau auf dem Brett aus (G)'
                : 'Zeigt die Geistervorschau auf dem Brett an (G)'
            }
            aria-pressed={isGhostPreviewVisible}
            aria-keyshortcuts="G"
            data-puzzle-allow-hotkeys="true"
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
            title={
              isHeatmapOverlayVisible
                ? 'Blendet die Heatmap fuer falsch platzierte Kacheln aus (M)'
                : 'Zeigt die Heatmap fuer falsch platzierte Kacheln an (M)'
            }
            aria-pressed={isHeatmapOverlayVisible}
            aria-keyshortcuts="M"
            data-puzzle-allow-hotkeys="true"
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
            title="Zeigt 5 Sekunden lang die Kachelnummern (N)"
            aria-pressed={areTileNumbersVisible}
            aria-keyshortcuts="N"
            data-puzzle-allow-hotkeys="true"
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
            title="Strg+Z"
            aria-keyshortcuts="Control+Z"
            data-puzzle-allow-hotkeys="true"
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
            title="Strg+Y"
            aria-keyshortcuts="Control+Y"
            data-puzzle-allow-hotkeys="true"
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
              title={`Regelt die Sichtbarkeit von ${activeGhostPreviewMode.sliderLabel.toLowerCase()} gegenueber dem Puzzle darunter`}
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

      <AnimatedReveal className="puzzle-side-footer" level="subtle">
        <AnimatedButton
          ref={actionButtonRefs.quit}
          onClick={onQuit}
          className="puzzle-tool-primary quit-btn"
          title="Bricht die Runde ab und kehrt zur Auswahl zurueck (Esc)"
          aria-keyshortcuts="Escape"
          data-puzzle-allow-hotkeys="true"
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
