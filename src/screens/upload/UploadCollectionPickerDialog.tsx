import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import AnimatedButton from '../../motion/AnimatedButton.tsx'
import AnimatedDialog from '../../motion/AnimatedDialog.tsx'
import { ImageCollection } from '../../types/index'
import { formatCollectionImageCount } from './UploadCollectionDisplayUtils.ts'

interface UploadCollectionPickerDialogProps {
  collections: ImageCollection[]
  imageIds: string[]
  imageLabel: string
  isBusy: boolean
  onCreateCollection: (name: string, imageIds: string[]) => Promise<void>
  onAddToCollection: (collectionId: string, imageIds: string[]) => Promise<void>
  onClose: () => void
}

export default function UploadCollectionPickerDialog({
  collections,
  imageIds,
  imageLabel,
  isBusy,
  onCreateCollection,
  onAddToCollection,
  onClose,
}: UploadCollectionPickerDialogProps) {
  const titleId = 'collection-picker-title'
  const descriptionId = 'collection-picker-description'
  const initialFocusRef = useRef<HTMLInputElement>(null)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [selectedCollectionId, setSelectedCollectionId] = useState(collections[0]?.id ?? '')
  const [localError, setLocalError] = useState<string | null>(null)
  const trimmedName = newCollectionName.trim()
  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.id === selectedCollectionId) ?? null,
    [collections, selectedCollectionId]
  )

  useEffect(() => {
    if (collections.length === 0) {
      setSelectedCollectionId('')
      return
    }

    if (!collections.some((collection) => collection.id === selectedCollectionId)) {
      setSelectedCollectionId(collections[0].id)
    }
  }, [collections, selectedCollectionId])

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!trimmedName) {
      setLocalError('Gib der neuen Sammlung einen Namen.')
      return
    }

    setLocalError(null)
    await onCreateCollection(trimmedName, imageIds)
  }

  async function handleAddToCollection() {
    if (!selectedCollection) {
      setLocalError('Waehle zuerst eine Sammlung aus.')
      return
    }

    setLocalError(null)
    await onAddToCollection(selectedCollection.id, imageIds)
  }

  return (
    <AnimatedDialog
      overlayClassName="delete-confirm-overlay collection-dialog-overlay"
      dialogClassName="delete-confirm-dialog collection-dialog"
      titleId={titleId}
      descriptionId={descriptionId}
      onClose={isBusy ? undefined : onClose}
      closeOnOverlayClick={!isBusy}
      closeOnEscape={!isBusy}
      trapFocus
      restoreFocus
      lockScroll
      initialFocusRef={initialFocusRef}
    >
      <h3 id={titleId}>Zu Sammlung hinzufuegen</h3>
      <p id={descriptionId}>
        {imageLabel} wird als Galerie-Referenz gespeichert. Die Bilddaten bleiben in der Galerie.
      </p>

      <form className="collection-dialog-form" onSubmit={handleCreateSubmit}>
        <label className="collection-dialog-field">
          <span>Neue Sammlung</span>
          <input
            ref={initialFocusRef}
            value={newCollectionName}
            onChange={(event) => setNewCollectionName(event.target.value)}
            placeholder="z. B. Weltraum, Kunst, Favoriten"
            maxLength={80}
            disabled={isBusy}
          />
        </label>
        <AnimatedButton type="submit" disabled={isBusy || !trimmedName}>
          {isBusy ? 'Speichere ...' : 'Neu anlegen'}
        </AnimatedButton>
      </form>

      {collections.length > 0 ? (
        <div className="collection-dialog-existing">
          <label className="collection-dialog-field">
            <span>Bestehende Sammlung</span>
            <select
              value={selectedCollectionId}
              onChange={(event) => setSelectedCollectionId(event.target.value)}
              disabled={isBusy}
            >
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name} ({formatCollectionImageCount(collection.imageIds.length)})
                </option>
              ))}
            </select>
          </label>
          <AnimatedButton className="secondary" onClick={() => void handleAddToCollection()} disabled={isBusy}>
            {isBusy ? 'Fuege hinzu ...' : 'Auswahl hinzufuegen'}
          </AnimatedButton>
        </div>
      ) : null}

      {localError ? <p className="collection-dialog-error" role="alert">{localError}</p> : null}

      <div className="delete-confirm-actions">
        <AnimatedButton className="secondary" onClick={onClose} disabled={isBusy}>
          Schliessen
        </AnimatedButton>
      </div>
    </AnimatedDialog>
  )
}
