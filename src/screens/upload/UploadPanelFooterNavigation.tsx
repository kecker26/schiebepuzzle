import { handleDirectionalFocusNavigation } from '../../app/directionalFocusNavigation.ts'
import UploadScreenIcon from '../../components/UploadScreenIcon.tsx'
import AnimatedButton from '../../motion/AnimatedButton.tsx'

interface UploadPanelFooterNavigationProps {
  onBackToStart?: () => void
  onScrollToStart?: () => void
}

export default function UploadPanelFooterNavigation({
  onBackToStart,
  onScrollToStart,
}: UploadPanelFooterNavigationProps) {
  if (!onBackToStart && !onScrollToStart) {
    return null
  }

  return (
    <div className="stats-report-section-footer">
      <div
        className="stats-report-jump-row stats-report-section-footer-row"
        onKeyDown={handleDirectionalFocusNavigation}
      >
        {onScrollToStart ? (
          <AnimatedButton
            className="secondary"
            interaction="chip"
            onClick={onScrollToStart}
            data-app-tooltip="Zum Anfang dieses Bereichs springen."
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
            data-app-tooltip="Zur Auswahlübersicht zurückkehren."
            data-app-tooltip-position="top"
          >
            <UploadScreenIcon name="home" />
            Zur Auswahl
          </AnimatedButton>
        ) : null}
      </div>
    </div>
  )
}
