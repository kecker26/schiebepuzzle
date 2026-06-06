import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import BusyIndicator from './BusyIndicator.tsx'

interface AsyncStatusPanelProps {
  title: string
  detail?: ReactNode
  phase?: string
  longWaitDetail?: string
  className?: string
  compact?: boolean
  floating?: boolean
}

export default function AsyncStatusPanel({
  title,
  detail,
  phase,
  longWaitDetail = 'Der Vorgang laeuft weiterhin. Du kannst die App waehrenddessen geoeffnet lassen.',
  className,
  compact = false,
  floating = false,
}: AsyncStatusPanelProps) {
  const [isLongWait, setIsLongWait] = useState(false)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setIsLongWait(true), 8000)
    return () => window.clearTimeout(timeoutId)
  }, [])

  const panel = (
    <div
      className={[
        'async-status-panel',
        compact ? 'async-status-panel--compact' : '',
        floating ? 'async-status-panel--floating' : '',
        className ?? '',
      ].filter(Boolean).join(' ')}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <BusyIndicator size={compact ? 'small' : 'large'} />
      <span className="async-status-panel-copy">
        <strong>{title}</strong>
        {phase ? <span className="async-status-panel-phase">{phase}</span> : null}
        {isLongWait ? <span>{longWaitDetail}</span> : detail ? <span>{detail}</span> : null}
      </span>
      <span className="async-status-panel-track" aria-hidden="true">
        <span />
      </span>
    </div>
  )

  return floating && typeof document !== 'undefined'
    ? createPortal(panel, document.body)
    : panel
}
