import type { RefObject } from 'react'
import { handleDirectionalFocusNavigation } from '../../app/directionalFocusNavigation.ts'
import UploadScreenIcon from '../../components/UploadScreenIcon.tsx'
import AnimatedCardButton from '../../motion/AnimatedCardButton.tsx'
import AnimatedReveal from '../../motion/AnimatedReveal.tsx'
import AnimatedStaggerGroup from '../../motion/AnimatedStaggerGroup.tsx'
import { formatDate } from './uploadUtils.ts'

interface UploadWorkspaceLauncherProps {
  savedGamesCount: number
  totalSolved: number
  activeDays: number
  galleryEntriesCount: number
  gallerySolveCount: number
  collectionsCount?: number
  collectedImagesCount?: number
  latestActivityAt: string | null
  latestGalleryAt: string | null
  isLoadingSavedGames: boolean
  isLoadingStats: boolean
  isLoadingGallery: boolean
  isLoadingCollections?: boolean
  onOpenSavedGames: () => void
  onOpenStats: () => void
  onOpenGallery: () => void
  onOpenCollections?: () => void
  savedGamesActionRef?: RefObject<HTMLButtonElement>
  statsActionRef?: RefObject<HTMLButtonElement>
  galleryActionRef?: RefObject<HTMLButtonElement>
  collectionsActionRef?: RefObject<HTMLButtonElement>
}

export default function UploadWorkspaceLauncher({
  savedGamesCount,
  totalSolved,
  activeDays,
  galleryEntriesCount,
  gallerySolveCount,
  collectionsCount = 0,
  collectedImagesCount = 0,
  latestActivityAt,
  latestGalleryAt,
  isLoadingSavedGames,
  isLoadingStats,
  isLoadingGallery,
  isLoadingCollections = false,
  onOpenSavedGames,
  onOpenStats,
  onOpenGallery,
  onOpenCollections = () => undefined,
  savedGamesActionRef,
  statsActionRef,
  galleryActionRef,
  collectionsActionRef,
}: UploadWorkspaceLauncherProps) {
  const latestActivityLabel = latestActivityAt ? formatDate(latestActivityAt) : 'Noch keine Aktivitaet'
  const latestGalleryLabel = latestGalleryAt ? formatDate(latestGalleryAt) : 'Noch kein Galerie-Eintrag'
  const savedGamesMeta = latestActivityAt ? `Aktiv ${latestActivityLabel}` : 'Bereit fuer offene Partien'
  const statsMeta = activeDays > 0 ? `${activeDays} aktive Tage` : 'Noch keine Sieges-Serie'
  const galleryMeta = latestGalleryAt ? `Letzter Sieg ${latestGalleryLabel}` : 'Wird mit jedem geloesten Bild gefuellt'
  const collectionsMeta = collectionsCount > 0 ? `${collectedImagesCount} Motive gesammelt` : 'Favoriten sammeln'

  return (
    <AnimatedStaggerGroup
      as="section"
      className="upload-workspace-launcher"
      aria-labelledby="upload-data-window-title"
      interaction="surface"
      level="medium"
    >
      <AnimatedReveal className="upload-workspace-launcher-header" level="medium">
        <span className="upload-kicker">Datenbereiche</span>
        <div className="upload-section-title-row">
          <span className="upload-section-title-icon-shell" aria-hidden="true">
            <UploadScreenIcon name="layers" className="upload-section-title-icon" />
          </span>
          <h2 id="upload-data-window-title" className="upload-workspace-launcher-title">
            Spielstaende, Statistik, Galerie und Sammlungen
          </h2>
        </div>
      </AnimatedReveal>

      <AnimatedStaggerGroup
        className="upload-workspace-launcher-actions"
        level="medium"
        onKeyDown={handleDirectionalFocusNavigation}
      >
        <AnimatedCardButton
          ref={savedGamesActionRef}
          className="workspace-launcher-link menu-card"
          onClick={onOpenSavedGames}
          disabled={isLoadingSavedGames}
          reveal
          revealLevel="medium"
        >
          <span className="menu-card-glow" aria-hidden="true" />
          <span className="menu-card-eyebrow">Fortsetzen</span>
          <span className="menu-card-icon" aria-hidden="true">
            <UploadScreenIcon name="folder" className="menu-card-icon-symbol" />
          </span>
          <span className="menu-card-title">Spielstaende</span>
          <strong className="workspace-launcher-value">
            {isLoadingSavedGames ? 'Lade ...' : `${savedGamesCount} aktiv`}
          </strong>
          <span className="menu-card-desc">Offene Partien durchsuchen und direkt an der letzten Stelle weiterspielen.</span>
          <div className="workspace-launcher-meta">
            <span className="saved-game-chip">
              <UploadScreenIcon name="listRestart" className="saved-game-chip-icon" />
              {isLoadingSavedGames ? 'Wird geladen ...' : `${savedGamesCount} offen`}
            </span>
            <span className="saved-game-chip">
              <UploadScreenIcon name="clock" className="saved-game-chip-icon" />
              {savedGamesMeta}
            </span>
          </div>
          <span className="menu-card-arrow">
            <UploadScreenIcon name="folder" className="menu-card-arrow-icon" />
            Spielstaende oeffnen
          </span>
        </AnimatedCardButton>

        <AnimatedCardButton
          ref={statsActionRef}
          className="workspace-launcher-link menu-card"
          onClick={onOpenStats}
          disabled={isLoadingStats}
          reveal
          revealLevel="medium"
        >
          <span className="menu-card-glow" aria-hidden="true" />
          <span className="menu-card-eyebrow">Auswertung</span>
          <span className="menu-card-icon" aria-hidden="true">
            <UploadScreenIcon name="barChart2" className="menu-card-icon-symbol" />
          </span>
          <span className="menu-card-title">Statistik</span>
          <strong className="workspace-launcher-value">
            {isLoadingStats ? 'Lade ...' : `${totalSolved} Siege`}
          </strong>
          <span className="menu-card-desc">Rekorde, Stufenvergleich und Verlauf in einer klaren Gesamtansicht ansehen.</span>
          <div className="workspace-launcher-meta">
            <span className="saved-game-chip">
              <UploadScreenIcon name="trophy" className="saved-game-chip-icon" />
              {isLoadingStats ? 'Wird geladen ...' : statsMeta}
            </span>
            <span className="saved-game-chip">
              <UploadScreenIcon name="clock" className="saved-game-chip-icon" />
              Aktiv {latestActivityLabel}
            </span>
          </div>
          <span className="menu-card-arrow">
            <UploadScreenIcon name="barChart2" className="menu-card-arrow-icon" />
            Statistik oeffnen
          </span>
        </AnimatedCardButton>

        <AnimatedCardButton
          ref={collectionsActionRef}
          className="workspace-launcher-link menu-card"
          onClick={onOpenCollections}
          disabled={isLoadingCollections}
          reveal
          revealLevel="medium"
        >
          <span className="menu-card-glow" aria-hidden="true" />
          <span className="menu-card-eyebrow">Kollektionen</span>
          <span className="menu-card-icon" aria-hidden="true">
            <UploadScreenIcon name="folderHeart" className="menu-card-icon-symbol" />
          </span>
          <span className="menu-card-title">Sammlungen</span>
          <strong className="workspace-launcher-value">
            {isLoadingCollections ? 'Lade ...' : `${collectionsCount} aktiv`}
          </strong>
          <span className="menu-card-desc">Lieblingsmotive gruppieren, wiederfinden und direkt neu starten.</span>
          <div className="workspace-launcher-meta">
            <span className="saved-game-chip">
              <UploadScreenIcon name="folderHeart" className="saved-game-chip-icon" />
              {isLoadingCollections ? 'Wird geladen ...' : collectionsMeta}
            </span>
            <span className="saved-game-chip">
              <UploadScreenIcon name="image" className="saved-game-chip-icon" />
              Aus geloesten Motiven
            </span>
          </div>
          <span className="menu-card-arrow">
            <UploadScreenIcon name="folderHeart" className="menu-card-arrow-icon" />
            Sammlungen oeffnen
          </span>
        </AnimatedCardButton>

        <AnimatedCardButton
          ref={galleryActionRef}
          className="workspace-launcher-link menu-card"
          onClick={onOpenGallery}
          disabled={isLoadingGallery}
          reveal
          revealLevel="medium"
        >
          <span className="menu-card-glow" aria-hidden="true" />
          <span className="menu-card-eyebrow">Rueckblick</span>
          <span className="menu-card-icon" aria-hidden="true">
            <UploadScreenIcon name="gallery" className="menu-card-icon-symbol" />
          </span>
          <span className="menu-card-title">Galerie</span>
          <strong className="workspace-launcher-value">
            {isLoadingGallery ? 'Lade ...' : `${galleryEntriesCount} Motive`}
          </strong>
          <span className="menu-card-desc">Alle geloesten Motive als durchsuchbare Bildwand mit Schwierigkeit und Laufdaten.</span>
          <div className="workspace-launcher-meta">
            <span className="saved-game-chip">
              <UploadScreenIcon name="image" className="saved-game-chip-icon" />
              {isLoadingGallery ? 'Wird geladen ...' : `${gallerySolveCount} Loesungen`}
            </span>
            <span className="saved-game-chip">
              <UploadScreenIcon name="clock" className="saved-game-chip-icon" />
              {galleryMeta}
            </span>
          </div>
          <span className="menu-card-arrow">
            <UploadScreenIcon name="gallery" className="menu-card-arrow-icon" />
            Galerie oeffnen
          </span>
        </AnimatedCardButton>
      </AnimatedStaggerGroup>
    </AnimatedStaggerGroup>
  )
}
