import { memo, type KeyboardEvent as ReactKeyboardEvent, type RefObject, useCallback } from 'react'
import UploadScreenIcon from '../../components/UploadScreenIcon.tsx'
import { SavedGameSummary } from '../../types/index'
import { formatDifficultyLabel } from '../../utils/puzzleDifficulty.ts'
import { useUploadImagePalette } from './uploadImagePalette.ts'
import { formatDate, formatTime } from './uploadUtils.ts'

interface UploadSavedGameItemProps {
  save: SavedGameSummary
  isLoading: boolean
  isDeleting: boolean
  isDeletingAllSavedGames: boolean
  primaryActionRef?: RefObject<HTMLButtonElement>
  onLoadSave: (saveId: string) => void
  onDeleteRequest: (save: SavedGameSummary) => void
  onActionKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void
}

const UploadSavedGameItem = memo(function UploadSavedGameItem({
  save,
  isLoading,
  isDeleting,
  isDeletingAllSavedGames,
  primaryActionRef,
  onLoadSave,
  onDeleteRequest,
  onActionKeyDown,
}: UploadSavedGameItemProps) {
  const isBusy = isLoading || isDeleting || isDeletingAllSavedGames
  const { activePalette, paletteStyle } = useUploadImagePalette({
    paletteSource: save.previewImage,
    storedPalette: save.imageTheme ?? null,
  })

  const handleLoadClick = useCallback(() => {
    onLoadSave(save.id)
  }, [onLoadSave, save.id])

  const handleDeleteClick = useCallback(() => {
    onDeleteRequest(save)
  }, [onDeleteRequest, save])

  return (
    <li
      className="saved-game-item"
      style={paletteStyle}
      data-image-mood={activePalette?.mood}
      data-image-palette-source={activePalette?.source}
    >
      <div className="saved-game-preview-shell">
        <img
          src={save.previewImage}
          alt={`Vorschau ${save.name}`}
          className="saved-game-preview"
        />
        {activePalette ? (
          <span className="image-card-palette saved-game-palette" aria-hidden="true">
            <span className="image-card-palette-swatch image-card-palette-swatch-primary" />
            <span className="image-card-palette-swatch image-card-palette-swatch-accent" />
            <span className="image-card-palette-swatch image-card-palette-swatch-glow" />
          </span>
        ) : null}
      </div>
      <div className="saved-game-meta">
        <span className="saved-game-kicker">Zuletzt gespielt</span>
        <strong>{save.name}</strong>
        <div className="saved-game-chips">
          <span className="saved-game-chip">
            <UploadScreenIcon name="layers" className="saved-game-chip-icon" />
            {formatDifficultyLabel(save.config)}
          </span>
          <span className="saved-game-chip">
            <UploadScreenIcon name="mousePointerClick" className="saved-game-chip-icon" />
            {save.moves} Zuege
          </span>
          <span className="saved-game-chip">
            <UploadScreenIcon name="timer" className="saved-game-chip-icon" />
            {formatTime(save.elapsedTime)}
          </span>
        </div>
        <span className="saved-game-date">{formatDate(save.updatedAt)}</span>
      </div>
      <div className="saved-game-actions">
        <button
          ref={primaryActionRef}
          type="button"
          data-save-id={save.id}
          data-save-action="load"
          onClick={handleLoadClick}
          onKeyDown={onActionKeyDown}
          disabled={isBusy}
        >
          <UploadScreenIcon name="playCircle" className="saved-game-action-icon" />
          <span>{isLoading ? 'Lade ...' : 'Weiterspielen'}</span>
        </button>
        <button
          type="button"
          className="secondary"
          data-save-id={save.id}
          data-save-action="delete"
          onClick={handleDeleteClick}
          onKeyDown={onActionKeyDown}
          disabled={isBusy}
        >
          <UploadScreenIcon name="trash" className="saved-game-action-icon" />
          <span>{isDeleting ? 'Loesche ...' : 'Loeschen'}</span>
        </button>
      </div>
    </li>
  )
})

export default UploadSavedGameItem
