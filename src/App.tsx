import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { AnimatePresence } from 'motion/react'
import CommandPalette, { type CommandPaletteCommand } from './components/CommandPalette.tsx'
import GlobalHelpOverlay from './components/GlobalHelpOverlay.tsx'
import RecoveryResumeDialog from './components/RecoveryResumeDialog.tsx'
import StatusToast, { type StatusToastPayload } from './components/StatusToast.tsx'
import ThemeSwitcher, { type ThemeSwitcherSaveStatus } from './components/ThemeSwitcher.tsx'
import WinDialog from './components/WinDialog.tsx'
import AccessibilityAnnouncerHost, { useAccessibilityAnnouncer } from './app/accessibilityAnnouncer.tsx'
import {
  clearCropDraftSessionSnapshot,
  readCropDraftSessionSnapshot,
  type CropDraftSnapshot,
  writeCropDraftSessionSnapshot,
} from './app/cropDraftSession.ts'
import { getDefaultHelpContext, getHelpView, type HelpContext } from './app/helpRegistry.ts'
import {
  clearLastSessionSnapshot,
  readLastSessionSnapshot,
  type LastSessionSnapshot,
  writeLastSessionSnapshot,
} from './app/lastSession.ts'
import {
  clearIgnoredRecoverySaveId as clearIgnoredRecoverySavePreference,
  clearRecoverySessionSnapshot,
  readIgnoredRecoverySaveId,
  readRecoverySessionSnapshot,
  writeIgnoredRecoverySaveId,
  writeRecoverySessionSnapshot,
} from './app/recoverySession.ts'
import { useCommandPaletteShortcuts } from './app/useCommandPaletteShortcuts.ts'
import { useGlobalHelpShortcuts } from './app/useGlobalHelpShortcuts.ts'
import { useGlobalPrimaryFocusShortcut } from './app/useGlobalPrimaryFocusShortcut.ts'
import { useStartScreenHero } from './app/useStartScreenHero.ts'
import { useImageThemePalette } from './app/useImageThemePalette.ts'
import { usePuzzleStats } from './app/usePuzzleStats.ts'
import { useSavedGamesCatalog } from './app/useSavedGamesCatalog.ts'
import { useSolvedGallery } from './app/useSolvedGallery.ts'
import { useImageCollections } from './app/useImageCollections.ts'
import { type AppContextMenuHandler } from './app/appContextMenu.ts'
import { useButtonOnlyTabNavigation } from './app/useButtonOnlyTabNavigation.ts'
import AnimatedScreen from './motion/AnimatedScreen.tsx'
import { useGlobalGlowTracking } from './motion/useGlowTracking.ts'
import {
  createCompletionPreviewImage,
  createGalleryPreviewImage,
  createPreviewImage,
  getErrorMessage,
  scrollViewportToTop,
  upsertSummary,
} from './app/appUtils.ts'
import StartScreen from './screens/StartScreen.tsx'
import { createDefaultCropTransform } from './services/CropService.ts'
import {
  createPuzzleDataBackupFile,
  deletePuzzleDataBackupFile,
  importPuzzleDataBackupFile,
} from './services/BackupService.ts'
import { fetchRandomPuzzleImageResult, type RandomImageSourceInfo } from './services/RandomImageService.ts'
import {
  createSavedGame,
  deleteAllSavedGames,
  deleteSavedGame,
  loadSavedGame,
  updateSavedGame,
} from './services/SaveService.ts'
import { addSolvedGalleryEntry, deleteSolvedGalleryEntries } from './services/GalleryService.ts'
import {
  addImageCollectionImages,
  createImageCollection,
  deleteImageCollection,
  removeImageCollectionImages,
  updateImageCollection,
} from './services/CollectionService.ts'
import audioService from './services/AudioService.ts'
import { recordPuzzleCompletion } from './services/StatsService.ts'
import { useTheme } from './contexts/ThemeContext.tsx'
import { getMusicStyleDefinition, MUSIC_STYLE_DEFINITIONS } from './services/musicStyles.ts'
import { type UploadCommandRequest, type UploadCommandRequestAction } from './screens/upload/uploadCommandRequest.ts'
import { type HistoryFilter, type UploadWorkspaceWindow } from './screens/upload/uploadUtils.ts'
import {
  AppState,
  PersistedPuzzleProgress,
  PuzzleDataBackupFile,
  PuzzleDataImportResult,
  PuzzleConfig,
  RecordPuzzleCompletionPayload,
  RecordPuzzleCompletionResult,
  RecordSolvedGalleryEntryPayload,
  SavedGameSummary,
  SolvedGalleryEntry,
  ImageCollection,
  ImageCollections,
  WinStats,
} from './types/index'
import { DEFAULT_PUZZLE_CONFIG, getNextDifficultyOption } from './utils/puzzleDifficulty.ts'

const DEFAULT_CONFIG: PuzzleConfig = DEFAULT_PUZZLE_CONFIG
const SAVE_DEBOUNCE_MS = 3000
const SAVE_MAX_INTERVAL_MS = 10000
type GlobalOverlayKind = 'help' | 'commandPalette'

function formatCommandTime(seconds: number | null | undefined): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
    return '--'
  }

  const roundedSeconds = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(roundedSeconds / 60)
  const remainingSeconds = roundedSeconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

function formatSaveTime(timestamp: number): string {
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp)
}

function describeResumeWindow(activeWindow: UploadWorkspaceWindow, historyFilter: HistoryFilter): string {
  switch (activeWindow) {
    case 'savedGames':
      return 'Spielstaende zuletzt geoeffnet.'
    case 'stats':
      return historyFilter === 'all'
        ? 'Statistik zuletzt geoeffnet.'
        : `Statistik zuletzt geoeffnet, Filter ${historyFilter}.`
    case 'gallery':
      return 'Galerie zuletzt geoeffnet.'
    case 'collections':
      return 'Sammlungen zuletzt geoeffnet.'
    case 'start':
    default:
      return 'Auswahlansicht zuletzt geoeffnet.'
  }
}

function describeCropResume(snapshot: CropDraftSnapshot): string {
  if (snapshot.isRandomImage) {
    return snapshot.randomImageSource?.label
      ? `Bildzuschnitt zuletzt geoeffnet, Zufallsbild von ${snapshot.randomImageSource.label}.`
      : 'Bildzuschnitt zuletzt mit einem Zufallsbild geoeffnet.'
  }

  return 'Bildzuschnitt zuletzt geoeffnet.'
}

function hasMeaningfulUploadResume(snapshot: LastSessionSnapshot): boolean {
  return snapshot.uploadWindow !== 'start' || snapshot.historyFilter !== 'all'
}

function useMusicMuted(): boolean {
  const subscribe = useCallback((onStoreChange: () => void) => {
    return audioService.subscribeToMusicMuted(onStoreChange)
  }, [])
  const getSnapshot = useCallback(() => audioService.getMusicMuted(), [])
  return useSyncExternalStore(subscribe, getSnapshot)
}

function useSelectedMusicStyle() {
  const subscribe = useCallback((onStoreChange: () => void) => {
    return audioService.subscribeToSelectedMusicStyle(onStoreChange)
  }, [])
  const getSnapshot = useCallback(() => audioService.getSelectedMusicStyle(), [])
  return useSyncExternalStore(subscribe, getSnapshot)
}

const loadUploadScreen = () => import('./screens/UploadScreen.tsx')
const loadCropScreen = () => import('./screens/CropScreen.tsx')
const loadPuzzleScreen = () => import('./screens/PuzzleScreen.tsx')

const UploadScreen = lazy(loadUploadScreen)
const CropScreen = lazy(loadCropScreen)
const PuzzleScreen = lazy(loadPuzzleScreen)
const APP_CONTEXT_MENU_BLOCKERS = '.puzzle-context-menu, [aria-modal="true"], [role="dialog"], [role="alertdialog"]'

interface AppScreenFallbackProps {
  title: string
  copy: string
}

interface PersistSaveOptions {
  keepalive?: boolean
}

interface RecoveryResumePromptState {
  save: SavedGameSummary
  interruptedAt: number
}

interface UploadResumeContext {
  activeWindow: UploadWorkspaceWindow
  historyFilter: HistoryFilter
}

type StartResumeCandidate =
  | {
      kind: 'save'
      save: SavedGameSummary
      label: string
      detail: string
    }
  | {
      kind: 'crop'
      label: string
      detail: string
    }
  | {
      kind: 'upload'
      activeWindow: UploadWorkspaceWindow
      historyFilter: HistoryFilter
      label: string
      detail: string
    }

function AppScreenFallback({ title, copy }: AppScreenFallbackProps) {
  return (
    <div className="app-screen-fallback" role="status" aria-live="polite">
      <div className="app-screen-fallback-card">
        <span className="app-screen-fallback-kicker">Ansicht wird geladen</span>
        <strong className="app-screen-fallback-title">{title}</strong>
        <p className="app-screen-fallback-copy">{copy}</p>
      </div>
    </div>
  )
}

export default function App() {
  const appRef = useRef<HTMLDivElement | null>(null)
  useGlobalGlowTracking()

  const announceAccessibility = useAccessibilityAnnouncer()
  const { mode, toggleMode } = useTheme()
  const isMusicMuted = useMusicMuted()
  const selectedMusicStyle = useSelectedMusicStyle()
  const [appState, setAppState] = useState<AppState>('welcome')
  const [image, setImage] = useState<string | null>(null)
  const [isRandomImage, setIsRandomImage] = useState(false)
  const [config, setConfig] = useState<PuzzleConfig>(DEFAULT_CONFIG)
  const [croppedImage, setCroppedImage] = useState<string | null>(null)
  const [savedProgress, setSavedProgress] = useState<PersistedPuzzleProgress | null>(null)
  const [currentSaveId, setCurrentSaveId] = useState<string | null>(null)
  const [completionResult, setCompletionResult] = useState<RecordPuzzleCompletionResult | null>(null)
  const [completionStatsError, setCompletionStatsError] = useState<string | null>(null)
  const [isRecordingCompletion, setIsRecordingCompletion] = useState(false)
  const [winStats, setWinStats] = useState<WinStats | null>(null)
  const [puzzleRunKey, setPuzzleRunKey] = useState(0)
  const [quitHint, setQuitHint] = useState<string | null>(null)
  const [isFetchingRandom, setIsFetchingRandom] = useState(false)
  const [randomImageError, setRandomImageError] = useState<string | null>(null)
  const [randomImageSource, setRandomImageSource] = useState<RandomImageSourceInfo | null>(null)
  const [activeGlobalOverlay, setActiveGlobalOverlay] = useState<GlobalOverlayKind | null>(null)
  const [helpContext, setHelpContext] = useState<HelpContext>(() => getDefaultHelpContext('welcome'))
  const [statusToast, setStatusToast] = useState<StatusToastPayload | null>(null)
  const [hasPendingSaveChanges, setHasPendingSaveChanges] = useState(false)
  const [isSavePersisting, setIsSavePersisting] = useState(false)
  const [lastSuccessfulSaveAt, setLastSuccessfulSaveAt] = useState<number | null>(null)
  const [saveStatusError, setSaveStatusError] = useState<string | null>(null)
  const [recoveryResumePrompt, setRecoveryResumePrompt] = useState<RecoveryResumePromptState | null>(null)
  const [deferredRecoverySaveId, setDeferredRecoverySaveId] = useState<string | null>(null)
  const [ignoredRecoverySaveId, setIgnoredRecoverySaveId] = useState<string | null>(() => readIgnoredRecoverySaveId())
  const [cropDraftSnapshot, setCropDraftSnapshot] = useState<CropDraftSnapshot | null>(() => readCropDraftSessionSnapshot())
  const [lastSessionSnapshot, setLastSessionSnapshot] = useState<LastSessionSnapshot | null>(() => readLastSessionSnapshot())
  const [uploadCommandRequest, setUploadCommandRequest] = useState<UploadCommandRequest | null>(null)
  const wasHelpOpenRef = useRef(false)
  const uploadCommandRequestIdRef = useRef(0)
  const statusToastIdRef = useRef(0)

  const {
    savedGames,
    isLoadingSavedGames,
    savedGamesError,
    setSavedGames,
    setSavedGamesError,
    refreshSavedGames,
  } = useSavedGamesCatalog()
  const {
    statsOverview,
    isLoadingStats,
    isResettingStats,
    statsError,
    setStatsOverview,
    setStatsError,
    resetStats,
  } = usePuzzleStats()
  const {
    gallery,
    isLoadingGallery,
    isResettingGallery,
    galleryError,
    setGallery,
    setGalleryError,
    resetGallery,
  } = useSolvedGallery()
  const {
    collections,
    isLoadingCollections,
    collectionsError,
    setCollections,
    setCollectionsError,
    refreshCollections,
  } = useImageCollections()

  const createSavePromiseRef = useRef<Promise<string> | null>(null)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const currentSaveIdRef = useRef<string | null>(null)
  const deferredRecoverySaveIdRef = useRef<string | null>(deferredRecoverySaveId)
  const ignoredRecoverySaveIdRef = useRef<string | null>(ignoredRecoverySaveId)
  const cropDraftSnapshotRef = useRef<CropDraftSnapshot | null>(cropDraftSnapshot)
  const lastSessionSnapshotRef = useRef<LastSessionSnapshot | null>(lastSessionSnapshot)
  const activeSessionRef = useRef(0)
  const saveDebounceTimerRef = useRef<number | null>(null)
  const pendingSaveProgressRef = useRef<PersistedPuzzleProgress | null>(null)
  const pendingSaveStartedAtRef = useRef(0)
  const cropDraftPersistTimerRef = useRef<number | null>(null)
  const appContextMenuHandlerRef = useRef<AppContextMenuHandler | null>(null)
  const lastPersistedSaveAtRef = useRef(0)
  const selectedMusicStyleDefinition = useMemo(
    () => getMusicStyleDefinition(selectedMusicStyle),
    [selectedMusicStyle]
  )
  const isHelpOpen = activeGlobalOverlay === 'help'
  const isCommandPaletteOpen = activeGlobalOverlay === 'commandPalette'
  const isSaveStatusBusy = hasPendingSaveChanges || isSavePersisting
  const visibleSaveStatus = useMemo<ThemeSwitcherSaveStatus | null>(() => {
    if (appState !== 'playing') {
      return null
    }

    if (saveStatusError) {
      return {
        kind: 'error',
        label: 'Speichern fehlgeschlagen',
        detail: saveStatusError,
      }
    }

    if (isSaveStatusBusy) {
      return {
        kind: 'saving',
        label: 'Speichert...',
        detail: 'Spielstand wird automatisch gesichert.',
      }
    }

    if (lastSuccessfulSaveAt) {
      return {
        kind: 'saved',
        label: 'Gespeichert',
        detail: `Zuletzt um ${formatSaveTime(lastSuccessfulSaveAt)}`,
      }
    }

    if (currentSaveId) {
      return {
        kind: 'active',
        label: 'Spielstand aktiv',
        detail: 'Autosave bereit.',
      }
    }

    return null
  }, [appState, currentSaveId, isSaveStatusBusy, lastSuccessfulSaveAt, saveStatusError])

  useImageThemePalette(image, croppedImage)
  useButtonOnlyTabNavigation(appRef)
  useGlobalPrimaryFocusShortcut({ scopeRef: appRef })
  const openHelp = useCallback(() => {
    setActiveGlobalOverlay('help')
  }, [])

  const closeHelp = useCallback(() => {
    setActiveGlobalOverlay((current) => (current === 'help' ? null : current))
  }, [])

  const openCommandPalette = useCallback(() => {
    setActiveGlobalOverlay('commandPalette')
  }, [])

  const closeCommandPalette = useCallback(() => {
    setActiveGlobalOverlay((current) => (current === 'commandPalette' ? null : current))
  }, [])

  useGlobalHelpShortcuts({
    isHelpOpen,
    onOpenHelp: openHelp,
    onCloseHelp: closeHelp,
  })
  useCommandPaletteShortcuts({
    isOpen: isCommandPaletteOpen,
    onOpen: openCommandPalette,
    onClose: closeCommandPalette,
  })

  useEffect(() => {
    audioService.activate()

    const activateAudio = () => {
      audioService.activate()
    }

    window.addEventListener('pointerdown', activateAudio, { passive: true })
    window.addEventListener('click', activateAudio, { passive: true })
    window.addEventListener('touchend', activateAudio, { passive: true })
    window.addEventListener('keydown', activateAudio)

    return () => {
      window.removeEventListener('pointerdown', activateAudio)
      window.removeEventListener('click', activateAudio)
      window.removeEventListener('touchend', activateAudio)
      window.removeEventListener('keydown', activateAudio)
    }
  }, [])

  useEffect(() => {
    if (appState !== 'playing') return
    audioService.noteGameStarted()
  }, [appState, puzzleRunKey])

  useEffect(() => {
    if (appState === 'welcome') {
      void loadUploadScreen()
    }
  }, [appState])

  useEffect(() => {
    if (appState === 'idle') {
      void loadCropScreen()
    }
  }, [appState])

  useEffect(() => {
    if (appState === 'imageLoaded') {
      void loadPuzzleScreen()
    }
  }, [appState])

  useEffect(() => {
    if (appState !== 'idle') {
      setHelpContext(getDefaultHelpContext(appState))
    }
  }, [appState])

  useEffect(() => {
    if (isHelpOpen && !wasHelpOpenRef.current) {
      announceAccessibility(`Hilfe geoeffnet: ${getHelpView(helpContext).kicker}.`)
    }

    wasHelpOpenRef.current = isHelpOpen
  }, [announceAccessibility, helpContext, isHelpOpen])

  useEffect(() => {
    if (!isCommandPaletteOpen) {
      return
    }

    announceAccessibility('Schnellaktionen geoeffnet.')
  }, [announceAccessibility, isCommandPaletteOpen])

  const startScreenHeroImage = useStartScreenHero({
    appState,
    gallery,
    savedGames,
    isLoadingGallery,
    isLoadingSavedGames,
  })

  const commitLastSessionSnapshot = useCallback((nextSnapshot: LastSessionSnapshot | null) => {
    lastSessionSnapshotRef.current = nextSnapshot
    setLastSessionSnapshot(nextSnapshot)
    if (nextSnapshot) {
      writeLastSessionSnapshot(nextSnapshot)
      return
    }

    clearLastSessionSnapshot()
  }, [])

  const showStatusToast = useCallback((message: string) => {
    statusToastIdRef.current += 1
    setStatusToast({
      id: statusToastIdRef.current,
      message,
    })
  }, [])

  const handleDismissStatusToast = useCallback((toastId: number) => {
    setStatusToast((currentToast) => (
      currentToast?.id === toastId ? null : currentToast
    ))
  }, [])

  const rememberIgnoredRecoverySave = useCallback((saveId: string) => {
    ignoredRecoverySaveIdRef.current = saveId
    setIgnoredRecoverySaveId(saveId)
    writeIgnoredRecoverySaveId(saveId)
  }, [])

  const clearIgnoredRecoverySave = useCallback((saveId?: string | null) => {
    const currentIgnoredSaveId = ignoredRecoverySaveIdRef.current
    if (typeof saveId === 'string' && saveId.length > 0 && currentIgnoredSaveId !== saveId) {
      return
    }

    ignoredRecoverySaveIdRef.current = null
    setIgnoredRecoverySaveId(null)
    clearIgnoredRecoverySavePreference(saveId)
  }, [])

  const flushCropDraftSnapshot = useCallback(() => {
    if (cropDraftPersistTimerRef.current !== null) {
      window.clearTimeout(cropDraftPersistTimerRef.current)
      cropDraftPersistTimerRef.current = null
    }

    const currentDraft = cropDraftSnapshotRef.current
    if (currentDraft) {
      writeCropDraftSessionSnapshot(currentDraft)
      return
    }

    clearCropDraftSessionSnapshot()
  }, [])

  const commitCropDraftSnapshot = useCallback((
    nextSnapshot: CropDraftSnapshot | null,
    options?: {
      syncState?: boolean
      immediate?: boolean
    }
  ) => {
    cropDraftSnapshotRef.current = nextSnapshot

    if (options?.syncState ?? true) {
      setCropDraftSnapshot(nextSnapshot)
    }

    if (cropDraftPersistTimerRef.current !== null) {
      window.clearTimeout(cropDraftPersistTimerRef.current)
      cropDraftPersistTimerRef.current = null
    }

    if (!nextSnapshot) {
      clearCropDraftSessionSnapshot()
      return
    }

    if (options?.immediate) {
      writeCropDraftSessionSnapshot(nextSnapshot)
      return
    }

    cropDraftPersistTimerRef.current = window.setTimeout(() => {
      const latestDraft = cropDraftSnapshotRef.current
      if (latestDraft) {
        writeCropDraftSessionSnapshot(latestDraft)
      } else {
        clearCropDraftSessionSnapshot()
      }
      cropDraftPersistTimerRef.current = null
    }, 120)
  }, [])

  const clearScheduledSave = useCallback(() => {
    if (saveDebounceTimerRef.current !== null) {
      window.clearTimeout(saveDebounceTimerRef.current)
      saveDebounceTimerRef.current = null
    }
    pendingSaveProgressRef.current = null
    pendingSaveStartedAtRef.current = 0
    setHasPendingSaveChanges(false)
  }, [])

  const resetCompletionFeedback = useCallback(() => {
    setCompletionResult(null)
    setCompletionStatsError(null)
    setIsRecordingCompletion(false)
  }, [])

  const releaseAppFocus = useCallback(() => {
    const activeElement = document.activeElement
    if (activeElement instanceof HTMLElement && appRef.current?.contains(activeElement)) {
      activeElement.blur()
    }
  }, [])

  const resetRunArtifacts = useCallback(() => {
    currentSaveIdRef.current = null
    setCurrentSaveId(null)
    setSavedProgress(null)
    setWinStats(null)
    setRandomImageError(null)
    resetCompletionFeedback()
  }, [resetCompletionFeedback])

  const restartPuzzleRun = useCallback(() => {
    setPuzzleRunKey((prev) => prev + 1)
  }, [])

  useEffect(() => {
    currentSaveIdRef.current = currentSaveId
  }, [currentSaveId])

  useEffect(() => {
    deferredRecoverySaveIdRef.current = deferredRecoverySaveId
  }, [deferredRecoverySaveId])

  useEffect(() => {
    ignoredRecoverySaveIdRef.current = ignoredRecoverySaveId
  }, [ignoredRecoverySaveId])

  useEffect(() => {
    const persistCropDraftOnHide = () => {
      flushCropDraftSnapshot()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushCropDraftSnapshot()
      }
    }

    window.addEventListener('pagehide', persistCropDraftOnHide)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('pagehide', persistCropDraftOnHide)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [flushCropDraftSnapshot])

  const buildCropDraftSnapshot = useCallback((overrides?: Partial<{
    image: string
    config: PuzzleConfig
    isRandomImage: boolean
    randomImageSource: RandomImageSourceInfo | null
    transform: CropDraftSnapshot['transform']
    useFullImage: boolean
  }>): CropDraftSnapshot | null => {
    const nextImage = overrides?.image ?? image
    if (!nextImage) {
      return null
    }

    const currentDraft = cropDraftSnapshotRef.current
    return {
      version: 1,
      updatedAt: Date.now(),
      image: nextImage,
      config: overrides?.config ?? config,
      isRandomImage: overrides?.isRandomImage ?? isRandomImage,
      randomImageSource: overrides?.randomImageSource ?? randomImageSource,
      transform: overrides?.transform ?? currentDraft?.transform ?? createDefaultCropTransform(),
      useFullImage: overrides?.useFullImage ?? currentDraft?.useFullImage ?? false,
    }
  }, [config, image, isRandomImage, randomImageSource])

  useEffect(() => {
    if (appState !== 'playing' || !currentSaveId) {
      return
    }

    const currentSnapshot = lastSessionSnapshotRef.current
    commitLastSessionSnapshot(writeLastSessionSnapshot({
      target: 'save',
      saveId: currentSaveId,
      uploadWindow: currentSnapshot?.uploadWindow ?? 'start',
      historyFilter: currentSnapshot?.historyFilter ?? 'all',
    }))
  }, [appState, commitLastSessionSnapshot, currentSaveId])

  useEffect(() => {
    if (appState !== 'imageLoaded') {
      return
    }

    const nextCropDraft = buildCropDraftSnapshot()
    if (nextCropDraft) {
      commitCropDraftSnapshot(nextCropDraft, {
        syncState: cropDraftSnapshotRef.current === null,
      })
    }

    const currentSnapshot = lastSessionSnapshotRef.current
    commitLastSessionSnapshot(writeLastSessionSnapshot({
      target: 'crop',
      saveId: null,
      uploadWindow: currentSnapshot?.uploadWindow ?? 'start',
      historyFilter: currentSnapshot?.historyFilter ?? 'all',
    }))
  }, [appState, buildCropDraftSnapshot, commitCropDraftSnapshot, commitLastSessionSnapshot])

  useEffect(() => {
    if (isLoadingSavedGames) {
      return
    }

    const currentSnapshot = lastSessionSnapshotRef.current
    if (!currentSnapshot?.saveId) {
      return
    }

    if (savedGames.some((entry) => entry.id === currentSnapshot.saveId)) {
      return
    }

    if (currentSnapshot.target === 'upload') {
      commitLastSessionSnapshot(writeLastSessionSnapshot({
        target: 'upload',
        saveId: null,
        uploadWindow: currentSnapshot.uploadWindow,
        historyFilter: currentSnapshot.historyFilter,
      }))
      return
    }

    if (hasMeaningfulUploadResume(currentSnapshot)) {
      commitLastSessionSnapshot(writeLastSessionSnapshot({
        target: 'upload',
        saveId: null,
        uploadWindow: currentSnapshot.uploadWindow,
        historyFilter: currentSnapshot.historyFilter,
      }))
      return
    }

    commitLastSessionSnapshot(null)
  }, [commitLastSessionSnapshot, isLoadingSavedGames, savedGames])

  useEffect(() => {
    if (appState !== 'playing' || !currentSaveId) {
      return
    }

    if (deferredRecoverySaveIdRef.current === currentSaveId) {
      setDeferredRecoverySaveId(null)
    }
    clearIgnoredRecoverySave(currentSaveId)
    writeRecoverySessionSnapshot(currentSaveId)
  }, [appState, clearIgnoredRecoverySave, currentSaveId, savedProgress?.elapsedTime, savedProgress?.moveCount])

  useEffect(() => {
    if (appState === 'playing' || isLoadingSavedGames || recoveryResumePrompt) {
      return
    }

    const recoverySnapshot = readRecoverySessionSnapshot()
    if (!recoverySnapshot) {
      return
    }

    if (deferredRecoverySaveIdRef.current === recoverySnapshot.saveId) {
      return
    }

    if (ignoredRecoverySaveIdRef.current === recoverySnapshot.saveId) {
      return
    }

    const matchingSave = savedGames.find((entry) => entry.id === recoverySnapshot.saveId)
    if (!matchingSave) {
      clearRecoverySessionSnapshot()
      clearIgnoredRecoverySavePreference(recoverySnapshot.saveId)
      return
    }

    setRecoveryResumePrompt({
      save: matchingSave,
      interruptedAt: recoverySnapshot.interruptedAt,
    })
    announceAccessibility('Unterbrochene Runde gefunden. Wiederherstellen ist moeglich.')
  }, [
    announceAccessibility,
    appState,
    isLoadingSavedGames,
    recoveryResumePrompt,
    savedGames,
  ])

  useEffect(() => {
    return () => {
      flushCropDraftSnapshot()
      clearScheduledSave()
    }
  }, [clearScheduledSave, flushCropDraftSnapshot])

  useEffect(() => {
    if (appState !== 'idle') return

    const frameId = window.requestAnimationFrame(() => {
      scrollViewportToTop()
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [appState])

  useEffect(() => {
    releaseAppFocus()

    let nestedFrameId: number | null = null
    let timeoutId: number | null = null
    const frameId = window.requestAnimationFrame(() => {
      scrollViewportToTop()
      nestedFrameId = window.requestAnimationFrame(() => {
        scrollViewportToTop()
      })

      timeoutId = window.setTimeout(() => {
        scrollViewportToTop()
      }, 0)
    })

    return () => {
      window.cancelAnimationFrame(frameId)
      if (nestedFrameId !== null) {
        window.cancelAnimationFrame(nestedFrameId)
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [appState, releaseAppFocus])

  const beginSession = useCallback(() => {
    activeSessionRef.current += 1
    clearRecoverySessionSnapshot()
    createSavePromiseRef.current = null
    lastPersistedSaveAtRef.current = 0
    setHasPendingSaveChanges(false)
    setIsSavePersisting(false)
    setLastSuccessfulSaveAt(null)
    setSaveStatusError(null)
    setRecoveryResumePrompt(null)
    clearScheduledSave()
    return activeSessionRef.current
  }, [clearScheduledSave])

  const handleUploadSessionContextChange = useCallback((context: UploadResumeContext) => {
    const currentSnapshot = lastSessionSnapshotRef.current
    commitLastSessionSnapshot(writeLastSessionSnapshot({
      target: 'upload',
      saveId: currentSnapshot?.saveId ?? null,
      uploadWindow: context.activeWindow,
      historyFilter: context.historyFilter,
    }))
  }, [commitLastSessionSnapshot])

  const handleCropSessionDraftChange = useCallback((draft: {
    transform: CropDraftSnapshot['transform']
    useFullImage: boolean
  }) => {
    const nextCropDraft = buildCropDraftSnapshot({
      transform: draft.transform,
      useFullImage: draft.useFullImage,
    })
    if (!nextCropDraft) {
      return
    }

    commitCropDraftSnapshot(nextCropDraft, {
      syncState: false,
    })
  }, [buildCropDraftSnapshot, commitCropDraftSnapshot])

  const clearDeletedSaveFromLastSession = useCallback((deletedSaveId: string | null) => {
    const currentSnapshot = lastSessionSnapshotRef.current
    if (!currentSnapshot) {
      return
    }

    if (deletedSaveId !== null && currentSnapshot.saveId !== deletedSaveId) {
      return
    }

    if (currentSnapshot.target === 'upload' || hasMeaningfulUploadResume(currentSnapshot)) {
      commitLastSessionSnapshot(writeLastSessionSnapshot({
        target: 'upload',
        saveId: null,
        uploadWindow: currentSnapshot.uploadWindow,
        historyFilter: currentSnapshot.historyFilter,
      }))
      return
    }

    commitLastSessionSnapshot(null)
  }, [commitLastSessionSnapshot])

  const enqueueSaveTask = useCallback((task: () => Promise<void>) => {
    const queuedTask = saveQueueRef.current.then(task).catch((error) => {
      setSavedGamesError(`Spielstand konnte nicht gespeichert werden: ${getErrorMessage(error)}`)
    })
    saveQueueRef.current = queuedTask
    return queuedTask
  }, [setSavedGamesError])

  const ensureSaveId = useCallback(
    async (
      progress: PersistedPuzzleProgress,
      sessionId: number,
      options: PersistSaveOptions = {}
    ): Promise<string> => {
      if (currentSaveIdRef.current) return currentSaveIdRef.current

      const pendingCreation = createSavePromiseRef.current
      if (pendingCreation) return pendingCreation

      if (!image || !croppedImage) {
        throw new Error('Es gibt kein aktives Bild zum Speichern.')
      }

      const creationPromise = (async () => {
        const previewImage = await createPreviewImage(croppedImage)
        if (activeSessionRef.current === sessionId) {
          lastPersistedSaveAtRef.current = Date.now()
        }
        const created = await createSavedGame({
          image,
          croppedImage,
          previewImage,
          config,
          progress,
        }, {
          keepalive: options.keepalive,
        })

        setSavedGames((prev) => upsertSummary(prev, created))

        if (activeSessionRef.current === sessionId) {
          currentSaveIdRef.current = created.id
          setCurrentSaveId(created.id)
        }

        return created.id
      })()

      createSavePromiseRef.current = creationPromise
      try {
        return await creationPromise
      } finally {
        if (createSavePromiseRef.current === creationPromise) {
          createSavePromiseRef.current = null
        }
      }
    },
    [config, croppedImage, image, setSavedGames]
  )

  const persistSaveProgress = useCallback(
    async (
      progress: PersistedPuzzleProgress,
      sessionId: number,
      options: PersistSaveOptions = {}
    ): Promise<void> => {
      const existingSaveId = currentSaveIdRef.current
      if (!existingSaveId) {
        await ensureSaveId(progress, sessionId, options)
        return
      }

      try {
        if (activeSessionRef.current === sessionId) {
          lastPersistedSaveAtRef.current = Date.now()
        }
        const updated = await updateSavedGame(existingSaveId, { progress }, {
          keepalive: options.keepalive,
        })
        setSavedGames((prev) => upsertSummary(prev, updated))
        if (
          activeSessionRef.current === sessionId
          && currentSaveIdRef.current === existingSaveId
        ) {
          setSaveStatusError(null)
        }
      } catch (error) {
        // If the save was deleted between scheduling and execution, skip silently
        if (currentSaveIdRef.current !== existingSaveId) return
        throw error
      }
    },
    [ensureSaveId, setSavedGames]
  )

  const flushPendingSave = useCallback(
    (
      sessionId: number,
      options: PersistSaveOptions = {}
    ): Promise<void> => {
      const latestProgress = pendingSaveProgressRef.current
      if (saveDebounceTimerRef.current !== null) {
        window.clearTimeout(saveDebounceTimerRef.current)
        saveDebounceTimerRef.current = null
      }
      pendingSaveProgressRef.current = null
      pendingSaveStartedAtRef.current = 0

      if (!latestProgress) {
        setHasPendingSaveChanges(false)
        return Promise.resolve()
      }

      return enqueueSaveTask(async () => {
        if (activeSessionRef.current !== sessionId) {
          return
        }

        setIsSavePersisting(true)
        setSaveStatusError(null)

        try {
          await persistSaveProgress(latestProgress, sessionId, options)
          if (activeSessionRef.current === sessionId) {
            setLastSuccessfulSaveAt(Date.now())
            setSaveStatusError(null)
          }
        } catch (error) {
          if (activeSessionRef.current === sessionId) {
            pendingSaveProgressRef.current = latestProgress
            if (pendingSaveStartedAtRef.current === 0) {
              pendingSaveStartedAtRef.current = Date.now()
            }
            setHasPendingSaveChanges(true)
            setSaveStatusError(getErrorMessage(error))
          }
          throw error
        } finally {
          if (activeSessionRef.current === sessionId) {
            setIsSavePersisting(false)
            setHasPendingSaveChanges(pendingSaveProgressRef.current !== null)
          }
        }
      })
    },
    [enqueueSaveTask, persistSaveProgress]
  )

  const handleRestoreCropSession = useCallback(async () => {
    const snapshot = cropDraftSnapshotRef.current ?? cropDraftSnapshot
    if (!snapshot) {
      return
    }

    if (appState === 'playing') {
      await flushPendingSave(activeSessionRef.current, {})
    }

    releaseAppFocus()
    scrollViewportToTop()
    beginSession()
    audioService.stopTransientEffects()
    resetRunArtifacts()
    setQuitHint(null)
    commitCropDraftSnapshot(snapshot, {
      immediate: true,
    })
    setConfig(snapshot.config)
    setImage(snapshot.image)
    setIsRandomImage(snapshot.isRandomImage)
    setRandomImageSource(snapshot.randomImageSource)
    setCroppedImage(null)
    setAppState('imageLoaded')
  }, [
    appState,
    beginSession,
    commitCropDraftSnapshot,
    cropDraftSnapshot,
    flushPendingSave,
    releaseAppFocus,
    resetRunArtifacts,
  ])

  const scheduleSaveProgress = useCallback(
    (progress: PersistedPuzzleProgress, sessionId: number) => {
      const now = Date.now()
      pendingSaveProgressRef.current = progress
      if (pendingSaveStartedAtRef.current === 0) {
        pendingSaveStartedAtRef.current = now
      }

      if (saveDebounceTimerRef.current !== null) {
        window.clearTimeout(saveDebounceTimerRef.current)
      }

      const idleSaveAt = now + SAVE_DEBOUNCE_MS
      const earliestAllowedSaveAt = lastPersistedSaveAtRef.current + SAVE_MAX_INTERVAL_MS
      const forcedSaveAt = pendingSaveStartedAtRef.current + SAVE_MAX_INTERVAL_MS
      const targetSaveAt = Math.min(Math.max(idleSaveAt, earliestAllowedSaveAt), forcedSaveAt)
      const delay = Math.max(0, targetSaveAt - now)

      saveDebounceTimerRef.current = window.setTimeout(() => {
        saveDebounceTimerRef.current = null
        void flushPendingSave(sessionId)
      }, delay)
    },
    [flushPendingSave]
  )

  useEffect(() => {
    const flushSaveOnHide = () => {
      if (appState !== 'playing') {
        return
      }

      void flushPendingSave(activeSessionRef.current, {
        keepalive: currentSaveIdRef.current !== null,
      })
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushSaveOnHide()
      }
    }

    window.addEventListener('pagehide', flushSaveOnHide)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('pagehide', flushSaveOnHide)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [appState, flushPendingSave])

  const handleImageLoaded = useCallback((imgSrc: string, isRandom = false, source: RandomImageSourceInfo | null = null) => {
    const initialCropDraft = writeCropDraftSessionSnapshot({
      image: imgSrc,
      config,
      isRandomImage: isRandom,
      randomImageSource: isRandom ? source : null,
      transform: createDefaultCropTransform(),
      useFullImage: false,
    })

    beginSession()
    resetRunArtifacts()
    commitCropDraftSnapshot(initialCropDraft, {
      immediate: true,
    })
    setImage(imgSrc)
    setIsRandomImage(isRandom)
    setRandomImageSource(isRandom ? source : null)
    setIsFetchingRandom(false)
    setRandomImageError(null)
    setCroppedImage(null)
    setAppState('imageLoaded')
  }, [beginSession, commitCropDraftSnapshot, config, resetRunArtifacts])

  const handleLoadSavedGame = useCallback(async (saveId: string): Promise<void> => {
    try {
      const loaded = await loadSavedGame(saveId)
      beginSession()
      restartPuzzleRun()
      commitCropDraftSnapshot(null, {
        immediate: true,
      })
      setDeferredRecoverySaveId(null)
      clearIgnoredRecoverySave(saveId)

      currentSaveIdRef.current = loaded.id
      setCurrentSaveId(loaded.id)
      setImage(loaded.image)
      setCroppedImage(loaded.croppedImage)
      setConfig(loaded.config)
      setSavedProgress(loaded.progress)
      setIsRandomImage(false)
      setRandomImageSource(null)
      setWinStats(null)
      setRandomImageError(null)
      resetCompletionFeedback()
      setAppState('playing')
      setSavedGamesError(null)
    } catch (error) {
      setSavedGamesError(`Spielstand konnte nicht geladen werden: ${getErrorMessage(error)}`)
    }
  }, [beginSession, clearIgnoredRecoverySave, commitCropDraftSnapshot, resetCompletionFeedback, restartPuzzleRun, setSavedGamesError])

  const handleDismissRecoveryResumePrompt = useCallback(() => {
    setDeferredRecoverySaveId(recoveryResumePrompt?.save.id ?? null)
    setRecoveryResumePrompt(null)
  }, [recoveryResumePrompt])

  const handleDeclineRecoveryResumePrompt = useCallback(() => {
    const declinedSaveId = recoveryResumePrompt?.save.id ?? null

    clearRecoverySessionSnapshot()
    if (declinedSaveId) {
      rememberIgnoredRecoverySave(declinedSaveId)
    }
    setDeferredRecoverySaveId(null)

    const currentSnapshot = lastSessionSnapshotRef.current
    if (declinedSaveId && currentSnapshot?.saveId === declinedSaveId) {
      if (hasMeaningfulUploadResume(currentSnapshot)) {
        commitLastSessionSnapshot(writeLastSessionSnapshot({
          target: 'upload',
          saveId: null,
          uploadWindow: currentSnapshot.uploadWindow,
          historyFilter: currentSnapshot.historyFilter,
        }))
      } else {
        commitLastSessionSnapshot(null)
      }
    }

    setRecoveryResumePrompt(null)
    showStatusToast('Nicht fortgesetzt. Der Spielstand bleibt unter Spielstaende erhalten.')
  }, [commitLastSessionSnapshot, recoveryResumePrompt, rememberIgnoredRecoverySave, showStatusToast])

  const handleResumeRecoveredSave = useCallback(async () => {
    if (!recoveryResumePrompt) {
      return
    }

    clearRecoverySessionSnapshot()
    clearIgnoredRecoverySave(recoveryResumePrompt.save.id)
    setDeferredRecoverySaveId(null)
    setRecoveryResumePrompt(null)
    await handleLoadSavedGame(recoveryResumePrompt.save.id)
  }, [clearIgnoredRecoverySave, handleLoadSavedGame, recoveryResumePrompt])

  const handleDeleteSavedGame = async (saveId: string): Promise<void> => {
    try {
      await deleteSavedGame(saveId)
      setSavedGames((prev) => prev.filter((entry) => entry.id !== saveId))
      clearDeletedSaveFromLastSession(saveId)
      clearIgnoredRecoverySave(saveId)

      if (currentSaveIdRef.current === saveId) {
        currentSaveIdRef.current = null
        setCurrentSaveId(null)
      }

      setSavedGamesError(null)
    } catch (error) {
      setSavedGamesError(`Spielstand konnte nicht geloescht werden: ${getErrorMessage(error)}`)
    }
  }

  const handleDeleteAllSavedGames = async (): Promise<void> => {
    try {
      await deleteAllSavedGames()
      currentSaveIdRef.current = null
      setCurrentSaveId(null)
      setSavedProgress(null)
      setSavedGames([])
      clearDeletedSaveFromLastSession(null)
      clearIgnoredRecoverySave()
      setSavedGamesError(null)
    } catch (error) {
      setSavedGamesError(`Spielstaende konnten nicht geloescht werden: ${getErrorMessage(error)}`)
    }
  }

  const handleResetStats = async (): Promise<void> => {
    try {
      await resetStats()
      setCompletionResult(null)
      setCompletionStatsError(null)
    } catch {
      // Hook already exposes the error state.
    }
  }

  const handleResetGallery = async (): Promise<void> => {
    try {
      await resetGallery()
      setGalleryError(null)
      await refreshCollections(false)
    } catch {
      // Hook already exposes the error state.
    }
  }

  const handleDeleteGalleryEntries = useCallback(async (entryIds: string[]): Promise<void> => {
    if (entryIds.length === 0) return

    try {
      const nextGallery = await deleteSolvedGalleryEntries(entryIds)
      setGallery(nextGallery)
      setGalleryError(null)
      await refreshCollections(false)
    } catch (error) {
      setGalleryError(`Galerie-Bild konnte nicht geloescht werden: ${getErrorMessage(error)}`)
      throw error
    }
  }, [refreshCollections, setGallery, setGalleryError])

  const handleCreateImageCollection = useCallback(async (
    name: string,
    imageIds: string[],
    description?: string
  ): Promise<ImageCollections> => {
    try {
      const nextCollections = await createImageCollection({ name, description, imageIds })
      setCollections(nextCollections)
      setCollectionsError(null)
      return nextCollections
    } catch (error) {
      setCollectionsError(`Sammlung konnte nicht erstellt werden: ${getErrorMessage(error)}`)
      throw error
    }
  }, [setCollections, setCollectionsError])

  const handleUpdateImageCollection = useCallback(async (
    collectionId: string,
    updates: Pick<ImageCollection, 'name'> & Partial<Pick<ImageCollection, 'description'>>
  ): Promise<ImageCollections> => {
    try {
      const nextCollections = await updateImageCollection(collectionId, updates)
      setCollections(nextCollections)
      setCollectionsError(null)
      return nextCollections
    } catch (error) {
      setCollectionsError(`Sammlung konnte nicht aktualisiert werden: ${getErrorMessage(error)}`)
      throw error
    }
  }, [setCollections, setCollectionsError])

  const handleDeleteImageCollection = useCallback(async (collectionId: string): Promise<ImageCollections> => {
    try {
      const nextCollections = await deleteImageCollection(collectionId)
      setCollections(nextCollections)
      setCollectionsError(null)
      return nextCollections
    } catch (error) {
      setCollectionsError(`Sammlung konnte nicht geloescht werden: ${getErrorMessage(error)}`)
      throw error
    }
  }, [setCollections, setCollectionsError])

  const handleAddImageCollectionImages = useCallback(async (
    collectionId: string,
    imageIds: string[]
  ): Promise<ImageCollections> => {
    try {
      const nextCollections = await addImageCollectionImages(collectionId, { imageIds })
      setCollections(nextCollections)
      setCollectionsError(null)
      return nextCollections
    } catch (error) {
      setCollectionsError(`Bild konnte nicht zur Sammlung hinzugefuegt werden: ${getErrorMessage(error)}`)
      throw error
    }
  }, [setCollections, setCollectionsError])

  const handleRemoveImageCollectionImages = useCallback(async (
    collectionId: string,
    imageIds: string[]
  ): Promise<ImageCollections> => {
    try {
      const nextCollections = await removeImageCollectionImages(collectionId, { imageIds })
      setCollections(nextCollections)
      setCollectionsError(null)
      return nextCollections
    } catch (error) {
      setCollectionsError(`Bild konnte nicht aus der Sammlung entfernt werden: ${getErrorMessage(error)}`)
      throw error
    }
  }, [setCollections, setCollectionsError])

  const handleCreateBackupFile = useCallback(async (): Promise<PuzzleDataBackupFile> => {
    return createPuzzleDataBackupFile()
  }, [])

  const handleImportBackupFile = useCallback(async (fileName: string): Promise<PuzzleDataImportResult> => {
    const result = await importPuzzleDataBackupFile(fileName)

    beginSession()
    resetRunArtifacts()
    commitCropDraftSnapshot(null, {
      immediate: true,
    })
    setDeferredRecoverySaveId(null)
    setImage(null)
    setIsRandomImage(false)
    setCroppedImage(null)
    setSavedGames(result.savedGames)
    setSavedGamesError(null)
    setStatsOverview(result.stats)
    setStatsError(null)
    setGallery(result.gallery)
    setGalleryError(null)
    setCollections(result.collections)
    setCollectionsError(null)
    setAppState('idle')

    return result
  }, [
    beginSession,
    commitCropDraftSnapshot,
    resetRunArtifacts,
    setGallery,
    setGalleryError,
    setCollections,
    setCollectionsError,
    setSavedGames,
    setSavedGamesError,
    setStatsError,
    setStatsOverview,
  ])

  const handleDeleteBackupFile = useCallback(async (fileName: string): Promise<void> => {
    await deletePuzzleDataBackupFile(fileName)
  }, [])

  const handleConfigChange = useCallback((rows: number, cols: number) => {
    const nextConfig = { rows, cols }
    setConfig(nextConfig)

    if (appState !== 'imageLoaded') {
      return
    }

    const nextCropDraft = buildCropDraftSnapshot({
      config: nextConfig,
    })
    if (nextCropDraft) {
      commitCropDraftSnapshot(nextCropDraft, {
        syncState: false,
      })
    }
  }, [appState, buildCropDraftSnapshot, commitCropDraftSnapshot])

  const handleEnterApp = useCallback(() => {
    releaseAppFocus()
    scrollViewportToTop()
    setQuitHint(null)
    setUploadCommandRequest(null)
    audioService.activate()
    setAppState('idle')
  }, [releaseAppFocus])

  const handleQuitApp = useCallback(async () => {
    setQuitHint(null)
    if (appState === 'playing') {
      await flushPendingSave(activeSessionRef.current, {
        keepalive: currentSaveIdRef.current !== null,
      })
    }

    window.close()

    window.setTimeout(() => {
      if (!window.closed) {
        setQuitHint('Der Browser blockiert das automatische Beenden. Bitte schliesse das Tab oder Fenster manuell.')
      }
    }, 180)
  }, [appState, flushPendingSave])

  const handleCropConfirmed = (croppedSrc: string) => {
    beginSession()
    resetRunArtifacts()
    commitCropDraftSnapshot(null, {
      immediate: true,
    })
    setCroppedImage(croppedSrc)
    restartPuzzleRun()
    setAppState('playing')
  }

  const handleProgressChange = useCallback(
    (progress: PersistedPuzzleProgress | null) => {
      setSavedProgress(progress)
      if (!progress) {
        clearScheduledSave()
        return
      }

      setSaveStatusError(null)
      setHasPendingSaveChanges(true)
      const sessionId = activeSessionRef.current
      scheduleSaveProgress(progress, sessionId)
    },
    [clearScheduledSave, scheduleSaveProgress]
  )

  const createCompletionPayload = useCallback(
    async (stats: WinStats, completedConfig: PuzzleConfig): Promise<RecordPuzzleCompletionPayload> => ({
      config: completedConfig,
      moves: stats.moves,
      time: stats.time,
      actionMoves: stats.actionMoves,
      undoCount: stats.undoCount,
      redoCount: stats.redoCount,
      hintCount: stats.hintCount,
      suggestedMoveCount: stats.suggestedMoveCount,
      previewImage: croppedImage ? await createCompletionPreviewImage(croppedImage) : null,
    }),
    [croppedImage]
  )

  const createGalleryEntryPayload = useCallback(
    async (stats: WinStats, completedConfig: PuzzleConfig): Promise<RecordSolvedGalleryEntryPayload> => ({
      config: completedConfig,
      moves: stats.moves,
      time: stats.time,
      actionMoves: stats.actionMoves,
      assistanceMode: stats.assistanceMode,
      hasDetailedProfile: true,
      previewImage: croppedImage ? await createGalleryPreviewImage(croppedImage) : null,
      sourceImage: image ?? croppedImage ?? null,
    }),
    [croppedImage, image]
  )

  const handleWin = useCallback(
    (stats: WinStats) => {
      const completedConfig = { rows: config.rows, cols: config.cols }
      const completedSaveId = currentSaveIdRef.current
      const sessionId = beginSession()

      currentSaveIdRef.current = null
      setCurrentSaveId(null)
      setSavedProgress(null)
      setWinStats(stats)
      setCompletionResult(null)
      setCompletionStatsError(null)
      setIsRecordingCompletion(true)
      setAppState('solved')

      void (async () => {
        try {
          const [completionPayload, galleryPayload] = await Promise.all([
            createCompletionPayload(stats, completedConfig),
            createGalleryEntryPayload(stats, completedConfig),
          ])

          const [statsOutcome, galleryOutcome] = await Promise.allSettled([
            recordPuzzleCompletion(completionPayload),
            addSolvedGalleryEntry(galleryPayload),
          ])

          if (statsOutcome.status === 'fulfilled') {
            setStatsOverview(statsOutcome.value.stats)
            setStatsError(null)

            if (activeSessionRef.current === sessionId) {
              setCompletionResult(statsOutcome.value)
            }
          } else if (activeSessionRef.current === sessionId) {
            setCompletionStatsError(
              `Bestzeiten konnten nicht aktualisiert werden: ${getErrorMessage(statsOutcome.reason)}`
            )
          }

          if (galleryOutcome.status === 'fulfilled') {
            setGallery(galleryOutcome.value)
            setGalleryError(null)
          } else {
            // Silent retry: transient failures should not permanently lose the gallery entry
            try {
              const retryResult = await addSolvedGalleryEntry(galleryPayload)
              setGallery(retryResult)
              setGalleryError(null)
            } catch (retryError) {
              setGalleryError(`Galerie konnte nicht aktualisiert werden: ${getErrorMessage(retryError)}`)
            }
          }

          if (completedSaveId) {
            try {
              await deleteSavedGame(completedSaveId)
              setSavedGames((prev) => prev.filter((entry) => entry.id !== completedSaveId))
              clearDeletedSaveFromLastSession(completedSaveId)
            } catch (error) {
              setSavedGamesError(
                `Spielstand konnte nach dem Sieg nicht entfernt werden: ${getErrorMessage(error)}`
              )
            }
          }
        } finally {
          if (activeSessionRef.current === sessionId) {
            setIsRecordingCompletion(false)
          }
        }
      })()
    },
    [
      beginSession,
      config,
      createCompletionPayload,
      createGalleryEntryPayload,
      setGallery,
      setGalleryError,
      setSavedGames,
      setSavedGamesError,
      setStatsError,
      setStatsOverview,
      clearDeletedSaveFromLastSession,
    ]
  )

  const handleRetryStats = useCallback(() => {
    if (!winStats) return

    setCompletionResult(null)
    setCompletionStatsError(null)
    setIsRecordingCompletion(true)

    const retryConfig = { rows: config.rows, cols: config.cols }
    const sessionId = activeSessionRef.current

    void (async () => {
      try {
        const result = await recordPuzzleCompletion(await createCompletionPayload(winStats, retryConfig))

        setStatsOverview(result.stats)
        setStatsError(null)

        if (activeSessionRef.current === sessionId) {
          setCompletionResult(result)
        }
      } catch (error) {
        if (activeSessionRef.current === sessionId) {
          setCompletionStatsError(
            `Bestzeiten konnten nicht aktualisiert werden: ${getErrorMessage(error)}`
          )
        }
      } finally {
        if (activeSessionRef.current === sessionId) {
          setIsRecordingCompletion(false)
        }
      }
    })()
  }, [config, createCompletionPayload, setStatsError, setStatsOverview, winStats])

  const handleFetchRandomImage = useCallback(async () => {
    setRandomImageError(null)
    setIsFetchingRandom(true)

    try {
      const randomImage = await fetchRandomPuzzleImageResult()
      handleImageLoaded(randomImage.imageSrc, true, randomImage.source)
    } catch (error) {
      setRandomImageError(`Zufaelliges Bild konnte nicht geladen werden: ${getErrorMessage(error)}`)
    } finally {
      setIsFetchingRandom(false)
    }
  }, [handleImageLoaded])

  const handleReplayGalleryEntry = useCallback((entry: SolvedGalleryEntry) => {
    const replayImage = entry.sourceImage ?? entry.previewImage
    if (!replayImage) {
      setGalleryError('Dieses Galerie-Bild kann nicht erneut gespielt werden, weil kein Bild gespeichert ist.')
      return
    }

    scrollViewportToTop()
    beginSession()
    resetRunArtifacts()
    commitCropDraftSnapshot(writeCropDraftSessionSnapshot({
      image: replayImage,
      config: entry.config,
      isRandomImage: false,
      randomImageSource: null,
      transform: createDefaultCropTransform(),
      useFullImage: false,
    }), {
      immediate: true,
    })
    setConfig(entry.config)
      setImage(replayImage)
      setCroppedImage(null)
      setIsRandomImage(false)
      setRandomImageSource(null)
      setGalleryError(null)
      setAppState('imageLoaded')
  }, [beginSession, commitCropDraftSnapshot, resetRunArtifacts, setGalleryError])

  const navigateToTopLevelScreen = useCallback(async (targetState: AppState) => {
    if (appState === 'playing') {
      await flushPendingSave(activeSessionRef.current, {
      })
    }

    releaseAppFocus()
    scrollViewportToTop()
    beginSession()
    audioService.stopTransientEffects()
    resetRunArtifacts()
    setQuitHint(null)
    setImage(null)
    setIsRandomImage(false)
    setRandomImageSource(null)
    setCroppedImage(null)
    setAppState(targetState)
    void refreshSavedGames(false)
  }, [appState, beginSession, flushPendingSave, refreshSavedGames, releaseAppFocus, resetRunArtifacts])

  const handleReset = useCallback(() => {
    navigateToTopLevelScreen('idle')
  }, [navigateToTopLevelScreen])

  const handleGoToStartScreen = useCallback(() => {
    navigateToTopLevelScreen('welcome')
  }, [navigateToTopLevelScreen])

  const issueUploadCommand = useCallback((request: Omit<UploadCommandRequest, 'id'>) => {
    uploadCommandRequestIdRef.current += 1
    setUploadCommandRequest({
      id: uploadCommandRequestIdRef.current,
      ...request,
    })
  }, [])

  const handleOpenUploadSurface = useCallback(async (action: UploadCommandRequestAction) => {
    if (appState === 'welcome') {
      handleEnterApp()
      issueUploadCommand({ action })
      return
    }

    if (appState !== 'idle') {
      await navigateToTopLevelScreen('idle')
    }

    issueUploadCommand({ action })
  }, [appState, handleEnterApp, issueUploadCommand, navigateToTopLevelScreen])

  const handleRestoreUploadSession = useCallback(async (
    activeWindow: UploadWorkspaceWindow,
    historyFilter: HistoryFilter
  ) => {
    if (appState === 'welcome') {
      handleEnterApp()
      issueUploadCommand({
        action: 'restore-session',
        window: activeWindow,
        historyFilter,
      })
      return
    }

    if (appState !== 'idle') {
      await navigateToTopLevelScreen('idle')
    }

    issueUploadCommand({
      action: 'restore-session',
      window: activeWindow,
      historyFilter,
    })
  }, [appState, handleEnterApp, issueUploadCommand, navigateToTopLevelScreen])

  const handleOpenCropScreen = useCallback(async () => {
    if (!image) {
      return
    }

    if (appState === 'playing') {
      await flushPendingSave(activeSessionRef.current, {})
    }

    releaseAppFocus()
    scrollViewportToTop()
    beginSession()
    audioService.stopTransientEffects()
    resetRunArtifacts()
    setQuitHint(null)
    commitCropDraftSnapshot(writeCropDraftSessionSnapshot({
      image,
      config,
      isRandomImage,
      randomImageSource,
      transform: createDefaultCropTransform(),
      useFullImage: false,
    }), {
      immediate: true,
    })
    setCroppedImage(null)
    setAppState('imageLoaded')
  }, [
    appState,
    beginSession,
    commitCropDraftSnapshot,
    config,
    flushPendingSave,
    image,
    isRandomImage,
    randomImageSource,
    releaseAppFocus,
    resetRunArtifacts,
  ])

  const latestSavedGame = useMemo(() => (
    savedGames.reduce<typeof savedGames[number] | null>((latest, entry) => {
      if (entry.id === ignoredRecoverySaveId) {
        return latest
      }

      if (!latest) {
        return entry
      }

      return Date.parse(entry.updatedAt) > Date.parse(latest.updatedAt) ? entry : latest
    }, null)
  ), [ignoredRecoverySaveId, savedGames])

  const startResumeCandidate = useMemo<StartResumeCandidate | null>(() => {
    if (recoveryResumePrompt) {
      return null
    }

    const snapshot = lastSessionSnapshot
    const resumeSave = snapshot?.saveId
      ? savedGames.find((entry) => entry.id === snapshot.saveId) ?? null
      : null
    const isResumeSaveIgnored = resumeSave?.id === ignoredRecoverySaveId

    if (snapshot?.target === 'save' && resumeSave && !isResumeSaveIgnored) {
      return {
        kind: 'save',
        save: resumeSave,
        label: 'Letzte Sitzung fortsetzen',
        detail: `${resumeSave.name} - ${resumeSave.config.rows}x${resumeSave.config.cols} - ${formatCommandTime(resumeSave.elapsedTime)}`,
      }
    }

    if (snapshot?.target === 'crop' && cropDraftSnapshot) {
      return {
        kind: 'crop',
        label: 'Letzte Sitzung fortsetzen',
        detail: describeCropResume(cropDraftSnapshot),
      }
    }

    if (snapshot?.target === 'upload') {
      return {
        kind: 'upload',
        activeWindow: snapshot.uploadWindow,
        historyFilter: snapshot.historyFilter,
        label: 'Letzte Sitzung fortsetzen',
        detail: describeResumeWindow(snapshot.uploadWindow, snapshot.historyFilter),
      }
    }

    if (snapshot?.target === 'save' && hasMeaningfulUploadResume(snapshot)) {
      return {
        kind: 'upload',
        activeWindow: snapshot.uploadWindow,
        historyFilter: snapshot.historyFilter,
        label: 'Letzte Sitzung fortsetzen',
        detail: describeResumeWindow(snapshot.uploadWindow, snapshot.historyFilter),
      }
    }

    if (snapshot?.target === 'crop' && hasMeaningfulUploadResume(snapshot)) {
      return {
        kind: 'upload',
        activeWindow: snapshot.uploadWindow,
        historyFilter: snapshot.historyFilter,
        label: 'Letzte Sitzung fortsetzen',
        detail: describeResumeWindow(snapshot.uploadWindow, snapshot.historyFilter),
      }
    }

    if (latestSavedGame) {
      return {
        kind: 'save',
        save: latestSavedGame,
        label: 'Letzte Sitzung fortsetzen',
        detail: `${latestSavedGame.name} - ${latestSavedGame.config.rows}x${latestSavedGame.config.cols} - ${formatCommandTime(latestSavedGame.elapsedTime)}`,
      }
    }

    return null
  }, [cropDraftSnapshot, ignoredRecoverySaveId, lastSessionSnapshot, latestSavedGame, recoveryResumePrompt, savedGames])

  const latestGalleryEntry = useMemo(() => (
    gallery?.entries.reduce<SolvedGalleryEntry | null>((latest, entry) => {
      if (!latest) {
        return entry
      }

      return Date.parse(entry.completedAt) > Date.parse(latest.completedAt) ? entry : latest
    }, null) ?? null
  ), [gallery])

  const handleResumeLastSession = useCallback(async () => {
    if (!startResumeCandidate) {
      return
    }

    audioService.activate()

    if (startResumeCandidate.kind === 'save') {
      if (appState === 'playing') {
        await flushPendingSave(activeSessionRef.current, {})
      }

      await handleLoadSavedGame(startResumeCandidate.save.id)
      return
    }

    if (startResumeCandidate.kind === 'crop') {
      await handleRestoreCropSession()
      return
    }

    await handleRestoreUploadSession(startResumeCandidate.activeWindow, startResumeCandidate.historyFilter)
  }, [appState, flushPendingSave, handleLoadSavedGame, handleRestoreCropSession, handleRestoreUploadSession, startResumeCandidate])

  const handleContinueLatestSavedGame = useCallback(async () => {
    if (!latestSavedGame) {
      return
    }

    if (appState === 'playing') {
      await flushPendingSave(activeSessionRef.current, {})
    }

    await handleLoadSavedGame(latestSavedGame.id)
  }, [appState, flushPendingSave, handleLoadSavedGame, latestSavedGame])

  const handleReplayLatestGalleryEntry = useCallback(async () => {
    if (!latestGalleryEntry) {
      return
    }

    if (appState === 'playing') {
      await flushPendingSave(activeSessionRef.current, {})
    }

    handleReplayGalleryEntry(latestGalleryEntry)
  }, [appState, flushPendingSave, handleReplayGalleryEntry, latestGalleryEntry])

  const handleStartRandomImageFromPalette = useCallback(async () => {
    if (appState === 'playing') {
      await flushPendingSave(activeSessionRef.current, {})
    }

    await handleFetchRandomImage()
  }, [appState, flushPendingSave, handleFetchRandomImage])

  const commandPaletteCommands = useMemo<CommandPaletteCommand[]>(() => {
    const commands: CommandPaletteCommand[] = []

    if (appState === 'welcome') {
      commands.push({
        id: 'nav-selection',
        title: 'Zur Auswahl',
        detail: 'Upload, Zufallsbild und Datenbereiche der App oeffnen.',
        section: 'Navigation',
        icon: 'navigation',
        keywords: ['upload', 'auswahl', 'bild laden'],
        onSelect: handleEnterApp,
      })
    } else {
      commands.push({
        id: 'nav-selection',
        title: 'Zur Auswahl',
        detail: 'Upload-Karte und Datenbereiche wieder oben ausrichten.',
        section: 'Navigation',
        icon: 'navigation',
        keywords: ['upload', 'auswahl', 'bild laden'],
        onSelect: () => handleOpenUploadSurface('focus-start'),
      })
    }

    if (appState !== 'welcome') {
      commands.push({
        id: 'nav-start',
        title: 'Zur Startseite',
        detail: 'Zur ruhigen Startseite mit Einstieg und Beenden zurueckkehren.',
        section: 'Navigation',
        icon: 'grid',
        keywords: ['start', 'willkommen', 'home'],
        onSelect: handleGoToStartScreen,
      })
    }

    commands.push(
      {
        id: 'nav-saved-games',
        title: 'Spielstaende oeffnen',
        detail: `${savedGames.length} offene Partien direkt im Workspace-Fenster anzeigen.`,
        section: 'Navigation',
        icon: 'archive',
        keywords: ['save', 'fortsetzen', 'offene partien'],
        onSelect: () => handleOpenUploadSurface('open-saved-games'),
      },
      {
        id: 'nav-stats',
        title: 'Statistik oeffnen',
        detail: `${statsOverview?.totalSolved ?? 0} Siege, Rekorde und Verlauf in den Fokus holen.`,
        section: 'Navigation',
        icon: 'grid',
        keywords: ['rekorde', 'verlauf', 'bestzeiten'],
        onSelect: () => handleOpenUploadSurface('open-stats'),
      },
      {
        id: 'nav-gallery',
        title: 'Galerie oeffnen',
        detail: `${gallery?.entries.length ?? 0} geloeste Eintraege und Motivkarten ansehen.`,
        section: 'Navigation',
        icon: 'image',
        keywords: ['motive', 'bilder', 'geloest'],
        onSelect: () => handleOpenUploadSurface('open-gallery'),
      },
      {
        id: 'nav-collections',
        title: 'Sammlungen oeffnen',
        detail: `${collections?.totalCollections ?? 0} eigene Kollektionen fuer Lieblingsmotive ansehen.`,
        section: 'Navigation',
        icon: 'archive',
        keywords: ['sammlungen', 'kollektionen', 'favoriten'],
        onSelect: () => handleOpenUploadSurface('open-collections'),
      }
    )

    if (image && appState !== 'imageLoaded') {
      commands.push({
        id: 'nav-crop',
        title: 'Zum Bildzuschnitt',
        detail: 'Mit dem aktuellen Motiv wieder in den Crop-Bereich springen.',
        section: 'Navigation',
        icon: 'move',
        keywords: ['crop', 'zuschnitt', 'bildausschnitt'],
        onSelect: handleOpenCropScreen,
      })
    }

    if (latestSavedGame) {
      commands.push({
        id: 'quick-latest-save',
        title: 'Neuester Spielstand fortsetzen',
        detail: `${latestSavedGame.name} - ${latestSavedGame.config.rows}x${latestSavedGame.config.cols} - ${formatCommandTime(latestSavedGame.elapsedTime)}`,
        section: 'Schnellstart',
        icon: 'archive',
        keywords: ['letzter save', 'weiterspielen', 'fortsetzen'],
        onSelect: handleContinueLatestSavedGame,
      })
    }

    if (latestGalleryEntry) {
      commands.push({
        id: 'quick-latest-gallery',
        title: 'Letztes Galerie-Motiv erneut spielen',
        detail: `${latestGalleryEntry.config.rows}x${latestGalleryEntry.config.cols} - ${formatCommandTime(latestGalleryEntry.time)} - zuletzt geloestes Motiv.`,
        section: 'Schnellstart',
        icon: 'image',
        keywords: ['galerie motiv', 'nochmal spielen', 'zuletzt geloest'],
        onSelect: handleReplayLatestGalleryEntry,
      })
    }

    commands.push({
      id: 'quick-random-image',
      title: 'Zufallsbild starten',
      detail: 'Direkt ein neues Motiv laden und in den Zuschnitt springen.',
      section: 'Schnellstart',
      icon: 'zap',
      keywords: ['zufall', 'random', 'neues motiv'],
      onSelect: handleStartRandomImageFromPalette,
    })

    commands.push(
      {
        id: 'data-export-backup',
        title: 'Backup exportieren',
        detail: 'Spielstaende, Statistik, Galerie und Sammlungen als lokales Backup sichern.',
        section: 'Daten',
        icon: 'archive',
        keywords: ['backup', 'export', 'sichern'],
        onSelect: () => handleOpenUploadSurface('export-backup'),
      },
      {
        id: 'data-import-backup',
        title: 'Backup importieren',
        detail: 'Vorhandene lokale Backups anzeigen und gezielt wiederherstellen.',
        section: 'Daten',
        icon: 'refreshCw',
        keywords: ['backup', 'import', 'wiederherstellen'],
        onSelect: () => handleOpenUploadSurface('import-backup'),
      }
    )

    if (appState === 'playing' || appState === 'solved') {
      commands.push(
        {
          id: 'round-restart',
          title: 'Runde neu starten',
          detail: 'Dasselbe Motiv mit aktueller Schwierigkeit sofort neu beginnen.',
          section: 'Aktuelle Runde',
          icon: 'refreshCw',
          keywords: ['neustart', 'restart', 'runde'],
          onSelect: () => {
            if (!croppedImage) {
              return
            }

            beginSession()
            restartPuzzleRun()
            resetRunArtifacts()
            setAppState('playing')
          },
        },
        {
          id: 'round-quit',
          title: 'Runde beenden und zur Auswahl',
          detail: 'Die aktuelle Runde verlassen; der Spielstand bleibt erhalten.',
          section: 'Aktuelle Runde',
          icon: 'navigation',
          keywords: ['abbrechen', 'zurueck', 'auswahl'],
          onSelect: handleReset,
        }
      )
    }

    commands.push(
      {
        id: isHelpOpen ? 'help-close' : 'help-open',
        title: isHelpOpen ? 'Hilfe schliessen' : 'Hilfe oeffnen',
        detail: 'Shortcut-Hilfe und Bedienhinweise ueber der aktuellen Ansicht anzeigen.',
        section: 'Werkzeuge',
        icon: 'helpCircle',
        shortcut: 'F1',
        keywords: ['hilfe', 'shortcuts', 'bedienung'],
        onSelect: isHelpOpen ? closeHelp : openHelp,
      },
      {
        id: 'theme-toggle',
        title: mode === 'light' ? 'Dunkelmodus aktivieren' : 'Hellmodus aktivieren',
        detail: `Aktueller Modus: ${mode === 'light' ? 'Hell' : 'Dunkel'}.`,
        section: 'Musik und Ansicht',
        icon: 'zap',
        keywords: ['theme', 'licht', 'dark', 'light'],
        onSelect: toggleMode,
      },
      {
        id: 'music-toggle',
        title: isMusicMuted ? 'Musik einschalten' : 'Musik ausschalten',
        detail: `Aktueller Stil: ${selectedMusicStyleDefinition.label}.`,
        section: 'Musik und Ansicht',
        icon: 'command',
        keywords: ['musik', 'audio', 'sound'],
        onSelect: () => {
          audioService.setMusicMuted(!isMusicMuted)
        },
      }
    )

    MUSIC_STYLE_DEFINITIONS.forEach((style) => {
      commands.push({
        id: `music-style-${style.id}`,
        title: `Musikstil: ${style.label}`,
        detail:
          style.id === selectedMusicStyle
            ? `${style.description} Aktuell aktiv.`
            : style.description,
        section: 'Musikstile',
        icon: 'command',
        keywords: [style.shortLabel, style.label, 'musikstil', 'playlist'],
        onSelect: () => {
          audioService.setSelectedMusicStyle(style.id)
          audioService.setMusicMuted(false)
        },
      })
    })

    return commands
  }, [
    appState,
    beginSession,
    closeHelp,
    collections?.totalCollections,
    croppedImage,
    gallery,
    handleContinueLatestSavedGame,
    handleEnterApp,
    handleGoToStartScreen,
    handleOpenCropScreen,
    handleOpenUploadSurface,
    handleReplayLatestGalleryEntry,
    handleReset,
    handleStartRandomImageFromPalette,
    image,
    isHelpOpen,
    isMusicMuted,
    latestGalleryEntry,
    latestSavedGame,
    mode,
    openHelp,
    selectedMusicStyle,
    selectedMusicStyleDefinition,
    statsOverview?.totalSolved,
    toggleMode,
    restartPuzzleRun,
    resetRunArtifacts,
    savedGames.length,
  ])

  const registerAppContextMenuHandler = useCallback((handler: AppContextMenuHandler | null) => {
    appContextMenuHandlerRef.current = handler
  }, [])

  const handleAppContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) return
    if (event.target instanceof Element && event.target.closest(APP_CONTEXT_MENU_BLOCKERS)) return

    appContextMenuHandlerRef.current?.({
      clientX: event.clientX,
      clientY: event.clientY,
      target: event.target,
      preventDefault: () => event.preventDefault(),
    })
  }, [])

  const handleReplaySameImage = () => {
    if (!croppedImage) return

    beginSession()
    restartPuzzleRun()
    resetRunArtifacts()
    setAppState('playing')
  }

  const handleNextDifficulty = () => {
    const nextDifficulty = getNextDifficultyOption(config)
    if (!croppedImage || !nextDifficulty) return

    beginSession()
    restartPuzzleRun()
    resetRunArtifacts()
    setConfig({ rows: nextDifficulty.rows, cols: nextDifficulty.cols })
    setAppState('playing')
  }

  const nextDifficultyOption = getNextDifficultyOption(config)
  const activeScreen =
    appState === 'welcome'
      ? {
          key: 'welcome',
          content: (
            <StartScreen
              onStart={handleEnterApp}
              onResumeSession={startResumeCandidate ? handleResumeLastSession : undefined}
              onQuit={handleQuitApp}
              onOpenHelp={openHelp}
              quitHint={quitHint}
              heroImage={startScreenHeroImage}
              registerAppContextMenuHandler={registerAppContextMenuHandler}
              resumeActionLabel={startResumeCandidate?.label ?? null}
              resumeActionDetail={startResumeCandidate?.detail ?? null}
              savedGamesCount={savedGames.length}
              solvedCount={statsOverview?.totalSolved ?? 0}
              galleryCount={gallery?.entries.length ?? 0}
            />
          ),
        }
      : appState === 'idle'
        ? {
          key: 'idle',
          content: (
            <Suspense
              fallback={
                <AppScreenFallback
                  title="Auswahlansicht wird vorbereitet"
                  copy="Spielstaende, Galerie und Statistik werden geladen."
                />
              }
            >
                <UploadScreen
                  onImageLoaded={handleImageLoaded}
                  onGoToStartScreen={handleGoToStartScreen}
                  onOpenHelp={openHelp}
                  onHelpContextChange={setHelpContext}
                  onSessionContextChange={handleUploadSessionContextChange}
                  commandRequest={uploadCommandRequest}
                  registerAppContextMenuHandler={registerAppContextMenuHandler}
                  savedGames={savedGames}
                isLoadingSavedGames={isLoadingSavedGames}
                savedGamesError={savedGamesError}
                stats={statsOverview}
                isLoadingStats={isLoadingStats}
                isResettingStats={isResettingStats}
                statsError={statsError}
                gallery={gallery}
                isLoadingGallery={isLoadingGallery}
                isResettingGallery={isResettingGallery}
                galleryError={galleryError}
                collections={collections}
                isLoadingCollections={isLoadingCollections}
                collectionsError={collectionsError}
                isFetchingRandom={isFetchingRandom}
                randomImageError={randomImageError}
                onFetchRandomImage={handleFetchRandomImage}
                onLoadSavedGame={handleLoadSavedGame}
                onDeleteSavedGame={handleDeleteSavedGame}
                onDeleteAllSavedGames={handleDeleteAllSavedGames}
                onResetStats={handleResetStats}
                onResetGallery={handleResetGallery}
                onReplayGalleryEntry={handleReplayGalleryEntry}
                onDeleteGalleryEntries={handleDeleteGalleryEntries}
                onCreateImageCollection={handleCreateImageCollection}
                onUpdateImageCollection={handleUpdateImageCollection}
                onDeleteImageCollection={handleDeleteImageCollection}
                onAddImageCollectionImages={handleAddImageCollectionImages}
                onRemoveImageCollectionImages={handleRemoveImageCollectionImages}
                onCreateBackupFile={handleCreateBackupFile}
                onDeleteBackupFile={handleDeleteBackupFile}
                onImportBackupFile={handleImportBackupFile}
              />
            </Suspense>
          ),
        }
        : appState === 'imageLoaded' && image
          ? {
              key: 'imageLoaded',
              content: (
                <Suspense
                  fallback={
                    <AppScreenFallback
                      title="Bildzuschnitt wird vorbereitet"
                      copy="Werkzeuge und Vorschau werden fuer dein Motiv geladen."
                    />
                  }
                >
                  <CropScreen
                    image={image}
                    config={config}
                    onOpenHelp={openHelp}
                    registerAppContextMenuHandler={registerAppContextMenuHandler}
                    isRandomImage={isRandomImage}
                    isFetchingRandom={isFetchingRandom}
                    randomImageError={randomImageError}
                    randomImageSource={randomImageSource}
                    onFetchNewRandomImage={handleFetchRandomImage}
                    initialTransform={cropDraftSnapshotRef.current?.transform ?? cropDraftSnapshot?.transform ?? null}
                    initialUseFullImage={cropDraftSnapshotRef.current?.useFullImage ?? cropDraftSnapshot?.useFullImage ?? false}
                    onSessionDraftChange={handleCropSessionDraftChange}
                    onConfigChange={handleConfigChange}
                    onCropConfirmed={handleCropConfirmed}
                    onBack={handleReset}
                    onGoToStartScreen={handleGoToStartScreen}
                  />
                </Suspense>
              ),
            }
          : (appState === 'playing' || appState === 'solved') && croppedImage
            ? {
                key: 'puzzle',
                content: (
                  <Suspense
                    fallback={
                      <AppScreenFallback
                        title="Puzzle wird vorbereitet"
                        copy="Board, Hinweise und Steuerung werden geladen."
                      />
                    }
                  >
                    <PuzzleScreen
                      key={puzzleRunKey}
                      image={croppedImage}
                      config={config}
                      isHelpOpen={isHelpOpen}
                      onOpenHelp={openHelp}
                      onHelpContextChange={setHelpContext}
                      registerAppContextMenuHandler={registerAppContextMenuHandler}
                      initialProgress={savedProgress}
                      onProgressChange={handleProgressChange}
                      onWin={handleWin}
                      onQuit={handleReset}
                      onGoToStartScreen={handleGoToStartScreen}
                      onRestart={handleReplaySameImage}
                    />
                  </Suspense>
                ),
              }
            : null

  return (
    <div className="app" ref={appRef} onContextMenu={handleAppContextMenu}>
      <ThemeSwitcher
        layout={appState === 'welcome' ? 'welcome' : 'floating'}
        onGoToStartScreen={appState === 'welcome' ? undefined : handleGoToStartScreen}
        onOpenCommandPalette={openCommandPalette}
        onOpenHelp={openHelp}
        saveStatus={visibleSaveStatus}
      />
      <AnimatePresence initial={false} mode="wait">
        {activeScreen && <AnimatedScreen key={activeScreen.key}>{activeScreen.content}</AnimatedScreen>}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {appState === 'solved' && winStats && (
          <WinDialog
            stats={winStats}
            config={config}
            nextDifficultyLabel={
              nextDifficultyOption
                ? `${nextDifficultyOption.label} ${nextDifficultyOption.rows}x${nextDifficultyOption.cols}`
                : null
            }
            completionResult={completionResult}
            completionStatsError={completionStatsError}
            isRecordingStats={isRecordingCompletion}
            onRetryStats={handleRetryStats}
            onReplaySameImage={handleReplaySameImage}
            onGoToSelectionScreen={handleReset}
            onChooseNewImage={handleGoToStartScreen}
            onNextDifficulty={handleNextDifficulty}
          />
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {recoveryResumePrompt && (
              <RecoveryResumeDialog
                save={recoveryResumePrompt.save}
                interruptedAt={recoveryResumePrompt.interruptedAt}
                onDismiss={handleDismissRecoveryResumePrompt}
                onDecline={handleDeclineRecoveryResumePrompt}
                onResume={handleResumeRecoveredSave}
              />
        )}
      </AnimatePresence>

      <AnimatePresence initial={false} mode="wait">
        {activeGlobalOverlay === 'help' ? (
          <GlobalHelpOverlay
            key="global-help"
            helpContext={helpContext}
            onClose={closeHelp}
          />
        ) : activeGlobalOverlay === 'commandPalette' ? (
          <CommandPalette
            key="command-palette"
            commands={commandPaletteCommands}
            contextLabel={getHelpView(helpContext).kicker}
            onClose={closeCommandPalette}
          />
        ) : null}
      </AnimatePresence>

      <StatusToast toast={statusToast} onDismiss={handleDismissStatusToast} />

      <AccessibilityAnnouncerHost />
    </div>
  )
}















