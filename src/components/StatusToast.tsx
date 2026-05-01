import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import '../styles/components/status-toast.css'

export interface StatusToastPayload {
  id: number
  message: string
}

interface StatusToastProps {
  toast: StatusToastPayload | null
  onDismiss?: (toastId: number) => void
  autoDismissMs?: number
}

export default function StatusToast({ toast, onDismiss, autoDismissMs = 2800 }: StatusToastProps) {
  const timerRef = useRef<number | null>(null)
  const [visible, setVisible] = useState(false)
  const [displayedToast, setDisplayedToast] = useState<StatusToastPayload | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (toast) {
      setDisplayedToast(toast)
      setVisible(true)
      clearTimer()
      timerRef.current = window.setTimeout(() => {
        setVisible(false)
        timerRef.current = null
      }, autoDismissMs)
    } else {
      setVisible(false)
    }

    return clearTimer
  }, [toast, autoDismissMs, clearTimer])

  const handleTransitionEnd = useCallback(() => {
    if (visible || !displayedToast) return

    const dismissedToastId = displayedToast.id
    setDisplayedToast(null)
    if (!toast || toast.id === dismissedToastId) {
      onDismiss?.(dismissedToastId)
    }
  }, [displayedToast, onDismiss, toast, visible])

  if (!displayedToast) return null

  return createPortal(
    <div
      className={`status-toast-container${visible ? ' is-visible' : ''}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      onTransitionEnd={handleTransitionEnd}
    >
      <div className="status-toast">
        <span className="status-toast-icon-shell" aria-hidden="true">
          <svg className="status-toast-icon" viewBox="0 0 20 20" fill="none">
            <path
              d="M4.5 10.5L8.1 14.1L15.5 6.9"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="status-toast-text">{displayedToast.message}</span>
      </div>
    </div>,
    document.body
  )
}
