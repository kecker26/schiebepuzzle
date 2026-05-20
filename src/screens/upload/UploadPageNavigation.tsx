import { handleDirectionalFocusNavigation } from '../../app/directionalFocusNavigation.ts'

interface UploadPageNavigationProps {
  activePage: number
  ariaLabel: string
  isDisabled?: boolean
  onPageChange: (page: number) => void
  pageCount: number
}

export default function UploadPageNavigation({
  activePage,
  ariaLabel,
  isDisabled = false,
  onPageChange,
  pageCount,
}: UploadPageNavigationProps) {
  if (pageCount <= 1) {
    return null
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
              onClick={() => onPageChange(page)}
              disabled={isDisabled}
            >
              {page}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
