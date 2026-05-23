import { type ChangeEvent, type DragEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { type HelpContext } from '../app/helpRegistry.ts'
import { getUploadHelpContextForTarget, isUploadHelpTarget } from '../app/helpContextTargets.ts'
import { type AppContextMenuHandler, type AppContextMenuRequest } from '../app/appContextMenu.ts'
import UploadScreenIcon from '../components/UploadScreenIcon.tsx'
import CompactContextMenu, { type ContextMenuItem, type ContextMenuPosition } from '../components/CompactContextMenu.tsx'
import AnimatedReveal from '../motion/AnimatedReveal.tsx'
import AnimatedStaggerGroup from '../motion/AnimatedStaggerGroup.tsx'
import {
  PuzzleDataBackupFile,
  PuzzleDataImportResult,
  PuzzleStats,
  SavedGameSummary,
  SolvedGallery,
  SolvedGalleryEntry,
  ImageCollection,
  ImageCollections,
  ImageThemePalette,
} from '../types/index'
import { getErrorMessage, scrollViewportToTop } from '../app/appUtils.ts'
import { listPuzzleDataBackupFiles } from '../services/BackupService.ts'
import { hasClipboardImage, readClipboardImageDataUrl, readClipboardText } from '../services/ClipboardService.ts'
import { generatePromptImage } from '../services/PromptImageService.ts'
import type { RandomImageSourceInfo } from '../services/RandomImageService.ts'
import UploadBackupBrowserDialog from './upload/UploadBackupBrowserDialog.tsx'
import UploadConfirmDialog from './upload/UploadConfirmDialog.tsx'
import { type UploadCommandRequest } from './upload/uploadCommandRequest.ts'
import { countUniqueGalleryEntries } from './upload/UploadGalleryDisplayUtils.ts'
import UploadDashboard from './upload/UploadDashboard.tsx'
import UploadDataTransferPanel from './upload/UploadDataTransferPanel.tsx'
import UploadMenuCards from './upload/UploadMenuCards.tsx'
import UploadWorkspaceLauncher from './upload/UploadWorkspaceLauncher.tsx'
import {
  DashboardMetric,
  HistoryFilter,
  UploadWorkspaceWindow,
  findFastestDifficulty,
  findFavoriteDifficulty,
  formatDate,
  formatOptionalTime,
  getDifficultyHistoryFilterOptions,
  getLatestActivityTimestamp,
  optimizeImageForPuzzle,
  validateImageFile,
} from './upload/uploadUtils.ts'
import { shouldPreserveNativeContextMenu } from '../utils/contextWindow.ts'
import ErrorToast from '../components/ErrorToast.tsx'
import { useUploadImagePalette } from './upload/uploadImagePalette.ts'
import '../styles/screens/upload.css'

interface UploadScreenProps {
  onImageLoaded: (imgSrc: string, isRandom?: boolean, source?: RandomImageSourceInfo | null) => void
  onGoToStartScreen: () => void
  onOpenHelp: () => void
  onHelpContextChange: (context: HelpContext) => void
  onSessionContextChange?: (context: {
    activeWindow: UploadWorkspaceWindow
    historyFilter: HistoryFilter
  }) => void
  commandRequest?: UploadCommandRequest | null
  registerAppContextMenuHandler: (handler: AppContextMenuHandler | null) => void
  savedGames: SavedGameSummary[]
  isLoadingSavedGames: boolean
  savedGamesError: string | null
  stats: PuzzleStats | null
  isLoadingStats: boolean
  isResettingStats: boolean
  statsError: string | null
  gallery: SolvedGallery | null
  isLoadingGallery: boolean
  isResettingGallery: boolean
  galleryError: string | null
  collections?: ImageCollections | null
  isLoadingCollections?: boolean
  collectionsError?: string | null
  isFetchingRandom: boolean
  randomImageError: string | null
  onFetchRandomImage: (query?: string) => Promise<void> | void
  onLoadSavedGame: (saveId: string) => Promise<void>
  onDeleteSavedGame: (saveId: string) => Promise<void>
  onDeleteAllSavedGames: () => Promise<void>
  onResetStats: () => Promise<void>
  onResetGallery: () => Promise<void>
  onReplayGalleryEntry: (entry: SolvedGalleryEntry) => void
  onDeleteGalleryEntries: (entryIds: string[]) => Promise<void>
  onUpdateGalleryTags?: (action: 'rename' | 'remove', sourceLabel: string, targetLabel?: string) => Promise<void>
  onRetryGalleryTagging?: (entryId: string) => Promise<void>
  onCreateImageCollection?: (name: string, imageIds: string[], description?: string) => Promise<ImageCollections>
  onUpdateImageCollection?: (
    collectionId: string,
    updates: Pick<ImageCollection, 'name'> & Partial<Pick<ImageCollection, 'description'>>
  ) => Promise<ImageCollections>
  onDeleteImageCollection?: (collectionId: string) => Promise<ImageCollections>
  onAddImageCollectionImages?: (collectionId: string, imageIds: string[]) => Promise<ImageCollections>
  onRemoveImageCollectionImages?: (collectionId: string, imageIds: string[]) => Promise<ImageCollections>
  onCreateBackupFile: () => Promise<PuzzleDataBackupFile>
  onDeleteBackupFile: (fileName: string) => Promise<void>
  onImportBackupFile: (fileName: string) => Promise<PuzzleDataImportResult>
}

type WorkspaceNavFocusTarget = Exclude<UploadWorkspaceWindow, 'start'>
type StartFocusTarget = 'primaryUploadCard' | WorkspaceNavFocusTarget

function hasDraggedFiles(dataTransfer: DataTransfer | null | undefined): boolean {
  if (!dataTransfer) return false
  if (dataTransfer.files.length > 0) return true
  return Array.from(dataTransfer.types).includes('Files')
}

type UploadContextMenuScope = 'screen' | 'uploadCard' | 'promptField'
type UploadClipboardPasteStatus = 'idle' | 'checking' | 'ready' | 'unavailable'

interface UploadContextMenuState extends ContextMenuPosition {
  scope: UploadContextMenuScope
}

function getClipboardImageExtension(mimeType: string): string {
  const [, rawSubtype = 'img'] = mimeType.split('/')

  switch (rawSubtype) {
    case 'jpeg':
      return 'jpg'
    case 'svg+xml':
      return 'svg'
    default:
      return rawSubtype.split('+')[0] || 'img'
  }
}

function getSingleImageFileFromClipboardData(items: DataTransferItemList | null | undefined): File | null {
  if (!items) return null

  const imageItems = Array.from(items).filter((item) => item.type.startsWith('image/'))
  if (imageItems.length !== 1) return null

  return imageItems[0].getAsFile()
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(
    'input:not([type="hidden"]), textarea, select, option, [contenteditable="true"], [contenteditable="plaintext-only"]'
  ) !== null
}

function isPromptFieldContextTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[data-upload-context="prompt-field"]') !== null
}

async function createFileFromImageDataUrl(imageDataUrl: string): Promise<File> {
  const response = await fetch(imageDataUrl)
  const blob = await response.blob()
  const mimeType = blob.type || 'image/png'
  const extension = getClipboardImageExtension(mimeType)

  return new File([blob], `zwischenablage-bild.${extension}`, {
    type: mimeType,
    lastModified: Date.now(),
  })
}

export default function UploadScreen({
  onImageLoaded,
  onGoToStartScreen,
  onOpenHelp,
  onHelpContextChange,
  onSessionContextChange,
  commandRequest = null,
  registerAppContextMenuHandler,
  savedGames,
  isLoadingSavedGames,
  savedGamesError,
  stats,
  isLoadingStats,
  isResettingStats,
  statsError,
  gallery,
  isLoadingGallery,
  isResettingGallery,
  galleryError,
  collections = null,
  isLoadingCollections = false,
  collectionsError = null,
  isFetchingRandom,
  randomImageError,
  onFetchRandomImage,
  onLoadSavedGame,
  onDeleteSavedGame,
  onDeleteAllSavedGames,
  onResetStats,
  onResetGallery,
  onReplayGalleryEntry,
  onDeleteGalleryEntries,
  onUpdateGalleryTags,
  onRetryGalleryTagging,
  onCreateImageCollection,
  onUpdateImageCollection,
  onDeleteImageCollection,
  onAddImageCollectionImages,
  onRemoveImageCollectionImages,
  onCreateBackupFile,
  onDeleteBackupFile,
  onImportBackupFile,
}: UploadScreenProps) {
  const screenRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const promptInputRef = useRef<HTMLTextAreaElement>(null)
  const primaryUploadCardRef = useRef<HTMLButtonElement>(null)
  const savedGamesLauncherRef = useRef<HTMLButtonElement>(null)
  const statsLauncherRef = useRef<HTMLButtonElement>(null)
  const galleryLauncherRef = useRef<HTMLButtonElement>(null)
  const collectionsLauncherRef = useRef<HTMLButtonElement>(null)
  const hasFocusedStartWindowRef = useRef(false)
  const deleteConfirmButtonRef = useRef<HTMLButtonElement>(null)
  const deleteAllConfirmButtonRef = useRef<HTMLButtonElement>(null)
  const resetStatsConfirmButtonRef = useRef<HTMLButtonElement>(null)
  const resetGalleryConfirmButtonRef = useRef<HTMLButtonElement>(null)
  const importBackupConfirmButtonRef = useRef<HTMLButtonElement>(null)
  const backupImportActionRef = useRef<HTMLButtonElement>(null)
  const restoreBackupImportFocusRef = useRef(false)
  const pendingWorkspaceNavFocusRef = useRef<WorkspaceNavFocusTarget | null>(null)
  const pendingStartFocusRef = useRef<StartFocusTarget | null>(null)
  const handledCommandRequestIdRef = useRef<number | null>(null)
  const dragDepthRef = useRef(0)
  const [error, setError] = useState<string | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)
  const [activeWindow, setActiveWindow] = useState<UploadWorkspaceWindow>('start')
  const [isWorkspaceExiting, setIsWorkspaceExiting] = useState(false)
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all')
  const [loadingSaveId, setLoadingSaveId] = useState<string | null>(null)
  const [deletingSaveId, setDeletingSaveId] = useState<string | null>(null)
  const [isDeletingAllSavedGames, setIsDeletingAllSavedGames] = useState(false)
  const [pendingDeleteSave, setPendingDeleteSave] = useState<SavedGameSummary | null>(null)
  const [isConfirmingDeleteAllSavedGames, setIsConfirmingDeleteAllSavedGames] = useState(false)
  const [isConfirmingStatsReset, setIsConfirmingStatsReset] = useState(false)
  const [isConfirmingGalleryReset, setIsConfirmingGalleryReset] = useState(false)
  const [isExportingBackup, setIsExportingBackup] = useState(false)
  const [isLoadingBackupFiles, setIsLoadingBackupFiles] = useState(false)
  const [isImportingBackup, setIsImportingBackup] = useState(false)
  const [deletingBackupFileName, setDeletingBackupFileName] = useState<string | null>(null)
  const [isShowingBackupBrowser, setIsShowingBackupBrowser] = useState(false)
  const [availableBackupFiles, setAvailableBackupFiles] = useState<PuzzleDataBackupFile[]>([])
  const [backupStatusMessage, setBackupStatusMessage] = useState<string | null>(null)
  const [pendingBackupImport, setPendingBackupImport] = useState<PuzzleDataBackupFile | null>(null)
  const [contextMenuState, setContextMenuState] = useState<UploadContextMenuState | null>(null)
  const [uploadClipboardPasteStatus, setUploadClipboardPasteStatus] = useState<UploadClipboardPasteStatus>('idle')
  const [promptImagePrompt, setPromptImagePrompt] = useState('')
  const [isGeneratingPromptImage, setIsGeneratingPromptImage] = useState(false)

  const alignSelectionViewportToTop = useCallback(() => {
    screenRef.current?.scrollIntoView({ block: 'start', inline: 'nearest' })
    scrollViewportToTop()
  }, [])

  const scheduleSelectionViewportAlignment = useCallback(() => {
    let nestedFrameId: number | null = null
    let timeoutId: number | null = null

    alignSelectionViewportToTop()

    const frameId = window.requestAnimationFrame(() => {
      alignSelectionViewportToTop()
      nestedFrameId = window.requestAnimationFrame(() => {
        alignSelectionViewportToTop()
      })
      timeoutId = window.setTimeout(() => {
        alignSelectionViewportToTop()
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
  }, [alignSelectionViewportToTop])

  useEffect(() => {
    const updateHelpContext = (target: EventTarget | null) => {
      onHelpContextChange(getUploadHelpContextForTarget(activeWindow, target))
    }

    updateHelpContext(document.activeElement)

    const handleFocusIn = (event: FocusEvent) => {
      if (!isUploadHelpTarget(event.target, screenRef.current)) {
        return
      }

      updateHelpContext(event.target)
    }

    window.addEventListener('focusin', handleFocusIn, true)
    return () => {
      window.removeEventListener('focusin', handleFocusIn, true)
    }
  }, [activeWindow, onHelpContextChange])

  useEffect(() => {
    onSessionContextChange?.({
      activeWindow,
      historyFilter,
    })
  }, [activeWindow, historyFilter, onSessionContextChange])

  useEffect(() => {
    const focusTarget = pendingWorkspaceNavFocusRef.current
    if (!focusTarget || activeWindow !== focusTarget || isWorkspaceExiting) {
      return
    }

    const isStillPending =
      focusTarget === 'savedGames'
        ? isDeletingAllSavedGames || isConfirmingDeleteAllSavedGames
        : focusTarget === 'stats'
          ? isResettingStats || isConfirmingStatsReset
          : isResettingGallery || isConfirmingGalleryReset
    if (isStillPending) {
      return
    }

    let frameId = 0
    let attempts = 0
    let isCancelled = false

    const focusWorkspaceNavigationButton = () => {
      if (isCancelled) {
        return
      }

      const targetButton = document.querySelector<HTMLButtonElement>(
        `.workspace-window-nav-button[data-workspace-window-nav="${focusTarget}"]`
      )
      if (targetButton?.isConnected && !targetButton.disabled) {
        pendingWorkspaceNavFocusRef.current = null
        targetButton.focus({ preventScroll: true })
        return
      }

      if (attempts >= 24) {
        pendingWorkspaceNavFocusRef.current = null
        return
      }

      attempts += 1
      frameId = window.requestAnimationFrame(focusWorkspaceNavigationButton)
    }

    frameId = window.requestAnimationFrame(focusWorkspaceNavigationButton)

    return () => {
      isCancelled = true
      window.cancelAnimationFrame(frameId)
    }
  }, [
    activeWindow,
    isConfirmingDeleteAllSavedGames,
    isConfirmingGalleryReset,
    isConfirmingStatsReset,
    isDeletingAllSavedGames,
    isResettingGallery,
    isResettingStats,
    isWorkspaceExiting,
  ])

  const getStartFocusTarget = useCallback((): HTMLButtonElement | null => {
    const requestedTarget = pendingStartFocusRef.current
    switch (requestedTarget) {
      case 'savedGames':
        return savedGamesLauncherRef.current?.isConnected ? savedGamesLauncherRef.current : null
      case 'stats':
        return statsLauncherRef.current?.isConnected ? statsLauncherRef.current : null
      case 'gallery':
        return galleryLauncherRef.current?.isConnected ? galleryLauncherRef.current : null
      case 'collections':
        return collectionsLauncherRef.current?.isConnected ? collectionsLauncherRef.current : null
      case 'primaryUploadCard':
      case null:
      default:
        return primaryUploadCardRef.current?.isConnected ? primaryUploadCardRef.current : null
    }
  }, [])

  const setTimedError = useCallback((message: string) => {
    setError(message)
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const loadImageFile = useCallback(
    async (file: File) => {
      const validationError = validateImageFile(file)
      if (validationError) {
        setTimedError(validationError)
        return
      }

      clearError()

      try {
        const optimizedImage = await optimizeImageForPuzzle(file)
        onImageLoaded(optimizedImage)
      } catch {
        setTimedError('Fehler beim Laden des Bildes')
      }
    },
    [clearError, onImageLoaded, setTimedError]
  )

  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      if (isTextEntryTarget(event.target)) {
        return
      }

      const file = getSingleImageFileFromClipboardData(event.clipboardData?.items)
      if (!file) {
        const hasAnyItems = event.clipboardData?.items && event.clipboardData.items.length > 0
        if (hasAnyItems) {
          setTimedError('In der Zwischenablage befindet sich kein Bild. Kopiere zuerst ein Bild und versuche es erneut.')
        }
        return
      }

      event.preventDefault()
      clearError()
      void loadImageFile(file)
    },
    [clearError, loadImageFile, setTimedError]
  )

  useEffect(() => {
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [handlePaste])

  useLayoutEffect(() => {
    return scheduleSelectionViewportAlignment()
  }, [scheduleSelectionViewportAlignment])

  const isBlockingDialogOpen =
    isShowingBackupBrowser
    || pendingBackupImport !== null
    || pendingDeleteSave !== null
    || isConfirmingDeleteAllSavedGames
    || isConfirmingStatsReset
    || isConfirmingGalleryReset
  const isWorkspaceOpen = activeWindow !== 'start' || isWorkspaceExiting

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented
        || event.key !== 'Escape'
        || event.altKey
        || event.ctrlKey
        || event.metaKey
        || activeWindow !== 'start'
        || isBlockingDialogOpen
      ) {
        return
      }

      const activeElement = document.activeElement
      if (
        !(activeElement instanceof HTMLElement)
        || !screenRef.current?.contains(activeElement)
      ) {
        return
      }

      event.preventDefault()
      onGoToStartScreen()
    }

    window.addEventListener('keydown', handleWindowKeyDown)
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown)
    }
  }, [activeWindow, isBlockingDialogOpen, onGoToStartScreen])

  useEffect(() => {
    if (activeWindow !== 'start') {
      hasFocusedStartWindowRef.current = false
      return
    }

    if (isBlockingDialogOpen || hasFocusedStartWindowRef.current) {
      return
    }

    let isCancelled = false
    let frameId = 0
    let attempts = 0

    const focusPrimaryCard = () => {
      if (isCancelled) {
        return
      }

      const target = getStartFocusTarget() ?? primaryUploadCardRef.current
      if (target?.isConnected) {
        target.focus({ preventScroll: true })
        pendingStartFocusRef.current = null
        hasFocusedStartWindowRef.current = true
        return
      }

      if (attempts >= 30) {
        return
      }

      attempts += 1
      frameId = window.requestAnimationFrame(focusPrimaryCard)
    }

    frameId = window.requestAnimationFrame(focusPrimaryCard)

    return () => {
      isCancelled = true
      window.cancelAnimationFrame(frameId)
    }
  }, [activeWindow, getStartFocusTarget, isBlockingDialogOpen])

  const resetDragState = useCallback(() => {
    dragDepthRef.current = 0
    setIsDragActive(false)
  }, [])

  const resetUploadClipboardState = useCallback(() => {
    setUploadClipboardPasteStatus('idle')
  }, [])

  const closeContextMenu = useCallback(() => {
    setContextMenuState(null)
    resetUploadClipboardState()
  }, [resetUploadClipboardState])

  const refreshUploadClipboardState = useCallback(async () => {
    setUploadClipboardPasteStatus('checking')

    try {
      setUploadClipboardPasteStatus((await hasClipboardImage()) ? 'ready' : 'unavailable')
    } catch {
      setUploadClipboardPasteStatus('unavailable')
    }
  }, [])

  useEffect(() => {
    if (!isBlockingDialogOpen) return
    closeContextMenu()
  }, [closeContextMenu, isBlockingDialogOpen])

  useEffect(() => {
    if (!isBlockingDialogOpen) return
    resetDragState()
  }, [isBlockingDialogOpen, resetDragState])

  const handleDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (isBlockingDialogOpen || !hasDraggedFiles(event.dataTransfer)) return

    event.preventDefault()
    dragDepthRef.current += 1
    setIsDragActive(true)
  }, [isBlockingDialogOpen])

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event.dataTransfer)) return

    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) {
      setIsDragActive(false)
    }
  }, [])

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (isBlockingDialogOpen || !hasDraggedFiles(event.dataTransfer)) return

    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setIsDragActive(true)
  }, [isBlockingDialogOpen])

  const handleDrop = useCallback(async (event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event.dataTransfer)) return

    event.preventDefault()
    resetDragState()
    if (isBlockingDialogOpen) return

    clearError()

    const files = event.dataTransfer.files
    if (!files || files.length === 0) return

    if (files.length > 1) {
      setTimedError('Nur die erste Datei wird verwendet. Bitte lege ein einzelnes Bild ab.')
    }

    await loadImageFile(files[0])
  }, [clearError, isBlockingDialogOpen, loadImageFile, resetDragState, setTimedError])

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    clearError()
    void loadImageFile(file)
    event.target.value = ''
  }

  const handlePasteImageFromClipboard = useCallback(async () => {
    try {
      const imageDataUrl = await readClipboardImageDataUrl()
      const clipboardImageFile = await createFileFromImageDataUrl(imageDataUrl)

      setUploadClipboardPasteStatus('ready')
      await loadImageFile(clipboardImageFile)
    } catch (clipboardError) {
      setUploadClipboardPasteStatus('unavailable')
      setTimedError(`Bild konnte nicht aus der Zwischenablage eingefuegt werden: ${getErrorMessage(clipboardError)}`)
    }
  }, [loadImageFile, setTimedError])

  const handlePastePromptFromClipboard = useCallback(async () => {
    try {
      const clipboardText = await readClipboardText()
      if (!clipboardText) {
        setTimedError('In der Zwischenablage befindet sich kein Text.')
        return
      }

      clearError()
      const promptInput = promptInputRef.current
      const selectionStart = promptInput?.selectionStart ?? promptImagePrompt.length
      const selectionEnd = promptInput?.selectionEnd ?? promptImagePrompt.length
      const nextPrompt = `${promptImagePrompt.slice(0, selectionStart)}${clipboardText}${promptImagePrompt.slice(selectionEnd)}`
      const nextCursorPosition = selectionStart + clipboardText.length

      setPromptImagePrompt(nextPrompt)

      window.requestAnimationFrame(() => {
        promptInput?.focus({ preventScroll: true })
        promptInput?.setSelectionRange(nextCursorPosition, nextCursorPosition)
      })
    } catch (clipboardError) {
      setTimedError(`Prompt konnte nicht eingefuegt werden: ${getErrorMessage(clipboardError)}`)
    }
  }, [clearError, promptImagePrompt, setTimedError])

  const handleGeneratePromptImage = useCallback(async () => {
    const prompt = promptImagePrompt.trim()
    if (!prompt) {
      setTimedError('Bitte gib zuerst einen Prompt fuer das KI-Bild ein.')
      return
    }

    clearError()
    setIsGeneratingPromptImage(true)

    try {
      const generatedImage = await generatePromptImage(prompt)
      onImageLoaded(generatedImage.imageSrc, true, generatedImage.source)
    } catch (promptImageError) {
      setTimedError(`KI-Bild konnte nicht erstellt werden: ${getErrorMessage(promptImageError)}`)
    } finally {
      setIsGeneratingPromptImage(false)
    }
  }, [clearError, onImageLoaded, promptImagePrompt, setTimedError])

  const handleOpenSavedGamesWindow = () => {
    handleWindowChange('savedGames')
  }

  const handleOpenStatsWindow = () => {
    handleWindowChange('stats')
  }

  const handleOpenGalleryWindow = () => {
    handleWindowChange('gallery')
  }

  const handleOpenCollectionsWindow = () => {
    handleWindowChange('collections')
  }

  const handleWindowChange = useCallback((window: UploadWorkspaceWindow) => {
    if (window === 'start') {
      scheduleSelectionViewportAlignment()
      hasFocusedStartWindowRef.current = false
      if (activeWindow !== 'start') {
        pendingStartFocusRef.current = activeWindow
        setIsWorkspaceExiting(true)
      }
      return
    }

    pendingStartFocusRef.current = null
    setIsWorkspaceExiting(false)
    setActiveWindow(window)
  }, [activeWindow, scheduleSelectionViewportAlignment])

  const handleWorkspaceExitComplete = useCallback(() => {
    if (!isWorkspaceExiting) {
      return
    }

    setActiveWindow('start')
    setIsWorkspaceExiting(false)
    window.requestAnimationFrame(() => {
      scheduleSelectionViewportAlignment()
      primaryUploadCardRef.current?.focus({ preventScroll: true })
    })
  }, [isWorkspaceExiting, scheduleSelectionViewportAlignment])

  const handleLoadSave = useCallback(async (saveId: string) => {
    setLoadingSaveId(saveId)
    try {
      await onLoadSavedGame(saveId)
    } finally {
      setLoadingSaveId(null)
    }
  }, [onLoadSavedGame])

  const handleDeleteRequest = useCallback((save: SavedGameSummary) => {
    pendingWorkspaceNavFocusRef.current = null
    setIsConfirmingDeleteAllSavedGames(false)
    setIsConfirmingStatsReset(false)
    setIsConfirmingGalleryReset(false)
    setPendingDeleteSave(save)
  }, [])

  const handleCancelDelete = () => {
    if (deletingSaveId) return
    setPendingDeleteSave(null)
  }

  const handleRequestDeleteAllSavedGames = useCallback(() => {
    pendingWorkspaceNavFocusRef.current = null
    setPendingDeleteSave(null)
    setIsConfirmingStatsReset(false)
    setIsConfirmingGalleryReset(false)
    setIsConfirmingDeleteAllSavedGames(true)
  }, [])

  const handleCancelDeleteAllSavedGames = () => {
    if (isDeletingAllSavedGames) return
    pendingWorkspaceNavFocusRef.current = null
    setIsConfirmingDeleteAllSavedGames(false)
  }

  const handleConfirmDelete = async () => {
    if (!pendingDeleteSave) return

    const saveId = pendingDeleteSave.id
    setDeletingSaveId(saveId)
    try {
      await onDeleteSavedGame(saveId)
      setPendingDeleteSave(null)
    } finally {
      setDeletingSaveId(null)
    }
  }

  const handleConfirmDeleteAllSavedGames = async () => {
    pendingWorkspaceNavFocusRef.current = 'savedGames'
    setIsDeletingAllSavedGames(true)
    try {
      await onDeleteAllSavedGames()
      setIsConfirmingDeleteAllSavedGames(false)
    } catch {
      pendingWorkspaceNavFocusRef.current = null
      // App state already exposes the error.
    } finally {
      setIsDeletingAllSavedGames(false)
    }
  }

  const handleRequestStatsReset = () => {
    pendingWorkspaceNavFocusRef.current = null
    setPendingDeleteSave(null)
    setIsConfirmingDeleteAllSavedGames(false)
    setIsConfirmingGalleryReset(false)
    setIsConfirmingStatsReset(true)
  }

  const handleCancelStatsReset = () => {
    if (isResettingStats) return
    pendingWorkspaceNavFocusRef.current = null
    setIsConfirmingStatsReset(false)
  }

  const handleConfirmStatsReset = async () => {
    pendingWorkspaceNavFocusRef.current = 'stats'
    try {
      await onResetStats()
      setIsConfirmingStatsReset(false)
      setHistoryFilter('all')
    } catch {
      pendingWorkspaceNavFocusRef.current = null
      // App state already exposes the error.
    }
  }

  const handleRequestGalleryReset = () => {
    pendingWorkspaceNavFocusRef.current = null
    setPendingDeleteSave(null)
    setIsConfirmingDeleteAllSavedGames(false)
    setIsConfirmingStatsReset(false)
    setIsConfirmingGalleryReset(true)
  }

  const handleCancelGalleryReset = () => {
    if (isResettingGallery) return
    pendingWorkspaceNavFocusRef.current = null
    setIsConfirmingGalleryReset(false)
  }

  const handleConfirmGalleryReset = async () => {
    pendingWorkspaceNavFocusRef.current = 'gallery'
    try {
      await onResetGallery()
      setIsConfirmingGalleryReset(false)
    } catch {
      pendingWorkspaceNavFocusRef.current = null
      // App state already exposes the error.
    }
  }

  const handleExportBackupRequest = useCallback(async () => {
    setBackupStatusMessage(null)
    setError(null)
    setIsExportingBackup(true)

    try {
      const backup = await onCreateBackupFile()
      const deletedBackupsLabel = backup.deletedBackupFileNames.join(', ')
      setBackupStatusMessage(
        backup.alreadyCurrent
          ? `Kein neues Backup angelegt: ${backup.fileName} ist bereits aktuell und enthaelt ${backup.savedGamesCount} Spielstaende, ${backup.totalSolved} Siege und ${backup.galleryEntriesCount} Galerie-Bilder.`
          : backup.deletedBackupFileNames.length === 0
            ? `Backup gespeichert: ${backup.fileName} mit ${backup.savedGamesCount} Spielstaenden, ${backup.totalSolved} Siegen und ${backup.galleryEntriesCount} Galerie-Bildern. Es werden maximal ${backup.retentionLimit} lokale Backups behalten.`
            : backup.deletedBackupFileNames.length === 1
              ? `Backup gespeichert: ${backup.fileName} mit ${backup.savedGamesCount} Spielstaenden, ${backup.totalSolved} Siegen und ${backup.galleryEntriesCount} Galerie-Bildern. Das aelteste Backup ${deletedBackupsLabel} wurde automatisch entfernt. Es bleiben ${backup.retentionLimit} lokale Backups.`
              : `Backup gespeichert: ${backup.fileName} mit ${backup.savedGamesCount} Spielstaenden, ${backup.totalSolved} Siegen und ${backup.galleryEntriesCount} Galerie-Bildern. ${backup.deletedBackupFileNames.length} alte Backups wurden automatisch entfernt (${deletedBackupsLabel}). Es bleiben ${backup.retentionLimit} lokale Backups.`
      )
    } catch (backupError) {
      setError(`Backup konnte nicht exportiert werden: ${getErrorMessage(backupError)}`)
    } finally {
      setIsExportingBackup(false)
    }
  }, [onCreateBackupFile])

  const handleOpenBackupBrowser = useCallback(async () => {
    setBackupStatusMessage(null)
    setError(null)
    setIsLoadingBackupFiles(true)

    try {
      const backupFiles = await listPuzzleDataBackupFiles()
      setAvailableBackupFiles(backupFiles)
      setIsShowingBackupBrowser(true)
    } catch (backupError) {
      setError(`Backups konnten nicht geladen werden: ${getErrorMessage(backupError)}`)
    } finally {
      setIsLoadingBackupFiles(false)
    }
  }, [])

  const handleCloseBackupBrowser = () => {
    if (isLoadingBackupFiles || deletingBackupFileName !== null) return
    restoreBackupImportFocusRef.current = true
    setIsShowingBackupBrowser(false)
  }

  useEffect(() => {
    if (!commandRequest) {
      return
    }

    if (handledCommandRequestIdRef.current === commandRequest.id) {
      return
    }

    handledCommandRequestIdRef.current = commandRequest.id

    switch (commandRequest.action) {
      case 'focus-start':
        handleWindowChange('start')
        window.requestAnimationFrame(() => {
          primaryUploadCardRef.current?.focus({ preventScroll: true })
          scrollViewportToTop()
        })
        return
      case 'open-saved-games':
        handleWindowChange('savedGames')
        return
      case 'open-stats':
        handleWindowChange('stats')
        return
      case 'open-gallery':
        handleWindowChange('gallery')
        return
      case 'open-collections':
        handleWindowChange('collections')
        return
      case 'restore-session':
        setHistoryFilter(commandRequest.historyFilter ?? 'all')
        if ((commandRequest.window ?? 'start') === 'start') {
          handleWindowChange('start')
          window.requestAnimationFrame(() => {
            primaryUploadCardRef.current?.focus({ preventScroll: true })
            scrollViewportToTop()
          })
          return
        }

        handleWindowChange(commandRequest.window ?? 'start')
        return
      case 'export-backup':
        void handleExportBackupRequest()
        return
      case 'import-backup':
        void handleOpenBackupBrowser()
        return
    }
  }, [commandRequest, handleExportBackupRequest, handleOpenBackupBrowser, handleWindowChange])

  const handleBackupImportSelection = (backupFile: PuzzleDataBackupFile) => {
    setIsShowingBackupBrowser(false)
    setPendingBackupImport(backupFile)
  }

  const handleDeleteBackupFile = async (backupFile: PuzzleDataBackupFile) => {
    if (isLoadingBackupFiles || deletingBackupFileName !== null || isImportingBackup) return

    setBackupStatusMessage(null)
    setError(null)
    setDeletingBackupFileName(backupFile.fileName)

    try {
      await onDeleteBackupFile(backupFile.fileName)
      setAvailableBackupFiles((prev) => prev.filter((entry) => entry.fileName !== backupFile.fileName))
      setBackupStatusMessage(`Backup geloescht: ${backupFile.fileName}.`)
    } catch (backupError) {
      setError(`Backup konnte nicht geloescht werden: ${getErrorMessage(backupError)}`)
    } finally {
      setDeletingBackupFileName(null)
    }
  }

  const handleCancelBackupImport = () => {
    if (isImportingBackup) return
    restoreBackupImportFocusRef.current = true
    setPendingBackupImport(null)
  }

  useEffect(() => {
    if (isShowingBackupBrowser || pendingBackupImport !== null || !restoreBackupImportFocusRef.current) {
      return
    }

    restoreBackupImportFocusRef.current = false

    const frameId = window.requestAnimationFrame(() => {
      backupImportActionRef.current?.focus({ preventScroll: true })
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [isShowingBackupBrowser, pendingBackupImport])

  const handleConfirmBackupImport = async () => {
    if (!pendingBackupImport) return

    setError(null)
    setIsImportingBackup(true)
    try {
      const result = await onImportBackupFile(pendingBackupImport.fileName)
      setPendingBackupImport(null)
      handleWindowChange('start')
      setHistoryFilter('all')
      setBackupStatusMessage(
        `Backup importiert: ${pendingBackupImport.fileName} mit ${result.savedGames.length} Spielstaenden, ${result.stats.totalSolved} Siegen und ${result.gallery.totalEntries} Galerie-Bildern.`
      )
    } catch (backupError) {
      setError(`Backup konnte nicht importiert werden: ${getErrorMessage(backupError)}`)
    } finally {
      setIsImportingBackup(false)
    }
  }

  const savedGamesCount = savedGames.length
  const galleryEntriesCount = gallery?.totalEntries ?? gallery?.entries.length ?? 0
  const galleryUniqueEntriesCount = countUniqueGalleryEntries(gallery?.entries ?? [])
  const imageCollections = collections?.collections ?? []
  const imageCollectionsCount = collections?.totalCollections ?? imageCollections.length
  const collectedImagesCount = imageCollections.reduce((sum, collection) => sum + collection.imageIds.length, 0)
  const latestGalleryAt = gallery?.lastCompletedAt ?? gallery?.entries[0]?.completedAt ?? null
  const hasRecordedStats = Boolean(stats && stats.totalSolved > 0)
  const historyFilterOptions = useMemo(() => getDifficultyHistoryFilterOptions(), [])
  const completionHistory = useMemo(() => stats?.completionHistory ?? [], [stats])
  const latestCompletion = completionHistory[0] ?? null
  const favoriteDifficulty = findFavoriteDifficulty(stats)
  const fastestDifficulty = findFastestDifficulty(stats)
  const latestActivityAt = getLatestActivityTimestamp(stats, savedGames, gallery)
  const latestSavedGame = useMemo(() => (
    savedGames.reduce<SavedGameSummary | null>((latest, entry) => {
      if (!latest) {
        return entry
      }

      return Date.parse(entry.updatedAt) > Date.parse(latest.updatedAt) ? entry : latest
    }, null)
  ), [savedGames])
  const latestGalleryEntry = useMemo(() => (
    gallery?.entries.reduce<SolvedGalleryEntry | null>((latest, entry) => {
      if (!latest) {
        return entry
      }

      return Date.parse(entry.completedAt) > Date.parse(latest.completedAt) ? entry : latest
    }, null) ?? null
  ), [gallery])
  const uploadPaletteCandidate = useMemo<{
    palette: ImageThemePalette | null
    source: string | null
  }>(() => {
    const latestSaveTime = latestSavedGame ? Date.parse(latestSavedGame.updatedAt) : Number.NEGATIVE_INFINITY
    const latestGalleryTime = latestGalleryEntry ? Date.parse(latestGalleryEntry.completedAt) : Number.NEGATIVE_INFINITY

    if (latestSavedGame && latestSaveTime >= latestGalleryTime) {
      return {
        palette: latestSavedGame.imageTheme ?? null,
        source: latestSavedGame.previewImage,
      }
    }

    if (latestGalleryEntry) {
      return {
        palette: latestGalleryEntry.imageTheme ?? null,
        source: latestGalleryEntry.previewImage ?? latestGalleryEntry.sourceImage,
      }
    }

    return {
      palette: null,
      source: null,
    }
  }, [latestGalleryEntry, latestSavedGame])
  const { activePalette, paletteStyle } = useUploadImagePalette({
    paletteSource: uploadPaletteCandidate.source,
    storedPalette: uploadPaletteCandidate.palette,
  })

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return completionHistory

    const [rowsRaw, colsRaw] = historyFilter.split('x')
    const rows = Number(rowsRaw)
    const cols = Number(colsRaw)

    return completionHistory.filter(
      (entry) => entry.config.rows === rows && entry.config.cols === cols
    )
  }, [completionHistory, historyFilter])

  const handleCreateCollection = useCallback(async (name: string, imageIds: string[], description?: string) => {
    if (!onCreateImageCollection) return
    await onCreateImageCollection(name, imageIds, description)
  }, [onCreateImageCollection])

  const handleUpdateCollection = useCallback(async (
    collectionId: string,
    updates: Pick<ImageCollection, 'name'> & Partial<Pick<ImageCollection, 'description'>>
  ) => {
    if (!onUpdateImageCollection) return
    await onUpdateImageCollection(collectionId, updates)
  }, [onUpdateImageCollection])

  const handleDeleteCollection = useCallback(async (collectionId: string) => {
    if (!onDeleteImageCollection) return
    await onDeleteImageCollection(collectionId)
  }, [onDeleteImageCollection])

  const handleAddCollectionImages = useCallback(async (collectionId: string, imageIds: string[]) => {
    if (!onAddImageCollectionImages) return
    await onAddImageCollectionImages(collectionId, imageIds)
  }, [onAddImageCollectionImages])

  const handleRemoveCollectionImages = useCallback(async (collectionId: string, imageIds: string[]) => {
    if (!onRemoveImageCollectionImages) return
    await onRemoveImageCollectionImages(collectionId, imageIds)
  }, [onRemoveImageCollectionImages])

  const topStats: DashboardMetric[] = [
    {
      label: 'Siege',
      value: isLoadingStats ? '...' : `${stats?.totalSolved ?? 0}`,
      detail: 'Abgeschlossene Runden',
    },
    {
      label: 'Sauber',
      value: isLoadingStats ? '...' : `${stats?.cleanSolvedCount ?? 0}`,
      detail: 'Ohne Hinweise oder Auto-Zuege, soweit erfasst',
    },
    {
      label: 'Unterstuetzt',
      value: isLoadingStats ? '...' : `${stats?.assistedSolvedCount ?? 0}`,
      detail: 'Mit Hinweisen oder Auto-Zuegen, soweit erfasst',
    },
    {
      label: 'Bestzeit',
      value: isLoadingStats ? '...' : formatOptionalTime(stats?.bestTime ?? null),
      detail: 'Ueber alle Stufen',
    },
  ]

  const openContextWindow = useCallback((request: AppContextMenuRequest) => {
    const isPromptFieldContext = isPromptFieldContextTarget(request.target)
    if ((shouldPreserveNativeContextMenu(request.target) && !isPromptFieldContext) || isBlockingDialogOpen) return

    request.preventDefault?.()

    const isUploadCardContext =
      request.target instanceof Element
      && request.target.closest('[data-upload-context="image-card"]') !== null

    setContextMenuState({
      x: request.clientX,
      y: request.clientY,
      scope: isPromptFieldContext ? 'promptField' : isUploadCardContext ? 'uploadCard' : 'screen',
    })

    if (isUploadCardContext || isPromptFieldContext) {
      void refreshUploadClipboardState()
      return
    }

    resetUploadClipboardState()
  }, [isBlockingDialogOpen, refreshUploadClipboardState, resetUploadClipboardState])

  useEffect(() => {
    registerAppContextMenuHandler(openContextWindow)
    return () => registerAppContextMenuHandler(null)
  }, [openContextWindow, registerAppContextMenuHandler])

  const handleOpenContextWindow = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    openContextWindow({
      clientX: event.clientX,
      clientY: event.clientY,
      target: event.target,
      preventDefault: () => event.preventDefault(),
    })
  }, [openContextWindow])

  const uploadContextActions: ContextMenuItem[] = [
    ...(activeWindow !== 'start'
      ? [
          {
            groupTitle: 'Navigation',
          } satisfies ContextMenuItem,
          {
            label: 'Zur Auswahl',
            icon: 'grid',
            meta: 'Zurueck',
            onClick: () => handleWindowChange('start'),
          } satisfies ContextMenuItem,
        ]
      : []),
    {
      groupTitle: 'Seite',
    },
    {
      label: 'Zur Startseite',
      icon: 'home',
      meta: 'Start',
      onClick: onGoToStartScreen,
    },
    {
      groupTitle: 'Hilfe',
    },
    {
      label: 'Shortcuts und Bedienung',
      icon: 'command',
      meta: 'F1',
      onClick: onOpenHelp,
    },
    ...(contextMenuState?.scope === 'promptField'
      ? [
          {
            groupTitle: 'Prompt',
          } satisfies ContextMenuItem,
          {
            label: 'Prompt einfuegen',
            icon: 'clipboard',
            meta:
              uploadClipboardPasteStatus === 'checking'
                ? 'Prueft ...'
                : uploadClipboardPasteStatus === 'ready'
                  ? 'Bild in Ablage'
                  : 'Text',
            onClick: () => {
              void handlePastePromptFromClipboard()
            },
            disabled: uploadClipboardPasteStatus !== 'unavailable',
          } satisfies ContextMenuItem,
          {
            label: 'Bild erstellen',
            icon: 'play',
            meta: 'Enter',
            onClick: () => {
              void handleGeneratePromptImage()
            },
            disabled: isGeneratingPromptImage,
          } satisfies ContextMenuItem,
        ]
      : []),
    {
      groupTitle: 'Bild',
    },
    {
      label: 'Foto hochladen',
      icon: 'upload',
      meta: 'Datei',
      onClick: () => fileInputRef.current?.click(),
    },
    ...(contextMenuState?.scope === 'uploadCard'
      ? [
          {
            label: 'Bild einfuegen',
            icon: 'clipboard',
            meta:
              uploadClipboardPasteStatus === 'checking'
                ? 'Prueft ...'
                : 'Zwischenablage',
            onClick: () => {
              void handlePasteImageFromClipboard()
            },
            disabled: uploadClipboardPasteStatus !== 'ready',
          } satisfies ContextMenuItem,
        ]
      : []),
    {
      label: 'Zufaelliges Bild',
      icon: 'shuffle',
      meta: isFetchingRandom ? 'Laedt ...' : 'Zufall',
      onClick: onFetchRandomImage,
      disabled: isFetchingRandom,
    },
    {
      groupTitle: 'Bereiche',
    },
    {
      label: 'Spielstaende',
      icon: 'folder',
      meta: isLoadingSavedGames ? 'Laedt ...' : `${savedGamesCount}`,
      onClick: handleOpenSavedGamesWindow,
    },
    {
      label: 'Statistik',
      icon: 'barChart2',
      meta: isLoadingStats ? 'Laedt ...' : `${stats?.totalSolved ?? 0} Siege`,
      onClick: handleOpenStatsWindow,
    },
    {
      label: 'Galerie',
      icon: 'image',
      meta: isLoadingGallery ? 'Laedt ...' : `${galleryUniqueEntriesCount} Motive`,
      onClick: handleOpenGalleryWindow,
    },
    {
      label: 'Sammlungen',
      icon: 'folder',
      meta: isLoadingCollections ? 'Laedt ...' : `${imageCollectionsCount}`,
      onClick: handleOpenCollectionsWindow,
    },
    {
      groupTitle: 'Backups',
    },
    {
      label: 'Backup exportieren',
      icon: 'downloadCloud',
      meta: isExportingBackup ? 'Export' : 'Backup',
      onClick: () => {
        void handleExportBackupRequest()
      },
      disabled: isExportingBackup || isImportingBackup || isLoadingBackupFiles,
    },
    {
      label: 'Backup importieren',
      icon: 'uploadCloud',
      meta: isLoadingBackupFiles ? 'Laedt ...' : 'Import',
      onClick: () => {
        void handleOpenBackupBrowser()
      },
      disabled: isLoadingBackupFiles || isImportingBackup || deletingBackupFileName !== null,
    },
  ]



  return (
    <div
      ref={screenRef}
      className={`upload-screen${isDragActive ? ' is-drag-active' : ''}`}
      data-page-focus-root="true"
      data-image-mood={activePalette?.mood}
      data-image-palette-source={activePalette?.source}
      style={paletteStyle}
      onContextMenu={handleOpenContextWindow}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={(event) => {
        void handleDrop(event)
      }}
    >
        <div className={`upload-container${isDragActive ? ' is-drag-active' : ''}`}>
        <div className={`upload-hero${isWorkspaceOpen ? ' is-workspace-open' : ''}`} aria-hidden={isWorkspaceOpen}>
          <span className="upload-kicker">Foto rein. Puzzle los.</span>
          <h1>
            <span className="upload-title-icon" aria-hidden="true">
              <UploadScreenIcon name="uploadCloud" className="upload-title-icon-symbol" />
            </span>
            Schiebepuzzle
          </h1>
          <p className="upload-subtitle">
            Starte direkt mit einem neuen Motiv. Spielstaende, Statistik und Galerie liegen bewusst
            in eigenen Fenstern, damit die Startseite ruhig, klar und schnell benutzbar bleibt.
          </p>
        </div>

        <ErrorToast
          message={error || savedGamesError || statsError || galleryError || collectionsError || randomImageError || null}
          onDismiss={clearError}
          paletteStyle={paletteStyle}
        />

        <input
          ref={fileInputRef}
          type="file"
          tabIndex={-1}
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {isDragActive && (
          <div className="upload-drop-overlay" aria-hidden="true">
            <div className="upload-drop-overlay-panel">
              <span className="upload-drop-overlay-icon-shell">
                <UploadScreenIcon name="uploadCloud" className="upload-drop-overlay-icon" />
              </span>
              <span className="upload-drop-overlay-kicker">Drag and Drop</span>
              <strong className="upload-drop-overlay-title">
                {activeWindow === 'start' ? 'Bild hier ablegen' : 'Neues Bild hier ablegen'}
              </strong>
              <p className="upload-drop-overlay-copy">
                Lass die Datei los, um sie direkt zu laden und danach im Zuschnitt weiterzumachen.
              </p>
            </div>
          </div>
        )}

        <AnimatedStaggerGroup
          className={`upload-start-layout${isWorkspaceOpen ? ' is-workspace-open' : ''}`}
          level="medium"
          aria-hidden={isWorkspaceOpen}
        >
          <AnimatedReveal level="medium">
            <UploadMenuCards
              fileInputRef={fileInputRef}
              promptInputRef={promptInputRef}
              primaryActionRef={primaryUploadCardRef}
              isDragActive={isDragActive}
              isFetchingRandom={isFetchingRandom}
              isGeneratingPromptImage={isGeneratingPromptImage}
              promptValue={promptImagePrompt}
              onFetchRandomImage={onFetchRandomImage}
              onPromptValueChange={setPromptImagePrompt}
              onGeneratePromptImage={handleGeneratePromptImage}
            />
          </AnimatedReveal>

          <AnimatedReveal level="medium">
            <UploadWorkspaceLauncher
              savedGamesActionRef={savedGamesLauncherRef}
              statsActionRef={statsLauncherRef}
              galleryActionRef={galleryLauncherRef}
              collectionsActionRef={collectionsLauncherRef}
              savedGamesCount={savedGamesCount}
              totalSolved={stats?.totalSolved ?? 0}
              activeDays={stats?.activeDays ?? 0}
              galleryEntriesCount={galleryUniqueEntriesCount}
              gallerySolveCount={galleryEntriesCount}
              collectionsCount={imageCollectionsCount}
              collectedImagesCount={collectedImagesCount}
              latestActivityAt={latestActivityAt}
              latestGalleryAt={latestGalleryAt}
              isLoadingSavedGames={isLoadingSavedGames}
              isLoadingStats={isLoadingStats}
              isLoadingGallery={isLoadingGallery}
              isLoadingCollections={isLoadingCollections}
              onOpenSavedGames={handleOpenSavedGamesWindow}
              onOpenStats={handleOpenStatsWindow}
              onOpenGallery={handleOpenGalleryWindow}
              onOpenCollections={handleOpenCollectionsWindow}
            />
          </AnimatedReveal>

          <AnimatedReveal level="medium">
            <UploadDataTransferPanel
              importActionRef={backupImportActionRef}
              savedGamesCount={savedGamesCount}
              totalSolved={stats?.totalSolved ?? 0}
              galleryEntriesCount={galleryEntriesCount}
              isExportingBackup={isExportingBackup}
              isLoadingBackupFiles={isLoadingBackupFiles}
              isImportingBackup={isImportingBackup}
              statusMessage={backupStatusMessage}
              onExportBackup={() => {
                void handleExportBackupRequest()
              }}
              onOpenBackupImport={() => {
                void handleOpenBackupBrowser()
              }}
            />
          </AnimatedReveal>
        </AnimatedStaggerGroup>

        <AnimatePresence initial={false} mode="wait" onExitComplete={handleWorkspaceExitComplete}>
          {!isWorkspaceExiting && activeWindow !== 'start' && (
            <UploadDashboard
              activeWindow={activeWindow}
              paletteStyle={paletteStyle}
              savedGames={savedGames}
              savedGamesCount={savedGamesCount}
              loadingSaveId={loadingSaveId}
              deletingSaveId={deletingSaveId}
              isDeletingAllSavedGames={isDeletingAllSavedGames}
              completionHistory={completionHistory}
              filteredHistory={filteredHistory}
              historyFilter={historyFilter}
              historyFilterOptions={historyFilterOptions}
              topStats={topStats}
              latestCompletion={latestCompletion}
              favoriteDifficulty={favoriteDifficulty}
              fastestDifficulty={fastestDifficulty}
              stats={stats}
              gallery={gallery}
              collections={imageCollections}
              isLoadingStats={isLoadingStats}
              isResettingStats={isResettingStats}
              isLoadingSavedGames={isLoadingSavedGames}
              isLoadingGallery={isLoadingGallery}
              isLoadingCollections={isLoadingCollections}
              isResettingGallery={isResettingGallery}
              hasRecordedStats={hasRecordedStats}
              onWindowChange={handleWindowChange}
              onHistoryFilterChange={setHistoryFilter}
              onRequestStatsReset={handleRequestStatsReset}
              onRequestGalleryReset={handleRequestGalleryReset}
              onReplayGalleryEntry={onReplayGalleryEntry}
              onDeleteGalleryEntries={onDeleteGalleryEntries}
              onUpdateGalleryTags={onUpdateGalleryTags}
              onRetryGalleryTagging={onRetryGalleryTagging}
              onFetchRandomImage={onFetchRandomImage}
              onCreateImageCollection={handleCreateCollection}
              onUpdateImageCollection={handleUpdateCollection}
              onDeleteImageCollection={handleDeleteCollection}
              onAddImageCollectionImages={handleAddCollectionImages}
              onRemoveImageCollectionImages={handleRemoveCollectionImages}
              onLoadSave={handleLoadSave}
              onDeleteRequest={handleDeleteRequest}
              onDeleteAllRequest={handleRequestDeleteAllSavedGames}
            />
          )}
        </AnimatePresence>

        <AnimatePresence initial={false} mode="wait">
          {isShowingBackupBrowser ? (
            <UploadBackupBrowserDialog
              key="backup-browser"
              backups={availableBackupFiles}
              isLoading={isLoadingBackupFiles}
              deletingFileName={deletingBackupFileName}
              restoreFocusFallbackRef={backupImportActionRef}
              paletteStyle={paletteStyle}
              onClose={handleCloseBackupBrowser}
              onDeleteBackup={(backup) => {
                void handleDeleteBackupFile(backup)
              }}
              onSelectBackup={handleBackupImportSelection}
            />
          ) : pendingBackupImport ? (
            <UploadConfirmDialog
              key={`backup-import-confirm-${pendingBackupImport.fileName}`}
              titleId="backup-import-title"
              title="Backup importieren?"
              description={
                <p>
                  <span className="delete-confirm-name">{pendingBackupImport.fileName}</span>
                  {pendingBackupImport.exportedAt ? ` vom ${formatDate(pendingBackupImport.exportedAt)}` : ''} enthaelt{' '}
                  {pendingBackupImport.savedGamesCount} Spielstaende, {pendingBackupImport.totalSolved} Siege und{' '}
                  {pendingBackupImport.galleryEntriesCount} Galerie-Bilder. Der aktuelle Datenstand wird dabei komplett ersetzt.
                </p>
              }
              confirmLabel="Importieren"
              busyLabel="Importiere ..."
              isBusy={isImportingBackup}
              onCancel={handleCancelBackupImport}
              onConfirm={() => {
                void handleConfirmBackupImport()
              }}
              confirmButtonRef={importBackupConfirmButtonRef}
              restoreFocusFallbackRef={backupImportActionRef}
              paletteStyle={paletteStyle}
            />
          ) : null}
        </AnimatePresence>

        <AnimatePresence initial={false}>

          {pendingDeleteSave && (
            <UploadConfirmDialog
              key="delete-save-confirm"
              titleId="delete-confirm-title"
              title="Spielstand loeschen?"
              description={
                <p>
                  Moechtest du <span className="delete-confirm-name">{pendingDeleteSave.name}</span>{' '}
                  wirklich entfernen? Dieser Schritt kann nicht rueckgaengig gemacht werden.
                </p>
              }
              confirmLabel="Loeschen"
              busyLabel="Loesche ..."
              isBusy={deletingSaveId === pendingDeleteSave.id}
              onCancel={handleCancelDelete}
              onConfirm={() => {
                void handleConfirmDelete()
              }}
              confirmButtonRef={deleteConfirmButtonRef}
              paletteStyle={paletteStyle}
            />
          )}

          {isConfirmingDeleteAllSavedGames && (
            <UploadConfirmDialog
              key="delete-all-saves-confirm"
              titleId="delete-all-saves-confirm-title"
              title="Alle Spielstaende loeschen?"
              description={
                <p>
                  Alle {savedGamesCount} Spielstaende werden entfernt. Dieser Schritt kann nicht
                  rueckgaengig gemacht werden.
                </p>
              }
              confirmLabel="Alle loeschen"
              busyLabel="Loesche alle ..."
              isBusy={isDeletingAllSavedGames}
              onCancel={handleCancelDeleteAllSavedGames}
              onConfirm={() => {
                void handleConfirmDeleteAllSavedGames()
              }}
              confirmButtonRef={deleteAllConfirmButtonRef}
              paletteStyle={paletteStyle}
            />
          )}

          {isConfirmingStatsReset && (
            <UploadConfirmDialog
              key="stats-reset-confirm"
              titleId="stats-reset-title"
              title="Statistik loeschen?"
              description={
                <p>
                  Alle Bestzeiten, Siege und Verlaufsdaten werden entfernt. Spielstaende und Galerie
                  bleiben erhalten, aber dieser Schritt kann nicht rueckgaengig gemacht werden.
                </p>
              }
              confirmLabel="Statistik loeschen"
              busyLabel="Loesche ..."
              isBusy={isResettingStats}
              onCancel={handleCancelStatsReset}
              onConfirm={() => {
                void handleConfirmStatsReset()
              }}
              confirmButtonRef={resetStatsConfirmButtonRef}
              paletteStyle={paletteStyle}
            />
          )}

          {isConfirmingGalleryReset && (
            <UploadConfirmDialog
              key="gallery-reset-confirm"
              titleId="gallery-reset-title"
              title="Galerie loeschen?"
              description={
                <p>
                  Alle Galerie-Bilder und Galerie-Eintraege werden entfernt. Statistik und
                  Spielstaende bleiben erhalten, aber dieser Schritt kann nicht rueckgaengig gemacht
                  werden.
                </p>
              }
              confirmLabel="Galerie loeschen"
              busyLabel="Loesche ..."
              isBusy={isResettingGallery}
              onCancel={handleCancelGalleryReset}
              onConfirm={() => {
                void handleConfirmGalleryReset()
              }}
              confirmButtonRef={resetGalleryConfirmButtonRef}
              paletteStyle={paletteStyle}
            />
          )}

        </AnimatePresence>

        <AnimatePresence initial={false}>
          {contextMenuState && (
            <CompactContextMenu
              position={contextMenuState}
              items={uploadContextActions}
              onClose={closeContextMenu}
              paletteStyle={paletteStyle}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}














