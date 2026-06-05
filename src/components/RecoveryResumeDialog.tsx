import { useCallback, useMemo, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import AnimatedButton from '../motion/AnimatedButton.tsx'
import AnimatedDialog from '../motion/AnimatedDialog.tsx'
import type { SavedGameSummary } from '../types/index'
import '../styles/components/recovery-resume-dialog.css'

interface RecoveryResumeDialogProps {
  save: SavedGameSummary
  interruptedAt: number
  onResume: () => void
  onDismiss: () => void
  onDecline: () => void
}

function formatRecoveryDate(timestamp: number): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

function formatSaveDate(timestamp: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

function formatDuration(totalSeconds: number): string {
  const roundedSeconds = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(roundedSeconds / 60)
  const seconds = roundedSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default function RecoveryResumeDialog({
  save,
  interruptedAt,
  onResume,
  onDismiss,
  onDecline,
}: RecoveryResumeDialogProps) {
  const titleId = 'recovery-resume-title'
  const descriptionId = 'recovery-resume-description'
  const dismissButtonRef = useRef<HTMLButtonElement>(null)

  const recoveryMetaLabel = useMemo(() => {
    return `Unterbrochen am ${formatRecoveryDate(interruptedAt)}`
  }, [interruptedAt])

  const lastAutosaveLabel = useMemo(() => {
    return `Autosave ${formatSaveDate(save.updatedAt)}`
  }, [save.updatedAt])

  const detailsDescription = useMemo(() => {
    return [
      `${save.name}.`,
      `${save.config.rows} mal ${save.config.cols}.`,
      `${save.moves} Zuege.`,
      `${formatDuration(save.elapsedTime)} Spielzeit.`,
      `${lastAutosaveLabel}.`,
      `${recoveryMetaLabel}.`,
    ].join(' ')
  }, [
    lastAutosaveLabel,
    recoveryMetaLabel,
    save.config.cols,
    save.config.rows,
    save.elapsedTime,
    save.moves,
    save.name,
  ])

  const handleActionKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
      return
    }

    const actionRow = event.currentTarget.closest<HTMLElement>('.recovery-resume-actions')
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

  return (
    <AnimatedDialog
      overlayClassName="recovery-resume-overlay"
      dialogClassName="recovery-resume-dialog"
      titleId={titleId}
      descriptionId={`${descriptionId} recovery-resume-details recovery-resume-keyboard-hint`}
      onClose={onDismiss}
      onOverlayClick={onDismiss}
      closeOnOverlayClick
      closeOnEscape
      trapFocus
      restoreFocus
      lockScroll
      initialFocusRef={dismissButtonRef}
    >
      <div className="recovery-resume-head">
        <span className="recovery-resume-kicker">Wiederherstellen</span>
        <h3 id={titleId}>Unterbrochene Runde gefunden</h3>
      </div>

      <p id={descriptionId} className="recovery-resume-copy">
        Die App wurde waehrend einer aktiven Runde geschlossen. Dein letzter Autosave ist noch da und kann direkt fortgesetzt werden.
      </p>
      <p id="recovery-resume-details" className="visually-hidden">
        {detailsDescription}
      </p>
      <p id="recovery-resume-keyboard-hint" className="visually-hidden">
        Mit Pfeiltasten wechselst du zwischen Spaeter, Nicht fortsetzen und Spielstand fortsetzen. Pos1 springt zum ersten Button, Ende zum letzten.
      </p>

      <div className="recovery-resume-card">
        <div className="recovery-resume-preview-shell" aria-hidden="true">
          <img className="recovery-resume-preview" src={save.previewImage} alt="" />
        </div>

        <div className="recovery-resume-summary">
          <div className="recovery-resume-summary-head">
            <strong>{save.name}</strong>
            <span>{recoveryMetaLabel}</span>
          </div>

          <div className="recovery-resume-chips" aria-label="Spielstanddetails">
            <span className="recovery-resume-chip">{`${save.config.rows}x${save.config.cols}`}</span>
            <span className="recovery-resume-chip">{`${save.moves} Zuege`}</span>
            <span className="recovery-resume-chip">{formatDuration(save.elapsedTime)}</span>
            <span className="recovery-resume-chip">{lastAutosaveLabel}</span>
          </div>
        </div>
      </div>

      <div className="recovery-resume-actions" role="group" aria-label="Wiederherstellungsaktionen">
        <AnimatedButton
          ref={dismissButtonRef}
          className="secondary"
          onClick={onDismiss}
          onKeyDown={handleActionKeyDown}
          data-app-tooltip="Dialog schliessen und spaeter erneut entscheiden."
          data-app-tooltip-position="top"
        >
          Spaeter
        </AnimatedButton>
        <AnimatedButton
          className="secondary"
          onClick={onDecline}
          onKeyDown={handleActionKeyDown}
          data-app-tooltip="Automatische Wiederherstellung verwerfen."
          data-app-tooltip-position="top"
        >
          Nicht fortsetzen
        </AnimatedButton>
        <AnimatedButton
          onClick={onResume}
          onKeyDown={handleActionKeyDown}
          data-page-primary-focus="true"
          data-app-tooltip="Gesicherten Spielstand laden und weiterspielen."
          data-app-tooltip-position="top"
        >
          Spielstand fortsetzen
        </AnimatedButton>
      </div>
    </AnimatedDialog>
  )
}
