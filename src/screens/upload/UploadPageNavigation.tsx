import { handleDirectionalFocusNavigation } from '../../app/directionalFocusNavigation.ts'
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react'

interface UploadPageNavigationProps {
  activePage: number
  ariaLabel: string
  isDisabled?: boolean
  onPageChange: (page: number) => void
  pageCount: number
  scrollTargetRef?: RefObject<HTMLElement | null>
}

function scrollPaginationContextToTop(target: HTMLElement): void {
  const panel = target.closest<HTMLElement>('.dashboard-panel-scroll')
  const overlay = target.closest<HTMLElement>('.workspace-window-overlay')
  const shell = target.closest<HTMLElement>('.workspace-window-shell')

  panel?.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  overlay?.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  shell?.scrollTo({ top: 0, left: 0, behavior: 'auto' })
}

export default function UploadPageNavigation({
  activePage,
  ariaLabel,
  isDisabled = false,
  onPageChange,
  pageCount,
  scrollTargetRef,
}: UploadPageNavigationProps) {
  if (pageCount <= 1) {
    return null
  }

  const handlePageClick = (event: ReactMouseEvent<HTMLButtonElement>, page: number) => {
    onPageChange(page)

    const button = event.currentTarget
    window.requestAnimationFrame(() => {
      if (scrollTargetRef?.current) {
        scrollTargetRef.current.scrollIntoView({ block: 'start', behavior: 'auto' })
      } else {
        scrollPaginationContextToTop(button)
      }

      window.requestAnimationFrame(() => {
        if (scrollTargetRef?.current) {
          scrollTargetRef.current.scrollIntoView({ block: 'start', behavior: 'auto' })
        } else {
          scrollPaginationContextToTop(button)
        }
      })
    })
  }

  return (
    <nav
      className="saved-games-pagination"
      aria-label={ariaLabel}
      onKeyDown={handleDirectionalFocusNavigation}
    >
      <span className="saved-games-page-summary">
        Seite {activePage} von {pageCount}
      </span>
      <div className="saved-games-page-links">
        {Array.from({ length: pageCount }, (_, index) => {
          const page = index + 1

          return (
            <button
              key={page}
              type="button"
              className="saved-games-page-link"
              aria-current={page === activePage ? 'page' : undefined}
              onClick={(event) => handlePageClick(event, page)}
              disabled={isDisabled}
              data-app-tooltip={`Zu Seite ${page} wechseln.`}
              data-app-tooltip-position="top"
            >
              {page}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
