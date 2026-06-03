import type { AriaRole, CSSProperties, KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { handleDirectionalFocusNavigation } from '../../app/directionalFocusNavigation.ts'
import {
  ensureElementVisible,
  FOCUS_VISIBILITY_ANCHOR_ATTRIBUTE,
} from '../../app/focusVisibility.ts'
import AnimatedButton from '../../motion/AnimatedButton.tsx'
import AnimatedStateSwap from '../../motion/AnimatedStateSwap.tsx'
import { ImageCollection, SolvedGallery, SolvedGalleryEntry } from '../../types/index'
import { formatDifficultyLabel, formatPuzzleSize } from '../../utils/puzzleDifficulty.ts'
import UploadConfirmDialog from './UploadConfirmDialog.tsx'
import UploadScreenIcon from '../../components/UploadScreenIcon.tsx'
import {
  buildCollectionDisplayEntries,
  CollectionDisplayEntry,
  formatCollectionImageCount,
} from './UploadCollectionDisplayUtils.ts'
import UploadGalleryDetailDialog from './UploadGalleryDetailDialog.tsx'
import {
  buildGalleryDisplayEntries,
  GalleryDisplayEntry,
  getGalleryMotifKey,
  getSimilarGalleryEntries,
} from './UploadGalleryDisplayUtils.ts'
import { formatDate, formatTime } from './uploadUtils.ts'
import type { GalleryReplayRequestHandler } from './galleryReplayRequest.ts'
import UploadPageNavigation from './UploadPageNavigation.tsx'
import UploadStateNotice from './UploadStateNotice.tsx'
import { useUploadImagePalette } from './uploadImagePalette.ts'

interface UploadCollectionsPanelProps {
  collections: ImageCollection[]
  gallery: SolvedGallery | null
  isLoadingCollections: boolean
  onReplayEntry: GalleryReplayRequestHandler
  onTagFilter?: (tagLabel: string) => void
  onFetchRandomImage?: (query?: string) => Promise<void> | void
  onUpdateCollection: (
    collectionId: string,
    updates: Pick<ImageCollection, 'name'> & Partial<Pick<ImageCollection, 'description'>>
  ) => Promise<void>
  onDeleteCollection: (collectionId: string) => Promise<void>
  onRemoveCollectionImages: (collectionId: string, imageIds: string[]) => Promise<void>
  titleId?: string
  panelRole?: AriaRole
  primaryActionRef?: RefObject<HTMLButtonElement>
  paletteStyle?: CSSProperties
}

interface RenameState {
  collection: ImageCollection
  name: string
  description: string
}

type CollectionImageAction = 'preview' | 'details' | 'remove'

interface PendingCollectionImageRemovalFocus {
  action: CollectionImageAction
  imageId: string
  visibleIndex: number
}

const COLLECTION_MOTIFS_PER_PAGE = 9

export default function UploadCollectionsPanel({
  collections,
  gallery,
  isLoadingCollections,
  onReplayEntry,
  onTagFilter,
  onFetchRandomImage,
  onUpdateCollection,
  onDeleteCollection,
  onRemoveCollectionImages,
  titleId = 'workspace-window-collections-title',
  panelRole = 'region',
  primaryActionRef,
  paletteStyle,
}: UploadCollectionsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const pendingImageRemovalFocusRef = useRef<PendingCollectionImageRemovalFocus | null>(null)
  const galleryEntries = useMemo(() => gallery?.entries ?? [], [gallery])
  const displayEntries = useMemo(
    () => buildCollectionDisplayEntries(collections, galleryEntries),
    [collections, galleryEntries]
  )
  const galleryDetailEntries = useMemo(
    () => buildGalleryDisplayEntries(galleryEntries, {
      difficultyFilter: 'all',
      assistanceFilter: 'all',
    }),
    [galleryEntries]
  )
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(displayEntries[0]?.collection.id ?? null)
  const [selectedDetailEntry, setSelectedDetailEntry] = useState<GalleryDisplayEntry | null>(null)
  const [renamingCollection, setRenamingCollection] = useState<RenameState | null>(null)
  const [pendingDeleteCollection, setPendingDeleteCollection] = useState<ImageCollection | null>(null)
  const [busyCollectionId, setBusyCollectionId] = useState<string | null>(null)
  const [currentCollectionPage, setCurrentCollectionPage] = useState(1)
  const selectedDisplayEntry =
    displayEntries.find((entry) => entry.collection.id === selectedCollectionId)
    ?? displayEntries[0]
    ?? null
  const collectionPageCount = Math.max(
    1,
    Math.ceil((selectedDisplayEntry?.entries.length ?? 0) / COLLECTION_MOTIFS_PER_PAGE)
  )
  const activeCollectionPage = Math.min(currentCollectionPage, collectionPageCount)
  const similarDetailEntries = useMemo(
    () => selectedDetailEntry ? getSimilarGalleryEntries(selectedDetailEntry, galleryDetailEntries) : [],
    [galleryDetailEntries, selectedDetailEntry]
  )
  const pagedCollectionEntries = useMemo(() => {
    const entries = selectedDisplayEntry?.entries ?? []
    const startIndex = (activeCollectionPage - 1) * COLLECTION_MOTIFS_PER_PAGE
    return entries.slice(startIndex, startIndex + COLLECTION_MOTIFS_PER_PAGE)
  }, [activeCollectionPage, selectedDisplayEntry])
  const collectionsStateKey = isLoadingCollections
    ? 'loading'
    : displayEntries.length === 0
      ? 'empty'
      : 'content'

  useEffect(() => {
    setCurrentCollectionPage(1)
  }, [selectedDisplayEntry?.collection.id])

  useEffect(() => {
    setCurrentCollectionPage((page) => Math.min(page, collectionPageCount))
  }, [collectionPageCount])

  const focusPanelElement = useCallback((target: HTMLElement | null) => {
    if (!target) {
      return
    }

    target.focus({ preventScroll: true })
    ensureElementVisible(target)
  }, [])

  const findCollectionImageActionButton = useCallback((
    imageId: string,
    action: CollectionImageAction
  ): HTMLButtonElement | null => {
    const panel = panelRef.current
    if (!panel) {
      return null
    }

    return Array.from(
      panel.querySelectorAll<HTMLButtonElement>(`button[data-collection-image-action="${action}"]:not([disabled])`)
    ).find((button) => button.dataset.collectionImageId === imageId) ?? null
  }, [])

  const findCollectionImageFallbackButton = useCallback((imageId: string): HTMLButtonElement | null => {
    const panel = panelRef.current
    if (!panel) {
      return null
    }

    return Array.from(
      panel.querySelectorAll<HTMLButtonElement>('button[data-collection-image-id]:not([disabled])')
    ).find((button) => button.dataset.collectionImageId === imageId) ?? null
  }, [])

  const findCollectionsFallbackTarget = useCallback((): HTMLElement | null => {
    const panel = panelRef.current
    if (!panel) {
      return null
    }

    return (
      panel.querySelector<HTMLElement>('.collection-list-item.is-selected:not([disabled])')
      ?? panel
        .closest<HTMLElement>('.workspace-window-shell')
        ?.querySelector<HTMLElement>('.workspace-window-nav-button[aria-current="page"]')
      ?? null
    )
  }, [])

  useEffect(() => {
    const focusRequest = pendingImageRemovalFocusRef.current
    if (!focusRequest || busyCollectionId !== null) {
      return
    }

    const selectedEntries = selectedDisplayEntry?.entries ?? []
    const isStillInCollection = selectedEntries.some((entry) => entry.id === focusRequest.imageId)

    if (isStillInCollection) {
      pendingImageRemovalFocusRef.current = null
      const frameId = window.requestAnimationFrame(() => {
        focusPanelElement(
          findCollectionImageActionButton(focusRequest.imageId, focusRequest.action)
          ?? findCollectionImageFallbackButton(focusRequest.imageId)
          ?? findCollectionsFallbackTarget()
        )
      })

      return () => {
        window.cancelAnimationFrame(frameId)
      }
    }

    const nextEntry =
      pagedCollectionEntries[focusRequest.visibleIndex]
      ?? pagedCollectionEntries[focusRequest.visibleIndex - 1]
      ?? null

    pendingImageRemovalFocusRef.current = null

    const frameId = window.requestAnimationFrame(() => {
      if (nextEntry) {
        focusPanelElement(
          findCollectionImageActionButton(nextEntry.id, focusRequest.action)
          ?? findCollectionImageActionButton(nextEntry.id, 'preview')
          ?? findCollectionImageFallbackButton(nextEntry.id)
        )
        return
      }

      focusPanelElement(findCollectionsFallbackTarget())
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [
    busyCollectionId,
    findCollectionImageActionButton,
    findCollectionImageFallbackButton,
    findCollectionsFallbackTarget,
    focusPanelElement,
    pagedCollectionEntries,
    selectedDisplayEntry?.entries,
  ])

  async function handleRenameSubmit() {
    if (!renamingCollection || !renamingCollection.name.trim()) {
      return
    }

    setBusyCollectionId(renamingCollection.collection.id)
    try {
      await onUpdateCollection(renamingCollection.collection.id, {
        name: renamingCollection.name,
        description: renamingCollection.description,
      })
      setRenamingCollection(null)
    } finally {
      setBusyCollectionId(null)
    }
  }

  async function handleDeleteConfirm() {
    if (!pendingDeleteCollection) {
      return
    }

    setBusyCollectionId(pendingDeleteCollection.id)
    try {
      await onDeleteCollection(pendingDeleteCollection.id)
      setPendingDeleteCollection(null)
      setSelectedCollectionId(null)
    } finally {
      setBusyCollectionId(null)
    }
  }

  async function handleRemoveImage(collectionId: string, imageId: string) {
    const activeElement = document.activeElement
    pendingImageRemovalFocusRef.current = {
      imageId,
      action:
        activeElement instanceof HTMLButtonElement
        && activeElement.dataset.collectionImageId === imageId
        && activeElement.dataset.collectionImageAction
          ? activeElement.dataset.collectionImageAction as CollectionImageAction
          : 'remove',
      visibleIndex: pagedCollectionEntries.findIndex((entry) => entry.id === imageId),
    }
    setBusyCollectionId(collectionId)
    try {
      await onRemoveCollectionImages(collectionId, [imageId])
    } finally {
      setBusyCollectionId(null)
    }
  }

  function handleOpenImageDetails(galleryEntry: SolvedGalleryEntry) {
    const motifKey = getGalleryMotifKey(galleryEntry)
    const detailEntry = galleryDetailEntries.find((entry) => entry.id === motifKey)
    if (detailEntry) {
      setSelectedDetailEntry(detailEntry)
    }
  }

  const handleDetailTagFilter = useCallback((tagLabel: string) => {
    setSelectedDetailEntry(null)
    onTagFilter?.(tagLabel)
  }, [onTagFilter])

  const handleDetailTagImageSearch = useCallback((tagLabel: string) => {
    setSelectedDetailEntry(null)
    void onFetchRandomImage?.(tagLabel)
  }, [onFetchRandomImage])

  return (
    <>
      <div
        ref={panelRef}
        id="dashboard-panel-collections"
        className="dashboard-panel-scroll"
        role={panelRole}
        aria-labelledby={titleId}
      >
        <div className="dashboard-section-header">
          <div>
            <span className="saved-games-kicker">Sammlungen</span>
            <h3 id={titleId} className="dashboard-section-title">
              Eigene Motivgruppen
            </h3>
          </div>
          {!isLoadingCollections && collections.length > 0 && (
            <span className="dashboard-section-note">
              {collections.length} {collections.length === 1 ? 'Sammlung' : 'Sammlungen'}
            </span>
          )}
        </div>

        <AnimatedStateSwap stateKey={collectionsStateKey} className="dashboard-state-swap">
          {isLoadingCollections ? (
            <UploadStateNotice
              icon={'\u{1F5C2}'}
              iconName="folder"
              title="Sammlungen werden geladen ..."
              detail="Favoriten und Motivgruppen werden aus dem lokalen Speicher vorbereitet."
              role="status"
              ariaLive="polite"
            />
          ) : displayEntries.length === 0 ? (
            <UploadStateNotice
              icon={'\u{1F5C2}'}
              iconName="folder"
              title="Noch keine Sammlung vorhanden."
              detail="Fuege in der Galerie ein geloestes Motiv zu einer neuen Sammlung hinzu."
            />
          ) : (
            <div className="collections-workspace-grid">
              <div className="collections-list" aria-label="Sammlungen" onKeyDown={handleDirectionalFocusNavigation}>
                {displayEntries.map((entry, index) => (
                  <CollectionListButton
                    key={entry.collection.id}
                    entry={entry}
                    isSelected={selectedDisplayEntry?.collection.id === entry.collection.id}
                    buttonRef={index === 0 ? primaryActionRef : undefined}
                    onSelect={() => setSelectedCollectionId(entry.collection.id)}
                  />
                ))}
              </div>

              {selectedDisplayEntry ? (
                <CollectionDetail
                  entry={selectedDisplayEntry}
                  activePage={activeCollectionPage}
                  busyCollectionId={busyCollectionId}
                  pageCount={collectionPageCount}
                  pagedEntries={pagedCollectionEntries}
                  onOpenImageDetails={handleOpenImageDetails}
                  onPageChange={setCurrentCollectionPage}
                  onRename={() => setRenamingCollection({
                    collection: selectedDisplayEntry.collection,
                    name: selectedDisplayEntry.collection.name,
                    description: selectedDisplayEntry.collection.description ?? '',
                  })}
                  onDelete={() => setPendingDeleteCollection(selectedDisplayEntry.collection)}
                  onRemoveImage={handleRemoveImage}
                />
              ) : null}
            </div>
          )}
        </AnimatedStateSwap>
      </div>

      {renamingCollection ? (
        <UploadConfirmDialog
          titleId="collection-rename-title"
          title="Sammlung bearbeiten"
          description={
            <div className="collection-edit-form">
              <label className="collection-dialog-field">
                <span>Name</span>
                <input
                  value={renamingCollection.name}
                  onChange={(event) => setRenamingCollection((current) =>
                    current ? { ...current, name: event.target.value } : current
                  )}
                  maxLength={80}
                  disabled={busyCollectionId === renamingCollection.collection.id}
                />
              </label>
              <label className="collection-dialog-field">
                <span>Notiz</span>
                <textarea
                  value={renamingCollection.description}
                  onChange={(event) => setRenamingCollection((current) =>
                    current ? { ...current, description: event.target.value } : current
                  )}
                  maxLength={220}
                  disabled={busyCollectionId === renamingCollection.collection.id}
                />
              </label>
            </div>
          }
          confirmLabel="Speichern"
          busyLabel="Speichere ..."
          isBusy={busyCollectionId === renamingCollection.collection.id}
          onCancel={() => setRenamingCollection(null)}
          onConfirm={() => void handleRenameSubmit()}
          paletteStyle={paletteStyle}
        />
      ) : null}

      {pendingDeleteCollection ? (
        <UploadConfirmDialog
          titleId="collection-delete-title"
          title="Sammlung loeschen?"
          description={
            <p>
              Moechtest du <span className="delete-confirm-name">{pendingDeleteCollection.name}</span> loeschen?
              Die Galerie-Bilder bleiben erhalten.
            </p>
          }
          confirmLabel="Loeschen"
          busyLabel="Loesche ..."
          isBusy={busyCollectionId === pendingDeleteCollection.id}
          onCancel={() => setPendingDeleteCollection(null)}
          onConfirm={() => void handleDeleteConfirm()}
          paletteStyle={paletteStyle}
        />
      ) : null}

      {selectedDetailEntry ? (
        <UploadGalleryDetailDialog
          entry={selectedDetailEntry}
          onReplayEntry={onReplayEntry}
          onTagFilter={onTagFilter ? handleDetailTagFilter : undefined}
          onFetchRandomImage={onFetchRandomImage ? handleDetailTagImageSearch : undefined}
          onOpenSimilarEntry={setSelectedDetailEntry}
          similarEntries={similarDetailEntries}
          onClose={() => setSelectedDetailEntry(null)}
        />
      ) : null}
    </>
  )
}

function CollectionListButton({
  entry,
  isSelected,
  buttonRef,
  onSelect,
}: {
  entry: CollectionDisplayEntry
  isSelected: boolean
  buttonRef?: RefObject<HTMLButtonElement>
  onSelect: () => void
}) {
  const { activePalette, paletteStyle } = useUploadImagePalette({
    paletteSource: entry.previewEntry?.previewImage ?? entry.previewEntry?.sourceImage,
    storedPalette: entry.previewEntry?.imageTheme ?? null,
  })

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`collection-list-item${isSelected ? ' is-selected' : ''}`}
      style={paletteStyle}
      data-image-mood={activePalette?.mood}
      data-image-palette-source={activePalette?.source}
      onClick={onSelect}
      aria-current={isSelected ? 'true' : undefined}
    >
      <span className="collection-list-preview" aria-hidden="true">
        {entry.previewEntry?.previewImage ? (
          <img src={entry.previewEntry.previewImage} alt="" />
        ) : (
          <UploadScreenIcon name="folderHeart" className="collection-list-preview-icon" />
        )}
        {activePalette ? (
          <span className="image-card-palette collection-list-palette">
            <span className="image-card-palette-swatch image-card-palette-swatch-primary" />
            <span className="image-card-palette-swatch image-card-palette-swatch-accent" />
            <span className="image-card-palette-swatch image-card-palette-swatch-glow" />
          </span>
        ) : null}
      </span>
      <span className="collection-list-copy">
        <strong>{entry.collection.name}</strong>
        <span>{formatCollectionImageCount(entry.entries.length)}</span>
      </span>
    </button>
  )
}

function CollectionDetail({
  entry,
  activePage,
  busyCollectionId,
  pageCount,
  pagedEntries,
  onOpenImageDetails,
  onPageChange,
  onRename,
  onDelete,
  onRemoveImage,
}: {
  entry: CollectionDisplayEntry
  activePage: number
  busyCollectionId: string | null
  pageCount: number
  pagedEntries: CollectionDisplayEntry['entries']
  onOpenImageDetails: (galleryEntry: SolvedGalleryEntry) => void
  onPageChange: (page: number) => void
  onRename: () => void
  onDelete: () => void
  onRemoveImage: (collectionId: string, imageId: string) => Promise<void>
}) {
  const isBusy = busyCollectionId === entry.collection.id

  const handleImageActionKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
      return
    }

    const currentButton = event.currentTarget
    const action = currentButton.dataset.collectionImageAction
    const card = currentButton.closest<HTMLElement>('.collection-image-card')
    const grid = currentButton.closest<HTMLElement>('.collection-image-grid')

    if (!action || !card || !grid) {
      return
    }

    const cardButtons = Array.from(
      card.querySelectorAll<HTMLButtonElement>('button[data-collection-image-action]:not([disabled])')
    )
    const sameActionButtons = Array.from(
      grid.querySelectorAll<HTMLButtonElement>(`button[data-collection-image-action="${action}"]:not([disabled])`)
    )
    const cardIndex = cardButtons.indexOf(currentButton)
    const actionIndex = sameActionButtons.indexOf(currentButton)

    const focusButton = (button: HTMLButtonElement | undefined) => {
      if (!button) {
        return
      }

      button.focus({ preventScroll: true })
      const visibleTarget = button.closest<HTMLElement>('.collection-image-card') ?? button
      ensureElementVisible(visibleTarget)
    }

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
          event.preventDefault()
          focusButton(sameActionButtons[actionIndex - 1])
        }
        return
      case 'ArrowDown':
        if (actionIndex >= 0 && actionIndex < sameActionButtons.length - 1) {
          event.preventDefault()
          focusButton(sameActionButtons[actionIndex + 1])
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
  }, [])

  return (
    <section className="collection-detail" aria-label={`Sammlung ${entry.collection.name}`}>
      <div className="collection-detail-header">
        <div>
          <span className="saved-games-kicker">Sammlung</span>
          <h4>{entry.collection.name}</h4>
          {entry.collection.description ? <p>{entry.collection.description}</p> : null}
        </div>
        <div className="collection-detail-actions">
          <AnimatedButton className="secondary" onClick={onRename} disabled={isBusy}>
            Bearbeiten
          </AnimatedButton>
          <AnimatedButton className="secondary" onClick={onDelete} disabled={isBusy}>
            Loeschen
          </AnimatedButton>
        </div>
      </div>

      <div className="dashboard-inline-chips collection-detail-chips">
        <span className="saved-game-chip">{formatCollectionImageCount(entry.entries.length)}</span>
        <span className="saved-game-chip">Aktualisiert {formatDate(entry.collection.updatedAt)}</span>
        {entry.missingImageCount > 0 ? (
          <span className="saved-game-chip">{entry.missingImageCount} bereinigt</span>
        ) : null}
      </div>

      {entry.entries.length === 0 ? (
        <UploadStateNotice
          icon={'\u{1F5BC}'}
          iconName="image"
          title="Diese Sammlung ist leer."
          detail="Fuege in der Galerie wieder Motive hinzu oder loesche die Sammlung."
          className="collection-detail-empty"
        />
      ) : (
        <>
          <div className="collection-image-grid" aria-label="Motive in dieser Sammlung">
            {pagedEntries.map((galleryEntry) => (
              <CollectionImageCard
                key={galleryEntry.id}
                collectionId={entry.collection.id}
                galleryEntry={galleryEntry}
                isBusy={isBusy}
                onActionKeyDown={handleImageActionKeyDown}
                onRemoveImage={onRemoveImage}
                onOpenDetails={onOpenImageDetails}
              />
            ))}
          </div>
          <UploadPageNavigation
            activePage={activePage}
            ariaLabel={`Sammlungsmotivseiten fuer ${entry.collection.name}`}
            isDisabled={isBusy}
            onPageChange={onPageChange}
            pageCount={pageCount}
          />
        </>
      )}
    </section>
  )
}

function CollectionImageCard({
  collectionId,
  galleryEntry,
  isBusy,
  onActionKeyDown,
  onRemoveImage,
  onOpenDetails,
}: {
  collectionId: string
  galleryEntry: SolvedGalleryEntry
  isBusy: boolean
  onActionKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void
  onRemoveImage: (collectionId: string, imageId: string) => Promise<void>
  onOpenDetails: (galleryEntry: SolvedGalleryEntry) => void
}) {
  const { activePalette, paletteStyle } = useUploadImagePalette({
    paletteSource: galleryEntry.previewImage ?? galleryEntry.sourceImage,
    storedPalette: galleryEntry.imageTheme ?? null,
  })
  const difficultyLabel = formatDifficultyLabel(galleryEntry.config)

  return (
    <article
      className="collection-image-card"
      style={paletteStyle}
      data-image-mood={activePalette?.mood}
      data-image-palette-source={activePalette?.source}
    >
      <button
        type="button"
        className="collection-image-preview"
        data-collection-image-action="preview"
        data-collection-image-id={galleryEntry.id}
        {...{ [FOCUS_VISIBILITY_ANCHOR_ATTRIBUTE]: '.collection-image-card' }}
        onClick={() => onOpenDetails(galleryEntry)}
        onKeyDown={onActionKeyDown}
        disabled={isBusy}
        aria-label={`Details zu ${difficultyLabel} aus Sammlung anzeigen`}
      >
        {galleryEntry.previewImage ? (
          <img
            src={galleryEntry.previewImage}
            alt={`Geloestes Puzzle ${difficultyLabel} vom ${formatDate(galleryEntry.completedAt)}`}
          />
        ) : (
          <span>Bild</span>
        )}
        {activePalette ? (
          <span className="image-card-palette collection-image-palette" aria-hidden="true">
            <span className="image-card-palette-swatch image-card-palette-swatch-primary" />
            <span className="image-card-palette-swatch image-card-palette-swatch-accent" />
            <span className="image-card-palette-swatch image-card-palette-swatch-glow" />
          </span>
        ) : null}
      </button>
      <div className="collection-image-card-body">
        <strong>{difficultyLabel}</strong>
        <span>{formatPuzzleSize(galleryEntry.config)}</span>
        <span>{formatTime(galleryEntry.time)} - {galleryEntry.moves} Netto</span>
      </div>
      <div className="collection-image-actions">
        <AnimatedButton
          data-collection-image-action="details"
          data-collection-image-id={galleryEntry.id}
          {...{ [FOCUS_VISIBILITY_ANCHOR_ATTRIBUTE]: '.collection-image-card' }}
          onClick={() => onOpenDetails(galleryEntry)}
          onKeyDown={onActionKeyDown}
          disabled={isBusy}
        >
          Details
        </AnimatedButton>
        <AnimatedButton
          className="secondary gallery-card-delete-button"
          data-collection-image-action="remove"
          data-collection-image-id={galleryEntry.id}
          {...{ [FOCUS_VISIBILITY_ANCHOR_ATTRIBUTE]: '.collection-image-card' }}
          onClick={() => void onRemoveImage(collectionId, galleryEntry.id)}
          onKeyDown={onActionKeyDown}
          disabled={isBusy}
        >
          Entfernen
        </AnimatedButton>
      </div>
    </article>
  )
}
