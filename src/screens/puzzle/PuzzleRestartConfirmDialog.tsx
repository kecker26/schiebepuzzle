import { useCallback, useRef, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react'
import AnimatedButton from '../../motion/AnimatedButton.tsx'
import AnimatedDialog from '../../motion/AnimatedDialog.tsx'
import AnimatedReveal from '../../motion/AnimatedReveal.tsx'
import AnimatedStaggerGroup from '../../motion/AnimatedStaggerGroup.tsx'

interface PuzzleRestartConfirmDialogProps {
  onCancel: () => void
  onConfirm: () => void
  confirmButtonRef: RefObject<HTMLButtonElement>
}

export default function PuzzleRestartConfirmDialog({
  onCancel,
  onConfirm,
  confirmButtonRef,
}: PuzzleRestartConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  const handleActionKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
      return
    }

    const actionRow = event.currentTarget.closest<HTMLElement>('.puzzle-confirm-actions')
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
      overlayClassName="puzzle-confirm-overlay"
      dialogClassName="puzzle-confirm-dialog"
      titleId="restart-confirm-title"
      descriptionId="restart-confirm-description"
      role="alertdialog"
      onClose={onCancel}
      closeOnOverlayClick
      closeOnEscape
      trapFocus
      restoreFocus
      lockScroll
      initialFocusRef={cancelButtonRef}
    >
      <AnimatedStaggerGroup level="medium">
        <AnimatedReveal level="medium">
          <span className="puzzle-confirm-kicker">Neustart</span>
        </AnimatedReveal>
        <AnimatedReveal level="medium">
          <h3 id="restart-confirm-title">Aktuelle Runde neu starten?</h3>
        </AnimatedReveal>
        <AnimatedReveal level="medium">
          <p id="restart-confirm-description">
            Der aktuelle Fortschritt wird verworfen. Das Puzzle wird mit demselben Bild neu gemischt.
          </p>
        </AnimatedReveal>
        <AnimatedStaggerGroup className="puzzle-confirm-actions" level="subtle">
          <AnimatedButton
            ref={cancelButtonRef}
            className="secondary"
            data-page-primary-focus="true"
            onClick={onCancel}
            onKeyDown={handleActionKeyDown}
            reveal
            revealLevel="subtle"
          >
            Abbrechen
          </AnimatedButton>
          <AnimatedButton
            onClick={onConfirm}
            onKeyDown={handleActionKeyDown}
            ref={confirmButtonRef}
            reveal
            revealLevel="subtle"
          >
            Neu starten
          </AnimatedButton>
        </AnimatedStaggerGroup>
      </AnimatedStaggerGroup>
    </AnimatedDialog>
  )
}
