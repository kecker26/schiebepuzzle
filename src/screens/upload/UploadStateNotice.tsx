import type { AriaRole } from 'react'

interface UploadStateNoticeProps {
  icon: string
  title: string
  detail?: string
  className?: string
  role?: AriaRole
  ariaLive?: 'polite' | 'assertive' | 'off'
  tone?: 'default' | 'quiet'
}

export default function UploadStateNotice({
  icon,
  title,
  detail,
  className,
  role,
  ariaLive,
  tone = 'default',
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
    <div className={combinedClassName} role={role} aria-live={ariaLive}>
      <span className="empty-icon" aria-hidden="true">
        {icon}
      </span>
      <p>{title}</p>
      {detail ? <p className="empty-hint">{detail}</p> : null}
    </div>
  )
}
