import { memo, type KeyboardEvent as ReactKeyboardEvent, useCallback } from 'react'
import {
  ensureElementVisible,
  FOCUS_VISIBILITY_ANCHOR_ATTRIBUTE,
} from '../../app/focusVisibility.ts'
import { getDirectionalFocusTarget } from '../../app/directionalFocusNavigation.ts'
import GlobalUiIcon from '../../components/GlobalUiIcon.tsx'
import { SolvedGalleryEntry } from '../../types/index'
import { formatDifficultyLabel, formatPuzzleSize } from '../../utils/puzzleDifficulty.ts'
import { GalleryDisplayEntry, formatGallerySolveCount } from './UploadGalleryDisplayUtils.ts'
import { getGalleryCardComparisonHints } from './galleryComparisonHints.ts'
import { getGalleryReplayActions } from './galleryReplayActions.ts'
import {
  formatAssistanceModeLabel,
  formatDate,
  formatTime,
} from './uploadUtils.ts'

interface UploadGalleryCardProps {
  entry: GalleryDisplayEntry
  onOpenDetails: (entry: GalleryDisplayEntry) => void
  onReplayEntry: (entry: SolvedGalleryEntry) => void
  onDeleteEntry: (entry: GalleryDisplayEntry) => void
  isDeleting: boolean
}

const UploadGalleryCard = memo(function UploadGalleryCard({
  entry,
  onOpenDetails,
  onReplayEntry,
  onDeleteEntry,
  isDeleting,
}: UploadGalleryCardProps) {
  const representativeEntry = entry.representativeEntry
  const assistanceLabel = representativeEntry.hasDetailedProfile
    ? formatAssistanceModeLabel(representativeEntry.assistanceMode)
    : 'Legacy'
  const solveCountLabel = formatGallerySolveCount(entry.totalSolveCount, entry.visibleSolveCount)
  const difficultyLabel = formatDifficultyLabel(representativeEntry.config)
  const completedAtLabel = formatDate(representativeEntry.completedAt)
  const motifReplaySummary = entry.motifReplaySummary
  const motifDifficultyCount = motifReplaySummary.difficultyVariants.length
  const motifReplayableCount = motifReplaySummary.replayableSolveCount
  const motifBestTimeLabel = motifReplaySummary.bestTimeEntry
    ? formatTime(motifReplaySummary.bestTimeEntry.time)
    : null
  const replayActions = getGalleryReplayActions(entry)
  const primaryReplayAction = replayActions[0] ?? null
  const secondaryReplayAction = replayActions[1] ?? null
  const comparisonHints = getGalleryCardComparisonHints(entry)
  const replaySummaryCopy =
    motifReplayableCount > 0
      ? `Motivweit ueber ${motifDifficultyCount} ${motifDifficultyCount === 1 ? 'Stufe' : 'Stufen'} ${motifReplayableCount} spielbare ${motifReplayableCount === 1 ? 'Loesung' : 'Loesungen'}${motifBestTimeLabel ? `, Bestzeit gesamt ${motifBestTimeLabel}` : ''}.`
      : `Dieses Motiv liegt aktuell nur als Archiv-Eintrag vor und ist noch nicht erneut spielbar.`

  const focusButton = useCallback((button: HTMLButtonElement | undefined) => {
    if (!button) {
      return
    }

    button.focus({ preventScroll: true })
    const visibleTarget = button.closest<HTMLElement>('.gallery-card') ?? button
    ensureElementVisible(visibleTarget)
  }, [])

  const handleActionKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
      return
    }

    const currentButton = event.currentTarget
    const action = currentButton.dataset.galleryAction
    const card = currentButton.closest<HTMLElement>('.gallery-card')
    const grid = currentButton.closest<HTMLElement>('.gallery-grid')

    if (!action || !card || !grid) {
      return
    }

    const cardButtons = Array.from(
      card.querySelectorAll<HTMLButtonElement>('button[data-gallery-action]:not([disabled])')
    )
    const sameActionButtons = Array.from(
      grid.querySelectorAll<HTMLButtonElement>(`button[data-gallery-action="${action}"]:not([disabled])`)
    )
    const cardIndex = cardButtons.indexOf(currentButton)
    const actionIndex = sameActionButtons.indexOf(currentButton)

    switch (event.key) {
      case 'ArrowLeft':
        if (cardIndex > 0) {
          event.preventDefault()
          focusButton(cardButtons[cardIndex - 1])
        }
        return
      case 'ArrowRight':
        if (cardIndex >= 0 && cardIndex < cardButtons.length - 1) {
          event.preventDefault()
          focusButton(cardButtons[cardIndex + 1])
        }
        return
      case 'ArrowUp':
        if (actionIndex > 0) {
          const nextButton = getDirectionalFocusTarget(currentButton, sameActionButtons, 'up', {
            requireCrossAxisOverlap: true,
          })
          if (nextButton) {
            event.preventDefault()
            focusButton(nextButton)
          }
        }
        return
      case 'ArrowDown':
        if (actionIndex >= 0 && actionIndex < sameActionButtons.length - 1) {
          const nextButton = getDirectionalFocusTarget(currentButton, sameActionButtons, 'down', {
            requireCrossAxisOverlap: true,
          })
          if (nextButton) {
            event.preventDefault()
            focusButton(nextButton)
          }
        }
        return
      case 'Home':
        if (sameActionButtons.length > 0) {
          event.preventDefault()
          focusButton(sameActionButtons[0])
        }
        return
      case 'End':
        if (sameActionButtons.length > 0) {
          event.preventDefault()
          focusButton(sameActionButtons[sameActionButtons.length - 1])
        }
        return
    }
  }, [focusButton])

  const handleOpenDetails = useCallback(() => {
    onOpenDetails(entry)
  }, [entry, onOpenDetails])

  const handlePrimaryReplay = useCallback(() => {
    if (!primaryReplayAction) {
      return
    }

    onReplayEntry(primaryReplayAction.entry)
  }, [onReplayEntry, primaryReplayAction])

  const handleSecondaryReplay = useCallback(() => {
    if (!secondaryReplayAction) {
      return
    }

    onReplayEntry(secondaryReplayAction.entry)
  }, [onReplayEntry, secondaryReplayAction])

  const handleDelete = useCallback(() => {
    onDeleteEntry(entry)
  }, [entry, onDeleteEntry])

  return (
    <article className="gallery-card">
      <button
        type="button"
        className="gallery-card-preview-shell"
        data-gallery-action="preview"
        data-gallery-entry-id={entry.id}
        {...{ [FOCUS_VISIBILITY_ANCHOR_ATTRIBUTE]: '.gallery-card' }}
        onClick={handleOpenDetails}
        onKeyDown={handleActionKeyDown}
        disabled={isDeleting}
        aria-label={`Details zu ${difficultyLabel} vom ${completedAtLabel} anzeigen`}
      >
        {representativeEntry.previewImage ? (
          <img
            src={representativeEntry.previewImage}
            alt={`Geloestes Puzzle ${difficultyLabel} vom ${completedAtLabel}`}
            className="gallery-card-preview"
          />
        ) : (
          <div className="gallery-card-preview-placeholder" aria-hidden="true">
            <span className="gallery-card-preview-mark">Bild</span>
          </div>
        )}
      </button>

      <div className="gallery-card-body">
        <div className="gallery-card-header">
          <strong className="gallery-card-title">{difficultyLabel}</strong>
          <span className="gallery-card-date">{completedAtLabel}</span>
        </div>

        <div className="gallery-card-tags">
          <span className="saved-game-chip gallery-card-info-chip">
            <GlobalUiIcon name="grid" className="gallery-card-info-chip-icon" />
            <span>{formatPuzzleSize(representativeEntry.config)}</span>
          </span>
          <span className="saved-game-chip gallery-card-info-chip">
            <GlobalUiIcon name="refreshCw" className="gallery-card-info-chip-icon" />
            <span>{solveCountLabel}</span>
          </span>
          <span className="saved-game-chip gallery-card-info-chip">
            <GlobalUiIcon
              name={representativeEntry.assistanceMode === 'auto-assisted' ? 'zap' : 'navigation'}
              className="gallery-card-info-chip-icon"
            />
            <span>{assistanceLabel}</span>
          </span>
          <span className="saved-game-chip gallery-card-info-chip">
            <GlobalUiIcon name="move" className="gallery-card-info-chip-icon" />
            <span>Motivweit {motifDifficultyCount} {motifDifficultyCount === 1 ? 'Stufe' : 'Stufen'}</span>
          </span>
          <span className="saved-game-chip gallery-card-info-chip">
            <GlobalUiIcon
              name={motifReplayableCount > 0 ? 'refreshCw' : 'archive'}
              className="gallery-card-info-chip-icon"
            />
            <span>{motifReplayableCount > 0 ? `Motivweit ${motifReplayableCount} spielbar` : 'Archiv'}</span>
          </span>
        </div>

        <div className="gallery-card-stats" aria-label="Zusammenfassung des Laufs">
          <div className="gallery-card-stat">
            <span className="gallery-card-stat-label">Zeit</span>
            <strong className="gallery-card-stat-value">{formatTime(representativeEntry.time)}</strong>
          </div>
          <div className="gallery-card-stat">
            <span className="gallery-card-stat-label">Netto</span>
            <strong className="gallery-card-stat-value">{representativeEntry.moves}</strong>
          </div>
        </div>

        <p className="gallery-card-replay-note">{replaySummaryCopy}</p>

        {comparisonHints.length > 0 ? (
          <div className="gallery-card-comparison-hints" aria-label="Motivvergleich">
            {comparisonHints.map((hint) => (
              <span key={hint.label} className={`is-${hint.tone}`}>
                {hint.label}
              </span>
            ))}
          </div>
        ) : null}

        <div className={`gallery-card-actions${secondaryReplayAction ? '' : ' is-compact'}`}>
          <button
            type="button"
            data-gallery-action="play-primary"
            data-gallery-entry-id={entry.id}
            {...{ [FOCUS_VISIBILITY_ANCHOR_ATTRIBUTE]: '.gallery-card' }}
            onClick={handlePrimaryReplay}
            onKeyDown={handleActionKeyDown}
            disabled={isDeleting || !primaryReplayAction}
            aria-label={
              primaryReplayAction
                ? `Puzzle ${formatDifficultyLabel(primaryReplayAction.entry.config)} erneut spielen`
                : `Puzzle ${difficultyLabel} kann aktuell nicht erneut gespielt werden`
            }
          >
            {primaryReplayAction?.label ?? 'Bild fehlt'}
          </button>
          {secondaryReplayAction ? (
            <button
              type="button"
              className="secondary"
              data-gallery-action="play-secondary"
              data-gallery-entry-id={entry.id}
              {...{ [FOCUS_VISIBILITY_ANCHOR_ATTRIBUTE]: '.gallery-card' }}
              onClick={handleSecondaryReplay}
              onKeyDown={handleActionKeyDown}
              disabled={isDeleting}
              aria-label={`Motivweiten Schnellstart ${secondaryReplayAction.label.toLowerCase()}`}
            >
              {secondaryReplayAction.label}
            </button>
          ) : null}
          <button
            type="button"
            className="secondary"
            data-gallery-action="details"
            data-gallery-entry-id={entry.id}
            {...{ [FOCUS_VISIBILITY_ANCHOR_ATTRIBUTE]: '.gallery-card' }}
            onClick={handleOpenDetails}
            onKeyDown={handleActionKeyDown}
            disabled={isDeleting}
          >
            Details
          </button>
          <button
            type="button"
            className="secondary gallery-card-delete-button"
            data-gallery-action="delete"
            data-gallery-entry-id={entry.id}
            {...{ [FOCUS_VISIBILITY_ANCHOR_ATTRIBUTE]: '.gallery-card' }}
            onClick={handleDelete}
            onKeyDown={handleActionKeyDown}
            disabled={isDeleting}
            aria-label={`Galerie-Bild ${difficultyLabel} vom ${completedAtLabel} loeschen`}
          >
            {isDeleting ? 'Loesche ...' : 'Loeschen'}
          </button>
        </div>
      </div>
    </article>
  )
})

export default UploadGalleryCard
