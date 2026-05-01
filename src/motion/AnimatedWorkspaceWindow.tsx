import { motion } from 'motion/react'
import { useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { getWorkspaceOverlayVariants, getWorkspaceShellVariants } from './variants.ts'
import { useReducedMotionPreference } from './useReducedMotionPreference.ts'
import { useDialogAccessibility } from './useDialogAccessibility.ts'

interface AnimatedWorkspaceWindowProps {
  overlayClassName: string
  shellClassName: string
  titleId: string
  descriptionId?: string
  children: ReactNode
  onClose?: () => void
  onOverlayClick?: () => void
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
  trapFocus?: boolean
  restoreFocus?: boolean
  lockScroll?: boolean
  initialFocusRef?: RefObject<HTMLElement | null>
}

export default function AnimatedWorkspaceWindow({
  overlayClassName,
  shellClassName,
  titleId,
  descriptionId,
  children,
  onClose,
  onOverlayClick,
  closeOnOverlayClick = false,
  closeOnEscape = false,
  trapFocus = false,
  restoreFocus = false,
  lockScroll = false,
  initialFocusRef,
}: AnimatedWorkspaceWindowProps) {
  const shouldReduceMotion = useReducedMotionPreference()
  const shellRef = useRef<HTMLElement>(null)
  const requestClose = onClose ?? onOverlayClick

  useDialogAccessibility({
    dialogRef: shellRef,
    initialFocusRef,
    restoreFocus,
    trapFocus,
    closeOnEscape,
    lockScroll,
    onRequestClose: requestClose,
  })

  const overlay = (
    <motion.div
      className={overlayClassName}
      data-page-focus-root="true"
      variants={getWorkspaceOverlayVariants(shouldReduceMotion)}
      initial="initial"
      animate="animate"
      exit="exit"
      onClick={(event) => {
        if (event.target === event.currentTarget && closeOnOverlayClick) {
          requestClose?.()
        }
      }}
    >
      <motion.section
        ref={shellRef}
        className={shellClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        variants={getWorkspaceShellVariants(shouldReduceMotion)}
        initial="initial"
        animate="animate"
        exit="exit"
        onClick={(event) => {
          event.stopPropagation()
        }}
      >
        {children}
      </motion.section>
    </motion.div>
  )

  if (typeof document === 'undefined') {
    return overlay
  }

  return createPortal(overlay, document.body)
}
