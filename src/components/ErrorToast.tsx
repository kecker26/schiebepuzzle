import { useEffect, useRef, useCallback, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import '../styles/components/error-toast.css'

interface ErrorToastProps {
  message: string | null
  onDismiss?: () => void
  autoDismissMs?: number
  paletteStyle?: CSSProperties
}

export default function ErrorToast({ message, onDismiss, autoDismissMs = 8000, paletteStyle }: ErrorToastProps) {
  const timerRef = useRef<number | null>(null)
  const [visible, setVisible] = useState(false)
  const [displayedMessage, setDisplayedMessage] = useState<string | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (message) {
      setDisplayedMessage(message)
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
  }, [message, autoDismissMs, clearTimer])

  const handleDismiss = useCallback(() => {
    clearTimer()
    setVisible(false)
    onDismiss?.()
  }, [clearTimer, onDismiss])

  const handleTransitionEnd = useCallback(() => {
    if (!visible) {
      setDisplayedMessage(null)
      if (message) {
        onDismiss?.()
      }
    }
  }, [visible, message, onDismiss])

  if (!displayedMessage) return null

  return createPortal(
    <div
      className={`error-toast-container${visible ? ' is-visible' : ''}`}
      style={paletteStyle}
      role="alert"
      aria-live="assertive"
      onTransitionEnd={handleTransitionEnd}
    >
      <div className="error-toast">
        <span className="error-toast-icon-shell" aria-hidden="true">
          <svg className="error-toast-icon" viewBox="0 0 20 20" fill="none">
            <path
              d="M10 2L1.5 17h17L10 2Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path d="M10 8v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="10" cy="14.5" r="0.8" fill="currentColor" />
          </svg>
        </span>
        <span className="error-toast-text">{displayedMessage}</span>
        <button
          type="button"
          className="error-toast-close"
          onClick={handleDismiss}
          aria-label="Fehlermeldung schließen"
          data-app-tooltip="Fehlermeldung ausblenden."
          data-app-tooltip-position="left"
        >
          ×
        </button>
      </div>
    </div>,
    document.body
  )
}
