import type { AriaRole } from 'react'
import UploadScreenIcon, { type UploadScreenIconName } from '../../components/UploadScreenIcon.tsx'
import BusyIndicator from '../../motion/BusyIndicator.tsx'

interface UploadStateNoticeProps {
  icon: string
  iconName?: UploadScreenIconName
  title: string
  detail?: string
  className?: string
  role?: AriaRole
  ariaLive?: 'polite' | 'assertive' | 'off'
  tone?: 'default' | 'quiet'
  busy?: boolean
}

export default function UploadStateNotice({
  icon,
  iconName,
  title,
  detail,
  className,
  role,
  ariaLive,
  tone = 'default',
  busy = false,
}: UploadStateNoticeProps) {
  const combinedClassName = [
    'dashboard-empty-state',
    'stats-empty-state',
    'upload-state-notice',
    tone === 'quiet' ? 'is-quiet' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={combinedClassName} role={role} aria-live={ariaLive} aria-busy={busy || undefined}>
      <span className={iconName ? 'empty-icon empty-icon-lucide' : 'empty-icon'} aria-hidden="true">
        {busy ? <BusyIndicator size="large" /> : iconName ? <UploadScreenIcon name={iconName} className="empty-icon-symbol" /> : icon}
      </span>
      <p>{title}</p>
      {detail ? <p className="empty-hint">{detail}</p> : null}
    </div>
  )
}
