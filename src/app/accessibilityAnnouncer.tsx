import { useCallback, useEffect, useState } from 'react'

export type AccessibilityAnnouncementPoliteness = 'polite' | 'assertive'

interface AccessibilityAnnouncement {
  id: number
  message: string
  politeness: AccessibilityAnnouncementPoliteness
}

type AccessibilityAnnouncementListener = (announcement: AccessibilityAnnouncement) => void

const listeners = new Set<AccessibilityAnnouncementListener>()
let nextAnnouncementId = 0

function emitAccessibilityAnnouncement(
  message: string,
  politeness: AccessibilityAnnouncementPoliteness = 'polite'
): void {
  const trimmedMessage = message.trim()
  if (!trimmedMessage) {
    return
  }

  const announcement = {
    id: nextAnnouncementId += 1,
    message: trimmedMessage,
    politeness,
  }

  listeners.forEach((listener) => {
    listener(announcement)
  })
}

export function useAccessibilityAnnouncer(): (
  message: string,
  politeness?: AccessibilityAnnouncementPoliteness
) => void {
  return useCallback((message: string, politeness: AccessibilityAnnouncementPoliteness = 'polite') => {
    emitAccessibilityAnnouncement(message, politeness)
  }, [])
}

export default function AccessibilityAnnouncerHost() {
  const [politeAnnouncement, setPoliteAnnouncement] = useState<AccessibilityAnnouncement | null>(null)
  const [assertiveAnnouncement, setAssertiveAnnouncement] = useState<AccessibilityAnnouncement | null>(null)

  useEffect(() => {
    const handleAnnouncement = (announcement: AccessibilityAnnouncement) => {
      if (announcement.politeness === 'assertive') {
        setAssertiveAnnouncement(announcement)
        return
      }

      setPoliteAnnouncement(announcement)
    }

    listeners.add(handleAnnouncement)
    return () => {
      listeners.delete(handleAnnouncement)
    }
  }, [])

  return (
    <>
      <div
        className="visually-hidden"
        aria-live="polite"
        aria-atomic="true"
        role="status"
        data-testid="accessibility-announcer-polite"
      >
        {politeAnnouncement ? <span key={politeAnnouncement.id}>{politeAnnouncement.message}</span> : null}
      </div>
      <div
        className="visually-hidden"
        aria-live="assertive"
        aria-atomic="true"
        data-testid="accessibility-announcer-assertive"
      >
        {assertiveAnnouncement ? <span key={assertiveAnnouncement.id}>{assertiveAnnouncement.message}</span> : null}
      </div>
    </>
  )
}
