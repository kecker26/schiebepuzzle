import { memo, type KeyboardEvent as ReactKeyboardEvent, type RefObject, useCallback } from 'react'
import { SavedGameSummary } from '../../types/index'
import { formatDifficultyLabel } from '../../utils/puzzleDifficulty.ts'
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

  const handleLoadClick = useCallback(() => {
    onLoadSave(save.id)
  }, [onLoadSave, save.id])

  const handleDeleteClick = useCallback(() => {
    onDeleteRequest(save)
  }, [onDeleteRequest, save])

  return (
    <li className="saved-game-item">
      <div className="saved-game-preview-shell">
        <img
          src={save.previewImage}
          alt={`Vorschau ${save.name}`}
          className="saved-game-preview"
        />
      </div>
      <div className="saved-game-meta">
        <span className="saved-game-kicker">Zuletzt gespielt</span>
        <strong>{save.name}</strong>
        <div className="saved-game-chips">
          <span className="saved-game-chip">{formatDifficultyLabel(save.config)}</span>
          <span className="saved-game-chip">{save.moves} Zuege</span>
          <span className="saved-game-chip">{formatTime(save.elapsedTime)}</span>
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
          {isLoading ? 'Lade ...' : 'Weiterspielen'}
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
          {isDeleting ? 'Loesche ...' : 'Loeschen'}
        </button>
      </div>
    </li>
  )
})

export default UploadSavedGameItem
