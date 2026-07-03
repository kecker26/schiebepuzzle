import {
  PuzzleCompletionRecord,
  PuzzleDifficultyStats,
  PuzzleStats,
  SavedGameSummary,
  SolvedGallery,
  ImageCollection,
} from '../../types/index'
import { motion } from 'motion/react'
import {
  startTransition,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Info } from 'lucide-react'
import { handleDirectionalFocusNavigation } from '../../app/directionalFocusNavigation.ts'
import { isEditableTarget } from '../../app/keyboardShortcutUtils.ts'
import UploadScreenIcon, { type UploadScreenIconName } from '../../components/UploadScreenIcon.tsx'
import AnimatedButton from '../../motion/AnimatedButton.tsx'
import AnimatedSwapPane from '../../motion/AnimatedSwapPane.tsx'
import AnimatedWorkspaceWindow from '../../motion/AnimatedWorkspaceWindow.tsx'
import SpringNumber from '../../motion/SpringNumber.tsx'
import { getStaggerContainerVariants, getStaggerItemVariants } from '../../motion/variants.ts'
import { useReducedMotionPreference } from '../../motion/useReducedMotionPreference.ts'
import { DIFFICULTY_OPTIONS, formatDifficultyLabel, formatPuzzleSize } from '../../utils/puzzleDifficulty.ts'
import UploadGalleryPanel from './UploadGalleryPanel.tsx'
import UploadCollectionsPanel from './UploadCollectionsPanel.tsx'
import { getTagCollectionImageRemovals } from './galleryTagCollectionSync.ts'
import { countUniqueGalleryEntries, formatGallerySolveCount } from './UploadGalleryDisplayUtils.ts'
import UploadStatsReport from './UploadStatsReport.tsx'
import type { VisualStatsView } from './UploadStatsVisualReport.tsx'
import UploadSavedGamesPanel from './UploadSavedGamesPanel.tsx'
import UploadWorkspaceSideNav from './UploadWorkspaceSideNav.tsx'
import type { UploadCommandRequest } from './uploadCommandRequest.ts'
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
import type { GalleryReplayRequestHandler } from './galleryReplayRequest.ts'

interface UploadDashboardProps {
  activeWindow: Exclude<UploadWorkspaceWindow, 'start'>
  galleryResetRequestId?: number | null
  commandRequest?: UploadCommandRequest | null
  paletteStyle?: CSSProperties
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
  collections?: ImageCollection[]
  isLoadingStats: boolean
  isResettingStats: boolean
  isLoadingSavedGames: boolean
  isLoadingGallery: boolean
  isLoadingCollections?: boolean
  isResettingGallery: boolean
  hasRecordedStats: boolean
  onWindowChange: (window: UploadWorkspaceWindow) => void
  onHistoryFilterChange: (filter: HistoryFilter) => void
  onRequestStatsReset: () => void
  onRequestGalleryReset: () => void
  onReplayGalleryEntry: GalleryReplayRequestHandler
  onFetchRandomImage?: (query?: string) => Promise<void> | void
  onDeleteGalleryEntries: (entryIds: string[]) => Promise<void>
  onUpdateGalleryTags?: (action: 'rename' | 'remove', sourceLabel: string, targetLabel?: string) => Promise<void>
  onEditGalleryEntryTags?: (entryIds: string[], add?: string[], remove?: string[]) => Promise<void>
  onRetryGalleryTagging?: (entryId: string) => Promise<void>
  onCreateImageCollection?: (name: string, imageIds: string[], description?: string) => Promise<void>
  onUpdateImageCollection?: (
    collectionId: string,
    updates: Pick<ImageCollection, 'name'> & Partial<Pick<ImageCollection, 'description'>>
  ) => Promise<void>
  onDeleteImageCollection?: (collectionId: string) => Promise<void>
  onAddImageCollectionImages?: (collectionId: string, imageIds: string[]) => Promise<void>
  onRemoveImageCollectionImages?: (collectionId: string, imageIds: string[]) => Promise<void>
  onLoadSave: (saveId: string) => void
  onDeleteRequest: (save: SavedGameSummary) => void
  onDeleteAllRequest: () => void
}

type DifficultyOption = (typeof DIFFICULTY_OPTIONS)[number]
const WORKSPACE_NAV_FOCUS_SHORTCUT_KEY = 'v'
const WORKSPACE_SIDE_CARD_HIDDEN_CLASS = 'is-hidden-by-side-nav'
const WORKSPACE_SIDE_NAV_TOUCH_BUFFER_PX = 2

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
  galleryResetRequestId = null,
  commandRequest,
  paletteStyle,
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
  collections = [],
  isLoadingStats,
  isResettingStats,
  isLoadingSavedGames,
  isLoadingGallery,
  isLoadingCollections = false,
  isResettingGallery,
  hasRecordedStats,
  onWindowChange,
  onHistoryFilterChange,
  onRequestStatsReset,
  onRequestGalleryReset,
  onReplayGalleryEntry,
  onFetchRandomImage = async () => undefined,
  onDeleteGalleryEntries,
  onUpdateGalleryTags = async () => undefined,
  onEditGalleryEntryTags = async () => undefined,
  onRetryGalleryTagging = async () => undefined,
  onCreateImageCollection = async () => undefined,
  onUpdateImageCollection = async () => undefined,
  onDeleteImageCollection = async () => undefined,
  onAddImageCollectionImages = async () => undefined,
  onRemoveImageCollectionImages = async () => undefined,
  onLoadSave,
  onDeleteRequest,
  onDeleteAllRequest,
}: UploadDashboardProps) {
  const [statsViewReloadKey, setStatsViewReloadKey] = useState(0)
  const [statsVisualView, setStatsVisualView] = useState<VisualStatsView>('overview')
  const [requestedGalleryTagFilterLabel, setRequestedGalleryTagFilterLabel] = useState<string | null>(null)
  const [consumedGalleryCommandRequestId, setConsumedGalleryCommandRequestId] = useState<number | null>(null)
  const startNavButtonRef = useRef<HTMLButtonElement>(null)
  const savedGamesNavButtonRef = useRef<HTMLButtonElement>(null)
  const statsNavButtonRef = useRef<HTMLButtonElement>(null)
  const galleryNavButtonRef = useRef<HTMLButtonElement>(null)
  const collectionsNavButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const savedGamesPrimaryActionRef = useRef<HTMLButtonElement>(null)
  const galleryPrimaryFilterRef = useRef<HTMLSelectElement>(null)
  const collectionsPrimaryActionRef = useRef<HTMLButtonElement>(null)
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
  const collectionsCount = collections.length
  const collectedImageCount = collections.reduce((sum, collection) => sum + collection.imageIds.length, 0)
  const savedGamesTotalTime = savedGames.reduce((sum, save) => sum + save.elapsedTime, 0)
  const savedGamesTotalMoves = savedGames.reduce((sum, save) => sum + save.moves, 0)
  const savedGamesDifficultySpread = new Set(savedGames.map((save) => `${save.config.rows}x${save.config.cols}`)).size
  const latestSavedLabel = latestSavedGame ? formatDate(latestSavedGame.updatedAt) : 'Noch kein Spielstand'
  const statsUpdatedLabel = stats?.lastUpdatedAt ? formatDate(stats.lastUpdatedAt) : 'Noch keine Statistikdaten'
  const latestGalleryLabel = latestGalleryEntry ? formatDate(latestGalleryEntry.completedAt) : 'Noch kein Galerie-Eintrag'
  const isStatsWindow = activeWindow === 'stats'
  const isGalleryWindow = activeWindow === 'gallery'
  const isCollectionsWindow = activeWindow === 'collections'
  const galleryCommandRequest = isGalleryWindow && commandRequest?.id !== consumedGalleryCommandRequestId
    ? commandRequest
    : null
  const hasGalleryEntries = galleryEntriesCount > 0
  const shouldReduceMotion = useReducedMotionPreference()
  const staggerItemVariants = getStaggerItemVariants(shouldReduceMotion)
  const staggerContainerVariants = getStaggerContainerVariants(shouldReduceMotion)
  const workspaceShellClassName = `workspace-window-shell${activeWindow === 'savedGames' ? ' is-saves' : activeWindow === 'gallery' ? ' is-gallery' : activeWindow === 'collections' ? ' is-collections' : ' is-stats'}`
  const handleReturnToStart = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    onWindowChange('start')
  }
  const handleOpenGalleryTagFilter = useCallback((tagLabel: string) => {
    setRequestedGalleryTagFilterLabel(tagLabel)
    onWindowChange('gallery')
  }, [onWindowChange])

  useEffect(() => {
    if (commandRequest?.action === 'open-medal-stats') {
      setStatsVisualView('medals')
    }
  }, [commandRequest])

  useEffect(() => {
    if (!isGalleryWindow || !galleryCommandRequest) return
    if (
      galleryCommandRequest.action !== 'open-gallery'
      && galleryCommandRequest.action !== 'open-medal-hunt'
    ) {
      return
    }

    setConsumedGalleryCommandRequestId(galleryCommandRequest.id)
  }, [galleryCommandRequest, isGalleryWindow])
  const handleEditGalleryEntryTags = useCallback(async (
    entryIds: string[],
    add: string[] = [],
    remove: string[] = []
  ) => {
    await onEditGalleryEntryTags(entryIds, add, remove)

    const collectionRemovals = getTagCollectionImageRemovals(collections, entryIds, remove)
    for (const removal of collectionRemovals) {
      await onRemoveImageCollectionImages(removal.collectionId, removal.imageIds)
    }
  }, [collections, onEditGalleryEntryTags, onRemoveImageCollectionImages])
  const resetWorkspaceScrollPosition = useCallback((behavior: ScrollBehavior = 'auto') => {
    const overlay = document.querySelector('.workspace-window-overlay')
    const shell = document.querySelector('.workspace-window-shell')

    if (overlay instanceof HTMLElement) {
      overlay.scrollTo({ top: 0, left: 0, behavior })
    }

    if (shell instanceof HTMLElement) {
      shell.scrollTo({ top: 0, left: 0, behavior })
    }
  }, [])

  const handleReloadStatsView = () => {
    resetWorkspaceScrollPosition(shouldReduceMotion ? 'auto' : 'smooth')

    startTransition(() => {
      setStatsViewReloadKey((current) => current + 1)
    })
  }

  const handleScrollToWorkspaceStart = useCallback(() => {
    resetWorkspaceScrollPosition(shouldReduceMotion ? 'auto' : 'smooth')

    window.requestAnimationFrame(() => {
      const activeNavButton = document.querySelector<HTMLButtonElement>(
        '.workspace-window-nav-button[aria-current="page"]'
      )
      activeNavButton?.focus({ preventScroll: true })
    })
  }, [resetWorkspaceScrollPosition, shouldReduceMotion])

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
      case 'collections':
        return collectionsNavButtonRef.current
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

  useEffect(() => {
    const handleWorkspaceNavigationShortcut = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented
        || event.altKey
        || event.ctrlKey
        || event.metaKey
        || event.shiftKey
        || event.key.toLowerCase() !== WORKSPACE_NAV_FOCUS_SHORTCUT_KEY
        || isEditableTarget(event.target)
      ) {
        return
      }

      const firstNavButton = startNavButtonRef.current
      if (!firstNavButton?.isConnected) {
        return
      }

      event.preventDefault()
      firstNavButton.focus({ preventScroll: true })
    }

    window.addEventListener('keydown', handleWorkspaceNavigationShortcut, true)

    return () => {
      window.removeEventListener('keydown', handleWorkspaceNavigationShortcut, true)
    }
  }, [])

  useEffect(() => {
    let frameId = 0

    const getAsideCards = (aside: HTMLElement) => Array.from(aside.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement
        && child.classList.contains('workspace-window-card'),
    )

    const updateSideCardVisibility = () => {
      frameId = 0

      const shell = document.querySelector<HTMLElement>('.workspace-window-shell')
      const asides = shell?.querySelectorAll<HTMLElement>('.workspace-window-aside') ?? []

      asides.forEach((aside) => {
        const sideNav = aside.querySelector<HTMLElement>('.workspace-window-side-nav')
        const cards = getAsideCards(aside)

        if (!sideNav) {
          cards.forEach((card) => card.classList.remove(WORKSPACE_SIDE_CARD_HIDDEN_CLASS))
          return
        }

        const sideNavRect = sideNav.getBoundingClientRect()

        cards.forEach((card) => {
          const cardRect = card.getBoundingClientRect()
          const isTouchingSideNav = cardRect.top <= sideNavRect.bottom + WORKSPACE_SIDE_NAV_TOUCH_BUFFER_PX
            && cardRect.bottom >= sideNavRect.top

          card.classList.toggle(WORKSPACE_SIDE_CARD_HIDDEN_CLASS, isTouchingSideNav)
        })
      })
    }

    const scheduleSideCardVisibilityUpdate = () => {
      if (frameId > 0) {
        return
      }

      frameId = window.requestAnimationFrame(updateSideCardVisibility)
    }

    const overlay = document.querySelector<HTMLElement>('.workspace-window-overlay')
    const shell = document.querySelector<HTMLElement>('.workspace-window-shell')
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleSideCardVisibilityUpdate)

    overlay?.addEventListener('scroll', scheduleSideCardVisibilityUpdate, { passive: true })
    window.addEventListener('resize', scheduleSideCardVisibilityUpdate)

    if (resizeObserver && shell) {
      resizeObserver.observe(shell)
      shell.querySelectorAll<HTMLElement>('.workspace-window-aside, .workspace-window-side-nav, .workspace-window-card')
        .forEach((element) => resizeObserver.observe(element))
    }

    scheduleSideCardVisibilityUpdate()

    return () => {
      if (frameId > 0) {
        window.cancelAnimationFrame(frameId)
      }

      overlay?.removeEventListener('scroll', scheduleSideCardVisibilityUpdate)
      window.removeEventListener('resize', scheduleSideCardVisibilityUpdate)
      resizeObserver?.disconnect()
      document
        .querySelectorAll<HTMLElement>(`.${WORKSPACE_SIDE_CARD_HIDDEN_CLASS}`)
        .forEach((card) => card.classList.remove(WORKSPACE_SIDE_CARD_HIDDEN_CLASS))
    }
  }, [activeWindow, collectionsCount, galleryCardCount, savedGamesCount, stats?.totalSolved])

  const workspaceSideNav = (
    <UploadWorkspaceSideNav
      activeWindow={activeWindow}
      savedGamesCount={savedGamesCount}
      statsTotalSolved={stats?.totalSolved ?? 0}
      galleryCardCount={galleryCardCount}
      collectionsCount={collectionsCount}
      startNavButtonRef={startNavButtonRef}
      savedGamesNavButtonRef={savedGamesNavButtonRef}
      statsNavButtonRef={statsNavButtonRef}
      collectionsNavButtonRef={collectionsNavButtonRef}
      galleryNavButtonRef={galleryNavButtonRef}
      focusShortcutLabel={WORKSPACE_NAV_FOCUS_SHORTCUT_KEY.toUpperCase()}
      onWindowChange={onWindowChange}
      onKeyDown={handleWorkspaceNavKeyDown}
    />
  )

  let title = 'Gespeicherte Spielstaende verwalten'
  let copy = 'Alle laufenden Partien in einem eigenen Fenster mit schneller Navigation zur Statistik, Galerie und Auswahl.'
  let kicker = 'Spielstandfenster'

  if (isStatsWindow) {
    title = 'Statistik, Verlauf und Rekorde'
    copy = 'Analysiere deine Siege im Detail und wechsle direkt zu offenen Spielstaenden oder in die Galerie.'
    kicker = 'Statistikfenster'
  }

  if (isGalleryWindow) {
    title = 'Galerie aller geloesten Spiele'
    copy = 'Jedes geloeste Motiv als eigener Galerie-Eintrag mit Vorschaubild, Schwierigkeit und Laufdaten.'
    kicker = 'Galeriefenster'
  }

  if (isCollectionsWindow) {
    title = 'Sammlungen fuer Lieblingsmotive'
    copy = 'Ordne geloeste Motive in eigene Gruppen und starte sie direkt aus deinen Kollektionen neu.'
    kicker = 'Sammlungsfenster'
  }

  return (
    <AnimatedWorkspaceWindow
      overlayClassName="workspace-window-overlay"
      shellClassName={workspaceShellClassName}
      titleId="workspace-window-title"
      descriptionId="workspace-window-copy"
      onClose={handleReturnToStart}
      closeOnEscape
      trapFocus
      restoreFocus
      lockScroll
      overlayStyle={paletteStyle}
      initialFocusRef={
        activeWindow === 'savedGames'
          ? savedGamesNavButtonRef
          : activeWindow === 'gallery'
            ? galleryNavButtonRef
            : activeWindow === 'collections'
              ? collectionsNavButtonRef
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
                ) : isCollectionsWindow ? (
                  <>
                    <span className="workspace-window-status">{collectionsCount} Sammlungen</span>
                    <span className="workspace-window-status">{collectedImageCount} Motive</span>
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
                    disabled={!hasRecordedStats || isLoadingStats}
                    busy={isResettingStats}
                    busyLabel="Loesche Statistik ..."
                    data-app-tooltip="Gespeicherte Statistikdaten loeschen. Galerie und Spielstaende bleiben separat."
                    data-app-tooltip-position="top"
                  >
                    <UploadScreenIcon name="trash" />
                    Statistik loeschen
                  </AnimatedButton>
                )}
                {isGalleryWindow && (
                  <AnimatedButton
                    className="secondary workspace-window-reset"
                    onClick={onRequestGalleryReset}
                    disabled={!hasGalleryEntries || isLoadingGallery}
                    busy={isResettingGallery}
                    busyLabel="Loesche Galerie ..."
                    data-app-tooltip="Galerie geloester Motive loeschen. Spielstaende bleiben separat."
                    data-app-tooltip-position="top"
                  >
                    <UploadScreenIcon name="trash" />
                    Galerie loeschen
                  </AnimatedButton>
                )}
                <AnimatedButton
                  ref={closeButtonRef}
                  className="secondary workspace-window-close"
                  onClick={handleReturnToStart}
                  data-app-tooltip="Zum Auswahl-Dashboard zurueckkehren."
                  data-app-tooltip-position="top"
                >
                  <UploadScreenIcon name="home" />
                  Auswahl
                </AnimatedButton>
              </div>
            </div>
          </motion.header>

          {isStatsWindow ? (
            <motion.div
              key={`stats-view-${statsViewReloadKey}`}
              className="workspace-window-body workspace-window-body-stats"
              variants={staggerItemVariants}
            >
              <div className="workspace-window-layout workspace-window-layout-stats">
                <motion.div className="workspace-window-main" variants={staggerItemVariants}>
                  <motion.div className="stats-compact-kpis" variants={staggerContainerVariants}>
                    {topStats.map((item) => (
                      <motion.div
                        key={item.id}
                        className="stats-compact-kpi"
                        variants={staggerItemVariants}
                        tabIndex={0}
                        data-app-tooltip={item.helpText}
                      >
                        <span className="stats-compact-kpi-icon-shell" aria-hidden="true">
                          <UploadScreenIcon
                            name={getDashboardMetricIconName(item.label)}
                            className="stats-compact-kpi-icon"
                          />
                        </span>
                        <span className="stats-compact-kpi-copy">
                          <span className="stats-compact-kpi-label-row">
                            <span className="stats-compact-kpi-label">{item.label}</span>
                            <Info className="stats-kpi-help-icon" aria-hidden="true" />
                          </span>
                          <strong className="stats-compact-kpi-value">
                            <SpringNumber
                              value={item.springValue}
                              from={0}
                              durationMs={1700}
                              fallback={item.value}
                              formatter={item.springFormatter}
                            />
                          </strong>
                        </span>
                      </motion.div>
                    ))}
                  </motion.div>

                  <motion.div variants={staggerItemVariants}>
                    <UploadStatsReport
                      primaryFocusRef={statsPrimaryActionRef}
                      isLoadingStats={isLoadingStats}
                      stats={stats}
                      gallery={gallery}
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
                      activeVisualView={statsVisualView}
                      onActiveVisualViewChange={setStatsVisualView}
                      collections={collections}
                      isLoadingCollections={isLoadingCollections}
                      onReplayGalleryEntry={onReplayGalleryEntry}
                      onOpenGalleryTagFilter={handleOpenGalleryTagFilter}
                      onFetchRandomImage={onFetchRandomImage}
                      onEditGalleryEntryTags={handleEditGalleryEntryTags}
                      onRetryGalleryTagging={onRetryGalleryTagging}
                      onCreateCollection={onCreateImageCollection}
                      onAddCollectionImages={onAddImageCollectionImages}
                    />
                  </motion.div>
                </motion.div>

                <motion.aside className="workspace-window-aside" variants={staggerContainerVariants}>
                  {workspaceSideNav}

                  <motion.article className="workspace-window-card" variants={staggerItemVariants}>
                    <span className="saved-games-kicker">Ueberblick</span>
                    <strong className="workspace-window-card-title">Deine Bilanz</strong>
                    <p className="workspace-window-card-copy">
                      {stats && stats.totalSolved > 0
                        ? `${stats.totalSolved} Siege mit ${formatDuration(stats.totalTime)} Gesamtspielzeit und ${stats.totalMoves} Netto-Zuegen.`
                        : 'Nach dem ersten Sieg erscheinen hier Gesamtzeit, Zuege und Streaks als schnelle Einordnung.'}
                    </p>
                    <div className="dashboard-inline-chips">
                      <span className="saved-game-chip">{stats?.totalSolved ?? 0} Siege</span>
                      <span className="saved-game-chip">{formatDuration(stats?.totalTime ?? 0)}</span>
                      <span className="saved-game-chip">{stats?.activeDays ?? 0} Tage</span>
                    </div>
                  </motion.article>

                  <motion.article className="workspace-window-card" variants={staggerItemVariants}>
                    <span className="saved-games-kicker">Zuletzt geloest</span>
                    {latestCompletion ? (
                      <>
                        <strong className="workspace-window-card-title">{formatDifficultyLabel(latestCompletion.config)}</strong>
                        <p className="workspace-window-card-copy">
                          Letzter Sieg am {formatDate(latestCompletion.completedAt)} mit {formatTime(latestCompletion.time)} und {latestCompletion.moves} Netto-Zuegen.
                        </p>
                        <div className="dashboard-inline-chips">
                          <span className="saved-game-chip">{formatPuzzleSize(latestCompletion.config)}</span>
                          <span className="saved-game-chip">{formatTime(latestCompletion.time)}</span>
                          <span className="saved-game-chip">Streak {stats?.currentStreak ?? 0}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <strong className="workspace-window-card-title">Noch kein Lauf</strong>
                        <p className="workspace-window-card-copy">
                          Loese ein Puzzle und der neueste Lauf bleibt hier neben der Navigation sichtbar.
                        </p>
                      </>
                    )}
                  </motion.article>
                </motion.aside>
              </div>
            </motion.div>
          ) : isGalleryWindow ? (
            <motion.div className="workspace-window-body workspace-window-body-gallery" variants={staggerItemVariants}>
              <div className="workspace-window-layout workspace-window-layout-gallery">
                <motion.div className="workspace-window-main" variants={staggerItemVariants}>
                  <div className="dashboard-panel workspace-window-panel workspace-window-panel-gallery">
                    <UploadGalleryPanel
                      primaryFilterRef={galleryPrimaryFilterRef}
                      gallery={gallery}
                      collections={collections}
                      isLoadingGallery={isLoadingGallery}
                      isLoadingCollections={isLoadingCollections}
                      onReplayEntry={onReplayGalleryEntry}
                      onFetchRandomImage={onFetchRandomImage}
                      requestedTagFilterLabel={requestedGalleryTagFilterLabel}
                      resetGalleryViewId={galleryResetRequestId}
                      requestedMedalFilter={galleryCommandRequest?.medalFilter ?? null}
                      requestedMedalFilterId={galleryCommandRequest?.medalFilter ? galleryCommandRequest.id : null}
                      requestedMedalHuntFilter={
                        galleryCommandRequest?.action === 'open-medal-hunt' ? 'upgradeable' : null
                      }
                      requestedMedalHuntFilterId={
                        galleryCommandRequest?.action === 'open-medal-hunt' ? galleryCommandRequest.id : null
                      }
                      onDeleteEntries={onDeleteGalleryEntries}
                      onUpdateTags={onUpdateGalleryTags}
                      onEditEntryTags={handleEditGalleryEntryTags}
                      onRetryTagging={onRetryGalleryTagging}
                      onCreateCollection={onCreateImageCollection}
                      onAddCollectionImages={onAddImageCollectionImages}
                      onBackToStart={handleReturnToStart}
                      onScrollToStart={handleScrollToWorkspaceStart}
                      titleId="workspace-window-gallery-title"
                      panelRole="region"
                      paletteStyle={paletteStyle}
                    />
                  </div>
                </motion.div>

                <motion.aside className="workspace-window-aside" variants={staggerContainerVariants}>
                  {workspaceSideNav}

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
                </motion.aside>
              </div>
            </motion.div>
          ) : isCollectionsWindow ? (
            <motion.div className="workspace-window-body workspace-window-body-collections" variants={staggerItemVariants}>
              <div className="workspace-window-layout workspace-window-layout-collections">
                <motion.div className="workspace-window-main" variants={staggerItemVariants}>
                  <div className="dashboard-panel workspace-window-panel workspace-window-panel-collections">
                    <UploadCollectionsPanel
                      primaryActionRef={collectionsPrimaryActionRef}
                      collections={collections}
                      gallery={gallery}
                      isLoadingCollections={isLoadingCollections}
                      onReplayEntry={onReplayGalleryEntry}
                      onTagFilter={handleOpenGalleryTagFilter}
                      onFetchRandomImage={onFetchRandomImage}
                      onUpdateCollection={onUpdateImageCollection}
                      onDeleteCollection={onDeleteImageCollection}
                      onRemoveCollectionImages={onRemoveImageCollectionImages}
                      onEditEntryTags={handleEditGalleryEntryTags}
                      onBackToStart={handleReturnToStart}
                      onScrollToStart={handleScrollToWorkspaceStart}
                      titleId="workspace-window-collections-title"
                      panelRole="region"
                      paletteStyle={paletteStyle}
                    />
                  </div>
                </motion.div>

                <motion.aside className="workspace-window-aside" variants={staggerContainerVariants}>
                  {workspaceSideNav}

                  <motion.article className="workspace-window-card" variants={staggerItemVariants}>
                    <span className="saved-games-kicker">Ueberblick</span>
                    <strong className="workspace-window-card-title">Deine Kollektionen</strong>
                    <p className="workspace-window-card-copy">
                      {collectionsCount > 0
                        ? `${collectionsCount} Sammlungen mit ${collectedImageCount} gespeicherten Galerie-Referenzen.`
                        : 'Sobald du in der Galerie ein Motiv sammelst, erscheint hier deine erste Kollektion.'}
                    </p>
                    <div className="dashboard-inline-chips">
                      <span className="saved-game-chip">{collectionsCount} Sammlungen</span>
                      <span className="saved-game-chip">{collectedImageCount} Motive</span>
                    </div>
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
                      onBackToStart={handleReturnToStart}
                      onScrollToStart={handleScrollToWorkspaceStart}
                      titleId="workspace-window-savedgames-title"
                      panelRole="region"
                    />
                  </div>
                </motion.div>

                <motion.aside className="workspace-window-aside" variants={staggerContainerVariants}>
                  {workspaceSideNav}

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
                </motion.aside>
              </div>
            </motion.div>
          )}
        </motion.div>
      </AnimatedSwapPane>
    </AnimatedWorkspaceWindow>
  )
}






