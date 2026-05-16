import type { AriaRole, RefObject } from 'react'
import { useMemo, useState } from 'react'
import AnimatedButton from '../../motion/AnimatedButton.tsx'
import AnimatedStateSwap from '../../motion/AnimatedStateSwap.tsx'
import { ImageCollection, SolvedGallery } from '../../types/index'
import { formatDifficultyLabel, formatPuzzleSize } from '../../utils/puzzleDifficulty.ts'
import UploadConfirmDialog from './UploadConfirmDialog.tsx'
import UploadScreenIcon from '../../components/UploadScreenIcon.tsx'
import {
  buildCollectionDisplayEntries,
  CollectionDisplayEntry,
  formatCollectionImageCount,
} from './UploadCollectionDisplayUtils.ts'
import { formatDate, formatTime } from './uploadUtils.ts'
import type { GalleryReplayRequestHandler } from './galleryReplayRequest.ts'
import UploadStateNotice from './UploadStateNotice.tsx'

interface UploadCollectionsPanelProps {
  collections: ImageCollection[]
  gallery: SolvedGallery | null
  isLoadingCollections: boolean
  onReplayEntry: GalleryReplayRequestHandler
  onUpdateCollection: (
    collectionId: string,
    updates: Pick<ImageCollection, 'name'> & Partial<Pick<ImageCollection, 'description'>>
  ) => Promise<void>
  onDeleteCollection: (collectionId: string) => Promise<void>
  onRemoveCollectionImages: (collectionId: string, imageIds: string[]) => Promise<void>
  titleId?: string
  panelRole?: AriaRole
  primaryActionRef?: RefObject<HTMLButtonElement>
}

interface RenameState {
  collection: ImageCollection
  name: string
  description: string
}

export default function UploadCollectionsPanel({
  collections,
  gallery,
  isLoadingCollections,
  onReplayEntry,
  onUpdateCollection,
  onDeleteCollection,
  onRemoveCollectionImages,
  titleId = 'workspace-window-collections-title',
  panelRole = 'region',
  primaryActionRef,
}: UploadCollectionsPanelProps) {
  const galleryEntries = useMemo(() => gallery?.entries ?? [], [gallery])
  const displayEntries = useMemo(
    () => buildCollectionDisplayEntries(collections, galleryEntries),
    [collections, galleryEntries]
  )
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(displayEntries[0]?.collection.id ?? null)
  const [renamingCollection, setRenamingCollection] = useState<RenameState | null>(null)
  const [pendingDeleteCollection, setPendingDeleteCollection] = useState<ImageCollection | null>(null)
  const [busyCollectionId, setBusyCollectionId] = useState<string | null>(null)
  const selectedDisplayEntry =
    displayEntries.find((entry) => entry.collection.id === selectedCollectionId)
    ?? displayEntries[0]
    ?? null
  const collectionsStateKey = isLoadingCollections
    ? 'loading'
    : displayEntries.length === 0
      ? 'empty'
      : 'content'

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
    setBusyCollectionId(collectionId)
    try {
      await onRemoveCollectionImages(collectionId, [imageId])
    } finally {
      setBusyCollectionId(null)
    }
  }

  return (
    <>
      <div
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
              <div className="collections-list" aria-label="Sammlungen">
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
                  busyCollectionId={busyCollectionId}
                  onReplayEntry={onReplayEntry}
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
  return (
    <button
      ref={buttonRef}
      type="button"
      className={`collection-list-item${isSelected ? ' is-selected' : ''}`}
      onClick={onSelect}
      aria-current={isSelected ? 'true' : undefined}
    >
      <span className="collection-list-preview" aria-hidden="true">
        {entry.previewEntry?.previewImage ? (
          <img src={entry.previewEntry.previewImage} alt="" />
        ) : (
          <UploadScreenIcon name="folderHeart" className="collection-list-preview-icon" />
        )}
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
  busyCollectionId,
  onReplayEntry,
  onRename,
  onDelete,
  onRemoveImage,
}: {
  entry: CollectionDisplayEntry
  busyCollectionId: string | null
  onReplayEntry: GalleryReplayRequestHandler
  onRename: () => void
  onDelete: () => void
  onRemoveImage: (collectionId: string, imageId: string) => Promise<void>
}) {
  const isBusy = busyCollectionId === entry.collection.id

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
        <div className="collection-image-grid" aria-label="Motive in dieser Sammlung">
          {entry.entries.map((galleryEntry) => (
            <article key={galleryEntry.id} className="collection-image-card">
              <button
                type="button"
                className="collection-image-preview"
                onClick={() => onReplayEntry(galleryEntry)}
                disabled={isBusy || !galleryEntry.sourceImage && !galleryEntry.previewImage}
                aria-label={`${formatDifficultyLabel(galleryEntry.config)} aus Sammlung spielen`}
              >
                {galleryEntry.previewImage ? (
                  <img
                    src={galleryEntry.previewImage}
                    alt={`Geloestes Puzzle ${formatDifficultyLabel(galleryEntry.config)} vom ${formatDate(galleryEntry.completedAt)}`}
                  />
                ) : (
                  <span>Bild</span>
                )}
              </button>
              <div className="collection-image-card-body">
                <strong>{formatDifficultyLabel(galleryEntry.config)}</strong>
                <span>{formatPuzzleSize(galleryEntry.config)}</span>
                <span>{formatTime(galleryEntry.time)} - {galleryEntry.moves} Netto</span>
              </div>
              <div className="collection-image-actions">
                <AnimatedButton
                  className="secondary"
                  onClick={() => onReplayEntry(galleryEntry)}
                  disabled={isBusy || !galleryEntry.sourceImage && !galleryEntry.previewImage}
                >
                  Spielen
                </AnimatedButton>
                <AnimatedButton
                  className="secondary"
                  onClick={() => void onRemoveImage(entry.collection.id, galleryEntry.id)}
                  disabled={isBusy}
                >
                  Entfernen
                </AnimatedButton>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
