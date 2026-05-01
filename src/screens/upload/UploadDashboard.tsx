import {
  PuzzleCompletionRecord,
  PuzzleDifficultyStats,
  PuzzleStats,
  SavedGameSummary,
  SolvedGallery,
  SolvedGalleryEntry,
} from '../../types/index'
import { motion } from 'motion/react'
import { startTransition, type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'
import { handleDirectionalFocusNavigation } from '../../app/directionalFocusNavigation.ts'
import UploadScreenIcon, { type UploadScreenIconName } from '../../components/UploadScreenIcon.tsx'
import AnimatedButton from '../../motion/AnimatedButton.tsx'
import AnimatedSwapPane from '../../motion/AnimatedSwapPane.tsx'
import AnimatedStaggerGroup from '../../motion/AnimatedStaggerGroup.tsx'
import AnimatedWorkspaceWindow from '../../motion/AnimatedWorkspaceWindow.tsx'
import { getStaggerContainerVariants, getStaggerItemVariants } from '../../motion/variants.ts'
import { useReducedMotionPreference } from '../../motion/useReducedMotionPreference.ts'
import { DIFFICULTY_OPTIONS, formatDifficultyLabel, formatPuzzleSize } from '../../utils/puzzleDifficulty.ts'
import UploadGalleryPanel from './UploadGalleryPanel.tsx'
import { countUniqueGalleryEntries, formatGallerySolveCount } from './UploadGalleryDisplayUtils.ts'
import UploadStatsReport from './UploadStatsReport.tsx'
import UploadSavedGamesPanel from './UploadSavedGamesPanel.tsx'
import {
  DashboardMetric,
  HistoryFilter,
  HistoryFilterDefinition,
  UploadWorkspaceWindow,
  formatDate,
  formatDuration,
  formatTime,
  getLatestGalleryEntry,
  getLatestSavedGame,
} from './uploadUtils.ts'

interface UploadDashboardProps {
  activeWindow: Exclude<UploadWorkspaceWindow, 'start'>
  savedGames: SavedGameSummary[]
  savedGamesCount: number
  loadingSaveId: string | null
  deletingSaveId: string | null
  isDeletingAllSavedGames: boolean
  completionHistory: PuzzleCompletionRecord[]
  filteredHistory: PuzzleCompletionRecord[]
  historyFilter: HistoryFilter
  historyFilterOptions: HistoryFilterDefinition[]
  topStats: DashboardMetric[]
  latestCompletion: PuzzleCompletionRecord | null
  favoriteDifficulty: PuzzleDifficultyStats | null
  fastestDifficulty: PuzzleDifficultyStats | null
  stats: PuzzleStats | null
  gallery: SolvedGallery | null
  isLoadingStats: boolean
  isResettingStats: boolean
  isLoadingSavedGames: boolean
  isLoadingGallery: boolean
  isResettingGallery: boolean
  hasRecordedStats: boolean
  onWindowChange: (window: UploadWorkspaceWindow) => void
  onHistoryFilterChange: (filter: HistoryFilter) => void
  onRequestStatsReset: () => void
  onRequestGalleryReset: () => void
  onReplayGalleryEntry: (entry: SolvedGalleryEntry) => void
  onDeleteGalleryEntries: (entryIds: string[]) => Promise<void>
  onLoadSave: (saveId: string) => void
  onDeleteRequest: (save: SavedGameSummary) => void
  onDeleteAllRequest: () => void
}

type DifficultyOption = (typeof DIFFICULTY_OPTIONS)[number]

function getDashboardMetricIconName(label: string): UploadScreenIconName {
  switch (label) {
    case 'Siege':
      return 'award'
    case 'Sauber':
      return 'checkCircle'
    case 'Unterstuetzt':
      return 'helpCircle'
    case 'Bestzeit':
      return 'clock'
    default:
      return 'barChart2'
  }
}

export default function UploadDashboard({
  activeWindow,
  savedGames,
  savedGamesCount,
  loadingSaveId,
  deletingSaveId,
  isDeletingAllSavedGames,
  completionHistory,
  filteredHistory,
  historyFilter,
  historyFilterOptions,
  topStats,
  latestCompletion,
  favoriteDifficulty,
  fastestDifficulty,
  stats,
  gallery,
  isLoadingStats,
  isResettingStats,
  isLoadingSavedGames,
  isLoadingGallery,
  isResettingGallery,
  hasRecordedStats,
  onWindowChange,
  onHistoryFilterChange,
  onRequestStatsReset,
  onRequestGalleryReset,
  onReplayGalleryEntry,
  onDeleteGalleryEntries,
  onLoadSave,
  onDeleteRequest,
  onDeleteAllRequest,
}: UploadDashboardProps) {
  const [statsViewReloadKey, setStatsViewReloadKey] = useState(0)
  const startNavButtonRef = useRef<HTMLButtonElement>(null)
  const savedGamesNavButtonRef = useRef<HTMLButtonElement>(null)
  const statsNavButtonRef = useRef<HTMLButtonElement>(null)
  const galleryNavButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const savedGamesPrimaryActionRef = useRef<HTMLButtonElement>(null)
  const galleryPrimaryFilterRef = useRef<HTMLSelectElement>(null)
  const statsPrimaryActionRef = useRef<HTMLButtonElement>(null)
  const standardDifficultyStats: Array<{
    option: DifficultyOption
    stats: PuzzleDifficultyStats | null
  }> = DIFFICULTY_OPTIONS.map((option) => ({
    option,
    stats: stats?.byDifficulty.find(
      (entry) => entry.config.rows === option.rows && entry.config.cols === option.cols
    ) ?? null,
  }))

  const latestSavedGame = getLatestSavedGame(savedGames)
  const galleryEntries = gallery?.entries ?? []
  const galleryEntriesCount = gallery?.totalEntries ?? galleryEntries.length
  const galleryCardCount = countUniqueGalleryEntries(galleryEntries)
  const latestGalleryEntry = getLatestGalleryEntry(gallery)
  const galleryDifficultySpread = new Set(galleryEntries.map((entry) => `${entry.config.rows}x${entry.config.cols}`)).size
  const galleryCleanCount = galleryEntries.filter((entry) => entry.assistanceMode === 'clean').length
  const galleryProfiledCount = galleryEntries.filter((entry) => entry.hasDetailedProfile).length
  const savedGamesTotalTime = savedGames.reduce((sum, save) => sum + save.elapsedTime, 0)
  const savedGamesTotalMoves = savedGames.reduce((sum, save) => sum + save.moves, 0)
  const savedGamesDifficultySpread = new Set(savedGames.map((save) => `${save.config.rows}x${save.config.cols}`)).size
  const latestSavedLabel = latestSavedGame ? formatDate(latestSavedGame.updatedAt) : 'Noch kein Spielstand'
  const statsUpdatedLabel = stats?.lastUpdatedAt ? formatDate(stats.lastUpdatedAt) : 'Noch keine Statistikdaten'
  const latestGalleryLabel = latestGalleryEntry ? formatDate(latestGalleryEntry.completedAt) : 'Noch kein Galerie-Eintrag'
  const isStatsWindow = activeWindow === 'stats'
  const isGalleryWindow = activeWindow === 'gallery'
  const hasGalleryEntries = galleryEntriesCount > 0
  const shouldReduceMotion = useReducedMotionPreference()
  const staggerItemVariants = getStaggerItemVariants(shouldReduceMotion)
  const staggerContainerVariants = getStaggerContainerVariants(shouldReduceMotion)
  const workspaceShellClassName = `workspace-window-shell${activeWindow === 'savedGames' ? ' is-saves' : activeWindow === 'gallery' ? ' is-gallery' : ' is-stats'}`
  const handleReturnToStart = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    onWindowChange('start')
  }
  const resetWorkspaceScrollPosition = useCallback(() => {
    const overlay = document.querySelector('.workspace-window-overlay')
    const shell = document.querySelector('.workspace-window-shell')

    if (overlay instanceof HTMLElement) {
      overlay.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }

    if (shell instanceof HTMLElement) {
      shell.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }
  }, [])

  const handleReloadStatsView = () => {
    resetWorkspaceScrollPosition()

    startTransition(() => {
      setStatsViewReloadKey((current) => current + 1)
    })
  }

  const handleWorkspaceNavKeyDown = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
      return
    }

    const target = event.target
    if (!(target instanceof HTMLButtonElement) || !target.classList.contains('workspace-window-nav-button')) {
      return
    }

    const navButtons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('.workspace-window-nav-button:not([disabled])')
    )
    if (navButtons.length === 0) {
      return
    }

    const currentIndex = navButtons.indexOf(target)
    if (currentIndex < 0) {
      return
    }

    const focusButtonAtIndex = (nextIndex: number) => {
      navButtons[nextIndex]?.focus({ preventScroll: true })
    }

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault()
        focusButtonAtIndex((currentIndex - 1 + navButtons.length) % navButtons.length)
        return
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault()
        focusButtonAtIndex((currentIndex + 1) % navButtons.length)
        return
      case 'Home':
        event.preventDefault()
        focusButtonAtIndex(0)
        return
      case 'End':
        event.preventDefault()
        focusButtonAtIndex(navButtons.length - 1)
        return
      }
  }, [])

  const getActiveWorkspaceNavButton = useCallback(() => {
    switch (activeWindow) {
      case 'savedGames':
        return savedGamesNavButtonRef.current
      case 'stats':
        return statsNavButtonRef.current
      case 'gallery':
        return galleryNavButtonRef.current
    }
  }, [activeWindow])

  const handleStatsWindowKeyDownCapture = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    if (
      activeWindow !== 'stats'
      || event.defaultPrevented
      || event.altKey
      || event.ctrlKey
      || event.metaKey
      || event.key !== 'End'
    ) {
      return
    }

    const target = event.target
    if (
      target instanceof HTMLInputElement
      || target instanceof HTMLTextAreaElement
      || target instanceof HTMLSelectElement
      || (target instanceof HTMLElement && target.isContentEditable)
    ) {
      return
    }

    const targetSummaryButton =
      target instanceof HTMLElement
        ? target.closest<HTMLButtonElement>('.stats-report-section-summary')
        : null

    if (!targetSummaryButton || !event.currentTarget.contains(targetSummaryButton)) {
      return
    }

    const summaryButtons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('.stats-report-section-summary:not([disabled])')
    )
    const lastSummaryButton = summaryButtons[summaryButtons.length - 1]
    if (!lastSummaryButton) {
      return
    }

    const lastSection =
      lastSummaryButton.closest<HTMLElement>('.stats-report-section, .stats-report-section-collapsible')
      ?? lastSummaryButton
    const overlay = lastSection.closest<HTMLElement>('.workspace-window-overlay')

    event.preventDefault()
    lastSummaryButton.focus({ preventScroll: true })

    if (overlay instanceof HTMLElement) {
      const overlayRect = overlay.getBoundingClientRect()
      const sectionRect = lastSection.getBoundingClientRect()
      const overlayPaddingTop = Number.parseFloat(window.getComputedStyle(overlay).paddingTop) || 0
      const nextTop = overlay.scrollTop + (sectionRect.top - overlayRect.top) - overlayPaddingTop

      overlay.scrollTo({
        top: Math.max(0, nextTop),
        left: 0,
        behavior: 'auto',
      })
      return
    }

    lastSection.scrollIntoView({
      block: 'start',
      inline: 'nearest',
      behavior: 'auto',
    })
  }, [activeWindow])

  useEffect(() => {
    let frameId = 0
    let nestedFrameId = 0

    resetWorkspaceScrollPosition()
    frameId = window.requestAnimationFrame(() => {
      resetWorkspaceScrollPosition()
      nestedFrameId = window.requestAnimationFrame(() => {
        resetWorkspaceScrollPosition()
      })
    })

    return () => {
      window.cancelAnimationFrame(frameId)
      window.cancelAnimationFrame(nestedFrameId)
    }
  }, [activeWindow, resetWorkspaceScrollPosition])

  useEffect(() => {
    let isCancelled = false
    let frameId = 0
    let settleFrameId = 0
    let attempts = 0

    const focusActiveWorkspaceNavButton = () => {
      if (isCancelled) {
        return
      }

      const target = getActiveWorkspaceNavButton()

      if (target?.isConnected) {
        target.focus({ preventScroll: true })
        settleFrameId = window.requestAnimationFrame(() => {
          if (!isCancelled) {
            resetWorkspaceScrollPosition()
          }
        })
        return
      }

      if (attempts >= 24) {
        return
      }

      attempts += 1
      frameId = window.requestAnimationFrame(focusActiveWorkspaceNavButton)
    }

    frameId = window.requestAnimationFrame(focusActiveWorkspaceNavButton)

    return () => {
      isCancelled = true
      window.cancelAnimationFrame(frameId)
      window.cancelAnimationFrame(settleFrameId)
    }
  }, [activeWindow, getActiveWorkspaceNavButton, resetWorkspaceScrollPosition])

  let title = 'Gespeicherte Spielstaende verwalten'
  let copy = 'Alle laufenden Partien in einem eigenen Fenster mit schneller Navigation zur Statistik, Galerie und Auswahl.'
  let kicker = 'Spielstandfenster'

  if (isStatsWindow) {
    title = 'Statistik, Verlauf und Rekorde'
    copy = 'Analysiere deine Siege im Detail und wechsle ohne Umweg direkt zu offenen Spielstaenden oder in die Galerie.'
    kicker = 'Statistikfenster'
  }

  if (isGalleryWindow) {
    title = 'Galerie aller geloesten Spiele'
    copy = 'Jedes geloeste Motiv als eigener Galerie-Eintrag mit Vorschaubild, Schwierigkeit und Laufdaten.'
    kicker = 'Galeriefenster'
  }

  return (
    <AnimatedWorkspaceWindow
      overlayClassName="workspace-window-overlay"
      shellClassName={workspaceShellClassName}
      titleId="workspace-window-title"
      descriptionId="workspace-window-copy"
      onClose={handleReturnToStart}
      onOverlayClick={handleReturnToStart}
      closeOnOverlayClick
      closeOnEscape
      trapFocus
      restoreFocus
      lockScroll
      initialFocusRef={
        activeWindow === 'savedGames'
          ? savedGamesNavButtonRef
          : activeWindow === 'gallery'
            ? galleryNavButtonRef
            : statsNavButtonRef
      }
    >
      <AnimatedSwapPane swapKey={activeWindow} className="workspace-window-view" initialTiming="matched">
        <motion.div
          className="workspace-window-view-inner"
          variants={staggerContainerVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          onKeyDownCapture={handleStatsWindowKeyDownCapture}
        >
          <motion.header className="workspace-window-header" variants={staggerItemVariants}>
            <div className="workspace-window-heading">
              <span className="upload-kicker">{kicker}</span>
              <h2 id="workspace-window-title" className="workspace-window-title">
                {title}
              </h2>
              <p id="workspace-window-copy" className="workspace-window-copy">
                {copy}
              </p>
            </div>

            <div className="workspace-window-header-actions">
              <div className="workspace-window-status-row" aria-label="Fensterstatus">
                {isStatsWindow ? (
                  <>
                    <span className="workspace-window-status">{stats?.totalSolved ?? 0} Siege</span>
                    <span className="workspace-window-status">Aktualisiert {statsUpdatedLabel}</span>
                  </>
                ) : isGalleryWindow ? (
                  <>
                    <span className="workspace-window-status">{galleryCardCount} Motive</span>
                    <span className="workspace-window-status">{formatGallerySolveCount(galleryEntriesCount)}</span>
                    <span className="workspace-window-status">Letzter Sieg {latestGalleryLabel}</span>
                  </>
                ) : (
                  <>
                    <span className="workspace-window-status">{savedGamesCount} Spielstaende</span>
                    <span className="workspace-window-status">Neuester Stand {latestSavedLabel}</span>
                  </>
                )}
              </div>

              <div className="workspace-window-header-buttons" onKeyDown={handleDirectionalFocusNavigation}>
                {isStatsWindow && (
                  <AnimatedButton
                    className="secondary workspace-window-reset"
                    onClick={onRequestStatsReset}
                    disabled={!hasRecordedStats || isLoadingStats || isResettingStats}
                  >
                    {isResettingStats ? 'Loesche ...' : 'Statistik loeschen'}
                  </AnimatedButton>
                )}
                {isGalleryWindow && (
                  <AnimatedButton
                    className="secondary workspace-window-reset"
                    onClick={onRequestGalleryReset}
                    disabled={!hasGalleryEntries || isLoadingGallery || isResettingGallery}
                  >
                    {isResettingGallery ? 'Loesche ...' : 'Galerie loeschen'}
                  </AnimatedButton>
                )}
                <AnimatedButton
                  ref={closeButtonRef}
                  className="secondary workspace-window-close"
                  onClick={handleReturnToStart}
                >
                  Auswahl
                </AnimatedButton>
              </div>
            </div>
          </motion.header>

          <AnimatedStaggerGroup
            className="workspace-window-nav"
            as="nav"
            aria-label="Bereiche wechseln"
            level="subtle"
            onKeyDown={handleWorkspaceNavKeyDown}
          >
            <AnimatedButton
              ref={startNavButtonRef}
              className="workspace-window-nav-button"
              interaction="surface"
              data-workspace-window-nav="start"
              data-page-primary-focus="true"
              onClick={handleReturnToStart}
              reveal
              revealLevel="subtle"
            >
              <span className="workspace-window-nav-head">
                <UploadScreenIcon name="home" className="workspace-window-nav-icon" />
                <span className="workspace-window-nav-label">Auswahl</span>
              </span>
              <span className="workspace-window-nav-copy">Neue Runde beginnen</span>
            </AnimatedButton>
            <AnimatedButton
              ref={savedGamesNavButtonRef}
              className={`workspace-window-nav-button${activeWindow === 'savedGames' ? ' is-active' : ''}`}
              interaction="surface"
              data-workspace-window-nav="savedGames"
              aria-current={activeWindow === 'savedGames' ? 'page' : undefined}
              onClick={() => onWindowChange('savedGames')}
              reveal
              revealLevel="subtle"
            >
              <span className="workspace-window-nav-head">
                <UploadScreenIcon name="folder" className="workspace-window-nav-icon" />
                <span className="workspace-window-nav-label">Spielstaende</span>
              </span>
              <span className="workspace-window-nav-copy">{savedGamesCount} aktive Partien</span>
            </AnimatedButton>
            <AnimatedButton
              ref={statsNavButtonRef}
              className={`workspace-window-nav-button${activeWindow === 'stats' ? ' is-active' : ''}`}
              interaction="surface"
              data-workspace-window-nav="stats"
              aria-current={activeWindow === 'stats' ? 'page' : undefined}
              onClick={() => onWindowChange('stats')}
              reveal
              revealLevel="subtle"
            >
              <span className="workspace-window-nav-head">
                <UploadScreenIcon name="barChart2" className="workspace-window-nav-icon" />
                <span className="workspace-window-nav-label">Statistik</span>
              </span>
              <span className="workspace-window-nav-copy">{stats?.totalSolved ?? 0} Siege gesamt</span>
            </AnimatedButton>
            <AnimatedButton
              ref={galleryNavButtonRef}
              className={`workspace-window-nav-button${activeWindow === 'gallery' ? ' is-active' : ''}`}
              interaction="surface"
              data-workspace-window-nav="gallery"
              aria-current={activeWindow === 'gallery' ? 'page' : undefined}
              onClick={() => onWindowChange('gallery')}
              reveal
              revealLevel="subtle"
            >
              <span className="workspace-window-nav-head">
                <UploadScreenIcon name="image" className="workspace-window-nav-icon" />
                <span className="workspace-window-nav-label">Galerie</span>
              </span>
              <span className="workspace-window-nav-copy">{galleryCardCount} Motive sichtbar</span>
            </AnimatedButton>
          </AnimatedStaggerGroup>

          {isStatsWindow ? (
            <motion.div
              key={`stats-view-${statsViewReloadKey}`}
              className="workspace-window-body workspace-window-body-stats"
              variants={staggerItemVariants}
            >
              <motion.div className="stats-compact-kpis" variants={staggerContainerVariants}>
                {topStats.map((item) => (
                  <motion.div key={item.label} className="stats-compact-kpi" variants={staggerItemVariants}>
                    <span className="stats-compact-kpi-icon-shell" aria-hidden="true">
                      <UploadScreenIcon
                        name={getDashboardMetricIconName(item.label)}
                        className="stats-compact-kpi-icon"
                      />
                    </span>
                    <span className="stats-compact-kpi-copy">
                      <span className="stats-compact-kpi-label">{item.label}</span>
                      <strong className="stats-compact-kpi-value">{item.value}</strong>
                    </span>
                  </motion.div>
                ))}
              </motion.div>

              <motion.div variants={staggerItemVariants}>
                    <UploadStatsReport
                      primaryFocusRef={statsPrimaryActionRef}
                      isLoadingStats={isLoadingStats}
                      stats={stats}
                  latestCompletion={latestCompletion}
                  favoriteDifficulty={favoriteDifficulty}
                  fastestDifficulty={fastestDifficulty}
                  completionHistory={completionHistory}
                  filteredHistory={filteredHistory}
                  historyFilter={historyFilter}
                  historyFilterOptions={historyFilterOptions}
                  standardDifficultyStats={standardDifficultyStats}
                  onHistoryFilterChange={onHistoryFilterChange}
                  onReloadView={handleReloadStatsView}
                  onBackToStart={handleReturnToStart}
                />
              </motion.div>
            </motion.div>
          ) : isGalleryWindow ? (
            <motion.div className="workspace-window-body workspace-window-body-gallery" variants={staggerItemVariants}>
              <div className="workspace-window-layout workspace-window-layout-gallery">
                <motion.div className="workspace-window-main" variants={staggerItemVariants}>
                  <div className="dashboard-panel workspace-window-panel workspace-window-panel-gallery">
                    <UploadGalleryPanel
                      primaryFilterRef={galleryPrimaryFilterRef}
                      gallery={gallery}
                      isLoadingGallery={isLoadingGallery}
                      onReplayEntry={onReplayGalleryEntry}
                      onDeleteEntries={onDeleteGalleryEntries}
                      titleId="workspace-window-gallery-title"
                      panelRole="region"
                    />
                  </div>
                </motion.div>

                <motion.aside className="workspace-window-aside" variants={staggerContainerVariants}>
                  <motion.article className="workspace-window-card" variants={staggerItemVariants}>
                  <span className="saved-games-kicker">Ueberblick</span>
                  <strong className="workspace-window-card-title">Geloeste Motive</strong>
                  <p className="workspace-window-card-copy">
                    {hasGalleryEntries
                      ? `${galleryCardCount} Motive aus ${formatGallerySolveCount(galleryEntriesCount)} ueber ${galleryDifficultySpread} Schwierigkeitsstufen, davon ${galleryCleanCount} sauber und ${galleryProfiledCount} mit vollem Laufprofil.`
                      : 'Die Galerie fuellt sich automatisch nach jedem Sieg und bleibt bewusst getrennt von Statistik und Spielstaenden loeschbar.'}
                  </p>
                  <div className="dashboard-inline-chips">
                    <span className="saved-game-chip">{galleryCardCount} Motive</span>
                    <span className="saved-game-chip">{formatGallerySolveCount(galleryEntriesCount)}</span>
                    <span className="saved-game-chip">{galleryDifficultySpread} Stufen</span>
                    <span className="saved-game-chip">Clean {galleryCleanCount}</span>
                    <span className="saved-game-chip">Profil {galleryProfiledCount}</span>
                  </div>
                  </motion.article>

                  <motion.article className="workspace-window-card" variants={staggerItemVariants}>
                  <span className="saved-games-kicker">Zuletzt geloest</span>
                  {latestGalleryEntry ? (
                    <>
                      <strong className="workspace-window-card-title">{formatDifficultyLabel(latestGalleryEntry.config)}</strong>
                      <p className="workspace-window-card-copy">
                        Letzter Galerie-Eintrag vom {formatDate(latestGalleryEntry.completedAt)} mit {formatTime(latestGalleryEntry.time)} und {latestGalleryEntry.moves} Netto-Zuegen.
                      </p>
                      <div className="dashboard-inline-chips">
                        <span className="saved-game-chip">{formatPuzzleSize(latestGalleryEntry.config)}</span>
                        <span className="saved-game-chip">{formatTime(latestGalleryEntry.time)}</span>
                        <span className="saved-game-chip">Netto {latestGalleryEntry.moves}</span>
                        {latestGalleryEntry.hasDetailedProfile ? (
                          <span className="saved-game-chip">Aktionen {latestGalleryEntry.actionMoves}</span>
                        ) : (
                          <span className="saved-game-chip">Legacy-Daten</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <strong className="workspace-window-card-title">Noch kein Eintrag</strong>
                      <p className="workspace-window-card-copy">
                        Sobald du ein Puzzle loest, wird das Motiv hier mit Thumbnail und Laufwerten abgelegt.
                      </p>
                    </>
                  )}
                  </motion.article>

                  <motion.article className="workspace-window-card workspace-window-card-actions" variants={staggerItemVariants}>
                  <span className="saved-games-kicker">Weiter navigieren</span>
                  <strong className="workspace-window-card-title">Alle Bereiche direkt verbunden</strong>
                  <p className="workspace-window-card-copy">
                    Wechsle von der Galerie ohne Umweg zu offenen Partien, zur Statistik oder zur Auswahl.
                  </p>
                  <AnimatedStaggerGroup
                    className="workspace-window-card-buttons"
                    level="subtle"
                    onKeyDown={handleDirectionalFocusNavigation}
                  >
                    <AnimatedButton className="secondary" onClick={() => onWindowChange('savedGames')} reveal revealLevel="subtle">
                      Zu Spielstaenden
                    </AnimatedButton>
                    <AnimatedButton className="secondary" onClick={() => onWindowChange('stats')} reveal revealLevel="subtle">
                      Zur Statistik
                    </AnimatedButton>
                    <AnimatedButton className="secondary" onClick={handleReturnToStart} reveal revealLevel="subtle">
                      Zur Auswahl
                    </AnimatedButton>
                  </AnimatedStaggerGroup>
                  </motion.article>
                </motion.aside>
              </div>
            </motion.div>
          ) : (
            <motion.div className="workspace-window-body workspace-window-body-saves" variants={staggerItemVariants}>
              <div className="workspace-window-layout workspace-window-layout-saves">
                <motion.div className="workspace-window-main" variants={staggerItemVariants}>
                  <div className="dashboard-panel workspace-window-panel workspace-window-panel-saves">
                    <UploadSavedGamesPanel
                      primaryActionRef={savedGamesPrimaryActionRef}
                      isLoadingSavedGames={isLoadingSavedGames}
                      savedGames={savedGames}
                      savedGamesCount={savedGamesCount}
                      loadingSaveId={loadingSaveId}
                      deletingSaveId={deletingSaveId}
                      isDeletingAllSavedGames={isDeletingAllSavedGames}
                      onLoadSave={onLoadSave}
                      onDeleteRequest={onDeleteRequest}
                      onDeleteAllRequest={onDeleteAllRequest}
                      titleId="workspace-window-savedgames-title"
                      panelRole="region"
                    />
                  </div>
                </motion.div>

                <motion.aside className="workspace-window-aside" variants={staggerContainerVariants}>
                  <motion.article className="workspace-window-card" variants={staggerItemVariants}>
                  <span className="saved-games-kicker">Ueberblick</span>
                  <strong className="workspace-window-card-title">Aktive Partien</strong>
                  <p className="workspace-window-card-copy">
                    {savedGamesCount > 0
                      ? `${savedGamesCount} offene Partien mit ${savedGamesTotalMoves} bisher gespielten Zuegen und ${formatDuration(savedGamesTotalTime)} Gesamtspielzeit.`
                      : 'Sobald du ein Puzzle unterbrichst, erscheint es hier sofort als fortsetzbarer Spielstand.'}
                  </p>
                  <div className="dashboard-inline-chips">
                    <span className="saved-game-chip">{savedGamesCount} aktiv</span>
                    <span className="saved-game-chip">{savedGamesDifficultySpread} Stufen</span>
                    <span className="saved-game-chip">{formatDuration(savedGamesTotalTime)}</span>
                  </div>
                  </motion.article>

                  <motion.article className="workspace-window-card" variants={staggerItemVariants}>
                  <span className="saved-games-kicker">Zuletzt gesichert</span>
                  {latestSavedGame ? (
                    <>
                      <strong className="workspace-window-card-title">{latestSavedGame.name}</strong>
                      <p className="workspace-window-card-copy">
                        Letzte Sicherung am {formatDate(latestSavedGame.updatedAt)}. Die Partie liegt auf {formatDifficultyLabel(latestSavedGame.config)} bei {latestSavedGame.moves} Zuegen.
                      </p>
                      <div className="dashboard-inline-chips">
                        <span className="saved-game-chip">{formatPuzzleSize(latestSavedGame.config)}</span>
                        <span className="saved-game-chip">{latestSavedGame.moves} Zuege</span>
                        <span className="saved-game-chip">{formatTime(latestSavedGame.elapsedTime)}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <strong className="workspace-window-card-title">Noch keine Sicherung</strong>
                      <p className="workspace-window-card-copy">
                        Starte ein neues Puzzle, unterbrich es spaeter und du findest es hier mit Vorschau und Fortschritt wieder.
                      </p>
                    </>
                  )}
                  </motion.article>

                  <motion.article className="workspace-window-card workspace-window-card-actions" variants={staggerItemVariants}>
                  <span className="saved-games-kicker">Weiter navigieren</span>
                  <strong className="workspace-window-card-title">Statistik, Galerie und Auswahl direkt daneben</strong>
                  <p className="workspace-window-card-copy">
                    Wechsle zur Statistik fuer Rekorde, in die Galerie fuer geloeste Motive oder zur Auswahl fuer ein neues Bild.
                  </p>
                  <AnimatedStaggerGroup
                    className="workspace-window-card-buttons"
                    level="subtle"
                    onKeyDown={handleDirectionalFocusNavigation}
                  >
                    <AnimatedButton className="secondary" onClick={() => onWindowChange('stats')} reveal revealLevel="subtle">
                      Zur Statistik
                    </AnimatedButton>
                    <AnimatedButton className="secondary" onClick={() => onWindowChange('gallery')} reveal revealLevel="subtle">
                      Zur Galerie
                    </AnimatedButton>
                    <AnimatedButton className="secondary" onClick={handleReturnToStart} reveal revealLevel="subtle">
                      Zur Auswahl
                    </AnimatedButton>
                  </AnimatedStaggerGroup>
                  </motion.article>
                </motion.aside>
              </div>
            </motion.div>
          )}
        </motion.div>
      </AnimatedSwapPane>
    </AnimatedWorkspaceWindow>
  )
}






