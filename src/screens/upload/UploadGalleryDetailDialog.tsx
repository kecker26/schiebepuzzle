import { useCallback, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import AnimatedDialog from '../../motion/AnimatedDialog.tsx'
import { SolvedGalleryEntry } from '../../types/index'
import { formatDifficultyLabel, formatPuzzleSize } from '../../utils/puzzleDifficulty.ts'
import { GalleryDisplayEntry, formatGallerySolveCount } from './UploadGalleryDisplayUtils.ts'
import { getGalleryTimelineComparisonHints } from './galleryComparisonHints.ts'
import { getGalleryReplayActions } from './galleryReplayActions.ts'
import {
  formatAssistanceModeLabel,
  formatDate,
  formatProfileSourceLabel,
  formatTime,
} from './uploadUtils.ts'

interface UploadGalleryDetailDialogProps {
  entry: GalleryDisplayEntry
  onReplayEntry: (entry: SolvedGalleryEntry) => void
  onCollectEntry?: (entry: GalleryDisplayEntry) => void
  onClose: () => void
}

function getConfigKey(entry: SolvedGalleryEntry): string {
  return `${entry.config.rows}x${entry.config.cols}`
}

export default function UploadGalleryDetailDialog({
  entry,
  onReplayEntry,
  onCollectEntry,
  onClose,
}: UploadGalleryDetailDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const replayButtonRef = useRef<HTMLButtonElement>(null)
  const collectButtonRef = useRef<HTMLButtonElement>(null)
  const representativeEntry = entry.representativeEntry
  const detailImage = representativeEntry.sourceImage ?? representativeEntry.previewImage
  const assistanceLabel = representativeEntry.hasDetailedProfile
    ? formatAssistanceModeLabel(representativeEntry.assistanceMode)
    : formatProfileSourceLabel(false)
  const solveCountLabel = formatGallerySolveCount(entry.totalSolveCount, entry.visibleSolveCount)
  const motifReplaySummary = entry.motifReplaySummary
  const motifDifficultyCount = motifReplaySummary.difficultyVariants.length
  const motifSolveCountLabel = formatGallerySolveCount(motifReplaySummary.totalSolveCount)
  const motifReplayableCount = motifReplaySummary.replayableSolveCount
  const motifBestTimeLabel = motifReplaySummary.bestTimeEntry
    ? formatTime(motifReplaySummary.bestTimeEntry.time)
    : null
  const motifBestCleanTimeLabel = motifReplaySummary.bestCleanTimeEntry
    ? formatTime(motifReplaySummary.bestCleanTimeEntry.time)
    : null
  const solveCountCopy = entry.visibleSolveCount === entry.totalSolveCount
    ? `Dieses Motiv wurde auf dieser Schwierigkeit ${entry.totalSolveCount} Mal geloest.`
    : `Dieses Motiv wurde auf dieser Schwierigkeit insgesamt ${entry.totalSolveCount} Mal geloest; ${entry.visibleSolveCount} Loesungen passen aktuell zu deiner Auswahl.`
  const motifReplayCopy =
    motifReplayableCount > 0
      ? `Motivweit ueber alle Stufen liegen ${motifSolveCountLabel} auf ${motifDifficultyCount} ${motifDifficultyCount === 1 ? 'Stufe' : 'Stufen'} vor; ${motifReplayableCount} davon haben ein Replay-Bild.`
      : `Motivweit ueber alle Stufen liegen ${motifSolveCountLabel} vor, derzeit aber ohne gespeichertes Replay-Bild.`
  const replayActions = getGalleryReplayActions(entry)
  const aiTags = representativeEntry.tags ?? []
  const aiTagging = representativeEntry.aiTagging ?? null
  const aiCollectionSuggestions = aiTagging?.collectionSuggestions ?? []
  const timelineEntries = motifReplaySummary.allEntries.length > 0
    ? motifReplaySummary.allEntries
    : entry.allEntries
  const descriptionId = 'gallery-detail-description'
  const initialFocusRef = replayActions.length > 0
    ? replayButtonRef
    : onCollectEntry
      ? collectButtonRef
      : closeButtonRef

  const handleActionKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
      return
    }

    const actionRow = event.currentTarget.closest<HTMLElement>('[data-gallery-detail-action-group="true"]')
    if (!actionRow) {
      return
    }

    const buttons = Array.from(actionRow.querySelectorAll<HTMLButtonElement>('button:not([disabled])'))
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

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <AnimatedDialog
      overlayClassName="gallery-detail-overlay"
      dialogClassName="gallery-detail-dialog"
      titleId="gallery-detail-title"
      descriptionId={descriptionId}
      onClose={onClose}
      closeOnOverlayClick
      closeOnEscape
      trapFocus
      restoreFocus
      lockScroll
      initialFocusRef={initialFocusRef}
    >
        <div className="gallery-detail-media-shell">
          {detailImage ? (
            <img
              src={detailImage}
              alt={`Geloestes Puzzle ${formatDifficultyLabel(representativeEntry.config)} vom ${formatDate(representativeEntry.completedAt)}`}
              className="gallery-detail-image"
            />
          ) : (
            <div className="gallery-detail-image-placeholder" aria-hidden="true">
              <span className="gallery-detail-image-mark">Bild</span>
            </div>
          )}
        </div>

        <div className="gallery-detail-body">
          <div className="gallery-detail-header">
            <span className="saved-games-kicker">Galerie-Detail</span>
            <h3 id="gallery-detail-title" className="gallery-detail-title">
              {formatDifficultyLabel(representativeEntry.config)}
            </h3>
            <p id={descriptionId} className="gallery-detail-copy">
              {solveCountCopy} Gezeigt wird der juengste Lauf, der zu deiner aktuellen Auswahl passt,
              vom {formatDate(representativeEntry.completedAt)}. {motifReplayCopy}
            </p>
          </div>

          <div className="dashboard-inline-chips">
            <span className="saved-game-chip">{formatPuzzleSize(representativeEntry.config)}</span>
            <span className="saved-game-chip">Stufe {solveCountLabel}</span>
            <span className="saved-game-chip">
              Motiv {motifDifficultyCount} {motifDifficultyCount === 1 ? 'Stufe' : 'Stufen'}
            </span>
            <span className="saved-game-chip">
              {motifReplayableCount > 0 ? `Replay ${motifReplayableCount}` : 'Archiv'}
            </span>
            {motifBestTimeLabel ? <span className="saved-game-chip">Rekord {motifBestTimeLabel}</span> : null}
            {motifBestCleanTimeLabel ? (
              <span className="saved-game-chip">Clean {motifBestCleanTimeLabel}</span>
            ) : null}
            {!representativeEntry.hasDetailedProfile ? <span className="saved-game-chip">Legacy-Profil</span> : null}
          </div>

          {aiTags.length > 0 || aiTagging ? (
            <section className="gallery-detail-ai" aria-labelledby="gallery-detail-ai-title">
              <div className="gallery-detail-replay-header">
                <span id="gallery-detail-ai-title" className="saved-games-kicker">KI-Sortierung</span>
                <p className="gallery-detail-replay-copy">
                  {aiTagging?.status === 'tagged'
                    ? 'Gemini hat Tags und passende Sammlungsvorschlaege fuer dieses Motiv erstellt.'
                    : aiTagging?.status === 'unavailable'
                      ? 'Gemini-Tagging ist noch nicht konfiguriert.'
                      : 'Gemini konnte dieses Motiv noch nicht taggen.'}
                </p>
              </div>

              {aiTags.length > 0 ? (
                <div className="gallery-detail-ai-tags" aria-label="KI-Tags">
                  {aiTags.map((tag) => (
                    <span key={tag.label}>#{tag.label}</span>
                  ))}
                </div>
              ) : null}

              {aiCollectionSuggestions.length > 0 ? (
                <div className="gallery-detail-ai-suggestions" aria-label="KI-Sammlungsvorschlaege">
                  {aiCollectionSuggestions.map((suggestion) => (
                    <span key={suggestion.collectionId}>
                      {suggestion.collectionName}
                      {suggestion.reason ? `: ${suggestion.reason}` : ''}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          <div className="gallery-detail-metrics">
            <article className="gallery-detail-metric">
              <span className="gallery-detail-metric-label">Zeit</span>
              <strong className="gallery-detail-metric-value">{formatTime(representativeEntry.time)}</strong>
              <span className="gallery-detail-metric-copy">Gemessene Abschlusszeit des angezeigten Laufs.</span>
            </article>
            <article className="gallery-detail-metric">
              <span className="gallery-detail-metric-label">Netto-Zuege</span>
              <strong className="gallery-detail-metric-value">{representativeEntry.moves}</strong>
              <span className="gallery-detail-metric-copy">Direkter geloester Zugweg ohne Umwege.</span>
            </article>
            <article className="gallery-detail-metric">
              <span className="gallery-detail-metric-label">Aktionen</span>
              <strong className="gallery-detail-metric-value">{representativeEntry.hasDetailedProfile ? representativeEntry.actionMoves : '--'}</strong>
              <span className="gallery-detail-metric-copy">
                {representativeEntry.hasDetailedProfile
                  ? 'Alle wirklich gespielten Schritte dieses angezeigten Laufs.'
                  : 'Bei Legacy-Daten wurden Aktionen damals noch nicht gespeichert.'}
              </span>
            </article>
            <article className="gallery-detail-metric">
              <span className="gallery-detail-metric-label">Laufart</span>
              <strong className="gallery-detail-metric-value">{assistanceLabel}</strong>
              <span className="gallery-detail-metric-copy">
                {representativeEntry.hasDetailedProfile
                  ? 'Zeigt, ob der Lauf clean, mit Hinweisen oder mit Auto-Zug beendet wurde.'
                  : 'Aelterer Eintrag ohne vollstaendiges Laufprofil.'}
              </span>
            </article>
          </div>

          {timelineEntries.length > 0 ? (
            <section className="gallery-detail-timeline" aria-labelledby="gallery-detail-timeline-title">
              <div className="gallery-detail-replay-header">
                <span id="gallery-detail-timeline-title" className="saved-games-kicker">Laufverlauf</span>
                <p className="gallery-detail-replay-copy">
                  {timelineEntries.length} gespeicherte {timelineEntries.length === 1 ? 'Runde' : 'Runden'} fuer
                  dieses Motiv.
                </p>
              </div>

              <div className="gallery-detail-timeline-list" data-gallery-detail-action-group="true">
                {timelineEntries.map((timelineEntry) => {
                  const isCurrentEntry = timelineEntry.id === representativeEntry.id
                  const isDifferentDifficulty = getConfigKey(timelineEntry) !== getConfigKey(representativeEntry)
                  const timelineMarkers = [
                    isCurrentEntry ? 'Aktuell' : null,
                    motifReplaySummary.bestTimeEntry?.id === timelineEntry.id ? 'Bestzeit' : null,
                    motifReplaySummary.bestMovesEntry?.id === timelineEntry.id ? 'Bestweg' : null,
                    motifReplaySummary.bestCleanTimeEntry?.id === timelineEntry.id ? 'Clean' : null,
                    isDifferentDifficulty ? 'Andere Stufe' : null,
                    timelineEntry.sourceImage || timelineEntry.previewImage ? null : 'Archiv',
                  ].filter((marker): marker is string => Boolean(marker))
                  const canReplayTimelineEntry = Boolean(timelineEntry.sourceImage ?? timelineEntry.previewImage)
                  const profileLabel = timelineEntry.hasDetailedProfile
                    ? formatAssistanceModeLabel(timelineEntry.assistanceMode)
                    : formatProfileSourceLabel(timelineEntry.hasDetailedProfile)
                  const comparisonHints = getGalleryTimelineComparisonHints(
                    timelineEntry,
                    timelineEntries,
                    motifReplaySummary,
                    representativeEntry
                  )

                  return (
                    <article
                      key={timelineEntry.id}
                      className={`gallery-detail-timeline-item${isCurrentEntry ? ' is-current' : ''}`}
                    >
                      <div className="gallery-detail-timeline-content">
                        <div className="gallery-detail-timeline-main">
                          <span>{isCurrentEntry ? 'Angezeigt' : 'Lauf'}</span>
                          <strong>{formatDifficultyLabel(timelineEntry.config)}</strong>
                          <small>{formatDate(timelineEntry.completedAt)}</small>
                        </div>

                        <div className="gallery-detail-timeline-meta" aria-label="Laufwerte">
                          <span>{formatTime(timelineEntry.time)}</span>
                          <span>{timelineEntry.moves} Netto</span>
                          <span>{profileLabel}</span>
                        </div>

                        {timelineMarkers.length > 0 ? (
                          <div className="gallery-detail-timeline-markers" aria-label="Laufmarkierungen">
                            {timelineMarkers.map((marker) => (
                              <span key={marker}>{marker}</span>
                            ))}
                          </div>
                        ) : null}

                        {comparisonHints.length > 0 ? (
                          <div className="gallery-detail-timeline-insights" aria-label="Laufvergleich">
                            {comparisonHints.map((hint) => (
                              <span key={hint.label} className={`is-${hint.tone}`}>
                                {hint.label}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        className="gallery-detail-timeline-action"
                        disabled={!canReplayTimelineEntry}
                        onClick={() => onReplayEntry(timelineEntry)}
                        onKeyDown={handleActionKeyDown}
                        aria-label={`Lauf ${formatDifficultyLabel(timelineEntry.config)} vom ${formatDate(timelineEntry.completedAt)} spielen`}
                      >
                        {canReplayTimelineEntry ? 'Diesen Lauf' : 'Archiv'}
                      </button>
                    </article>
                  )
                })}
              </div>
            </section>
          ) : null}

          {replayActions.length > 0 ? (
            <section className="gallery-detail-replay">
              <div className="gallery-detail-replay-header">
                <span className="saved-games-kicker">Schnellstarts</span>
                <p className="gallery-detail-replay-copy">
                  Waehle direkt den Wiedereinstieg, den du fuer dieses Motiv als Naechstes angehen willst.
                </p>
              </div>

              <div className="gallery-detail-replay-grid" data-gallery-detail-action-group="true">
                {replayActions.map((action, index) => (
                  <button
                    key={action.id}
                    ref={index === 0 ? replayButtonRef : undefined}
                    type="button"
                    className={`gallery-detail-replay-action${index === 0 ? ' is-primary' : ''}`}
                    data-page-primary-focus={index === 0 ? 'true' : undefined}
                    onClick={() => onReplayEntry(action.entry)}
                    onKeyDown={handleActionKeyDown}
                    aria-label={`${action.label}, ${action.summary}`}
                  >
                    <span className="gallery-detail-replay-label">{action.label}</span>
                    <strong className="gallery-detail-replay-value">{action.summary}</strong>
                    <span className="gallery-detail-replay-copy">{action.description}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <div className="gallery-detail-actions" data-gallery-detail-action-group="true">
            {onCollectEntry ? (
              <button
                ref={collectButtonRef}
                type="button"
                className="secondary"
                data-page-primary-focus={replayActions.length === 0 ? 'true' : undefined}
                onClick={() => onCollectEntry(entry)}
                onKeyDown={handleActionKeyDown}
                aria-label={`Galerie-Bild ${formatDifficultyLabel(representativeEntry.config)} vom ${formatDate(representativeEntry.completedAt)} zu einer Sammlung hinzufuegen`}
              >
                Sammeln
              </button>
            ) : null}
            <button
              ref={closeButtonRef}
              type="button"
              className="secondary"
              data-page-primary-focus={replayActions.length === 0 ? 'true' : undefined}
              onClick={onClose}
              onKeyDown={handleActionKeyDown}
            >
              Schliessen
            </button>
          </div>
        </div>
    </AnimatedDialog>,
    document.body
  )
}
