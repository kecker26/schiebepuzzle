import { motion } from 'motion/react'
import { useRef, type AriaRole, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { getDialogOverlayVariants, getDialogVariants } from './variants.ts'
import { useReducedMotionPreference } from './useReducedMotionPreference.ts'
import { useDialogAccessibility } from './useDialogAccessibility.ts'

interface AnimatedDialogProps {
  overlayClassName: string
  dialogClassName: string
  titleId: string
  descriptionId?: string
  children: ReactNode
  onClose?: () => void
  onOverlayClick?: () => void
  role?: AriaRole
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
  trapFocus?: boolean
  restoreFocus?: boolean
  restoreFocusFallbackRef?: RefObject<HTMLElement | null>
  lockScroll?: boolean
  initialFocusRef?: RefObject<HTMLElement | null>
  dialogStyle?: CSSProperties
  overlayStyle?: CSSProperties
}

export default function AnimatedDialog({
  overlayClassName,
  dialogClassName,
  titleId,
  descriptionId,
  children,
  onClose,
  onOverlayClick,
  role = 'dialog',
  closeOnOverlayClick,
  closeOnEscape = false,
  trapFocus = false,
  restoreFocus = false,
  restoreFocusFallbackRef,
  lockScroll = false,
  initialFocusRef,
  dialogStyle,
  overlayStyle,
}: AnimatedDialogProps) {
  const shouldReduceMotion = useReducedMotionPreference()
  const dialogRef = useRef<HTMLDivElement>(null)
  const requestClose = onClose ?? onOverlayClick
  const canCloseOnOverlayClick = closeOnOverlayClick ?? Boolean(requestClose && onOverlayClick)

  useDialogAccessibility({
    dialogRef,
    initialFocusRef,
    restoreFocus,
    restoreFocusFallbackRef,
    trapFocus,
    closeOnEscape,
    lockScroll,
    onRequestClose: requestClose,
  })

  const overlay = (
    <motion.div
      className={overlayClassName}
      style={overlayStyle}
      data-page-focus-root="true"
      variants={getDialogOverlayVariants(shouldReduceMotion)}
      initial="initial"
      animate="animate"
      exit="exit"
      onClick={(event) => {
        if (event.target === event.currentTarget && canCloseOnOverlayClick) {
          requestClose?.()
        }
      }}
    >
      <motion.div
        ref={dialogRef}
        className={dialogClassName}
        style={dialogStyle}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        variants={getDialogVariants(shouldReduceMotion)}
        onClick={(event) => {
          event.stopPropagation()
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  )

  if (typeof document === 'undefined') {
    return overlay
  }

  return createPortal(overlay, document.body)
}
