import {
  useCallback,
  useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import AnimatedButton from '../../motion/AnimatedButton.tsx'
import AnimatedDialog from '../../motion/AnimatedDialog.tsx'

interface UploadConfirmDialogProps {
  titleId: string
  title: string
  description: ReactNode
  confirmLabel: string
  busyLabel: string
  isBusy: boolean
  onCancel: () => void
  onConfirm: () => void
  confirmButtonRef?: RefObject<HTMLButtonElement>
  restoreFocusFallbackRef?: RefObject<HTMLElement | null>
  paletteStyle?: CSSProperties
}

export default function UploadConfirmDialog({
  titleId,
  title,
  description,
  confirmLabel,
  busyLabel,
  isBusy,
  onCancel,
  onConfirm,
  confirmButtonRef,
  restoreFocusFallbackRef,
  paletteStyle,
}: UploadConfirmDialogProps) {
  const descriptionId = `${titleId}-description`
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  const handleActionKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
      return
    }

    const actionRow = event.currentTarget.closest<HTMLElement>('.delete-confirm-actions')
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
      overlayClassName="delete-confirm-overlay"
      dialogClassName="delete-confirm-dialog"
      titleId={titleId}
      descriptionId={descriptionId}
      role="alertdialog"
      onClose={isBusy ? undefined : onCancel}
      closeOnEscape={!isBusy}
      trapFocus
      restoreFocus
      restoreFocusFallbackRef={restoreFocusFallbackRef}
      lockScroll
      overlayStyle={paletteStyle}
      initialFocusRef={cancelButtonRef}
    >
      <h3 id={titleId}>{title}</h3>
      <div id={descriptionId}>{description}</div>
      <div className="delete-confirm-actions">
        <AnimatedButton
          ref={cancelButtonRef}
          className="secondary"
          data-page-primary-focus="true"
          onClick={onCancel}
          onKeyDown={handleActionKeyDown}
          busy={isBusy}
          busyLabel={busyLabel}
          data-app-tooltip="Aktion abbrechen und nichts aendern."
          data-app-tooltip-position="top"
        >
          Abbrechen
        </AnimatedButton>
        <AnimatedButton
          className="danger"
          onClick={onConfirm}
          onKeyDown={handleActionKeyDown}
          disabled={isBusy}
          ref={confirmButtonRef}
          data-app-tooltip={isBusy ? busyLabel : `${confirmLabel} bestaetigen.`}
          data-app-tooltip-position="top"
        >
          {confirmLabel}
        </AnimatedButton>
      </div>
    </AnimatedDialog>
  )
}
