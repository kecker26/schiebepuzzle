import {
  memo,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useMemo,
} from 'react'
import { Medal } from 'lucide-react'
import {
  ensureElementVisible,
  FOCUS_VISIBILITY_ANCHOR_ATTRIBUTE,
} from '../../app/focusVisibility.ts'
import { getDirectionalFocusTarget } from '../../app/directionalFocusNavigation.ts'
import UploadScreenIcon from '../../components/UploadScreenIcon.tsx'
import BusyIndicator from '../../motion/BusyIndicator.tsx'
import { ImageCollection, ImageThemePalette, SolvedGalleryEntry } from '../../types/index'
import { formatDifficultyLabel } from '../../utils/puzzleDifficulty.ts'
import {
  formatChallengeMedalLabel,
  getChallengeMedalEmoji,
  getChallengeMedalProgress,
} from '../../utils/galleryChallenge.ts'
import { GalleryDisplayEntry, formatGallerySolveCount } from './UploadGalleryDisplayUtils.ts'
import { getTagCollectionSuggestions } from './galleryTagCollectionSync.ts'
import { useUploadImagePalette } from './uploadImagePalette.ts'
import { formatDate } from './uploadUtils.ts'

interface UploadGalleryCardProps {
  entry: GalleryDisplayEntry
  onOpenDetails: (entry: GalleryDisplayEntry) => void
  onCollectEntry?: (entry: GalleryDisplayEntry) => void
  onTagFilter?: (tagLabel: string) => void
  onRetryTagging?: (entry: SolvedGalleryEntry) => Promise<void>
  onAddSuggestedCollection?: (
    collectionId: string,
    entry: GalleryDisplayEntry,
    source: 'tag' | 'ai'
  ) => void
  collections?: ImageCollection[]
  suggestedCollectionBusyKey?: string | null
  retryingTagEntryId?: string | null
  onDeleteEntry: (entry: GalleryDisplayEntry) => void
  isDeleting: boolean
}

function findStoredCardPalette(entry: GalleryDisplayEntry): ImageThemePalette | null {
  return (
    entry.representativeEntry.imageTheme
    ?? entry.visibleEntries.find((galleryEntry) => galleryEntry.imageTheme)?.imageTheme
    ?? entry.allEntries.find((galleryEntry) => galleryEntry.imageTheme)?.imageTheme
    ?? null
  )
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
  const storedPalette = useMemo(() => findStoredCardPalette(entry), [entry])
  const difficultyLabel = formatDifficultyLabel(representativeEntry.config)
  const completedAtLabel = formatDate(representativeEntry.completedAt)
  const totalSolveCountLabel = formatGallerySolveCount(entry.motifReplaySummary.totalSolveCount)
  const bestChallengeMedal = entry.motifReplaySummary.bestChallengeMedal
  const medalProgress = useMemo(
    () => getChallengeMedalProgress(entry.motifReplaySummary.allEntries),
    [entry.motifReplaySummary.allEntries]
  )
  const aiTags = representativeEntry.tags ?? []
  const aiTagging = representativeEntry.aiTagging ?? null
  const motifEntryIds = new Set(entry.allEntries.map((galleryEntry) => galleryEntry.id))
  const tagCollectionSuggestions = getTagCollectionSuggestions(collections, entry.allEntries)
    .map(({ collection, tagLabel }) => ({
      collection,
      reason: `Tag-Vorschlag: Das Motiv ist mit #${tagLabel} getaggt.`,
      source: 'tag' as const,
    }))
  const tagCollectionIds = new Set(tagCollectionSuggestions.map(({ collection }) => collection.id))
  const aiCollectionSuggestions = (aiTagging?.collectionSuggestions ?? [])
    .map((suggestion) => ({
      reason: suggestion.reason
        ? `KI-Vorschlag: ${suggestion.reason}`
        : 'KI-Vorschlag auf Grundlage der Bildanalyse.',
      collection: collections.find((collection) => collection.id === suggestion.collectionId) ?? null,
      source: 'ai' as const,
    }))
    .filter(({ collection }) =>
      collection
      && !tagCollectionIds.has(collection.id)
      && !collection.imageIds.some((imageId) => motifEntryIds.has(imageId))
    )
  const remainingAiSuggestionSlots = Math.max(0, 2 - tagCollectionSuggestions.length)
  const collectionSuggestions = [
    ...tagCollectionSuggestions,
    ...aiCollectionSuggestions.slice(0, remainingAiSuggestionSlots),
  ]
  const { activePalette, paletteStyle: cardPaletteStyle } = useUploadImagePalette({
    paletteSource: representativeEntry.previewImage ?? representativeEntry.sourceImage,
    storedPalette,
  })

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
    <article
      className="gallery-card"
      style={cardPaletteStyle}
      data-image-mood={activePalette?.mood}
      data-image-palette-source={activePalette?.source}
    >
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
        data-app-tooltip="Galerie-Details, Laufverlauf und Replay-Optionen oeffnen."
        data-app-tooltip-align="start"
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
        {activePalette ? (
          <span
            className="gallery-card-palette"
            aria-hidden="true"
            data-app-tooltip={`Lokale Bildstimmung: ${activePalette.mood}.`}
            data-app-tooltip-position="top"
          >
            <span className="gallery-card-palette-swatch gallery-card-palette-swatch-primary" />
            <span className="gallery-card-palette-swatch gallery-card-palette-swatch-accent" />
            <span className="gallery-card-palette-swatch gallery-card-palette-swatch-glow" />
          </span>
        ) : null}
        {bestChallengeMedal ? (
          <span
            className={`gallery-card-challenge-medal is-${bestChallengeMedal}`}
            aria-label={`Beste Challenge-Medaille: ${formatChallengeMedalLabel(bestChallengeMedal)}`}
            data-app-tooltip={`${formatChallengeMedalLabel(bestChallengeMedal)} ist die beste Challenge-Medaille fuer dieses Motiv.`}
            data-app-tooltip-position="top"
          >
            <Medal aria-hidden="true" size={18} strokeWidth={2.4} />
          </span>
        ) : null}
      </button>

      <div className="gallery-card-body">
        <div
          className={`gallery-card-medal-progress${medalProgress.currentMedal ? '' : ' is-empty'}`}
          aria-label={medalProgress.label}
          data-app-tooltip={medalProgress.label}
          data-app-tooltip-position="top"
        >
          <div className="gallery-card-medal-progress-head">
            <span>Medaillen-Fortschritt</span>
            <strong>
              {medalProgress.currentMedal
                ? formatChallengeMedalLabel(medalProgress.currentMedal)
                : 'Noch keine'}
            </strong>
          </div>
          <div className="gallery-card-medal-progress-track" aria-hidden="true">
            {medalProgress.stages.map((stage) => (
              <span
                key={stage.medal}
                className={`gallery-card-medal-progress-stage is-${stage.medal} is-${stage.status}`}
              >
                <span>{getChallengeMedalEmoji(stage.medal)}</span>
                <small>{formatChallengeMedalLabel(stage.medal)}</small>
              </span>
            ))}
          </div>
        </div>

        {aiTags.length > 0 || collectionSuggestions.length > 0 ? (
          <div className="gallery-card-ai" aria-label="Tags und Sammlungsvorschlaege">
            <div className="gallery-card-run-count" aria-label={`Gesamtzahl der Laeufe: ${totalSolveCountLabel}`}>
              <UploadScreenIcon name="refreshCw" className="gallery-card-run-count-icon" />
              <span>{totalSolveCountLabel}</span>
            </div>

            {aiTags.length > 0 ? (
              <div className="gallery-card-ai-tags">
                {aiTags.map((tag) => (
                  <button
                    key={tag.label}
                    type="button"
                    data-gallery-action="tag"
                    data-gallery-entry-id={entry.id}
                    {...{ [FOCUS_VISIBILITY_ANCHOR_ATTRIBUTE]: '.gallery-card' }}
                    onClick={() => onTagFilter?.(tag.label)}
                    onKeyDown={handleActionKeyDown}
                    disabled={isDeleting || !onTagFilter}
                    data-app-tooltip={`Galerie nach #${tag.label} filtern.`}
                    data-app-tooltip-position="top"
                  >
                    #{tag.label}
                  </button>
                ))}
              </div>
            ) : null}

            {collectionSuggestions.length > 0 ? (
              <div className="gallery-card-ai-suggestions">
                {collectionSuggestions.map(({ reason, collection, source }) => {
                  if (!collection) return null

                  const busyKey = `${entry.id}:${collection.id}`
                  const isBusy = suggestedCollectionBusyKey === busyKey
                  const isAiSuggestion = source === 'ai'

                  return (
                    <button
                      key={collection.id}
                      type="button"
                      className={`gallery-card-ai-suggestion${isAiSuggestion ? ' is-ai' : ' is-tag-match'}`}
                      data-gallery-action="suggestion"
                      data-gallery-entry-id={entry.id}
                      data-suggestion-source={source}
                      {...{ [FOCUS_VISIBILITY_ANCHOR_ATTRIBUTE]: '.gallery-card' }}
                      aria-label={`${isAiSuggestion ? 'KI-Vorschlag' : 'Tag-Vorschlag'} ${collection.name}`}
                      onClick={() => onAddSuggestedCollection?.(collection.id, entry, source)}
                      onKeyDown={handleActionKeyDown}
                      disabled={isDeleting || isBusy || !onAddSuggestedCollection}
                      data-app-tooltip={reason || `Dieses Motiv zur Sammlung ${collection.name} hinzufuegen.`}
                      data-app-tooltip-position="top"
                    >
                      <UploadScreenIcon name="sparkles" className="gallery-card-action-icon" />
                      {isAiSuggestion ? <span className="gallery-card-ai-suggestion-label">KI</span> : null}
                      <span>{isBusy ? <BusyIndicator label="Sortiere ..." /> : collection.name}</span>
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
            data-app-tooltip="Details oeffnen, Lauf vergleichen oder Motiv erneut spielen."
            data-app-tooltip-position="top"
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
            data-app-tooltip="Motiv zu einer bestehenden oder neuen Sammlung hinzufuegen."
            data-app-tooltip-position="top"
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
            data-app-tooltip="Galerie-Eintrag aus der lokalen Galerie loeschen."
            data-app-tooltip-position="top"
          >
            <UploadScreenIcon name="trash" className="gallery-card-action-icon" />
            <span>{isDeleting ? <BusyIndicator label="Loesche ..." /> : 'Loeschen'}</span>
          </button>
        </div>
      </div>
    </article>
  )
})

export default UploadGalleryCard
