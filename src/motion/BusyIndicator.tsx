import { LoaderCircle } from 'lucide-react'

interface BusyIndicatorProps {
  label?: string
  className?: string
  size?: 'small' | 'medium' | 'large'
}

export default function BusyIndicator({
  label,
  className,
  size = 'small',
}: BusyIndicatorProps) {
  return (
    <span
      className={['busy-indicator', `busy-indicator--${size}`, className ?? ''].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      <LoaderCircle className="busy-indicator-icon" />
      {label ? <span className="busy-indicator-label">{label}</span> : null}
    </span>
  )
}
