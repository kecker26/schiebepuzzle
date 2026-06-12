import { type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, ReactNode, RefObject, useCallback, useEffect, useId, useRef, useState } from 'react'
import { useAccessibilityAnnouncer } from '../../app/accessibilityAnnouncer.tsx'
import { handleDirectionalFocusNavigation } from '../../app/directionalFocusNavigation.ts'
import UploadScreenIcon from '../../components/UploadScreenIcon.tsx'
import AnimatedButton from '../../motion/AnimatedButton.tsx'
import AnimatedCollapse from '../../motion/AnimatedCollapse.tsx'
import { motionTransitions } from '../../motion/tokens.ts'

interface UploadStatsSectionProps {
  id?: string
  className?: string
  kicker: string
  title: string
  copy: string
  actions?: ReactNode
  summaryMeta?: ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
  onReloadView?: () => void
  onBackToStart?: () => void
  children: ReactNode
  summaryButtonRef?: RefObject<HTMLButtonElement>
}

const OPEN_SCROLL_SETTLE_DELAY_MS = Math.round(motionTransitions.panelEnter.duration * 1000) + 40

export default function UploadStatsSection({
  id,
  className,
  kicker,
  title,
  copy,
  actions,
  summaryMeta,
  collapsible = false,
  defaultOpen = false,
  onReloadView,
  onBackToStart,
  children,
  summaryButtonRef,
}: UploadStatsSectionProps) {
  const announceAccessibility = useAccessibilityAnnouncer()
  const sectionRef = useRef<HTMLElement>(null)
  const shouldScrollSummaryOnOpenRef = useRef(false)
  const generatedBodyId = useId().replace(/:/g, '')
  const bodyId = `${id ?? generatedBodyId}-body`
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const hasFooterNavigation = Boolean(onReloadView || onBackToStart)
  const footerNavigation = hasFooterNavigation ? (
    <div className="stats-report-section-footer">
      <div
        className="stats-report-jump-row stats-report-section-footer-row"
        onKeyDown={handleDirectionalFocusNavigation}
      >
        {onReloadView ? (
          <AnimatedButton
            className="secondary"
            interaction="chip"
            onClick={onReloadView}
            data-app-tooltip="Zum Anfang dieses Statistikbereichs springen."
            data-app-tooltip-position="top"
          >
            <UploadScreenIcon name="arrowUp" />
            Zum Seitenanfang
          </AnimatedButton>
        ) : null}
        {onBackToStart ? (
          <AnimatedButton
            className="secondary"
            interaction="chip"
            onClick={onBackToStart}
            data-app-tooltip="Zur Auswahluebersicht zurueckkehren."
            data-app-tooltip-position="top"
          >
            <UploadScreenIcon name="home" />
            Zur Auswahl
          </AnimatedButton>
        ) : null}
      </div>
    </div>
  ) : null

  useEffect(() => {
    if (!collapsible) {
      return
    }

    setIsOpen(defaultOpen)
  }, [collapsible, defaultOpen])

  useEffect(() => {
    if (!collapsible) {
      return
    }

    const section = sectionRef.current
    if (!section) {
      return
    }

    const handleOpenRequest = () => {
      shouldScrollSummaryOnOpenRef.current = true
      setIsOpen(true)
    }

    section.addEventListener('stats-section:open', handleOpenRequest as EventListener)
    return () => {
      section.removeEventListener('stats-section:open', handleOpenRequest as EventListener)
    }
  }, [collapsible])

  const scrollSummaryButtonIntoView = useCallback((targetButton?: HTMLButtonElement | null) => {
    const resolvedButton = targetButton
      ?? sectionRef.current?.querySelector<HTMLButtonElement>('.stats-report-section-summary')

    if (!resolvedButton) {
      return
    }

    const targetSection =
      resolvedButton.closest<HTMLElement>('.stats-report-section, .stats-report-section-collapsible')
      ?? resolvedButton

    const overlay = targetSection.closest<HTMLElement>('.workspace-window-overlay')
    if (overlay instanceof HTMLElement) {
      const overlayRect = overlay.getBoundingClientRect()
      const targetRect = targetSection.getBoundingClientRect()
      const overlayPaddingTop = Number.parseFloat(window.getComputedStyle(overlay).paddingTop) || 0
      const nextTop = overlay.scrollTop + (targetRect.top - overlayRect.top) - overlayPaddingTop

      overlay.scrollTo({
        top: Math.max(0, nextTop),
        left: 0,
        behavior: 'auto',
      })
      return
    }

    targetSection.scrollIntoView({
      block: 'start',
      inline: 'nearest',
      behavior: 'auto',
    })
  }, [])

  const focusStatisticsPageStart = useCallback(() => {
    const section = sectionRef.current
    if (!section) {
      return
    }

    const overlay = section.closest<HTMLElement>('.workspace-window-overlay')
    const statsScrollContainer = section.closest<HTMLElement>('.dashboard-panel-scroll')
    const startButton =
      section
        .closest<HTMLElement>('.workspace-window-shell')
        ?.querySelector<HTMLButtonElement>('.workspace-window-nav-button')
      ?? document.querySelector<HTMLButtonElement>('.workspace-window-nav-button')

    if (overlay instanceof HTMLElement) {
      overlay.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    } else if (statsScrollContainer instanceof HTMLElement) {
      statsScrollContainer.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }

    if (!startButton) {
      return
    }

    window.requestAnimationFrame(() => {
      startButton.focus({ preventScroll: true })
      startButton.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'auto',
      })
    })
  }, [])

  useEffect(() => {
    if (!collapsible || !isOpen || !shouldScrollSummaryOnOpenRef.current) {
      return
    }

    shouldScrollSummaryOnOpenRef.current = false
    scrollSummaryButtonIntoView()

    const frameId = window.requestAnimationFrame(() => {
      scrollSummaryButtonIntoView()
    })
    const settleTimeoutId = window.setTimeout(() => {
      scrollSummaryButtonIntoView()
    }, OPEN_SCROLL_SETTLE_DELAY_MS)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.clearTimeout(settleTimeoutId)
    }
  }, [collapsible, isOpen, scrollSummaryButtonIntoView])

  const getSiblingSummaryButtons = useCallback(() => {
    const section = sectionRef.current
    if (!section) {
      return []
    }

    const scope =
      section.closest<HTMLElement>('.stats-report-stack')
      ?? section.parentElement

    if (!scope) {
      return []
    }

    return Array.from(
      scope.querySelectorAll<HTMLButtonElement>('.stats-report-section-summary:not([disabled])')
    )
  }, [])

  const handleSummaryKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
      return
    }

    const summaryButtons = getSiblingSummaryButtons()
    if (summaryButtons.length === 0) {
      return
    }

    const currentIndex = summaryButtons.indexOf(event.currentTarget)
    if (currentIndex < 0) {
      return
    }

    const focusButtonAtIndex = (nextIndex: number) => {
      const targetButton = summaryButtons[nextIndex]
      if (!targetButton) {
        return
      }

      targetButton.focus({ preventScroll: true })
      scrollSummaryButtonIntoView(targetButton)
    }

    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault()
        focusButtonAtIndex((currentIndex - 1 + summaryButtons.length) % summaryButtons.length)
        return
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault()
        focusButtonAtIndex((currentIndex + 1) % summaryButtons.length)
        return
      case 'Home':
        event.preventDefault()
        focusStatisticsPageStart()
        return
      case 'End':
        event.preventDefault()
        focusButtonAtIndex(summaryButtons.length - 1)
        return
    }
  }, [focusStatisticsPageStart, getSiblingSummaryButtons, scrollSummaryButtonIntoView])

  const handleSummaryToggle = (event: ReactKeyboardEvent<HTMLButtonElement> | ReactMouseEvent<HTMLButtonElement>) => {
    const targetButton = event.currentTarget
    const nextOpen = !isOpen
    shouldScrollSummaryOnOpenRef.current = nextOpen

    scrollSummaryButtonIntoView(targetButton)
    window.requestAnimationFrame(() => {
      scrollSummaryButtonIntoView(targetButton)
    })

    setIsOpen(nextOpen)
    announceAccessibility(`${title} ${nextOpen ? 'aufgeklappt' : 'eingeklappt'}.`)
  }

  if (collapsible) {
    return (
      <section
        ref={sectionRef}
        id={id}
        className={`stats-report-section stats-report-section-collapsible${className ? ` ${className}` : ''}`}
        data-open={isOpen ? 'true' : 'false'}
        data-stats-collapsible="true"
      >
        <div className="stats-report-section-chrome">
          <AnimatedButton
            ref={summaryButtonRef}
            className="stats-report-section-summary"
            interaction="surface"
            aria-expanded={isOpen}
            aria-controls={bodyId}
            onClick={handleSummaryToggle}
            onKeyDown={handleSummaryKeyDown}
            data-app-tooltip={`${title} ${isOpen ? 'einklappen' : 'aufklappen'}.`}
            data-app-tooltip-align="start"
          >
            <span className="stats-report-section-summary-main">
              <span className="stats-report-section-heading">
                <span className="saved-games-kicker">{kicker}</span>
                <span className="stats-report-section-title" role="heading" aria-level={3}>
                  {title}
                </span>
              </span>
            </span>

            <span className="stats-report-section-summary-side">
              {summaryMeta ? (
                <span className="stats-report-section-summary-meta">{summaryMeta}</span>
              ) : null}

              <span className="dashboard-disclosure-toggle stats-report-section-toggle">
                <span className="stats-report-section-toggle-open-label">Aufklappen</span>
                <span className="stats-report-section-toggle-close-label">Einklappen</span>
                <span className="dashboard-disclosure-icon" aria-hidden="true">
                  &#9662;
                </span>
              </span>
            </span>
          </AnimatedButton>
        </div>

        <AnimatedCollapse isOpen={isOpen} className="stats-report-section-collapse">
          <div id={bodyId} className="stats-report-section-body">
            {actions ? <div className="stats-report-section-actions">{actions}</div> : null}
            <p className="stats-report-section-copy">{copy}</p>
            {children}
            {footerNavigation}
          </div>
        </AnimatedCollapse>
      </section>
    )
  }

  return (
    <section ref={sectionRef} id={id} className={`stats-report-section${className ? ` ${className}` : ''}`}>
      <div className="stats-report-section-chrome">
        <div className="stats-report-section-head">
          <div className="stats-report-section-heading">
            <span className="saved-games-kicker">{kicker}</span>
            <h3 className="stats-report-section-title">{title}</h3>
          </div>

          {actions ? <div className="stats-report-section-actions">{actions}</div> : null}
        </div>
      </div>

      <div className="stats-report-section-body">
        <p className="stats-report-section-copy">{copy}</p>
        {children}
        {footerNavigation}
      </div>
    </section>
  )
}
