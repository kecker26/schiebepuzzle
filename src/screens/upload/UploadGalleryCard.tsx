import { memo, type KeyboardEvent as ReactKeyboardEvent, useCallback } from 'react'
import {
  ensureElementVisible,
  FOCUS_VISIBILITY_ANCHOR_ATTRIBUTE,
} from '../../app/focusVisibility.ts'
import { getDirectionalFocusTarget } from '../../app/directionalFocusNavigation.ts'
import UploadScreenIcon from '../../components/UploadScreenIcon.tsx'
import { ImageCollection, SolvedGalleryEntry } from '../../types/index'
import { formatDifficultyLabel } from '../../utils/puzzleDifficulty.ts'
import { GalleryDisplayEntry, formatGallerySolveCount } from './UploadGalleryDisplayUtils.ts'
import { formatDate } from './uploadUtils.ts'

interface UploadGalleryCardProps {
  entry: GalleryDisplayEntry
  onOpenDetails: (entry: GalleryDisplayEntry) => void
  onCollectEntry?: (entry: GalleryDisplayEntry) => void
  onTagFilter?: (tagLabel: string) => void
  onRetryTagging?: (entry: SolvedGalleryEntry) => Promise<void>
  onAddSuggestedCollection?: (collectionId: string, entry: GalleryDisplayEntry) => void
  collections?: ImageCollection[]
  suggestedCollectionBusyKey?: string | null
  retryingTagEntryId?: string | null
  onDeleteEntry: (entry: GalleryDisplayEntry) => void
  isDeleting: boolean
}

const UploadGalleryCard = memo(function UploadGalleryCard({
  entry,
  onOpenDetails,
  onCollectEntry,
  onTagFilter,
  onAddSuggestedCollection,
  collections = [],
  suggestedCollectionBusyKey = null,
  onDeleteEntry,
  isDeleting,
}: UploadGalleryCardProps) {
  const representativeEntry = entry.representativeEntry
  const difficultyLabel = formatDifficultyLabel(representativeEntry.config)
  const completedAtLabel = formatDate(representativeEntry.completedAt)
  const totalSolveCountLabel = formatGallerySolveCount(entry.motifReplaySummary.totalSolveCount)
  const aiTags = representativeEntry.tags ?? []
  const aiTagging = representativeEntry.aiTagging ?? null
  const collectionSuggestions = (aiTagging?.collectionSuggestions ?? [])
    .map((suggestion) => ({
      suggestion,
      collection: collections.find((collection) => collection.id === suggestion.collectionId) ?? null,
    }))
    .filter(({ collection }) => collection && !collection.imageIds.includes(representativeEntry.id))
    .slice(0, 2)

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

  const handleDelete = useCallback(() => {
    onDeleteEntry(entry)
  }, [entry, onDeleteEntry])

  const handleCollect = useCallback(() => {
    onCollectEntry?.(entry)
  }, [entry, onCollectEntry])

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
        {aiTags.length > 0 || collectionSuggestions.length > 0 ? (
          <div className="gallery-card-ai" aria-label="KI-Tags und Sammlungsvorschlaege">
            <div className="gallery-card-run-count" aria-label={`Gesamtzahl der Laeufe: ${totalSolveCountLabel}`}>
              <UploadScreenIcon name="refreshCw" className="gallery-card-run-count-icon" />
              <span>{totalSolveCountLabel}</span>
            </div>

            {aiTags.length > 0 ? (
              <div className="gallery-card-ai-tags">
                {aiTags.slice(0, 5).map((tag) => (
                  <button
                    key={tag.label}
                    type="button"
                    data-gallery-action="tag"
                    data-gallery-entry-id={entry.id}
                    onClick={() => onTagFilter?.(tag.label)}
                    onKeyDown={handleActionKeyDown}
                    disabled={isDeleting || !onTagFilter}
                    title={`Galerie nach #${tag.label} filtern`}
                  >
                    #{tag.label}
                  </button>
                ))}
              </div>
            ) : null}

            {collectionSuggestions.length > 0 ? (
              <div className="gallery-card-ai-suggestions">
                {collectionSuggestions.map(({ suggestion, collection }) => {
                  if (!collection) return null

                  const busyKey = `${entry.id}:${collection.id}`
                  const isBusy = suggestedCollectionBusyKey === busyKey

                  return (
                    <button
                      key={collection.id}
                      type="button"
                      className="gallery-card-ai-suggestion"
                      onClick={() => onAddSuggestedCollection?.(collection.id, entry)}
                      disabled={isDeleting || isBusy || !onAddSuggestedCollection}
                      title={suggestion.reason || `Vorschlag fuer ${collection.name}`}
                    >
                      <UploadScreenIcon name="sparkles" className="gallery-card-action-icon" />
                      <span>{isBusy ? 'Sortiere ...' : collection.name}</span>
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="gallery-card-ai">
            <div className="gallery-card-run-count" aria-label={`Gesamtzahl der Laeufe: ${totalSolveCountLabel}`}>
              <UploadScreenIcon name="refreshCw" className="gallery-card-run-count-icon" />
              <span>{totalSolveCountLabel}</span>
            </div>
          </div>
        )}

        <div className="gallery-card-actions is-compact">
          <button
            type="button"
            data-gallery-action="details"
            data-gallery-entry-id={entry.id}
            {...{ [FOCUS_VISIBILITY_ANCHOR_ATTRIBUTE]: '.gallery-card' }}
            onClick={handleOpenDetails}
            onKeyDown={handleActionKeyDown}
            disabled={isDeleting}
            aria-label={`Spielen und Details zu ${difficultyLabel} vom ${completedAtLabel} oeffnen`}
          >
            <UploadScreenIcon name="playCircle" className="gallery-card-action-icon" />
            <span>Details</span>
          </button>
          <button
            type="button"
            className="secondary"
            data-gallery-action="collect"
            data-gallery-entry-id={entry.id}
            {...{ [FOCUS_VISIBILITY_ANCHOR_ATTRIBUTE]: '.gallery-card' }}
            onClick={handleCollect}
            onKeyDown={handleActionKeyDown}
            disabled={isDeleting || !onCollectEntry}
            aria-label={`Galerie-Bild ${difficultyLabel} vom ${completedAtLabel} zu einer Sammlung hinzufuegen`}
          >
            <UploadScreenIcon name="folderHeart" className="gallery-card-action-icon" />
            <span>Sammeln</span>
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
            <UploadScreenIcon name="trash" className="gallery-card-action-icon" />
            <span>{isDeleting ? 'Loesche ...' : 'Loeschen'}</span>
          </button>
        </div>
      </div>
    </article>
  )
})

export default UploadGalleryCard
