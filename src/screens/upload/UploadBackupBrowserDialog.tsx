import { type KeyboardEvent as ReactKeyboardEvent, type RefObject, useCallback, useRef } from 'react'
import AnimatedDialog from '../../motion/AnimatedDialog.tsx'
import { PuzzleDataBackupFile } from '../../types/index'

interface UploadBackupBrowserDialogProps {
  backups: PuzzleDataBackupFile[]
  isLoading: boolean
  deletingFileName: string | null
  onClose: () => void
  onDeleteBackup: (backup: PuzzleDataBackupFile) => void
  onSelectBackup: (backup: PuzzleDataBackupFile) => void
  restoreFocusFallbackRef?: RefObject<HTMLElement | null>
}

function formatBackupTimestamp(value: string | null): string {
  if (!value) {
    return 'Unbekannter Zeitpunkt'
  }

  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) {
    return 'Unbekannter Zeitpunkt'
  }

  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp)
}

function formatBackupSize(size: number): string {
  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export default function UploadBackupBrowserDialog({
  backups,
  isLoading,
  deletingFileName,
  onClose,
  onDeleteBackup,
  onSelectBackup,
  restoreFocusFallbackRef,
}: UploadBackupBrowserDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const primaryActionRef = useRef<HTMLButtonElement>(null)
  const canClose = !isLoading && deletingFileName === null
  const initialFocusRef = !isLoading && backups.length > 0 ? primaryActionRef : closeButtonRef

  const handleBackupActionKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
      return
    }

    const currentButton = event.currentTarget
    const action = currentButton.dataset.backupAction
    const actionRow = currentButton.closest<HTMLElement>('.backup-browser-item-actions')
    const list = currentButton.closest<HTMLElement>('.backup-browser-list')

    if (!action || !actionRow || !list) {
      return
    }

    const siblingButtons = Array.from(
      actionRow.querySelectorAll<HTMLButtonElement>('button:not([disabled])')
    )
    const sameActionButtons = Array.from(
      list.querySelectorAll<HTMLButtonElement>(`button[data-backup-action="${action}"]:not([disabled])`)
    )
    const siblingIndex = siblingButtons.indexOf(currentButton)
    const actionIndex = sameActionButtons.indexOf(currentButton)

    const focusSiblingAtIndex = (nextIndex: number) => {
      const targetButton = siblingButtons[nextIndex]
      if (!targetButton) {
        return
      }

      targetButton.focus({ preventScroll: true })
      targetButton.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'auto',
      })
    }

    const focusSameActionAtIndex = (nextIndex: number) => {
      const targetButton = sameActionButtons[nextIndex]
      if (!targetButton) {
        return
      }

      targetButton.focus({ preventScroll: true })
      targetButton.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'auto',
      })
    }

    switch (event.key) {
      case 'ArrowLeft':
        if (siblingIndex > 0) {
          event.preventDefault()
          focusSiblingAtIndex(siblingIndex - 1)
        }
        return
      case 'ArrowRight':
        if (siblingIndex >= 0 && siblingIndex < siblingButtons.length - 1) {
          event.preventDefault()
          focusSiblingAtIndex(siblingIndex + 1)
        }
        return
      case 'ArrowUp':
        if (actionIndex > 0) {
          event.preventDefault()
          focusSameActionAtIndex(actionIndex - 1)
        }
        return
      case 'ArrowDown':
        if (actionIndex >= 0 && actionIndex < sameActionButtons.length - 1) {
          event.preventDefault()
          focusSameActionAtIndex(actionIndex + 1)
        }
        return
      case 'Home':
        if (sameActionButtons.length > 0) {
          event.preventDefault()
          focusSameActionAtIndex(0)
        }
        return
      case 'End':
        if (sameActionButtons.length > 0) {
          event.preventDefault()
          focusSameActionAtIndex(sameActionButtons.length - 1)
        }
        return
    }
  }, [])

  return (
    <AnimatedDialog
      overlayClassName="backup-browser-overlay"
      dialogClassName="backup-browser-dialog"
      titleId="backup-browser-title"
      descriptionId="backup-browser-description"
      onClose={canClose ? onClose : undefined}
      closeOnOverlayClick={canClose}
      closeOnEscape={canClose}
      trapFocus
      restoreFocus
      restoreFocusFallbackRef={restoreFocusFallbackRef}
      lockScroll
      initialFocusRef={initialFocusRef}
    >
      <div className="backup-browser-header">
        <span className="upload-kicker">Backup-Ordner</span>
        <h3 id="backup-browser-title">Backup importieren</h3>
        <p id="backup-browser-description">
          Hier werden nur die bereits vorhandenen Backup-Dateien der App angezeigt. Waehle ein Backup
          aus, das du importieren moechtest.
        </p>
      </div>

      <div className="backup-browser-list" role="list" aria-busy={isLoading}>
        {isLoading ? (
          <div className="backup-browser-empty" role="status" aria-live="polite">
            Verfuegbare Backups werden geladen ...
          </div>
        ) : backups.length === 0 ? (
          <div className="backup-browser-empty">
            Im Backup-Ordner wurden noch keine importierbaren Backup-Dateien gefunden.
          </div>
        ) : (
          backups.map((backup) => (
            <article key={backup.fileName} className="backup-browser-item" role="listitem">
              <div className="backup-browser-item-copy">
                <div className="backup-browser-item-header">
                  <strong className="backup-browser-file-name">{backup.fileName}</strong>
                </div>
                <p className="backup-browser-item-text">
                  Exportiert: {formatBackupTimestamp(backup.exportedAt)}
                  <br />
                  Zuletzt gespeichert: {formatBackupTimestamp(backup.modifiedAt)}
                </p>
                <div className="dashboard-inline-chips backup-browser-chips">
                  <span className="saved-game-chip">{backup.savedGamesCount} Spielstaende</span>
                  <span className="saved-game-chip">{backup.totalSolved} Siege</span>
                  <span className="saved-game-chip">{backup.galleryEntriesCount} Galerie-Bilder</span>
                  <span className="saved-game-chip">{formatBackupSize(backup.size)}</span>
                </div>
              </div>

              <div className="backup-browser-item-actions">
                <button
                  type="button"
                  className="secondary"
                  data-backup-action="delete"
                  onClick={() => {
                    onDeleteBackup(backup)
                  }}
                  onKeyDown={handleBackupActionKeyDown}
                  disabled={isLoading || deletingFileName !== null}
                >
                  {deletingFileName === backup.fileName ? 'Loesche ...' : 'Loeschen'}
                </button>
                <button
                  type="button"
                  data-backup-action="select"
                  data-page-primary-focus={!isLoading && backups[0]?.fileName === backup.fileName ? 'true' : undefined}
                  ref={backups[0]?.fileName === backup.fileName ? primaryActionRef : undefined}
                  onClick={() => {
                    onSelectBackup(backup)
                  }}
                  onKeyDown={handleBackupActionKeyDown}
                  disabled={isLoading || deletingFileName !== null}
                >
                  Auswaehlen
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="backup-browser-actions">
        <button
          ref={closeButtonRef}
          type="button"
          className="secondary"
          data-page-primary-focus={!isLoading && backups.length === 0 ? 'true' : undefined}
          onClick={onClose}
          disabled={!canClose}
        >
          Schliessen
        </button>
      </div>
    </AnimatedDialog>
  )
}
