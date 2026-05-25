import * as React from 'react'
import { AnimatePresence } from 'motion/react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { listPuzzleDataBackupFiles } from '../services/BackupService.ts'
import * as ClipboardService from '../services/ClipboardService.ts'
import type { AppContextMenuHandler } from '../app/appContextMenu.ts'
import AccessibilityAnnouncerHost, { useAccessibilityAnnouncer } from '../app/accessibilityAnnouncer.tsx'
import { getDefaultHelpContext, getHelpView } from '../app/helpRegistry.ts'
import { getPuzzleHelpContextForTarget, getUploadHelpContextForTarget } from '../app/helpContextTargets.ts'
import { useButtonOnlyTabNavigation } from '../app/useButtonOnlyTabNavigation.ts'
import { useCommandPaletteShortcuts } from '../app/useCommandPaletteShortcuts.ts'
import { useGlobalHelpShortcuts } from '../app/useGlobalHelpShortcuts.ts'
import { useGlobalPrimaryFocusShortcut } from '../app/useGlobalPrimaryFocusShortcut.ts'
import { usePuzzleKeyboardShortcuts } from '../screens/puzzle/usePuzzleKeyboardShortcuts.ts'
import {
  clearCropDraftSessionSnapshot,
  readCropDraftSessionSnapshot,
  writeCropDraftSessionSnapshot,
} from '../app/cropDraftSession.ts'
import {
  clearLastSessionSnapshot,
  readLastSessionSnapshot,
  writeLastSessionSnapshot,
} from '../app/lastSession.ts'
import {
  clearIgnoredRecoverySaveId,
  clearRecoverySessionSnapshot,
  readIgnoredRecoverySaveId,
  readRecoverySessionSnapshot,
  writeIgnoredRecoverySaveId,
  writeRecoverySessionSnapshot,
} from '../app/recoverySession.ts'
import CommandPalette from '../components/CommandPalette.tsx'
import GlobalHelpOverlay from '../components/GlobalHelpOverlay.tsx'
import RecoveryResumeDialog from '../components/RecoveryResumeDialog.tsx'
import StatusToast from '../components/StatusToast.tsx'
import ThemeSwitcher from '../components/ThemeSwitcher.tsx'
import { ThemeProvider } from '../contexts/ThemeContext.tsx'
import CropScreen from '../screens/CropScreen.tsx'
import StartScreen from '../screens/StartScreen.tsx'
import UploadScreen from '../screens/UploadScreen.tsx'
import UploadBackupBrowserDialog from '../screens/upload/UploadBackupBrowserDialog.tsx'
import UploadGalleryCard from '../screens/upload/UploadGalleryCard.tsx'
import UploadGalleryDetailDialog from '../screens/upload/UploadGalleryDetailDialog.tsx'
import UploadGalleryPanel from '../screens/upload/UploadGalleryPanel.tsx'
import UploadMenuCards from '../screens/upload/UploadMenuCards.tsx'
import WinDialog from '../components/WinDialog.tsx'
import type { GalleryDisplayEntry } from '../screens/upload/UploadGalleryDisplayUtils.ts'
import UploadConfirmDialog from '../screens/upload/UploadConfirmDialog.tsx'
import UploadDashboard from '../screens/upload/UploadDashboard.tsx'
import UploadSavedGamesPanel from '../screens/upload/UploadSavedGamesPanel.tsx'
import UploadStatsComparisonMatrix from '../screens/upload/UploadStatsComparisonMatrix.tsx'
import UploadStatsHistorySection from '../screens/upload/UploadStatsHistorySection.tsx'
import UploadStatsSection from '../screens/upload/UploadStatsSection.tsx'
import UploadWorkspaceLauncher from '../screens/upload/UploadWorkspaceLauncher.tsx'
import type {
  PuzzleCompletionRecord,
  PuzzleDataBackupFile,
  PuzzleStats,
  RecordPuzzleCompletionResult,
  SavedGameSummary,
  SolvedGallery,
  SolvedGalleryEntry,
  ImageThemePalette,
  PuzzleState,
} from '../types/index'

vi.mock('../services/BackupService.ts', async () => {
  const actual = await vi.importActual<typeof import('../services/BackupService.ts')>('../services/BackupService.ts')

  return {
    ...actual,
    listPuzzleDataBackupFiles: vi.fn(),
  }
})

function createSavedGame(id: string, updatedAt: string): SavedGameSummary {
  return {
    id,
    name: `Spielstand ${id}`,
    createdAt: updatedAt,
    updatedAt,
    previewImage: 'data:image/png;base64,test',
    config: { rows: 4, cols: 4 },
    moves: Number.parseInt(id, 10),
    elapsedTime: 60 + Number.parseInt(id, 10),
  }
}

function createSolvedGalleryEntry(id: string, completedAt: string): SolvedGalleryEntry {
  return {
    id,
    completedAt,
    previewImage: 'data:image/png;base64,test',
    sourceImage: 'data:image/png;base64,source',
    config: { rows: 4, cols: 4 },
    moves: 20 + Number.parseInt(id, 10),
    time: 90 + Number.parseInt(id, 10),
    actionMoves: 25 + Number.parseInt(id, 10),
    assistanceMode: 'hinted',
    hasDetailedProfile: true,
  }
}

function createGalleryDisplayEntry(id: string, completedAt: string): GalleryDisplayEntry {
  const representativeEntry = createSolvedGalleryEntry(id, completedAt)
  const motifId = representativeEntry.sourceImage ?? representativeEntry.previewImage ?? `missing:${representativeEntry.id}`
  return {
    id: `gallery-${id}`,
    motifId,
    allEntries: [representativeEntry],
    visibleEntries: [representativeEntry],
    representativeEntry,
    totalSolveCount: 1,
    visibleSolveCount: 1,
    latestCompletedAt: completedAt,
    earliestVisibleCompletedAt: completedAt,
    bestVisibleTime: representativeEntry.time,
    bestVisibleMoves: representativeEntry.moves,
    bestVisibleActionMoves: representativeEntry.actionMoves,
    bestVisibleDetours: representativeEntry.actionMoves - representativeEntry.moves,
    motifReplaySummary: {
      motifId,
      allEntries: [representativeEntry],
      totalSolveCount: 1,
      replayableSolveCount: 1,
      difficultyVariants: [representativeEntry.config],
      latestCompletedAt: completedAt,
      lastReplayableEntry: representativeEntry,
      bestTimeEntry: representativeEntry,
      bestMovesEntry: representativeEntry,
      bestCleanTimeEntry: null,
    },
  }
}

function createImageThemePalette(): ImageThemePalette {
  return {
    accentSolid: 'rgb(220, 38, 38)',
    accentSoft: 'rgba(220, 38, 38, 0.18)',
    accentStrong: 'rgba(220, 38, 38, 0.34)',
    glow: 'rgba(248, 113, 113, 0.48)',
    primaryColor: '#dc2626',
    primaryHover: '#b91c1c',
    primaryShadow: 'rgba(220, 38, 38, 0.28)',
    primaryShadowHover: 'rgba(220, 38, 38, 0.38)',
    mood: 'energetic',
    moodLabel: 'Energie',
    confidence: 0.84,
    source: 'local-color',
    reason: null,
    analyzedAt: '2026-04-11T10:00:00.000Z',
  }
}

function createSolvedGallery(id: string, completedAt: string): SolvedGallery {
  return {
    entries: [createSolvedGalleryEntry(id, completedAt)],
    totalEntries: 1,
    lastCompletedAt: completedAt,
    lastUpdatedAt: completedAt,
  }
}

function createDistinctSolvedGallery(entries: Array<{
  id: string
  completedAt: string
  rows: number
  cols: number
}>): SolvedGallery {
  const galleryEntries = entries.map((entry) => ({
    ...createSolvedGalleryEntry(entry.id, entry.completedAt),
    previewImage: `data:image/png;base64,preview-${entry.id}`,
    sourceImage: `data:image/png;base64,source-${entry.id}`,
    config: { rows: entry.rows, cols: entry.cols },
  }))

  return {
    entries: galleryEntries,
    totalEntries: galleryEntries.length,
    lastCompletedAt: galleryEntries[0]?.completedAt ?? null,
    lastUpdatedAt: galleryEntries[0]?.completedAt ?? null,
  }
}

function createCompletionRecord(id: string, completedAt: string): PuzzleCompletionRecord {
  return {
    id,
    completedAt,
    previewImage: 'data:image/png;base64,test',
    config: { rows: 4, cols: 4 },
    moves: 40 + Number.parseInt(id, 10),
    time: 120 + Number.parseInt(id, 10),
    actionMoves: 46 + Number.parseInt(id, 10),
    undoCount: 1,
    redoCount: 0,
    hintCount: 1,
    suggestedMoveCount: 0,
    assistanceMode: 'hinted',
    hasDetailedProfile: true,
  }
}

function createBackup(fileName: string): PuzzleDataBackupFile {
  return {
    fileName,
    exportedAt: '2026-04-11T10:00:00.000Z',
    savedGamesCount: 3,
    totalSolved: 7,
    galleryEntriesCount: 5,
    size: 1024,
    modifiedAt: '2026-04-11T10:30:00.000Z',
    alreadyCurrent: false,
    deletedBackupFileNames: [],
    retentionLimit: 10,
  }
}

function createCompletionResult(): RecordPuzzleCompletionResult {
  return {
    stats: {
      totalSolved: 20,
      cleanSolvedCount: 8,
      assistedSolvedCount: 9,
      autoAssistedSolvedCount: 3,
      profiledSolvedCount: 18,
      legacySolvedCount: 2,
      totalMoves: 500,
      totalTime: 1260,
      averageMoves: 25,
      averageTime: 63,
      medianMoves: 24,
      medianTime: 61,
      currentStreak: 4,
      bestStreak: 7,
      activeDays: 5,
      bestMoves: 18,
      bestCleanMoves: 18,
      bestTime: 14,
      bestCleanTime: 14,
      byDifficulty: [],
      recentCompletions: [],
      completionHistory: [],
      lastCompletedAt: '2026-04-11T12:00:00.000Z',
      lastUpdatedAt: '2026-04-11T12:00:00.000Z',
    },
    completion: createCompletionRecord('7', '2026-04-11T12:00:00.000Z'),
    difficultyStats: {
      config: { rows: 4, cols: 4 },
      solveCount: 7,
      cleanSolveCount: 3,
      assistedSolveCount: 3,
      autoAssistedSolveCount: 1,
      profiledSolveCount: 7,
      legacySolveCount: 0,
      totalMoves: 180,
      totalActionMoves: 198,
      totalTime: 470,
      averageMoves: 24,
      averageActionMoves: 27,
      bestTime: 42,
      bestMoves: 18,
      bestCleanMoves: 18,
      bestCleanTime: 42,
      averageTime: 67,
      medianMoves: 23,
      medianActionMoves: 25,
      medianTime: 63,
      averageExtraMoves: 3,
      medianExtraMoves: 3,
      recentMedianMoves: 21,
      recentMedianTime: 58,
      lastMoves: 19,
      lastActionMoves: 22,
      lastExtraMoves: 3,
      lastTime: 44,
      lastAssistanceMode: 'clean',
      lastHasDetailedProfile: true,
      lastCompletedAt: '2026-04-11T12:00:00.000Z',
    },
    previousCompletion: createCompletionRecord('6', '2026-04-10T12:00:00.000Z'),
    previousRecentMedianMoves: 22,
    previousRecentMedianTime: 60,
    isNewBestTime: false,
    isNewBestMoves: false,
    isNewBestCleanMoves: false,
    isNewBestCleanTime: false,
  }
}

function mockElementRect(
  element: Element,
  {
    left,
    top,
    width = 160,
    height = 48,
  }: {
    left: number
    top: number
    width?: number
    height?: number
  }
) {
  const right = left + width
  const bottom = top + height

  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    writable: true,
    value: () => ({
      x: left,
      y: top,
      top,
      left,
      right,
      bottom,
      width,
      height,
      toJSON: () => ({}),
    }),
  })
}

function mockScrollableContainer(
  element: HTMLElement,
  {
    left = 0,
    top = 0,
    width = 720,
    height = 360,
    scrollTop = 0,
    scrollHeight = 1200,
  }: {
    left?: number
    top?: number
    width?: number
    height?: number
    scrollTop?: number
    scrollHeight?: number
  } = {}
) {
  const scrollTo = vi.fn(({ top: nextTop }: { top?: number }) => {
    if (typeof nextTop === 'number') {
      Object.defineProperty(element, 'scrollTop', {
        configurable: true,
        writable: true,
        value: nextTop,
      })
    }
  })

  element.style.overflowY = 'auto'
  element.style.overflowX = 'hidden'
  element.style.paddingTop = '0px'
  element.style.paddingBottom = '0px'
  element.style.scrollPaddingTop = '0px'
  element.style.scrollPaddingBottom = '0px'

  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    value: height,
  })
  Object.defineProperty(element, 'clientWidth', {
    configurable: true,
    value: width,
  })
  Object.defineProperty(element, 'scrollHeight', {
    configurable: true,
    value: scrollHeight,
  })
  Object.defineProperty(element, 'scrollWidth', {
    configurable: true,
    value: width,
  })
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    writable: true,
    value: scrollTop,
  })
  Object.defineProperty(element, 'scrollLeft', {
    configurable: true,
    writable: true,
    value: 0,
  })
  Object.defineProperty(element, 'scrollTo', {
    configurable: true,
    writable: true,
    value: scrollTo,
  })

  mockElementRect(element, { left, top, width, height })

  return scrollTo
}

describe('keyboard smoke tests', () => {
  it('shows page-specific help content for upload subviews', () => {
    expect(getDefaultHelpContext('idle')).toBe('upload-start')

    const savedGamesView = getHelpView('upload-savedGames')
    expect(savedGamesView.kicker).toBe('Spielstaende')
    expect(savedGamesView.sections[0]?.title).toBe('Im Fenster navigieren')

    const statsView = getHelpView('upload-stats')
    expect(statsView.kicker).toBe('Statistik')
    expect(statsView.sections[0]?.title).toBe('Statistikabschnitte')
    expect(statsView.sections.some((section) => section.title === 'Dialoge und Fenster')).toBe(true)

    const galleryView = getHelpView('upload-gallery')
    expect(galleryView.kicker).toBe('Galerie')
    expect(galleryView.sections[0]?.title).toBe('Filter und Eintraege')

    const playingView = getHelpView('playing')
    expect(playingView.kicker).toBe('Puzzle')
    expect(playingView.sections[0]?.title).toBe('Brett und Bewegung')
  })

  it('derives focus-specific help contexts for upload and puzzle areas', () => {
    const statsFilterButton = document.createElement('button')
    const statsFilterRow = document.createElement('div')
    statsFilterRow.className = 'dashboard-filter-row'
    statsFilterRow.appendChild(statsFilterButton)

    const statsSummaryButton = document.createElement('button')
    statsSummaryButton.className = 'stats-report-section-summary'

    const galleryToolbarSelect = document.createElement('select')
    const galleryToolbar = document.createElement('div')
    galleryToolbar.className = 'gallery-toolbar'
    galleryToolbar.appendChild(galleryToolbarSelect)

    const galleryCardButton = document.createElement('button')
    const galleryCard = document.createElement('article')
    galleryCard.className = 'gallery-card'
    galleryCard.appendChild(galleryCardButton)

    const boardCanvas = document.createElement('canvas')
    boardCanvas.className = 'puzzle-canvas'

    const toolButton = document.createElement('button')
    const toolShell = document.createElement('div')
    toolShell.className = 'puzzle-tools-shell'
    toolShell.appendChild(toolButton)

    const referenceButton = document.createElement('button')
    const referencePanel = document.createElement('aside')
    referencePanel.className = 'puzzle-side-panel-right'
    referencePanel.appendChild(referenceButton)

    expect(getUploadHelpContextForTarget('stats', statsFilterButton)).toBe('upload-stats')
    expect(getUploadHelpContextForTarget('stats', statsSummaryButton)).toBe('upload-stats')
    expect(getUploadHelpContextForTarget('gallery', galleryToolbarSelect)).toBe('upload-gallery')
    expect(getUploadHelpContextForTarget('gallery', galleryCardButton)).toBe('upload-gallery')
    expect(getPuzzleHelpContextForTarget(boardCanvas)).toBe('playing')
    expect(getPuzzleHelpContextForTarget(toolButton)).toBe('playing')
    expect(getPuzzleHelpContextForTarget(referenceButton)).toBe('playing')
  })

  it('stores and clears recovery snapshots defensively', () => {
    clearRecoverySessionSnapshot()
    expect(readRecoverySessionSnapshot()).toBeNull()

    writeRecoverySessionSnapshot('save-42')
    const snapshot = readRecoverySessionSnapshot()
    expect(snapshot?.saveId).toBe('save-42')
    expect(typeof snapshot?.interruptedAt).toBe('number')

    window.localStorage.setItem('schiebepuzzle.recovery-session.v1', '{"broken":true}')
    expect(readRecoverySessionSnapshot()).toBeNull()

    clearRecoverySessionSnapshot()
    expect(readRecoverySessionSnapshot()).toBeNull()
  })

  it('stores and clears ignored recovery save ids defensively', () => {
    clearIgnoredRecoverySaveId()
    expect(readIgnoredRecoverySaveId()).toBeNull()

    writeIgnoredRecoverySaveId('save-42')
    expect(readIgnoredRecoverySaveId()).toBe('save-42')

    clearIgnoredRecoverySaveId('save-7')
    expect(readIgnoredRecoverySaveId()).toBe('save-42')

    clearIgnoredRecoverySaveId('save-42')
    expect(readIgnoredRecoverySaveId()).toBeNull()

    writeIgnoredRecoverySaveId('save-9')
    window.localStorage.setItem('schiebepuzzle.recovery-session.ignore.v1', '{"broken":true}')
    expect(readIgnoredRecoverySaveId()).toBeNull()

    clearIgnoredRecoverySaveId()
    expect(readIgnoredRecoverySaveId()).toBeNull()
  })

  it('stores and clears last session snapshots defensively', () => {
    clearLastSessionSnapshot()
    expect(readLastSessionSnapshot()).toBeNull()

    writeLastSessionSnapshot({
      target: 'upload',
      saveId: 'save-7',
      uploadWindow: 'stats',
      historyFilter: '4x4',
    })
    const snapshot = readLastSessionSnapshot()
    expect(snapshot?.target).toBe('upload')
    expect(snapshot?.saveId).toBe('save-7')
    expect(snapshot?.uploadWindow).toBe('stats')
    expect(snapshot?.historyFilter).toBe('4x4')

    window.localStorage.setItem('schiebepuzzle.last-session.v1', '{"broken":true}')
    expect(readLastSessionSnapshot()).toBeNull()

    clearLastSessionSnapshot()
    expect(readLastSessionSnapshot()).toBeNull()
  })

  it('stores and clears crop draft snapshots defensively', () => {
    clearCropDraftSessionSnapshot()
    expect(readCropDraftSessionSnapshot()).toBeNull()

    writeCropDraftSessionSnapshot({
      image: 'data:image/png;base64,test',
      config: { rows: 4, cols: 4 },
      isRandomImage: true,
      randomImageSource: {
        label: 'Lorem Picsum',
        url: 'https://picsum.photos/',
      },
      transform: {
        zoom: 1.5,
        rotationDeg: 90,
        offsetX: 24,
        offsetY: -12,
      },
      useFullImage: true,
    })

    const snapshot = readCropDraftSessionSnapshot()
    expect(snapshot?.image).toBe('data:image/png;base64,test')
    expect(snapshot?.config).toEqual({ rows: 4, cols: 4 })
    expect(snapshot?.isRandomImage).toBe(true)
    expect(snapshot?.randomImageSource?.label).toBe('Lorem Picsum')
    expect(snapshot?.transform.zoom).toBe(1.5)
    expect(snapshot?.useFullImage).toBe(true)

    window.localStorage.setItem('schiebepuzzle.crop-draft-session.v1', '{"broken":true}')
    expect(readCropDraftSessionSnapshot()).toBeNull()

    clearCropDraftSessionSnapshot()
    expect(readCropDraftSessionSnapshot()).toBeNull()
  })

  it('migrates a legacy crop draft from session storage to local storage', () => {
    clearCropDraftSessionSnapshot()

    window.sessionStorage.setItem('schiebepuzzle.crop-draft-session.v1', JSON.stringify({
      version: 1,
      updatedAt: Date.now(),
      image: 'data:image/png;base64,test',
      config: { rows: 4, cols: 4 },
      isRandomImage: true,
      randomImageSource: {
        label: 'Lorem Picsum',
        url: 'https://picsum.photos/',
      },
      transform: {
        zoom: 1.25,
        rotationDeg: 0,
        offsetX: 12,
        offsetY: -4,
      },
      useFullImage: false,
    }))

    const snapshot = readCropDraftSessionSnapshot()
    expect(snapshot?.image).toBe('data:image/png;base64,test')
    expect(window.localStorage.getItem('schiebepuzzle.crop-draft-session.v1')).toContain('"version":1')
    expect(window.sessionStorage.getItem('schiebepuzzle.crop-draft-session.v1')).toBeNull()
  })

  it('lets keyboard users choose recovery actions with arrows', async () => {
    const onDismiss = vi.fn()
    const onDecline = vi.fn()
    const onResume = vi.fn()

    render(
      <AnimatePresence>
        <RecoveryResumeDialog
          save={createSavedGame('42', '2026-04-11T10:30:00.000Z')}
          interruptedAt={Date.parse('2026-04-11T10:35:00.000Z')}
          onDismiss={onDismiss}
          onDecline={onDecline}
          onResume={onResume}
        />
      </AnimatePresence>
    )

    const laterButton = await screen.findByRole('button', { name: 'Spaeter' })
    const declineButton = screen.getByRole('button', { name: 'Nicht fortsetzen' })
    const resumeButton = screen.getByRole('button', { name: 'Spielstand fortsetzen' })
    const actionGroup = screen.getByRole('group', { name: 'Wiederherstellungsaktionen' })
    const dialog = screen.getByRole('dialog', { name: 'Unterbrochene Runde gefunden' })

    await waitFor(() => {
      expect(document.activeElement).toBe(laterButton)
    })

    expect(actionGroup).toBeTruthy()
    expect(dialog.getAttribute('aria-describedby')).toContain('recovery-resume-details')
    expect(dialog.getAttribute('aria-describedby')).toContain('recovery-resume-keyboard-hint')

    fireEvent.keyDown(laterButton, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(declineButton)

    fireEvent.keyDown(declineButton, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(resumeButton)

    fireEvent.keyDown(resumeButton, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(declineButton)

    fireEvent.keyDown(declineButton, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(laterButton)

    fireEvent.keyDown(laterButton, { key: 'End' })
    expect(document.activeElement).toBe(resumeButton)

    fireEvent.keyDown(resumeButton, { key: 'Home' })
    expect(document.activeElement).toBe(laterButton)

    fireEvent.click(declineButton)
    expect(onDecline).toHaveBeenCalledTimes(1)

    fireEvent.click(resumeButton)
    expect(onResume).toHaveBeenCalledTimes(1)
  })

  it('keeps the recovery dialog closed for the current app session after choosing later', async () => {
    clearRecoverySessionSnapshot()
    writeRecoverySessionSnapshot('42')

    function RecoveryLaterHarness() {
      const [recoveryResumePrompt, setRecoveryResumePrompt] = React.useState<{
        save: SavedGameSummary
        interruptedAt: number
      } | null>(null)
      const [deferredRecoverySaveId, setDeferredRecoverySaveId] = React.useState<string | null>(null)
      const savedGames = React.useMemo(() => [createSavedGame('42', '2026-04-11T10:30:00.000Z')], [])

      React.useEffect(() => {
        if (recoveryResumePrompt) {
          return
        }

        const recoverySnapshot = readRecoverySessionSnapshot()
        if (!recoverySnapshot || deferredRecoverySaveId === recoverySnapshot.saveId) {
          return
        }

        const matchingSave = savedGames.find((entry) => entry.id === recoverySnapshot.saveId)
        if (!matchingSave) {
          return
        }

        setRecoveryResumePrompt({
          save: matchingSave,
          interruptedAt: recoverySnapshot.interruptedAt,
        })
      }, [deferredRecoverySaveId, recoveryResumePrompt, savedGames])

      if (!recoveryResumePrompt) {
        return <div>Kein Recovery-Dialog</div>
      }

      return (
        <AnimatePresence>
          <RecoveryResumeDialog
            save={recoveryResumePrompt.save}
            interruptedAt={recoveryResumePrompt.interruptedAt}
            onDismiss={() => {
              setDeferredRecoverySaveId(recoveryResumePrompt.save.id)
              setRecoveryResumePrompt(null)
            }}
            onDecline={vi.fn()}
            onResume={vi.fn()}
          />
        </AnimatePresence>
      )
    }

    const firstRender = render(<RecoveryLaterHarness />)

    fireEvent.click(await screen.findByRole('button', { name: 'Spaeter' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Unterbrochene Runde gefunden' })).toBeNull()
      expect(screen.getByText('Kein Recovery-Dialog')).toBeTruthy()
    })

    firstRender.unmount()

    render(<RecoveryLaterHarness />)

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Unterbrochene Runde gefunden' })).toBeTruthy()
    })
  })

  it('shows a status hint when recovery resume is declined', async () => {
    function RecoveryDeclineToastHarness() {
      const [recoveryResumePrompt, setRecoveryResumePrompt] = React.useState<{
        save: SavedGameSummary
        interruptedAt: number
      } | null>({
        save: createSavedGame('42', '2026-04-11T10:30:00.000Z'),
        interruptedAt: Date.parse('2026-04-11T10:35:00.000Z'),
      })
      const [toast, setToast] = React.useState<{ id: number; message: string } | null>(null)
      const toastIdRef = React.useRef(0)

      const showToast = React.useCallback((message: string) => {
        toastIdRef.current += 1
        setToast({
          id: toastIdRef.current,
          message,
        })
      }, [])

      return (
        <>
          <AnimatePresence>
            {recoveryResumePrompt && (
              <RecoveryResumeDialog
                save={recoveryResumePrompt.save}
                interruptedAt={recoveryResumePrompt.interruptedAt}
                onDismiss={vi.fn()}
                onDecline={() => {
                  setRecoveryResumePrompt(null)
                  showToast('Nicht fortgesetzt. Der Spielstand bleibt unter Spielstaende erhalten.')
                }}
                onResume={vi.fn()}
              />
            )}
          </AnimatePresence>
          <StatusToast
            toast={toast}
            onDismiss={(toastId) => {
              setToast((currentToast) => (
                currentToast?.id === toastId ? null : currentToast
              ))
            }}
          />
        </>
      )
    }

    render(<RecoveryDeclineToastHarness />)

    fireEvent.click(await screen.findByRole('button', { name: 'Nicht fortsetzen' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Unterbrochene Runde gefunden' })).toBeNull()
    })

    const status = await screen.findByRole('status')
    expect(within(status).getByText('Nicht fortgesetzt. Der Spielstand bleibt unter Spielstaende erhalten.')).toBeTruthy()
  })

  it('offers a start-screen action for resuming the last session', async () => {
    const onResumeSession = vi.fn()

    render(
      <StartScreen
        onStart={vi.fn()}
        onResumeSession={onResumeSession}
        onQuit={vi.fn()}
        onOpenHelp={vi.fn()}
        quitHint={null}
        heroImage={null}
        registerAppContextMenuHandler={vi.fn()}
        resumeActionLabel="Letzte Sitzung fortsetzen"
        resumeActionDetail="Statistik zuletzt geoeffnet."
        savedGamesCount={3}
        solvedCount={12}
        galleryCount={8}
      />
    )

    const resumeButton = await screen.findByRole('button', { name: 'Letzte Sitzung fortsetzen' })

    await waitFor(() => {
      expect(document.activeElement).toBe(resumeButton)
    })

    expect(screen.getByText('Statistik zuletzt geoeffnet.')).toBeTruthy()

    fireEvent.click(resumeButton)
    expect(onResumeSession).toHaveBeenCalledTimes(1)
  })

  it('announces statistics section toggles in the live region', () => {
    render(
      <>
        <AccessibilityAnnouncerHost />
        <UploadStatsSection
          id="announce-stats"
          kicker="Abschnitt"
          title="Testabschnitt"
          copy="Testinhalt"
          collapsible
          defaultOpen={false}
        >
          <div>Inhalt</div>
        </UploadStatsSection>
      </>
    )

    const summaryButton = screen.getByRole('button', { name: /Testabschnitt/i })
    fireEvent.click(summaryButton)

    expect(screen.getByTestId('accessibility-announcer-polite').textContent).toContain('Testabschnitt aufgeklappt.')
  })

  it('announces help, filters and sorting changes in the live region', () => {
    function HelpAnnouncementHarness() {
      const announceAccessibility = useAccessibilityAnnouncer()

      return (
        <button
          type="button"
          onClick={() => {
            announceAccessibility(`Hilfe geoeffnet: ${getHelpView('upload-stats').kicker}.`)
          }}
        >
          Hilfe oeffnen
        </button>
      )
    }

    const completionHistory = [
      createCompletionRecord('1', '2026-04-10T10:00:00.000Z'),
      createCompletionRecord('2', '2026-04-11T10:00:00.000Z'),
    ]

    render(
      <>
        <AccessibilityAnnouncerHost />
        <HelpAnnouncementHarness />
        <UploadStatsHistorySection
          isLoadingStats={false}
          completionHistory={completionHistory}
          filteredHistory={completionHistory}
          historyFilter="all"
          historyFilterOptions={[
            { id: 'all', label: 'Alle Siege' },
            { id: '4x4', label: 'Normal 4x4' },
          ]}
          standardDifficultyStats={[]}
          onHistoryFilterChange={vi.fn()}
          onReloadView={vi.fn()}
          onBackToStart={vi.fn()}
        />
      </>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Hilfe oeffnen' }))
    expect(screen.getByTestId('accessibility-announcer-polite').textContent).toContain('Hilfe geoeffnet: Statistik.')

    fireEvent.click(screen.getByRole('button', { name: 'Normal 4x4' }))
    expect(screen.getByTestId('accessibility-announcer-polite').textContent).toContain('Verlauffilter: Normal 4x4.')

    fireEvent.click(screen.getByRole('button', { name: /Datum/i }))
    expect(screen.getByTestId('accessibility-announcer-polite').textContent).toContain(
      'Verlauf sortiert nach Datum, aufsteigend.'
    )
  })

  it('moves through save actions with arrows, Pos1 and Ende', () => {
    const saves = [
      createSavedGame('1', '2026-04-11T10:00:00.000Z'),
      createSavedGame('2', '2026-04-11T11:00:00.000Z'),
    ]

    const { container } = render(
      <UploadSavedGamesPanel
        isLoadingSavedGames={false}
        savedGames={saves}
        savedGamesCount={saves.length}
        loadingSaveId={null}
        deletingSaveId={null}
        isDeletingAllSavedGames={false}
        onLoadSave={vi.fn()}
        onDeleteRequest={vi.fn()}
        onDeleteAllRequest={vi.fn()}
      />
    )

    const saveItems = Array.from(container.querySelectorAll<HTMLElement>('.saved-game-item'))
    const firstLoadButton = within(saveItems[0]!).getByRole('button', { name: 'Weiterspielen' })
    const firstDeleteButton = within(saveItems[0]!).getByRole('button', { name: 'Loeschen' })
    const secondDeleteButton = within(saveItems[1]!).getByRole('button', { name: 'Loeschen' })

    firstLoadButton.focus()
    fireEvent.keyDown(firstLoadButton, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(firstDeleteButton)

    fireEvent.keyDown(firstDeleteButton, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(secondDeleteButton)

    fireEvent.keyDown(secondDeleteButton, { key: 'Home' })
    expect(document.activeElement).toBe(firstDeleteButton)

    fireEvent.keyDown(firstDeleteButton, { key: 'End' })
    expect(document.activeElement).toBe(secondDeleteButton)
  })

  it('moves through upload cards and workspace launchers with arrows, Pos1 and Ende', () => {
    const fileInputRef = {
      current: document.createElement('input'),
    } as React.RefObject<HTMLInputElement>

    render(
      <>
        <UploadMenuCards
          fileInputRef={fileInputRef}
          isDragActive={false}
          isFetchingRandom={false}
          isGeneratingPromptImage={false}
          promptValue=""
          onFetchRandomImage={vi.fn()}
          onPromptValueChange={vi.fn()}
          onGeneratePromptImage={vi.fn()}
        />
        <UploadWorkspaceLauncher
          savedGamesCount={2}
          totalSolved={8}
          activeDays={3}
          galleryEntriesCount={5}
          gallerySolveCount={7}
          latestActivityAt="2026-04-11T10:00:00.000Z"
          latestGalleryAt="2026-04-11T11:00:00.000Z"
          isLoadingSavedGames={false}
          isLoadingStats={false}
          isLoadingGallery={false}
          onOpenSavedGames={vi.fn()}
          onOpenStats={vi.fn()}
          onOpenGallery={vi.fn()}
        />
      </>
    )

    const uploadButton = screen.getByRole('button', { name: /Foto hochladen/i })
    const randomButton = screen.getByRole('button', { name: /Zufaelliges Bild/i })
    const savedGamesButton = screen.getByRole('button', { name: /Spielstaende/i })
    const statsButton = screen.getByRole('button', { name: /Statistik/i })
    const galleryButton = screen.getByRole('button', { name: /Galerie/i })

    mockElementRect(uploadButton, { left: 0, top: 0, width: 220, height: 180 })
    mockElementRect(randomButton, { left: 260, top: 0, width: 220, height: 180 })
    mockElementRect(savedGamesButton, { left: 0, top: 260, width: 220, height: 180 })
    mockElementRect(statsButton, { left: 260, top: 260, width: 220, height: 180 })
    mockElementRect(galleryButton, { left: 520, top: 260, width: 220, height: 180 })

    uploadButton.focus()
    fireEvent.keyDown(uploadButton, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(randomButton)

    savedGamesButton.focus()
    fireEvent.keyDown(savedGamesButton, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(statsButton)

    fireEvent.keyDown(statsButton, { key: 'End' })
    expect(document.activeElement).toBe(galleryButton)

    fireEvent.keyDown(galleryButton, { key: 'Home' })
    expect(document.activeElement).toBe(savedGamesButton)
  })

  it('submits the prompt image field with Enter and keeps Shift+Enter for line breaks', () => {
    const fileInputRef = {
      current: document.createElement('input'),
    } as React.RefObject<HTMLInputElement>
    const onGeneratePromptImage = vi.fn()

    render(
      <UploadMenuCards
        fileInputRef={fileInputRef}
        isDragActive={false}
        isFetchingRandom={false}
        isGeneratingPromptImage={false}
        promptValue="Leuchtende Berglandschaft"
        onFetchRandomImage={vi.fn()}
        onPromptValueChange={vi.fn()}
        onGeneratePromptImage={onGeneratePromptImage}
      />
    )

    const promptInput = screen.getByLabelText(/Bild per Prompt/i)

    fireEvent.keyDown(promptInput, { key: 'Enter' })
    expect(onGeneratePromptImage).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(promptInput, { key: 'Enter', shiftKey: true })
    expect(onGeneratePromptImage).toHaveBeenCalledTimes(1)
  })

  it('focuses workspace navigation cards and jumps to the first navigation item with V', async () => {
    const sharedProps = {
      savedGames: [] as SavedGameSummary[],
      savedGamesCount: 0,
      loadingSaveId: null,
      deletingSaveId: null,
      isDeletingAllSavedGames: false,
      completionHistory: [] as PuzzleCompletionRecord[],
      filteredHistory: [] as PuzzleCompletionRecord[],
      historyFilter: 'all' as const,
      historyFilterOptions: [],
      topStats: [],
      latestCompletion: null,
      favoriteDifficulty: null,
      fastestDifficulty: null,
      stats: null,
      gallery: null,
      isLoadingStats: false,
      isResettingStats: false,
      isLoadingSavedGames: false,
      isLoadingGallery: false,
      isResettingGallery: false,
      hasRecordedStats: false,
      onWindowChange: vi.fn(),
      onHistoryFilterChange: vi.fn(),
      onRequestStatsReset: vi.fn(),
      onRequestGalleryReset: vi.fn(),
      onReplayGalleryEntry: vi.fn(),
      onDeleteGalleryEntries: vi.fn(() => Promise.resolve()),
      onLoadSave: vi.fn(),
      onDeleteRequest: vi.fn(),
      onDeleteAllRequest: vi.fn(),
    }

    const { rerender } = render(
      <UploadDashboard
        {...sharedProps}
        activeWindow="savedGames"
      />
    )

    await waitFor(() => {
      const workspaceNavigation = screen.getByRole('navigation', { name: 'Bereiche wechseln' })
      expect(document.activeElement).toBe(within(workspaceNavigation).getByRole('button', { name: /Spielstaende/i }))
    })

    rerender(
      <UploadDashboard
        {...sharedProps}
        activeWindow="stats"
      />
    )

    await waitFor(() => {
      const workspaceNavigation = screen.getByRole('navigation', { name: 'Bereiche wechseln' })
      expect(document.activeElement).toBe(within(workspaceNavigation).getByRole('button', { name: /Statistik/i }))
    })

    rerender(
      <UploadDashboard
        {...sharedProps}
        activeWindow="gallery"
      />
    )

    await waitFor(() => {
      const workspaceNavigation = screen.getByRole('navigation', { name: 'Bereiche wechseln' })
      expect(document.activeElement).toBe(within(workspaceNavigation).getByRole('button', { name: /Galerie/i }))
    })

    const workspaceNavigation = screen.getByRole('navigation', { name: 'Bereiche wechseln' })
    expect(workspaceNavigation.getAttribute('aria-keyshortcuts')).toBe('V')

    fireEvent.keyDown(window, { key: 'v' })
    expect(document.activeElement).toBe(within(workspaceNavigation).getByRole('button', { name: /Spielstaende/i }))
  })

  it('moves through workspace header actions with arrows, Pos1 and Ende', async () => {
    render(
      <UploadDashboard
        activeWindow="gallery"
        savedGames={[]}
        savedGamesCount={0}
        loadingSaveId={null}
        deletingSaveId={null}
        isDeletingAllSavedGames={false}
        completionHistory={[]}
        filteredHistory={[]}
        historyFilter="all"
        historyFilterOptions={[]}
        topStats={[]}
        latestCompletion={null}
        favoriteDifficulty={null}
        fastestDifficulty={null}
        stats={null}
        gallery={createSolvedGallery('1', '2026-04-11T10:00:00.000Z')}
        isLoadingStats={false}
        isResettingStats={false}
        isLoadingSavedGames={false}
        isLoadingGallery={false}
        isResettingGallery={false}
        hasRecordedStats={false}
        onWindowChange={vi.fn()}
        onHistoryFilterChange={vi.fn()}
        onRequestStatsReset={vi.fn()}
        onRequestGalleryReset={vi.fn()}
        onReplayGalleryEntry={vi.fn()}
        onDeleteGalleryEntries={vi.fn(() => Promise.resolve())}
        onLoadSave={vi.fn()}
        onDeleteRequest={vi.fn()}
        onDeleteAllRequest={vi.fn()}
      />
    )

    const resetButton = await screen.findByRole('button', { name: 'Galerie loeschen' })
    const startButton = screen.getByRole('button', { name: 'Auswahl' })

    mockElementRect(resetButton, { left: 0, top: 0, width: 180, height: 44 })
    mockElementRect(startButton, { left: 220, top: 0, width: 180, height: 44 })

    resetButton.focus()
    fireEvent.keyDown(resetButton, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(startButton)

    fireEvent.keyDown(startButton, { key: 'Home' })
    expect(document.activeElement).toBe(resetButton)

    fireEvent.keyDown(resetButton, { key: 'End' })
    expect(document.activeElement).toBe(startButton)
  })

  it('returns focus to the gallery difficulty filter after resetting active toolbar criteria', async () => {
    render(
      <div className="workspace-window-shell is-gallery">
        <button type="button" className="workspace-window-nav-button" aria-current="page">
          Galerie
        </button>
        <UploadGalleryPanel
          gallery={createDistinctSolvedGallery([
            { id: '1', completedAt: '2026-04-11T12:00:00.000Z', rows: 4, cols: 4 },
            { id: '2', completedAt: '2026-04-11T11:00:00.000Z', rows: 5, cols: 5 },
          ])}
          isLoadingGallery={false}
          onReplayEntry={vi.fn()}
          onDeleteEntries={vi.fn(() => Promise.resolve())}
          titleId="gallery-panel-title"
          panelRole="region"
        />
      </div>
    )

    const assistanceSelect = screen.getByRole('combobox', { name: 'Laufart' })
    fireEvent.change(assistanceSelect, { target: { value: 'hinted' } })

    const resetButton = await screen.findByRole('button', { name: 'Zuruecksetzen' })
    resetButton.focus()
    fireEvent.click(resetButton)

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Schwierigkeit' }))
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Zuruecksetzen' }).disabled).toBe(true)
    })
  })

  it('toggles multiple gallery tag chips as AND filters', async () => {
    const galleryEntries: SolvedGalleryEntry[] = [
      {
        ...createSolvedGalleryEntry('1', '2026-04-11T12:00:00.000Z'),
        previewImage: 'data:image/png;base64,preview-1',
        sourceImage: 'data:image/png;base64,source-1',
        tags: [
          { label: 'Stadt', confidence: 0.91, source: 'gemini' },
          { label: 'Nacht', confidence: 0.86, source: 'gemini' },
        ],
      },
      {
        ...createSolvedGalleryEntry('2', '2026-04-11T11:00:00.000Z'),
        previewImage: 'data:image/png;base64,preview-2',
        sourceImage: 'data:image/png;base64,source-2',
        tags: [{ label: 'Stadt', confidence: 0.88, source: 'gemini' }],
      },
      {
        ...createSolvedGalleryEntry('3', '2026-04-11T10:00:00.000Z'),
        previewImage: 'data:image/png;base64,preview-3',
        sourceImage: 'data:image/png;base64,source-3',
        tags: [{ label: 'Wald', confidence: 0.82, source: 'gemini' }],
      },
    ]

    render(
      <div className="workspace-window-shell is-gallery">
        <button type="button" className="workspace-window-nav-button" aria-current="page">
          Galerie
        </button>
        <UploadGalleryPanel
          gallery={{
            entries: galleryEntries,
            totalEntries: galleryEntries.length,
            lastCompletedAt: galleryEntries[0].completedAt,
            lastUpdatedAt: galleryEntries[0].completedAt,
          }}
          isLoadingGallery={false}
          onReplayEntry={vi.fn()}
          onDeleteEntries={vi.fn(() => Promise.resolve())}
          titleId="gallery-panel-title"
          panelRole="region"
        />
      </div>
    )

    expect(screen.getByText('3 von 3 Motiven sichtbar')).not.toBeNull()
    expect(screen.queryByLabelText('KI-Tags als UND-Filter')).toBeNull()

    fireEvent.click(screen.getAllByRole('button', { name: '#Stadt' })[0]!)
    const stadtChip = () => screen.getByRole('button', { name: /Tag #Stadt/ })
    const nachtChip = () => screen.getByRole('button', { name: /Tag #Nacht/ })
    await waitFor(() => {
      expect(screen.getByLabelText('KI-Tags als UND-Filter')).not.toBeNull()
      expect(stadtChip().getAttribute('aria-pressed')).toBe('true')
      expect(screen.getByText('2 von 3 Motiven sichtbar')).not.toBeNull()
    })
    expect(screen.queryByRole('button', { name: /Tag #Wald/ })).toBeNull()

    fireEvent.click(nachtChip())
    await waitFor(() => {
      expect(nachtChip().getAttribute('aria-pressed')).toBe('true')
      expect(screen.getByText('1 von 3 Motiven sichtbar')).not.toBeNull()
    })

    fireEvent.click(stadtChip())
    await waitFor(() => {
      expect(stadtChip().getAttribute('aria-pressed')).toBe('false')
      expect(nachtChip().getAttribute('aria-pressed')).toBe('true')
      expect(screen.getByText('1 von 3 Motiven sichtbar')).not.toBeNull()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Tags zuruecksetzen' }))
    await waitFor(() => {
      expect(screen.queryByLabelText('KI-Tags als UND-Filter')).toBeNull()
      expect(screen.getByText('3 von 3 Motiven sichtbar')).not.toBeNull()
    })
  })

  it('starts a tagged online motif from gallery details without filtering back to the gallery', async () => {
    const onFetchRandomImage = vi.fn()
    const galleryEntries = [
      {
        ...createSolvedGalleryEntry('1', '2026-04-11T12:00:00.000Z'),
        previewImage: 'data:image/png;base64,preview-1',
        sourceImage: 'data:image/png;base64,source-1',
        tags: [{ label: 'Stadt', confidence: 0.91, source: 'gemini' as const }],
      },
      {
        ...createSolvedGalleryEntry('2', '2026-04-11T11:00:00.000Z'),
        previewImage: 'data:image/png;base64,preview-2',
        sourceImage: 'data:image/png;base64,source-2',
        tags: [{ label: 'Wald', confidence: 0.88, source: 'gemini' as const }],
      },
    ]

    render(
      <div className="workspace-window-shell is-gallery">
        <button type="button" className="workspace-window-nav-button" aria-current="page">
          Galerie
        </button>
        <UploadGalleryPanel
          gallery={{
            entries: galleryEntries,
            totalEntries: galleryEntries.length,
            lastCompletedAt: galleryEntries[0].completedAt,
            lastUpdatedAt: galleryEntries[0].completedAt,
          }}
          isLoadingGallery={false}
          onReplayEntry={vi.fn()}
          onFetchRandomImage={onFetchRandomImage}
          onDeleteEntries={vi.fn(() => Promise.resolve())}
          titleId="gallery-panel-title"
          panelRole="region"
        />
      </div>
    )

    expect(screen.getByText('2 von 2 Motiven sichtbar')).not.toBeNull()

    fireEvent.click(screen.getAllByRole('button', { name: /Details zu Normal 4x4 vom/i })[0]!)
    const tagSearchButton = await screen.findByRole('button', { name: 'Neues Online-Motiv zu Stadt suchen' })
    expect(within(tagSearchButton).getByText('Online')).not.toBeNull()
    fireEvent.click(tagSearchButton)

    expect(onFetchRandomImage).toHaveBeenCalledWith('Stadt')
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Neues Online-Motiv zu Stadt suchen' })).toBeNull()
      expect(screen.getByText('2 von 2 Motiven sichtbar')).not.toBeNull()
    })
  })

  it('moves through statistics jump and footer actions with arrows, Pos1 and Ende', () => {
    const completionResult = createCompletionResult()

    render(
      <UploadStatsComparisonMatrix
        stats={completionResult.stats}
        latestCompletion={completionResult.completion}
        favoriteDifficulty={completionResult.difficultyStats}
        fastestDifficulty={completionResult.difficultyStats}
        completionHistory={[completionResult.completion]}
        standardDifficultyStats={[]}
        onReloadView={vi.fn()}
        onBackToStart={vi.fn()}
      />
    )

    const detailsButton = screen.getByRole('button', { name: 'Detailtabelle' })
    const historyButton = screen.getByRole('button', { name: 'Verlaufstabelle' })
    const pageTopButton = screen.getByRole('button', { name: 'Zum Seitenanfang' })
    const startButton = screen.getByRole('button', { name: 'Zur Auswahl' })

    mockElementRect(detailsButton, { left: 0, top: 0, width: 160, height: 40 })
    mockElementRect(historyButton, { left: 200, top: 0, width: 160, height: 40 })
    mockElementRect(pageTopButton, { left: 0, top: 120, width: 180, height: 40 })
    mockElementRect(startButton, { left: 220, top: 120, width: 200, height: 40 })

    detailsButton.focus()
    fireEvent.keyDown(detailsButton, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(historyButton)

    fireEvent.keyDown(historyButton, { key: 'Home' })
    expect(document.activeElement).toBe(detailsButton)

    pageTopButton.focus()
    fireEvent.keyDown(pageTopButton, { key: 'End' })
    expect(document.activeElement).toBe(startButton)

    fireEvent.keyDown(startButton, { key: 'Home' })
    expect(document.activeElement).toBe(pageTopButton)
  })

  it('does not let the statistics End handler override header, jump or footer rows', async () => {
    const completionResult = createCompletionResult()

    render(
      <UploadDashboard
        activeWindow="stats"
        savedGames={[]}
        savedGamesCount={0}
        loadingSaveId={null}
        deletingSaveId={null}
        isDeletingAllSavedGames={false}
        completionHistory={[completionResult.completion]}
        filteredHistory={[completionResult.completion]}
        historyFilter="all"
        historyFilterOptions={[
          { id: 'all', label: 'Alle Siege' },
          { id: '4x4', label: 'Normal 4x4' },
        ]}
        topStats={[]}
        latestCompletion={completionResult.completion}
        favoriteDifficulty={completionResult.difficultyStats}
        fastestDifficulty={completionResult.difficultyStats}
        stats={completionResult.stats}
        gallery={createSolvedGallery('1', '2026-04-11T10:00:00.000Z')}
        isLoadingStats={false}
        isResettingStats={false}
        isLoadingSavedGames={false}
        isLoadingGallery={false}
        isResettingGallery={false}
        hasRecordedStats
        onWindowChange={vi.fn()}
        onHistoryFilterChange={vi.fn()}
        onRequestStatsReset={vi.fn()}
        onRequestGalleryReset={vi.fn()}
        onReplayGalleryEntry={vi.fn()}
        onDeleteGalleryEntries={vi.fn(() => Promise.resolve())}
        onLoadSave={vi.fn()}
        onDeleteRequest={vi.fn()}
        onDeleteAllRequest={vi.fn()}
      />
    )

    const resetButton = await screen.findByRole('button', { name: 'Statistik loeschen' })
    const headerStartButton = screen.getByRole('button', { name: 'Auswahl' })

    resetButton.focus()
    fireEvent.keyDown(resetButton, { key: 'End' })
    expect(document.activeElement).toBe(headerStartButton)

    fireEvent.click(screen.getByRole('tab', { name: 'Rohdaten' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Expertenmatrix' }))

    const detailsButton = screen.getByRole('button', { name: 'Detailtabelle' })
    const comparisonSection = detailsButton.closest<HTMLElement>('.stats-report-section, .stats-report-section-collapsible')
    expect(comparisonSection).toBeTruthy()

    const historyJumpButton = within(comparisonSection!).getByRole('button', { name: 'Verlaufstabelle' })
    const pageTopButton = within(comparisonSection!).getByRole('button', { name: 'Zum Seitenanfang' })
    const footerStartButton = within(comparisonSection!).getByRole('button', { name: 'Zur Auswahl' })
    const summaryButtons = Array.from(document.body.querySelectorAll<HTMLButtonElement>('.stats-report-section-summary'))
    const historySectionSummary = summaryButtons[summaryButtons.length - 1]
    expect(historySectionSummary).toBeTruthy()

    detailsButton.focus()
    fireEvent.keyDown(detailsButton, { key: 'End' })
    expect(document.activeElement).toBe(historyJumpButton)
    expect(document.activeElement).not.toBe(historySectionSummary)

    pageTopButton.focus()
    fireEvent.keyDown(pageTopButton, { key: 'End' })
    expect(document.activeElement).toBe(footerStartButton)
    expect(document.activeElement).not.toBe(historySectionSummary)
  })

  it('moves through gallery actions within and across cards', () => {
    const firstEntry = createGalleryDisplayEntry('1', '2026-04-11T10:00:00.000Z')
    const secondEntry = createGalleryDisplayEntry('2', '2026-04-11T11:00:00.000Z')

    const { container } = render(
      <div className="gallery-grid">
        <UploadGalleryCard
          entry={firstEntry}
          onOpenDetails={vi.fn()}
          onDeleteEntry={vi.fn()}
          isDeleting={false}
        />
        <UploadGalleryCard
          entry={secondEntry}
          onOpenDetails={vi.fn()}
          onDeleteEntry={vi.fn()}
          isDeleting={false}
        />
      </div>
    )

    const galleryCards = Array.from(container.querySelectorAll<HTMLElement>('.gallery-card'))
    const firstPreviewButton = within(galleryCards[0]!).getByRole('button', {
      name: /^details zu normal 4x4 vom/i,
    })
    const firstDetailsActionButton = within(galleryCards[0]!).getByRole('button', {
      name: /spielen und details zu normal 4x4 vom/i,
    })
    const secondDetailsActionButton = within(galleryCards[1]!).getByRole('button', {
      name: /spielen und details zu normal 4x4 vom/i,
    })
    const secondPreviewButton = within(galleryCards[1]!).getByRole('button', {
      name: /^details zu normal 4x4 vom/i,
    })

    firstPreviewButton.focus()
    fireEvent.keyDown(firstPreviewButton, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(firstDetailsActionButton)

    fireEvent.keyDown(firstDetailsActionButton, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(firstPreviewButton)

    secondDetailsActionButton.focus()
    fireEvent.keyDown(secondDetailsActionButton, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(secondPreviewButton)

    fireEvent.keyDown(secondPreviewButton, { key: 'Home' })
    expect(document.activeElement).toBe(firstPreviewButton)

    fireEvent.keyDown(firstPreviewButton, { key: 'End' })
    expect(document.activeElement).toBe(secondPreviewButton)
  })

  it('moves through gallery card tag buttons with the same action navigation', () => {
    const entry = createGalleryDisplayEntry('1', '2026-04-11T10:00:00.000Z')
    entry.representativeEntry.tags = [
      { label: 'Stadt', confidence: 0.94, source: 'gemini' },
      { label: 'Nacht', confidence: 0.88, source: 'gemini' },
    ]

    render(
      <div className="gallery-grid">
        <UploadGalleryCard
          entry={entry}
          onOpenDetails={vi.fn()}
          onTagFilter={vi.fn()}
          onDeleteEntry={vi.fn()}
          isDeleting={false}
        />
      </div>
    )

    const stadtTagButton = screen.getByRole('button', { name: '#Stadt' })
    const nachtTagButton = screen.getByRole('button', { name: '#Nacht' })
    const detailsButton = screen.getByRole('button', {
      name: /spielen und details zu normal 4x4 vom/i,
    })

    stadtTagButton.focus()
    fireEvent.keyDown(stadtTagButton, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(nachtTagButton)

    fireEvent.keyDown(nachtTagButton, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(detailsButton)

    fireEvent.keyDown(detailsButton, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(nachtTagButton)

    fireEvent.keyDown(nachtTagButton, { key: 'Home' })
    expect(document.activeElement).toBe(stadtTagButton)
  })

  it('moves through gallery actions by the visible card grid', () => {
    const firstEntry = createGalleryDisplayEntry('1', '2026-04-11T10:00:00.000Z')
    const secondEntry = createGalleryDisplayEntry('2', '2026-04-11T11:00:00.000Z')
    const thirdEntry = createGalleryDisplayEntry('3', '2026-04-11T12:00:00.000Z')
    const fourthEntry = createGalleryDisplayEntry('4', '2026-04-11T13:00:00.000Z')

    const { container } = render(
      <div className="gallery-grid">
        <UploadGalleryCard
          entry={firstEntry}
          onOpenDetails={vi.fn()}
          onDeleteEntry={vi.fn()}
          isDeleting={false}
        />
        <UploadGalleryCard
          entry={secondEntry}
          onOpenDetails={vi.fn()}
          onDeleteEntry={vi.fn()}
          isDeleting={false}
        />
        <UploadGalleryCard
          entry={thirdEntry}
          onOpenDetails={vi.fn()}
          onDeleteEntry={vi.fn()}
          isDeleting={false}
        />
        <UploadGalleryCard
          entry={fourthEntry}
          onOpenDetails={vi.fn()}
          onDeleteEntry={vi.fn()}
          isDeleting={false}
        />
      </div>
    )

    const galleryCards = Array.from(container.querySelectorAll<HTMLElement>('.gallery-card'))
    const firstPreviewButton = within(galleryCards[0]!).getByRole('button', {
      name: /^details zu normal 4x4 vom/i,
    })
    const secondPreviewButton = within(galleryCards[1]!).getByRole('button', {
      name: /^details zu normal 4x4 vom/i,
    })
    const thirdPreviewButton = within(galleryCards[2]!).getByRole('button', {
      name: /^details zu normal 4x4 vom/i,
    })
    const fourthPreviewButton = within(galleryCards[3]!).getByRole('button', {
      name: /^details zu normal 4x4 vom/i,
    })
    const firstDetailsButton = within(galleryCards[0]!).getByRole('button', { name: /spielen und details zu normal 4x4 vom/i })
    const secondDetailsButton = within(galleryCards[1]!).getByRole('button', { name: /spielen und details zu normal 4x4 vom/i })
    const thirdDetailsButton = within(galleryCards[2]!).getByRole('button', { name: /spielen und details zu normal 4x4 vom/i })
    const fourthDetailsButton = within(galleryCards[3]!).getByRole('button', { name: /spielen und details zu normal 4x4 vom/i })

    mockElementRect(firstPreviewButton, { left: 0, top: 0, width: 180, height: 120 })
    mockElementRect(secondPreviewButton, { left: 220, top: 0, width: 180, height: 120 })
    mockElementRect(thirdPreviewButton, { left: 440, top: 0, width: 180, height: 120 })
    mockElementRect(fourthPreviewButton, { left: 0, top: 180, width: 180, height: 120 })
    mockElementRect(firstDetailsButton, { left: 0, top: 132, width: 100, height: 40 })
    mockElementRect(secondDetailsButton, { left: 220, top: 132, width: 100, height: 40 })
    mockElementRect(thirdDetailsButton, { left: 440, top: 132, width: 100, height: 40 })
    mockElementRect(fourthDetailsButton, { left: 0, top: 312, width: 100, height: 40 })

    firstPreviewButton.focus()
    fireEvent.keyDown(firstPreviewButton, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(fourthPreviewButton)

    fireEvent.keyDown(fourthPreviewButton, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(firstPreviewButton)

    firstDetailsButton.focus()
    fireEvent.keyDown(firstDetailsButton, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(fourthDetailsButton)

    secondDetailsButton.focus()
    fireEvent.keyDown(secondDetailsButton, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(secondDetailsButton)

    thirdDetailsButton.focus()
    fireEvent.keyDown(thirdDetailsButton, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(thirdDetailsButton)
  })

  it('keeps gallery cards to one replay action even when the motif has another strong replay target', () => {
    const entry = createGalleryDisplayEntry('7', '2026-04-11T10:00:00.000Z')
    const bestTimeEntry = {
      ...createSolvedGalleryEntry('8', '2026-04-11T09:00:00.000Z'),
      time: 80,
      moves: 18,
    }

    entry.motifReplaySummary = {
      ...entry.motifReplaySummary,
      allEntries: [entry.representativeEntry, bestTimeEntry],
      totalSolveCount: 2,
      replayableSolveCount: 2,
      bestTimeEntry,
      bestMovesEntry: bestTimeEntry,
    }

    render(
      <div className="gallery-grid">
        <UploadGalleryCard
          entry={entry}
          onOpenDetails={vi.fn()}
          onDeleteEntry={vi.fn()}
          isDeleting={false}
        />
      </div>
    )

    expect(screen.queryByRole('button', { name: /motivweiten schnellstart/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /bestzeit spielen/i })).toBeNull()
    expect(screen.getByRole('button', { name: /spielen und details zu normal 4x4 vom/i })).toBeTruthy()
    expect(screen.queryByText('+0:17 zur Bestzeit')).toBeNull()
  })

  it('keeps the whole gallery card in view when tab focus moves to the next action', () => {
    const firstEntry = createGalleryDisplayEntry('1', '2026-04-11T10:00:00.000Z')

    function GalleryKeyboardHarness() {
      const scopeRef = React.useRef<HTMLDivElement>(null)
      useButtonOnlyTabNavigation(scopeRef)

      return (
        <div ref={scopeRef} className="workspace-window-overlay" data-page-focus-root="true">
          <div className="gallery-grid">
            <UploadGalleryCard
              entry={firstEntry}
              onOpenDetails={vi.fn()}
              onDeleteEntry={vi.fn()}
              isDeleting={false}
            />
          </div>
        </div>
      )
    }

    const { container } = render(
      <GalleryKeyboardHarness />
    )

    const scrollRoot = container.querySelector<HTMLElement>('.workspace-window-overlay')!
    const scrollTo = mockScrollableContainer(scrollRoot, {
      top: 0,
      height: 320,
      scrollTop: 100,
      scrollHeight: 1200,
    })

    const galleryCard = container.querySelector<HTMLElement>('.gallery-card')!
    const previewButton = within(galleryCard).getByRole('button', {
      name: /^details zu normal 4x4 vom/i,
    })
    const replayButton = within(galleryCard).getByRole('button', {
      name: /spielen und details zu normal 4x4 vom/i,
    })
    const replayScrollIntoView = vi.fn()

    Object.defineProperty(replayButton, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: replayScrollIntoView,
    })

    mockElementRect(galleryCard, { left: 0, top: -20, width: 220, height: 300 })
    mockElementRect(previewButton, { left: 0, top: 0, width: 220, height: 180 })
    mockElementRect(replayButton, { left: 0, top: 220, width: 120, height: 40 })

    previewButton.focus()
    fireEvent.keyDown(previewButton, { key: 'Tab' })

    expect(document.activeElement).toBe(replayButton)
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 80, left: 0 }))
    expect(replayScrollIntoView).not.toHaveBeenCalled()
  })

  it('opens a gallery confirm dialog and restores focus on cancel', async () => {
    function GalleryDeleteFocusHarness() {
      const [gallery, setGallery] = React.useState(
        createDistinctSolvedGallery([
          { id: '1', completedAt: '2026-04-11T12:00:00.000Z', rows: 4, cols: 4 },
          { id: '2', completedAt: '2026-04-11T11:00:00.000Z', rows: 5, cols: 5 },
          { id: '3', completedAt: '2026-04-11T10:00:00.000Z', rows: 6, cols: 6 },
        ])
      )

      return (
        <div className="workspace-window-shell is-gallery">
          <button type="button" className="workspace-window-nav-button" aria-current="page">
            Galerie
          </button>
          <UploadGalleryPanel
            gallery={gallery}
            isLoadingGallery={false}
            onReplayEntry={vi.fn()}
            onDeleteEntries={async (entryIds) => {
              setGallery((current) => {
                const remainingEntries = current.entries.filter((entry) => !entryIds.includes(entry.id))
                return {
                  entries: remainingEntries,
                  totalEntries: remainingEntries.length,
                  lastCompletedAt: remainingEntries[0]?.completedAt ?? null,
                  lastUpdatedAt: remainingEntries[0]?.completedAt ?? null,
                }
              })
            }}
            titleId="gallery-panel-title"
            panelRole="region"
          />
        </div>
      )
    }

    const { container } = render(<GalleryDeleteFocusHarness />)
    const deleteButtons = () => Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[data-gallery-action="delete"]')
    )

    const firstDeleteButton = deleteButtons()[0]!
    firstDeleteButton.focus()
    fireEvent.click(firstDeleteButton)

    const dialog = await screen.findByRole('alertdialog')
    const cancelButton = within(dialog).getByRole('button', { name: 'Abbrechen' })

    expect(document.activeElement).toBe(cancelButton)

    fireEvent.click(cancelButton)

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).toBeNull()
      expect(document.activeElement).toBe(deleteButtons()[0])
    })
  })

  it('focuses the next gallery delete action after confirming the dialog', async () => {
    function GalleryDeleteFocusHarness() {
      const [gallery, setGallery] = React.useState(
        createDistinctSolvedGallery([
          { id: '1', completedAt: '2026-04-11T12:00:00.000Z', rows: 4, cols: 4 },
          { id: '2', completedAt: '2026-04-11T11:00:00.000Z', rows: 5, cols: 5 },
          { id: '3', completedAt: '2026-04-11T10:00:00.000Z', rows: 6, cols: 6 },
        ])
      )

      return (
        <div className="workspace-window-shell is-gallery">
          <button type="button" className="workspace-window-nav-button" aria-current="page">
            Galerie
          </button>
          <UploadGalleryPanel
            gallery={gallery}
            isLoadingGallery={false}
            onReplayEntry={vi.fn()}
            onDeleteEntries={async (entryIds) => {
              setGallery((current) => {
                const remainingEntries = current.entries.filter((entry) => !entryIds.includes(entry.id))
                return {
                  entries: remainingEntries,
                  totalEntries: remainingEntries.length,
                  lastCompletedAt: remainingEntries[0]?.completedAt ?? null,
                  lastUpdatedAt: remainingEntries[0]?.completedAt ?? null,
                }
              })
            }}
            titleId="gallery-panel-title"
            panelRole="region"
          />
        </div>
      )
    }

    const { container } = render(<GalleryDeleteFocusHarness />)
    const deleteButtons = () => Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[data-gallery-action="delete"]')
    )

    const firstDeleteButton = deleteButtons()[0]!
    firstDeleteButton.focus()
    fireEvent.click(firstDeleteButton)

    const dialog = await screen.findByRole('alertdialog')
    const confirmButton = within(dialog).getByRole('button', { name: 'Loeschen' })
    fireEvent.click(confirmButton)

    await waitFor(() => {
      const remainingDeleteButtons = deleteButtons()
      expect(remainingDeleteButtons).toHaveLength(2)
      expect(document.activeElement).toBe(remainingDeleteButtons[0])
    })
  })

  it('focuses the next saved game delete action after a save is removed', async () => {
    const firstSave = createSavedGame('1', '2026-04-11T10:00:00.000Z')
    const secondSave = createSavedGame('2', '2026-04-11T11:00:00.000Z')

    const { rerender, container } = render(
      <div className="workspace-window-shell">
        <button type="button" className="workspace-window-nav-button" aria-current="page">
          Spielstaende
        </button>
        <UploadSavedGamesPanel
          isLoadingSavedGames={false}
          savedGames={[firstSave, secondSave]}
          savedGamesCount={2}
          loadingSaveId={null}
          deletingSaveId="1"
          isDeletingAllSavedGames={false}
          onLoadSave={vi.fn()}
          onDeleteRequest={vi.fn()}
          onDeleteAllRequest={vi.fn()}
          titleId="saved-games-panel-title"
          panelRole="region"
        />
      </div>
    )

    const firstDeleteButton = container.querySelector<HTMLButtonElement>('button[data-save-id="1"][data-save-action="delete"]')!
    firstDeleteButton.focus()

    rerender(
      <div className="workspace-window-shell">
        <button type="button" className="workspace-window-nav-button" aria-current="page">
          Spielstaende
        </button>
        <UploadSavedGamesPanel
          isLoadingSavedGames={false}
          savedGames={[secondSave]}
          savedGamesCount={1}
          loadingSaveId={null}
          deletingSaveId={null}
          isDeletingAllSavedGames={false}
          onLoadSave={vi.fn()}
          onDeleteRequest={vi.fn()}
          onDeleteAllRequest={vi.fn()}
          titleId="saved-games-panel-title"
          panelRole="region"
        />
      </div>
    )

    await waitFor(() => {
      const secondDeleteButton = container.querySelector<HTMLButtonElement>('button[data-save-id="2"][data-save-action="delete"]')
      expect(document.activeElement).toBe(secondDeleteButton)
    })
  })

  it('moves through backup actions with arrows, Pos1 and Ende', async () => {
    const backups = [createBackup('backup-a.json'), createBackup('backup-b.json')]

    render(
      <UploadBackupBrowserDialog
        backups={backups}
        isLoading={false}
        deletingFileName={null}
        onClose={vi.fn()}
        onDeleteBackup={vi.fn()}
        onSelectBackup={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Schliessen' })).toBeTruthy()
    })

    const backupItems = Array.from(document.body.querySelectorAll<HTMLElement>('.backup-browser-item'))
    const firstDeleteButton = within(backupItems[0]!).getByRole('button', { name: 'Loeschen' })
    const firstSelectButton = within(backupItems[0]!).getByRole('button', { name: 'Auswaehlen' })
    const secondSelectButton = within(backupItems[1]!).getByRole('button', { name: 'Auswaehlen' })

    firstDeleteButton.focus()
    fireEvent.keyDown(firstDeleteButton, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(firstSelectButton)

    fireEvent.keyDown(firstSelectButton, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(secondSelectButton)

    fireEvent.keyDown(secondSelectButton, { key: 'Home' })
    expect(document.activeElement).toBe(firstSelectButton)

    fireEvent.keyDown(firstSelectButton, { key: 'End' })
    expect(document.activeElement).toBe(secondSelectButton)
  })

  it('focuses the safest action first in confirm dialogs and restores focus on close', async () => {
    function ConfirmDialogHarness() {
      const [isOpen, setIsOpen] = React.useState(false)

      return (
        <div>
          <button type="button" onClick={() => setIsOpen(true)}>
            Dialog oeffnen
          </button>
          {isOpen ? (
            <UploadConfirmDialog
              titleId="confirm-test-title"
              title="Wirklich loeschen?"
              description={<p>Dieser Schritt ist endgueltig.</p>}
              confirmLabel="Loeschen"
              busyLabel="Loesche ..."
              isBusy={false}
              onCancel={() => setIsOpen(false)}
              onConfirm={vi.fn()}
            />
          ) : null}
        </div>
      )
    }

    render(<ConfirmDialogHarness />)

    const opener = screen.getByRole('button', { name: 'Dialog oeffnen' })
    opener.focus()
    fireEvent.click(opener)

    const cancelButton = await screen.findByRole('button', { name: 'Abbrechen' })
    expect(document.activeElement).toBe(cancelButton)

    fireEvent.keyDown(cancelButton, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Loeschen' }))

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(cancelButton)

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(document.activeElement).toBe(opener)
    })
  })

  it('restores focus to a fallback target when the original opener disappears', async () => {
    function ConfirmDialogFallbackHarness() {
      const [isOpen, setIsOpen] = React.useState(false)
      const [showOpener, setShowOpener] = React.useState(true)
      const fallbackButtonRef = React.useRef<HTMLButtonElement>(null)

      return (
        <div>
          {showOpener ? (
            <button
              type="button"
              onClick={() => {
                setShowOpener(false)
                setIsOpen(true)
              }}
            >
              Dialog oeffnen
            </button>
          ) : (
            <button ref={fallbackButtonRef} type="button">
              Sicheres Ziel
            </button>
          )}
          {isOpen ? (
            <UploadConfirmDialog
              titleId="confirm-fallback-title"
              title="Wirklich ersetzen?"
              description={<p>Die urspruengliche Aktion ist nicht mehr sichtbar.</p>}
              confirmLabel="Ersetzen"
              busyLabel="Ersetze ..."
              isBusy={false}
              onCancel={() => setIsOpen(false)}
              onConfirm={vi.fn()}
              restoreFocusFallbackRef={fallbackButtonRef}
            />
          ) : null}
        </div>
      )
    }

    render(<ConfirmDialogFallbackHarness />)

    const opener = screen.getByRole('button', { name: 'Dialog oeffnen' })
    opener.focus()
    fireEvent.click(opener)

    const cancelButton = await screen.findByRole('button', { name: 'Abbrechen' })
    fireEvent.click(cancelButton)

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Sicheres Ziel' }))
    })
  })

  it('jumps to the primary page focus target with Strg+Pos1', () => {
    function PrimaryFocusShortcutHarness() {
      const scopeRef = React.useRef<HTMLDivElement>(null)
      useGlobalPrimaryFocusShortcut({ scopeRef })

      return (
        <div ref={scopeRef}>
          <div
            data-testid="page-root"
            data-page-focus-root="true"
            style={{ overflowY: 'auto', maxHeight: '220px' }}
          >
            <button type="button">Andere Aktion</button>
            <button type="button" data-page-primary-focus="true">
              Primaere Aktion
            </button>
          </div>
        </div>
      )
    }

    render(<PrimaryFocusShortcutHarness />)

    const focusRoot = screen.getByTestId('page-root')
    Object.defineProperty(focusRoot, 'scrollHeight', {
      configurable: true,
      value: 640,
    })
    Object.defineProperty(focusRoot, 'clientHeight', {
      configurable: true,
      value: 220,
    })
    Object.defineProperty(focusRoot, 'scrollTo', {
      configurable: true,
      writable: true,
      value: vi.fn((options?: ScrollToOptions | number, y?: number) => {
        if (typeof options === 'number') {
          focusRoot.scrollTop = y ?? 0
          return
        }

        focusRoot.scrollTop = options?.top ?? focusRoot.scrollTop
      }),
    })
    focusRoot.scrollTop = 180

    const otherButton = screen.getByRole('button', { name: 'Andere Aktion' })
    const primaryButton = screen.getByRole('button', { name: 'Primaere Aktion' })

    otherButton.focus()
    fireEvent.keyDown(window, { key: 'Home', ctrlKey: true })

    expect(document.activeElement).toBe(primaryButton)
    expect(focusRoot.scrollTop).toBe(0)
  })

  it('focuses the puzzle board with B even when a form control has focus', () => {
    const activePuzzleState: PuzzleState = {
      tiles: [],
      board: [],
      emptyIndex: 0,
      emptyRow: 0,
      emptyCol: 0,
      moveCount: 0,
      startTime: 0,
      isSolved: false,
      isAnimating: false,
      dragState: null,
    }

    function PuzzleBoardFocusShortcutHarness() {
      const boardRef = React.useRef<HTMLCanvasElement>(null)

      usePuzzleKeyboardShortcuts({
        isRestartConfirmOpen: false,
        isHelpOpen: false,
        puzzleState: activePuzzleState,
        isInteractionLocked: false,
        onFocusBoard: () => boardRef.current?.focus(),
        onQuit: vi.fn(),
        onTogglePreview: vi.fn(),
        onToggleGhostPreview: vi.fn(),
        onToggleHeatmapOverlay: vi.fn(),
        onShowTileNumbers: vi.fn(),
        onSuggestedMove: vi.fn(),
        onShowHint: vi.fn(),
        onRestart: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
      })

      return (
        <div>
          <label>
            Lautstaerke
            <input type="range" min="0" max="100" defaultValue="50" />
          </label>
          <canvas ref={boardRef} tabIndex={0} aria-label="Puzzlebrett" />
        </div>
      )
    }

    render(<PuzzleBoardFocusShortcutHarness />)

    const volumeSlider = screen.getByLabelText('Lautstaerke')
    const board = screen.getByLabelText('Puzzlebrett')

    volumeSlider.focus()
    fireEvent.keyDown(volumeSlider, { key: 'b' })

    expect(document.activeElement).toBe(board)
  })

  it('scrolls focused actions smoothly into view while tabbing even if they are only partly visible', () => {
    function TabNavigationHarness() {
      const scopeRef = React.useRef<HTMLDivElement>(null)
      useButtonOnlyTabNavigation(scopeRef)

      return (
        <div ref={scopeRef}>
          <div
            data-testid="scroll-root"
            data-page-focus-root="true"
            style={{ overflowY: 'auto', maxHeight: '160px' }}
          >
            <button type="button">Erste Aktion</button>
            <button type="button">Zweite Aktion</button>
          </div>
        </div>
      )
    }

    render(<TabNavigationHarness />)

    const scrollRoot = screen.getByTestId('scroll-root')
    Object.defineProperty(scrollRoot, 'clientHeight', {
      configurable: true,
      value: 160,
    })
    Object.defineProperty(scrollRoot, 'scrollHeight', {
      configurable: true,
      value: 420,
    })
    const scrollToSpy = vi.fn((options?: ScrollToOptions | number, y?: number) => {
      if (typeof options === 'number') {
        scrollRoot.scrollTop = y ?? 0
        return
      }

      scrollRoot.scrollTop = options?.top ?? scrollRoot.scrollTop
    })
    Object.defineProperty(scrollRoot, 'scrollTo', {
      configurable: true,
      writable: true,
      value: scrollToSpy,
    })

    const firstButton = screen.getByRole('button', { name: 'Erste Aktion' })
    const secondButton = screen.getByRole('button', { name: 'Zweite Aktion' })

    firstButton.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 120,
      bottom: 40,
      width: 120,
      height: 40,
      toJSON: () => ({}),
    })

    secondButton.getBoundingClientRect = () => ({
      x: 0,
      y: 130,
      top: 130,
      left: 0,
      right: 120,
      bottom: 170,
      width: 120,
      height: 40,
      toJSON: () => ({}),
    })

    scrollRoot.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 200,
      bottom: 160,
      width: 200,
      height: 160,
      toJSON: () => ({}),
    })

    firstButton.focus()
    fireEvent.keyDown(window, { key: 'Tab' })

    expect(document.activeElement).toBe(secondButton)
    expect(scrollRoot.scrollTop).toBe(130)
    expect(scrollToSpy).toHaveBeenCalledWith({
      top: 130,
      left: 0,
      behavior: 'smooth',
    })
  })

  it('does not scroll the page when a newly focused start action is already visible', () => {
    function VisibleTabHarness() {
      const scopeRef = React.useRef<HTMLDivElement>(null)
      useButtonOnlyTabNavigation(scopeRef)

      return (
        <div ref={scopeRef}>
          <div>
            <button type="button">Palette</button>
            <button type="button">Spiel starten</button>
          </div>
        </div>
      )
    }

    render(<VisibleTabHarness />)

    const firstButton = screen.getByRole('button', { name: 'Palette' })
    const startButton = screen.getByRole('button', { name: 'Spiel starten' })
    const scrollIntoViewSpy = vi.fn()

    Object.defineProperty(startButton, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: scrollIntoViewSpy,
    })
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: 900,
    })
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1400,
    })

    firstButton.getBoundingClientRect = () => ({
      x: 64,
      y: 120,
      top: 120,
      left: 64,
      right: 204,
      bottom: 164,
      width: 140,
      height: 44,
      toJSON: () => ({}),
    })

    startButton.getBoundingClientRect = () => ({
      x: 260,
      y: 300,
      top: 300,
      left: 260,
      right: 420,
      bottom: 348,
      width: 160,
      height: 48,
      toJSON: () => ({}),
    })

    firstButton.focus()
    fireEvent.keyDown(window, { key: 'Tab' })

    expect(document.activeElement).toBe(startButton)
    expect(scrollIntoViewSpy).not.toHaveBeenCalled()
  })

  it('stops auto-scrolling restored focus targets after Escape until another navigation key is used', () => {
    function EscapeRestoreHarness() {
      const scopeRef = React.useRef<HTMLDivElement>(null)
      useButtonOnlyTabNavigation(scopeRef)

      return (
        <div ref={scopeRef}>
          <div
            data-testid="escape-scroll-root"
            data-page-focus-root="true"
            style={{ overflowY: 'auto', maxHeight: '160px' }}
          >
            <button type="button">Erste Aktion</button>
            <button type="button">Wiederhergestellte Aktion</button>
          </div>
        </div>
      )
    }

    render(<EscapeRestoreHarness />)

    const scrollRoot = screen.getByTestId('escape-scroll-root')
    Object.defineProperty(scrollRoot, 'clientHeight', {
      configurable: true,
      value: 160,
    })
    Object.defineProperty(scrollRoot, 'scrollHeight', {
      configurable: true,
      value: 420,
    })
    const scrollToSpy = vi.fn((options?: ScrollToOptions | number, y?: number) => {
      if (typeof options === 'number') {
        scrollRoot.scrollTop = y ?? 0
        return
      }

      scrollRoot.scrollTop = options?.top ?? scrollRoot.scrollTop
    })
    Object.defineProperty(scrollRoot, 'scrollTo', {
      configurable: true,
      writable: true,
      value: scrollToSpy,
    })

    const firstButton = screen.getByRole('button', { name: 'Erste Aktion' })
    const restoredButton = screen.getByRole('button', { name: 'Wiederhergestellte Aktion' })

    firstButton.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 120,
      bottom: 40,
      width: 120,
      height: 40,
      toJSON: () => ({}),
    })

    restoredButton.getBoundingClientRect = () => ({
      x: 0,
      y: 210,
      top: 210,
      left: 0,
      right: 180,
      bottom: 250,
      width: 180,
      height: 40,
      toJSON: () => ({}),
    })

    scrollRoot.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 200,
      bottom: 160,
      width: 200,
      height: 160,
      toJSON: () => ({}),
    })

    firstButton.focus()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(document.activeElement).toBe(restoredButton)
    expect(scrollToSpy).toHaveBeenCalledTimes(1)

    scrollToSpy.mockClear()
    scrollRoot.scrollTop = 0

    firstButton.focus()
    fireEvent.keyDown(window, { key: 'Escape' })
    restoredButton.focus()

    expect(document.activeElement).toBe(restoredButton)
    expect(scrollToSpy).not.toHaveBeenCalled()
  })

  it('keeps tab navigation in the stats history aligned to the workspace overlay instead of hidden inner wrappers', () => {
    function StatsHistoryTabHarness() {
      const scopeRef = React.useRef<HTMLDivElement>(null)
      useButtonOnlyTabNavigation(scopeRef)

      return (
        <div ref={scopeRef}>
          <div
            className="workspace-window-overlay"
            data-page-focus-root="true"
            style={{
              overflowY: 'auto',
              paddingTop: '12px',
              paddingBottom: '16px',
              scrollPaddingTop: '20px',
              scrollPaddingBottom: '28px',
            }}
          >
            <div className="workspace-window-shell">
              <div className="dashboard-panel-scroll">
                <div className="stats-report-stack">
                  <UploadStatsHistorySection
                    isLoadingStats={false}
                    completionHistory={[
                      createCompletionRecord('1', '2026-04-10T10:00:00.000Z'),
                      createCompletionRecord('2', '2026-04-11T10:00:00.000Z'),
                    ]}
                    filteredHistory={[
                      createCompletionRecord('1', '2026-04-10T10:00:00.000Z'),
                      createCompletionRecord('2', '2026-04-11T10:00:00.000Z'),
                    ]}
                    historyFilter="6x6"
                    historyFilterOptions={[
                      { id: 'all', label: 'Alle Siege' },
                      { id: '3x3', label: 'Leicht' },
                      { id: '4x4', label: 'Normal' },
                      { id: '5x5', label: 'Schwer' },
                      { id: '6x6', label: 'Sehr Schwer' },
                    ]}
                    standardDifficultyStats={[]}
                    onHistoryFilterChange={vi.fn()}
                    onReloadView={vi.fn()}
                    onBackToStart={vi.fn()}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    render(<StatsHistoryTabHarness />)

    const overlay = document.body.querySelector<HTMLElement>('.workspace-window-overlay')!
    const collapsibleSection = document.body.querySelector<HTMLElement>('.stats-report-section-collapsible')!
    const collapseBody = document.body.querySelector<HTMLElement>('.stats-report-section-body')!
    const tableShell = document.body.querySelector<HTMLElement>('.stats-table-shell')!
    const veryHardFilterButton = screen.getByRole('button', { name: 'Sehr Schwer' })
    const firstSortButton = screen.getByRole('button', { name: /datum/i })

    Object.defineProperty(overlay, 'clientHeight', {
      configurable: true,
      value: 220,
    })
    Object.defineProperty(overlay, 'scrollHeight', {
      configurable: true,
      value: 820,
    })
    overlay.scrollTop = 0
    const overlayScrollToSpy = vi.fn((options?: ScrollToOptions | number, y?: number) => {
      if (typeof options === 'number') {
        overlay.scrollTop = y ?? 0
        return
      }

      overlay.scrollTop = options?.top ?? overlay.scrollTop
    })
    Object.defineProperty(overlay, 'scrollTo', {
      configurable: true,
      writable: true,
      value: overlayScrollToSpy,
    })
    overlay.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 980,
      bottom: 220,
      width: 980,
      height: 220,
      toJSON: () => ({}),
    })

    Object.defineProperty(collapsibleSection, 'clientHeight', {
      configurable: true,
      value: 260,
    })
    Object.defineProperty(collapsibleSection, 'scrollHeight', {
      configurable: true,
      value: 520,
    })
    const sectionScrollToSpy = vi.fn()
    Object.defineProperty(collapsibleSection, 'scrollTo', {
      configurable: true,
      writable: true,
      value: sectionScrollToSpy,
    })

    Object.defineProperty(collapseBody, 'clientHeight', {
      configurable: true,
      value: 220,
    })
    Object.defineProperty(collapseBody, 'scrollHeight', {
      configurable: true,
      value: 500,
    })
    const collapseBodyScrollToSpy = vi.fn()
    Object.defineProperty(collapseBody, 'scrollTo', {
      configurable: true,
      writable: true,
      value: collapseBodyScrollToSpy,
    })

    Object.defineProperty(tableShell, 'clientHeight', {
      configurable: true,
      value: 140,
    })
    Object.defineProperty(tableShell, 'scrollHeight', {
      configurable: true,
      value: 140,
    })
    tableShell.getBoundingClientRect = () => ({
      x: 0,
      y: 188,
      top: 188,
      left: 0,
      right: 980,
      bottom: 328,
      width: 980,
      height: 140,
      toJSON: () => ({}),
    })

    veryHardFilterButton.getBoundingClientRect = () => ({
      x: 0,
      y: 126,
      top: 126,
      left: 0,
      right: 140,
      bottom: 158,
      width: 140,
      height: 32,
      toJSON: () => ({}),
    })

    firstSortButton.getBoundingClientRect = () => ({
      x: 0,
      y: 196,
      top: 196,
      left: 0,
      right: 180,
      bottom: 236,
      width: 180,
      height: 40,
      toJSON: () => ({}),
    })

    veryHardFilterButton.focus()
    fireEvent.keyDown(window, { key: 'Tab' })

    expect(document.activeElement).toBe(firstSortButton)
    expect(overlay.scrollTop).toBe(176)
    expect(overlayScrollToSpy).toHaveBeenCalledWith({
      top: 176,
      left: 0,
      behavior: 'smooth',
    })
    expect(sectionScrollToSpy).not.toHaveBeenCalled()
    expect(collapseBodyScrollToSpy).not.toHaveBeenCalled()
  })

  it('scrolls wide table actions horizontally into view inside table shells while keeping the vertical overlay stable', () => {
    function HorizontalTableTabHarness() {
      const scopeRef = React.useRef<HTMLDivElement>(null)
      useButtonOnlyTabNavigation(scopeRef)

      return (
        <div ref={scopeRef}>
          <div
            className="workspace-window-overlay"
            data-page-focus-root="true"
            style={{ overflowY: 'auto', maxHeight: '220px' }}
          >
            <div className="stats-table-shell" style={{ overflowX: 'auto', maxWidth: '240px', padding: '8px' }}>
              <div style={{ display: 'flex', gap: '12px', width: '520px' }}>
                <button type="button">Datum</button>
                <button type="button">Datenquelle</button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    render(<HorizontalTableTabHarness />)

    const overlay = document.body.querySelector<HTMLElement>('.workspace-window-overlay')!
    const tableShell = document.body.querySelector<HTMLElement>('.stats-table-shell')!
    const firstButton = screen.getByRole('button', { name: 'Datum' })
    const secondButton = screen.getByRole('button', { name: 'Datenquelle' })

    Object.defineProperty(overlay, 'clientHeight', {
      configurable: true,
      value: 220,
    })
    Object.defineProperty(overlay, 'scrollHeight', {
      configurable: true,
      value: 220,
    })
    overlay.scrollTop = 0
    const overlayScrollToSpy = vi.fn()
    Object.defineProperty(overlay, 'scrollTo', {
      configurable: true,
      writable: true,
      value: overlayScrollToSpy,
    })
    overlay.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 320,
      bottom: 220,
      width: 320,
      height: 220,
      toJSON: () => ({}),
    })

    Object.defineProperty(tableShell, 'clientWidth', {
      configurable: true,
      value: 240,
    })
    Object.defineProperty(tableShell, 'scrollWidth', {
      configurable: true,
      value: 520,
    })
    Object.defineProperty(tableShell, 'clientHeight', {
      configurable: true,
      value: 80,
    })
    Object.defineProperty(tableShell, 'scrollHeight', {
      configurable: true,
      value: 80,
    })
    tableShell.scrollLeft = 0
    const tableShellScrollToSpy = vi.fn((options?: ScrollToOptions | number, y?: number) => {
      if (typeof options === 'number') {
        tableShell.scrollLeft = y ?? 0
        return
      }

      tableShell.scrollLeft = options?.left ?? tableShell.scrollLeft
    })
    Object.defineProperty(tableShell, 'scrollTo', {
      configurable: true,
      writable: true,
      value: tableShellScrollToSpy,
    })
    tableShell.getBoundingClientRect = () => ({
      x: 0,
      y: 24,
      top: 24,
      left: 0,
      right: 240,
      bottom: 104,
      width: 240,
      height: 80,
      toJSON: () => ({}),
    })

    firstButton.getBoundingClientRect = () => ({
      x: 12,
      y: 40,
      top: 40,
      left: 12,
      right: 112,
      bottom: 76,
      width: 100,
      height: 36,
      toJSON: () => ({}),
    })

    secondButton.getBoundingClientRect = () => ({
      x: 280,
      y: 40,
      top: 40,
      left: 280,
      right: 420,
      bottom: 76,
      width: 140,
      height: 36,
      toJSON: () => ({}),
    })

    firstButton.focus()
    fireEvent.keyDown(window, { key: 'Tab' })

    expect(document.activeElement).toBe(secondButton)
    expect(tableShell.scrollLeft).toBe(272)
    expect(tableShellScrollToSpy).toHaveBeenCalledWith({
      top: 0,
      left: 272,
      behavior: 'smooth',
    })
    expect(overlayScrollToSpy).not.toHaveBeenCalled()
  })

  it('focuses the first backup action and restores focus after closing the backup browser', async () => {
    function BackupDialogHarness() {
      const [isOpen, setIsOpen] = React.useState(false)

      return (
        <div>
          <button type="button" onClick={() => setIsOpen(true)}>
            Backupbrowser oeffnen
          </button>
          {isOpen ? (
            <UploadBackupBrowserDialog
              backups={[createBackup('backup-a.json'), createBackup('backup-b.json')]}
              isLoading={false}
              deletingFileName={null}
              onClose={() => setIsOpen(false)}
              onDeleteBackup={vi.fn()}
              onSelectBackup={vi.fn()}
            />
          ) : null}
        </div>
      )
    }

    render(<BackupDialogHarness />)

    const opener = screen.getByRole('button', { name: 'Backupbrowser oeffnen' })
    opener.focus()
    fireEvent.click(opener)

    const selectButtons = await screen.findAllByRole('button', { name: 'Auswaehlen' })
    const firstSelectButton = selectButtons[0]!
    expect(document.activeElement).toBe(firstSelectButton)

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(document.activeElement).toBe(opener)
    })
  })

  it('focuses the first timeline replay in gallery details and restores focus after closing', async () => {
    function GalleryDetailHarness() {
      const [isOpen, setIsOpen] = React.useState(false)
      const detailEntry = createGalleryDisplayEntry('9', '2026-04-11T12:00:00.000Z')
      const bestTimeEntry = {
        ...createSolvedGalleryEntry('10', '2026-04-10T09:00:00.000Z'),
        time: 80,
        moves: 24,
      }
      const otherDifficultyEntry = {
        ...createSolvedGalleryEntry('11', '2026-04-09T09:00:00.000Z'),
        config: { rows: 5, cols: 5 },
        time: 180,
        moves: 70,
      }

      detailEntry.motifReplaySummary = {
        ...detailEntry.motifReplaySummary,
        allEntries: [detailEntry.representativeEntry, bestTimeEntry, otherDifficultyEntry],
        totalSolveCount: 3,
        replayableSolveCount: 3,
        bestTimeEntry,
        bestMovesEntry: bestTimeEntry,
      }

      return (
        <div>
          <button type="button" onClick={() => setIsOpen(true)}>
            Galerie-Detail oeffnen
          </button>
          {isOpen ? (
            <UploadGalleryDetailDialog
              entry={detailEntry}
              onReplayEntry={vi.fn()}
              onCollectEntry={vi.fn()}
              onClose={() => setIsOpen(false)}
            />
          ) : null}
        </div>
      )
    }

    render(<GalleryDetailHarness />)

    const opener = screen.getByRole('button', { name: 'Galerie-Detail oeffnen' })
    opener.focus()
    fireEvent.click(opener)

    const collectButton = screen.getByRole('button', { name: /zu einer Sammlung hinzufuegen/i })
    const closeButton = screen.getByRole('button', { name: 'Schliessen' })
    collectButton.focus()
    fireEvent.keyDown(collectButton, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(closeButton)

    expect(screen.getByText('Laufverlauf')).toBeTruthy()
    expect(screen.getByText('Aktuell')).toBeTruthy()
    expect(screen.getByText('Bestzeit')).toBeTruthy()
    expect(screen.getByText('Bestweg')).toBeTruthy()
    expect(screen.getByText('Andere Stufe')).toBeTruthy()
    expect(screen.getByText('+0:19 zur Bestzeit')).toBeTruthy()
    expect(screen.getAllByText(/vs\. vorher/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText('gleiche Stufe').length).toBeGreaterThan(0)
    expect(document.querySelectorAll('.gallery-detail-timeline-preview img')).toHaveLength(3)
    expect(screen.queryByText('Schnellstarts')).toBeNull()
    expect(screen.queryByRole('button', { name: /bestzeit spielen/i })).toBeNull()
    const timelineButtons = screen.getAllByRole('button', { name: /lauf normal 4x4 vom/i })
    const motifNewButtons = screen.getAllByRole('button', { name: /motiv normal 4x4 vom/i })
    expect(timelineButtons).toHaveLength(2)
    expect(motifNewButtons).toHaveLength(1)
    await waitFor(() => {
      expect(document.activeElement).toBe(motifNewButtons[0])
    })
    timelineButtons[0].focus()
    fireEvent.keyDown(timelineButtons[0], { key: 'ArrowDown' })
    expect(document.activeElement).toBe(timelineButtons[1])

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(document.activeElement).toBe(opener)
    })
  })

  it('moves through gallery detail tag actions with arrows', () => {
    const detailEntry = createGalleryDisplayEntry('12', '2026-04-11T12:00:00.000Z')
    detailEntry.representativeEntry.tags = [
      { label: 'Stadt', confidence: 0.94, source: 'gemini' },
      { label: 'Nacht', confidence: 0.88, source: 'gemini' },
    ]
    detailEntry.representativeEntry.aiTagging = {
      status: 'tagged',
      provider: 'gemini',
      model: 'gemini-test',
      generatedAt: '2026-04-11T12:00:00.000Z',
      error: null,
      collectionSuggestions: [],
    }

    render(
      <UploadGalleryDetailDialog
        entry={detailEntry}
        onReplayEntry={vi.fn()}
        onCollectEntry={vi.fn()}
        onTagFilter={vi.fn()}
        onFetchRandomImage={vi.fn()}
        onClose={vi.fn()}
      />
    )

    const stadtFilterButton = screen.getByRole('button', { name: '#Stadt' })
    const stadtSearchButton = screen.getByRole('button', { name: 'Neues Online-Motiv zu Stadt suchen' })
    const nachtFilterButton = screen.getByRole('button', { name: '#Nacht' })
    const nachtSearchButton = screen.getByRole('button', { name: 'Neues Online-Motiv zu Nacht suchen' })

    mockElementRect(stadtFilterButton, { left: 0, top: 0, width: 80, height: 32 })
    mockElementRect(stadtSearchButton, { left: 84, top: 0, width: 64, height: 32 })
    mockElementRect(nachtFilterButton, { left: 160, top: 0, width: 80, height: 32 })
    mockElementRect(nachtSearchButton, { left: 244, top: 0, width: 64, height: 32 })

    stadtFilterButton.focus()
    fireEvent.keyDown(stadtFilterButton, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(stadtSearchButton)

    fireEvent.keyDown(stadtSearchButton, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(nachtFilterButton)

    fireEvent.keyDown(nachtFilterButton, { key: 'End' })
    expect(document.activeElement).toBe(nachtSearchButton)

    fireEvent.keyDown(nachtSearchButton, { key: 'Home' })
    expect(document.activeElement).toBe(stadtFilterButton)
  })

  it('moves through win dialog actions with arrows, Pos1 and Ende', async () => {
    render(
      <WinDialog
        stats={{
          moves: 18,
          time: 42,
          actionMoves: 21,
          undoCount: 0,
          redoCount: 0,
          hintCount: 0,
          suggestedMoveCount: 0,
          assistanceMode: 'clean',
        }}
        config={{ rows: 4, cols: 4 }}
        nextDifficultyLabel="Schwer 5x5"
        completionResult={createCompletionResult()}
        completionStatsError={null}
        isRecordingStats={false}
        onRetryStats={vi.fn()}
        onReplaySameImage={vi.fn()}
        onGoToSelectionScreen={vi.fn()}
        onChooseNewImage={vi.fn()}
        onNextDifficulty={vi.fn()}
      />
    )

    const replayButton = await screen.findByRole('button', { name: 'Nochmal spielen' })
    const nextDifficultyButton = screen.getByRole('button', { name: 'Weiter: Schwer 5x5' })
    const selectionButton = screen.getByRole('button', { name: 'Zur Auswahl' })
    const startButton = screen.getByRole('button', { name: 'Zur Startseite' })

    expect(document.activeElement).toBe(replayButton)

    fireEvent.keyDown(replayButton, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(nextDifficultyButton)

    fireEvent.keyDown(nextDifficultyButton, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(selectionButton)

    fireEvent.keyDown(selectionButton, { key: 'End' })
    expect(document.activeElement).toBe(startButton)

    fireEvent.keyDown(startButton, { key: 'Home' })
    expect(document.activeElement).toBe(replayButton)
  })

  it('cycles through win dialog actions with Tab, Shift+Tab and arrow keys when the retry action is visible', async () => {
    const user = userEvent.setup()

    render(
      <WinDialog
        stats={{
          moves: 18,
          time: 42,
          actionMoves: 21,
          undoCount: 0,
          redoCount: 0,
          hintCount: 0,
          suggestedMoveCount: 0,
          assistanceMode: 'clean',
        }}
        config={{ rows: 4, cols: 4 }}
        nextDifficultyLabel="Schwer 5x5"
        completionResult={createCompletionResult()}
        completionStatsError="Statistik konnte nicht aktualisiert werden."
        isRecordingStats={false}
        onRetryStats={vi.fn()}
        onReplaySameImage={vi.fn()}
        onGoToSelectionScreen={vi.fn()}
        onChooseNewImage={vi.fn()}
        onNextDifficulty={vi.fn()}
      />
    )

    const replayButton = await screen.findByRole('button', { name: 'Nochmal spielen' })
    const retryButton = screen.getByRole('button', { name: 'Erneut versuchen' })
    const nextDifficultyButton = screen.getByRole('button', { name: 'Weiter: Schwer 5x5' })
    const selectionButton = screen.getByRole('button', { name: 'Zur Auswahl' })
    const startButton = screen.getByRole('button', { name: 'Zur Startseite' })

    expect(screen.getByText(/Tastatur: Tab, Shift\+Tab, Pfeile, Pos1 und Ende/i)).toBeTruthy()
    expect(document.activeElement).toBe(replayButton)

    await user.tab()
    expect(document.activeElement).toBe(nextDifficultyButton)

    await user.tab()
    expect(document.activeElement).toBe(selectionButton)

    await user.tab()
    expect(document.activeElement).toBe(startButton)

    await user.tab()
    expect(document.activeElement).toBe(retryButton)

    await user.tab()
    expect(document.activeElement).toBe(replayButton)

    await user.tab({ shift: true })
    expect(document.activeElement).toBe(retryButton)

    fireEvent.keyDown(retryButton, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(replayButton)

    fireEvent.keyDown(replayButton, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(retryButton)

    fireEvent.keyDown(retryButton, { key: 'End' })
    expect(document.activeElement).toBe(startButton)

    fireEvent.keyDown(startButton, { key: 'Home' })
    expect(document.activeElement).toBe(retryButton)
  })

  it('navigates statistics section headings with arrows and Pos1', async () => {
    render(
      <div className="workspace-window-shell">
        <div className="workspace-window-overlay">
          <button type="button" className="workspace-window-nav-button">
            Start
          </button>
          <div className="dashboard-panel-scroll">
            <div className="stats-report-stack">
              <UploadStatsSection
                id="stats-a"
                kicker="Bereich A"
                title="Erster Abschnitt"
                copy="A"
                collapsible
                defaultOpen
              >
                <div>Inhalt A</div>
              </UploadStatsSection>
              <UploadStatsSection
                id="stats-b"
                kicker="Bereich B"
                title="Zweiter Abschnitt"
                copy="B"
                collapsible
                defaultOpen
              >
                <div>Inhalt B</div>
              </UploadStatsSection>
              <UploadStatsSection
                id="stats-c"
                kicker="Bereich C"
                title="Dritter Abschnitt"
                copy="C"
                collapsible
                defaultOpen
              >
                <div>Inhalt C</div>
              </UploadStatsSection>
            </div>
          </div>
        </div>
      </div>
    )

    const firstSummaryButton = screen.getByRole('button', { name: /Erster Abschnitt/i })
    const secondSummaryButton = screen.getByRole('button', { name: /Zweiter Abschnitt/i })
    const thirdSummaryButton = screen.getByRole('button', { name: /Dritter Abschnitt/i })
    const startButton = screen.getByRole('button', { name: 'Start' })

    firstSummaryButton.focus()
    fireEvent.keyDown(firstSummaryButton, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(secondSummaryButton)

    fireEvent.keyDown(secondSummaryButton, { key: 'End' })
    expect(document.activeElement).toBe(thirdSummaryButton)

    fireEvent.keyDown(thirdSummaryButton, { key: 'Home' })
    await waitFor(() => {
      expect(document.activeElement).toBe(startButton)
    })
  })

  it('moves through statistics filters and sort headers with arrows, Pos1 and Ende', () => {
    const completionHistory = [
      createCompletionRecord('1', '2026-04-10T10:00:00.000Z'),
      createCompletionRecord('2', '2026-04-11T10:00:00.000Z'),
    ]

    render(
      <div className="workspace-window-shell">
        <div className="workspace-window-overlay">
          <div className="dashboard-panel-scroll">
            <div className="stats-report-stack">
              <UploadStatsHistorySection
                isLoadingStats={false}
                completionHistory={completionHistory}
                filteredHistory={completionHistory}
                historyFilter="all"
                historyFilterOptions={[
                  { id: 'all', label: 'Alle Siege' },
                  { id: '4x4', label: 'Normal 4x4' },
                ]}
                standardDifficultyStats={[]}
                onHistoryFilterChange={vi.fn()}
                onReloadView={vi.fn()}
                onBackToStart={vi.fn()}
              />
            </div>
          </div>
        </div>
      </div>
    )

    const allFilterButton = screen.getByRole('button', { name: 'Alle Siege' })
    const difficultyFilterButton = screen.getByRole('button', { name: 'Normal 4x4' })

    allFilterButton.focus()
    fireEvent.keyDown(allFilterButton, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(difficultyFilterButton)

    fireEvent.keyDown(difficultyFilterButton, { key: 'Home' })
    expect(document.activeElement).toBe(allFilterButton)

    fireEvent.keyDown(allFilterButton, { key: 'End' })
    expect(document.activeElement).toBe(difficultyFilterButton)

    const sortButtons = screen.getAllByRole('button', {
      name: /datum|stufe|zeit|zuege|laufart/i,
    })
    const firstSortButton = sortButtons[0]!
    const secondSortButton = sortButtons[1]!
    const lastSortButton = sortButtons[sortButtons.length - 1]!

    firstSortButton.focus()
    fireEvent.keyDown(firstSortButton, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(secondSortButton)

    fireEvent.keyDown(secondSortButton, { key: 'End' })
    expect(document.activeElement).toBe(lastSortButton)

    fireEvent.keyDown(lastSortButton, { key: 'Home' })
    expect(document.activeElement).toBe(firstSortButton)
  })

  it('renders the compact statistics history table without obsolete move columns or empty assistance details', () => {
    const cleanRun: PuzzleCompletionRecord = {
      ...createCompletionRecord('1', '2026-04-10T10:00:00.000Z'),
      id: 'clean-run',
      moves: 30,
      actionMoves: 30,
      hintCount: 0,
      suggestedMoveCount: 0,
      assistanceMode: 'clean',
    }
    const hintedExtraRun: PuzzleCompletionRecord = {
      ...createCompletionRecord('2', '2026-04-11T10:00:00.000Z'),
      id: 'hinted-extra-run',
      moves: 32,
      actionMoves: 35,
      hintCount: 1,
      suggestedMoveCount: 0,
      assistanceMode: 'hinted',
    }
    const normalRun: PuzzleCompletionRecord = {
      ...createCompletionRecord('3', '2026-04-12T10:00:00.000Z'),
      id: 'normal-run',
      moves: 34,
      actionMoves: 34,
      hintCount: 0,
      suggestedMoveCount: 0,
      assistanceMode: 'clean',
    }
    const autoRunWithoutDetail: PuzzleCompletionRecord = {
      ...createCompletionRecord('4', '2026-04-13T10:00:00.000Z'),
      id: 'auto-run-without-detail',
      moves: 36,
      actionMoves: 36,
      hintCount: 0,
      suggestedMoveCount: 0,
      assistanceMode: 'auto-assisted',
    }
    const autoRunWithDetail: PuzzleCompletionRecord = {
      ...createCompletionRecord('5', '2026-04-14T10:00:00.000Z'),
      id: 'auto-run-with-detail',
      moves: 38,
      actionMoves: 40,
      hintCount: 0,
      suggestedMoveCount: 2,
      assistanceMode: 'auto-assisted',
    }
    const completionHistory = [
      cleanRun,
      hintedExtraRun,
      normalRun,
      autoRunWithoutDetail,
      autoRunWithDetail,
    ]

    const { container } = render(
      <UploadStatsHistorySection
        isLoadingStats={false}
        completionHistory={completionHistory}
        filteredHistory={completionHistory}
        historyFilter="all"
        historyFilterOptions={[{ id: 'all', label: 'Alle Siege' }]}
        standardDifficultyStats={[]}
        onHistoryFilterChange={vi.fn()}
        onReloadView={vi.fn()}
        onBackToStart={vi.fn()}
      />
    )

    expect(screen.queryByRole('columnheader', { name: /gesamt-zuege/i })).toBeNull()
    expect(screen.queryByRole('columnheader', { name: /extra-zuege/i })).toBeNull()
    expect(screen.queryByText(/gesamt-zuege/i)).toBeNull()
    expect(screen.queryByText(/^laufzeit$/i)).toBeNull()
    expect(screen.queryByText(/^netto$/i)).toBeNull()
    expect(screen.queryByText(/^grid$/i)).toBeNull()

    const extraMoveBadges = Array.from(container.querySelectorAll('.stats-extra-moves-badge'))
    expect(extraMoveBadges.map((badge) => badge.textContent?.trim())).toEqual(['+2 Extra', '+3 Extra'])

    const assistanceBadges = Array.from(container.querySelectorAll<HTMLElement>('.stats-assistance-badge'))
    const cleanBadges = assistanceBadges.filter((badge) => badge.textContent?.includes('Clean'))
    const autoBadges = assistanceBadges.filter((badge) => badge.textContent?.includes('Auto-Zug'))

    expect(cleanBadges.length).toBe(2)
    expect(cleanBadges.every((badge) => !badge.textContent?.includes('0 Hinweise'))).toBe(true)
    expect(cleanBadges.every((badge) => !badge.textContent?.includes('0 Auto'))).toBe(true)
    expect(cleanBadges.every((badge) => !badge.getAttribute('title')?.includes('0 Hinweise'))).toBe(true)
    expect(cleanBadges.every((badge) => !badge.getAttribute('title')?.includes('0 Auto'))).toBe(true)

    expect(autoBadges.length).toBe(2)
    expect(autoBadges.filter((badge) => badge.textContent?.includes('2 Auto'))).toHaveLength(1)
    expect(autoBadges.every((badge) => !badge.textContent?.includes('0 Auto'))).toBe(true)
  })

  it('keeps focus on the same statistics sort button after resorting the history table', async () => {
    const completionHistory = [
      createCompletionRecord('1', '2026-04-10T10:00:00.000Z'),
      createCompletionRecord('2', '2026-04-11T10:00:00.000Z'),
    ]

    render(
      <div className="workspace-window-shell">
        <div className="workspace-window-overlay">
          <div className="dashboard-panel-scroll">
            <div className="stats-report-stack">
              <UploadStatsHistorySection
                isLoadingStats={false}
                completionHistory={completionHistory}
                filteredHistory={completionHistory}
                historyFilter="all"
                historyFilterOptions={[
                  { id: 'all', label: 'Alle Siege' },
                  { id: '4x4', label: 'Normal 4x4' },
                ]}
                standardDifficultyStats={[]}
                onHistoryFilterChange={vi.fn()}
                onReloadView={vi.fn()}
                onBackToStart={vi.fn()}
              />
            </div>
          </div>
        </div>
      </div>
    )

    const timeSortButton = screen.getByRole('button', { name: 'Zeit' })
    timeSortButton.focus()
    fireEvent.click(timeSortButton)

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Zeit' }))
    })

    fireEvent.click(screen.getByRole('button', { name: 'Zeit' }))

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Zeit' }))
    })
  })

  it('toggles the command palette with F8 outside editable fields', () => {
    function CommandPaletteShortcutHarness() {
      const [isOpen, setIsOpen] = React.useState(false)

      useCommandPaletteShortcuts({
        isOpen,
        onOpen: () => setIsOpen(true),
        onClose: () => setIsOpen(false),
      })

      return (
        <div>
          <input aria-label="Notiz" />
          <span>{isOpen ? 'Palette offen' : 'Palette geschlossen'}</span>
        </div>
      )
    }

    render(<CommandPaletteShortcutHarness />)

    const textInput = screen.getByRole('textbox', { name: 'Notiz' })
    textInput.focus()
    fireEvent.keyDown(textInput, { key: 'F8' })
    expect(screen.getByText('Palette geschlossen')).toBeTruthy()

    textInput.blur()
    fireEvent.keyDown(window, { key: 'F8' })
    expect(screen.getByText('Palette offen')).toBeTruthy()

    fireEvent.keyDown(window, { key: 'F8' })
    expect(screen.getByText('Palette geschlossen')).toBeTruthy()
  })

  it('filters and executes command palette actions with keyboard', async () => {
    const onOpenGallery = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(
      <CommandPalette
        contextLabel="Auswahl"
        onClose={onClose}
        commands={[
          {
            id: 'start',
            title: 'Zur Startseite',
            detail: 'Zur Startseite zurueckkehren.',
            section: 'Navigation',
            icon: 'grid',
            onSelect: vi.fn(),
          },
          {
            id: 'stats',
            title: 'Statistik oeffnen',
            detail: 'Rekorde und Verlauf ansehen.',
            section: 'Navigation',
            icon: 'grid',
            onSelect: vi.fn(),
          },
          {
            id: 'gallery',
            title: 'Galerie oeffnen',
            detail: 'Motive und geloeste Eintraege anzeigen.',
            section: 'Navigation',
            icon: 'image',
            onSelect: onOpenGallery,
          },
        ]}
      />
    )

    const searchInput = screen.getByRole('combobox', { name: /Schnellaktionen durchsuchen/i })
    await user.type(searchInput, 'galerie')
    const galleryButton = screen.getByRole('option', { name: /Galerie oeffnen/i })
    galleryButton.focus()
    fireEvent.keyDown(galleryButton, { key: 'Enter' })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onOpenGallery).toHaveBeenCalledTimes(1)
  })

  it('renders the inline save status accessibly in the top toolbar', () => {
    render(
      <ThemeProvider>
        <ThemeSwitcher
          layout="floating"
          onGoToStartScreen={vi.fn()}
          onOpenCommandPalette={vi.fn()}
          onOpenHelp={vi.fn()}
          saveStatus={{
            kind: 'saving',
            label: 'Speichert...',
            detail: 'Spielstand wird automatisch gesichert.',
          }}
        />
      </ThemeProvider>
    )

    expect(screen.getByRole('toolbar', { name: 'App-Navigation, Hilfe, Musik und Darstellung' })).toBeTruthy()
    const saveStatus = screen.getByRole('status')
    expect(within(saveStatus).getByText('Speichert...')).toBeTruthy()
    expect(within(saveStatus).getByText('Spielstand wird automatisch gesichert.')).toBeTruthy()
  })

  it('uses the emotion theme toggle for scoped image palettes too', async () => {
    window.localStorage.setItem('puzzle-emotion-theme-enabled', 'true')
    const entry = createGalleryDisplayEntry('1', '2026-04-11T10:00:00.000Z')
    entry.representativeEntry.imageTheme = createImageThemePalette()

    const { container } = render(
      <ThemeProvider>
        <ThemeSwitcher
          layout="floating"
          onGoToStartScreen={vi.fn()}
          onOpenCommandPalette={vi.fn()}
          onOpenHelp={vi.fn()}
        />
        <div className="gallery-grid">
          <UploadGalleryCard
            entry={entry}
            onOpenDetails={vi.fn()}
            onDeleteEntry={vi.fn()}
            isDeleting={false}
          />
        </div>
      </ThemeProvider>
    )

    const card = container.querySelector<HTMLElement>('.gallery-card')!

    await waitFor(() => {
      expect(card.querySelector('.gallery-card-palette')).toBeTruthy()
      expect(card.style.getPropertyValue('--primary-color')).toBe('#dc2626')
      expect(document.documentElement.getAttribute('data-emotion-theme')).toBe('on')
    })

    fireEvent.click(screen.getByRole('button', { name: /Emotion-Theme deaktivieren/i }))

    await waitFor(() => {
      expect(card.querySelector('.gallery-card-palette')).toBeNull()
      expect(card.style.getPropertyValue('--primary-color')).toBe('')
      expect(document.documentElement.getAttribute('data-emotion-theme')).toBe('off')
    })
  })

  it('moves through the top primary toolbar with arrows, Pos1 and Ende', () => {
    render(
      <ThemeProvider>
        <ThemeSwitcher
          layout="floating"
          onGoToStartScreen={vi.fn()}
          onOpenCommandPalette={vi.fn()}
          onOpenHelp={vi.fn()}
        />
      </ThemeProvider>
    )

    const startButton = screen.getByRole('button', { name: 'Zur Startseite wechseln' })
    const paletteButton = screen.getByRole('button', { name: 'Command Palette oeffnen' })
    const helpButton = screen.getByRole('button', { name: 'Hilfe und Tastaturbefehle anzeigen' })
    const themeButton = screen.getByRole('button', { name: /Dunkelmodus aktivieren|Hellmodus aktivieren/i })

    mockElementRect(startButton, { left: 0, top: 0, width: 120, height: 44 })
    mockElementRect(paletteButton, { left: 150, top: 0, width: 120, height: 44 })
    mockElementRect(helpButton, { left: 300, top: 0, width: 120, height: 44 })
    mockElementRect(themeButton, { left: 900, top: 0, width: 120, height: 44 })

    startButton.focus()
    fireEvent.keyDown(startButton, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(paletteButton)

    fireEvent.keyDown(paletteButton, { key: 'End' })
    expect(document.activeElement).toBe(themeButton)

    fireEvent.keyDown(themeButton, { key: 'Home' })
    expect(document.activeElement).toBe(startButton)
  })

  it('exposes save errors assertively in the top toolbar', () => {
    render(
      <ThemeProvider>
        <ThemeSwitcher
          layout="floating"
          onGoToStartScreen={vi.fn()}
          onOpenCommandPalette={vi.fn()}
          onOpenHelp={vi.fn()}
          saveStatus={{
            kind: 'error',
            label: 'Speichern fehlgeschlagen',
            detail: 'Bitte erneut versuchen.',
          }}
        />
      </ThemeProvider>
    )

    const saveError = screen.getByRole('alert')
    expect(within(saveError).getByText('Speichern fehlgeschlagen')).toBeTruthy()
    expect(within(saveError).getByText('Bitte erneut versuchen.')).toBeTruthy()
  })

  it('announces help context changes and exposes the help content as a labeled region', () => {
    render(
      <>
        <AccessibilityAnnouncerHost />
        <GlobalHelpOverlay helpContext="upload-start" onClose={vi.fn()} />
      </>
    )

    const scrollRegion = screen.getByRole('region', { name: 'Shortcuts und Bedienung' })
    const contextSelect = screen.getByRole('combobox', { name: 'Hilfekontext wechseln' })

    expect(scrollRegion.getAttribute('aria-describedby')).toContain('global-help-scroll-hint')

    fireEvent.change(contextSelect, { target: { value: 'upload-stats' } })
    expect(screen.getByTestId('accessibility-announcer-polite').textContent).toContain(
      'Hilfekontext gewechselt: Statistik. Verlauf, Vergleiche und Rekorde.'
    )
  })

  it('returns from the selection screen with Escape when focus stays in the page', async () => {
    const onGoToStartScreen = vi.fn()

    render(
      <UploadScreen
        onImageLoaded={vi.fn()}
        onGoToStartScreen={onGoToStartScreen}
        onOpenHelp={vi.fn()}
        onHelpContextChange={vi.fn()}
        registerAppContextMenuHandler={vi.fn()}
        savedGames={[]}
        isLoadingSavedGames={false}
        savedGamesError={null}
        stats={null}
        isLoadingStats={false}
        isResettingStats={false}
        statsError={null}
        gallery={null}
        isLoadingGallery={false}
        isResettingGallery={false}
        galleryError={null}
        isFetchingRandom={false}
        randomImageError={null}
        onFetchRandomImage={vi.fn()}
        onLoadSavedGame={vi.fn()}
        onDeleteSavedGame={vi.fn()}
        onDeleteAllSavedGames={vi.fn()}
        onResetStats={vi.fn()}
        onResetGallery={vi.fn()}
        onReplayGalleryEntry={vi.fn()}
        onDeleteGalleryEntries={vi.fn()}
        onCreateBackupFile={vi.fn()}
        onDeleteBackupFile={vi.fn()}
        onImportBackupFile={vi.fn()}
      />
    )

    const uploadButton = await screen.findByRole('button', { name: /Foto hochladen/i })
    uploadButton.focus()
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onGoToStartScreen).toHaveBeenCalledTimes(1)
  })

  it('uses the app context menu for the prompt field and pastes text without triggering image paste errors', async () => {
    let contextHandler: AppContextMenuHandler | null = null
    const hasClipboardImageSpy = vi
      .spyOn(ClipboardService, 'hasClipboardImage')
      .mockResolvedValue(false)
    const readClipboardTextSpy = vi
      .spyOn(ClipboardService, 'readClipboardText')
      .mockResolvedValue('Leuchtende Berglandschaft')

    render(
      <UploadScreen
        onImageLoaded={vi.fn()}
        onGoToStartScreen={vi.fn()}
        onOpenHelp={vi.fn()}
        onHelpContextChange={vi.fn()}
        registerAppContextMenuHandler={(handler) => {
          contextHandler = handler
        }}
        savedGames={[]}
        isLoadingSavedGames={false}
        savedGamesError={null}
        stats={null}
        isLoadingStats={false}
        isResettingStats={false}
        statsError={null}
        gallery={null}
        isLoadingGallery={false}
        isResettingGallery={false}
        galleryError={null}
        isFetchingRandom={false}
        randomImageError={null}
        onFetchRandomImage={vi.fn()}
        onLoadSavedGame={vi.fn()}
        onDeleteSavedGame={vi.fn()}
        onDeleteAllSavedGames={vi.fn()}
        onResetStats={vi.fn()}
        onResetGallery={vi.fn()}
        onReplayGalleryEntry={vi.fn()}
        onDeleteGalleryEntries={vi.fn()}
        onCreateBackupFile={vi.fn()}
        onDeleteBackupFile={vi.fn()}
        onImportBackupFile={vi.fn()}
      />
    )

    const promptInput = await screen.findByLabelText(/Bild per Prompt/i)
    fireEvent.paste(promptInput, {
      clipboardData: {
        items: [
          {
            type: 'text/plain',
            getAsFile: () => null,
          },
        ],
      },
    })

    expect(screen.queryByRole('alert')).toBeNull()

    await waitFor(() => {
      expect(contextHandler).not.toBeNull()
    })

    const preventDefault = vi.fn()
    const registeredContextHandler = contextHandler as AppContextMenuHandler | null
    if (!registeredContextHandler) {
      throw new Error('App-Kontextmenue wurde nicht registriert')
    }

    registeredContextHandler({
      clientX: 12,
      clientY: 18,
      target: promptInput,
      preventDefault,
    })

    expect(preventDefault).toHaveBeenCalledTimes(1)
    await screen.findByRole('menuitem', { name: /Prompt einfuegen/i })

    await waitFor(() => {
      expect(hasClipboardImageSpy).toHaveBeenCalledTimes(1)
      expect((screen.getByRole('menuitem', { name: /Prompt einfuegen/i }) as HTMLButtonElement).disabled).toBe(false)
    })

    await userEvent.click(screen.getByRole('menuitem', { name: /Prompt einfuegen/i }))

    await waitFor(() => {
      expect(readClipboardTextSpy).toHaveBeenCalledTimes(1)
      expect((screen.getByLabelText(/Bild per Prompt/i) as HTMLTextAreaElement).value).toBe('Leuchtende Berglandschaft')
    })

    hasClipboardImageSpy.mockRestore()
    readClipboardTextSpy.mockRestore()
  })

  it('disables prompt paste in the prompt context menu when the clipboard contains an image', async () => {
    let contextHandler: AppContextMenuHandler | null = null
    const hasClipboardImageSpy = vi
      .spyOn(ClipboardService, 'hasClipboardImage')
      .mockResolvedValue(true)
    const readClipboardTextSpy = vi
      .spyOn(ClipboardService, 'readClipboardText')
      .mockResolvedValue('Leuchtende Berglandschaft')

    render(
      <UploadScreen
        onImageLoaded={vi.fn()}
        onGoToStartScreen={vi.fn()}
        onOpenHelp={vi.fn()}
        onHelpContextChange={vi.fn()}
        registerAppContextMenuHandler={(handler) => {
          contextHandler = handler
        }}
        savedGames={[]}
        isLoadingSavedGames={false}
        savedGamesError={null}
        stats={null}
        isLoadingStats={false}
        isResettingStats={false}
        statsError={null}
        gallery={null}
        isLoadingGallery={false}
        isResettingGallery={false}
        galleryError={null}
        isFetchingRandom={false}
        randomImageError={null}
        onFetchRandomImage={vi.fn()}
        onLoadSavedGame={vi.fn()}
        onDeleteSavedGame={vi.fn()}
        onDeleteAllSavedGames={vi.fn()}
        onResetStats={vi.fn()}
        onResetGallery={vi.fn()}
        onReplayGalleryEntry={vi.fn()}
        onDeleteGalleryEntries={vi.fn()}
        onCreateBackupFile={vi.fn()}
        onDeleteBackupFile={vi.fn()}
        onImportBackupFile={vi.fn()}
      />
    )

    const promptInput = await screen.findByLabelText(/Bild per Prompt/i)

    await waitFor(() => {
      expect(contextHandler).not.toBeNull()
    })

    const registeredContextHandler = contextHandler as AppContextMenuHandler | null
    if (!registeredContextHandler) {
      throw new Error('App-Kontextmenue wurde nicht registriert')
    }

    registeredContextHandler({
      clientX: 12,
      clientY: 18,
      target: promptInput,
      preventDefault: vi.fn(),
    })

    const pastePromptItem = await screen.findByRole('menuitem', { name: /Prompt einfuegen/i })

    await waitFor(() => {
      expect(hasClipboardImageSpy).toHaveBeenCalledTimes(1)
      expect((screen.getByRole('menuitem', { name: /Prompt einfuegen/i }) as HTMLButtonElement).disabled).toBe(true)
    })

    await userEvent.click(pastePromptItem)
    expect(readClipboardTextSpy).not.toHaveBeenCalled()

    hasClipboardImageSpy.mockRestore()
    readClipboardTextSpy.mockRestore()
  })

  it('restores the last statistics view and filter from a session command', async () => {
    const onSessionContextChange = vi.fn()
    const baseStats = createCompletionResult().stats
    const filteredStats: PuzzleStats = {
      ...baseStats,
      recentCompletions: [
        createCompletionRecord('1', '2026-04-11T10:00:00.000Z'),
        {
          ...createCompletionRecord('2', '2026-04-11T09:00:00.000Z'),
          config: { rows: 3, cols: 3 },
        },
      ],
      completionHistory: [
        createCompletionRecord('1', '2026-04-11T10:00:00.000Z'),
        {
          ...createCompletionRecord('2', '2026-04-11T09:00:00.000Z'),
          config: { rows: 3, cols: 3 },
        },
      ],
    }

    render(
      <UploadScreen
        onImageLoaded={vi.fn()}
        onGoToStartScreen={vi.fn()}
        onOpenHelp={vi.fn()}
        onHelpContextChange={vi.fn()}
        onSessionContextChange={onSessionContextChange}
        commandRequest={{
          id: 1,
          action: 'restore-session',
          window: 'stats',
          historyFilter: '4x4',
        }}
        registerAppContextMenuHandler={vi.fn()}
        savedGames={[]}
        isLoadingSavedGames={false}
        savedGamesError={null}
        stats={filteredStats}
        isLoadingStats={false}
        isResettingStats={false}
        statsError={null}
        gallery={null}
        isLoadingGallery={false}
        isResettingGallery={false}
        galleryError={null}
        isFetchingRandom={false}
        randomImageError={null}
        onFetchRandomImage={vi.fn()}
        onLoadSavedGame={vi.fn()}
        onDeleteSavedGame={vi.fn()}
        onDeleteAllSavedGames={vi.fn()}
        onResetStats={vi.fn()}
        onResetGallery={vi.fn()}
        onReplayGalleryEntry={vi.fn()}
        onDeleteGalleryEntries={vi.fn()}
        onCreateBackupFile={vi.fn()}
        onDeleteBackupFile={vi.fn()}
        onImportBackupFile={vi.fn()}
      />
    )

    fireEvent.click(await screen.findByRole('tab', { name: 'Rohdaten' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Einzellauf-Historie' }))

    await waitFor(() => {
      expect(screen.getByText('1 von 2 Eintraegen sichtbar')).toBeTruthy()
    })

    expect(
      document.body.querySelector('.workspace-window-nav-button[data-workspace-window-nav="stats"]')?.getAttribute('aria-current')
    ).toBe('page')

    expect(onSessionContextChange).toHaveBeenCalledWith({
      activeWindow: 'stats',
      historyFilter: '4x4',
    })
  })

  it('restores crop draft props and reports crop draft changes', async () => {
    const onSessionDraftChange = vi.fn()
    const initialTransform = {
      zoom: 1.5,
      rotationDeg: 90,
      offsetX: 24,
      offsetY: -12,
    }

    render(
      <CropScreen
        image="data:image/png;base64,test"
        config={{ rows: 4, cols: 4 }}
        onOpenHelp={vi.fn()}
        registerAppContextMenuHandler={vi.fn()}
        isRandomImage
        randomImageSource={{
          label: 'Lorem Picsum',
          url: 'https://picsum.photos/',
        }}
        initialTransform={initialTransform}
        initialUseFullImage
        onSessionDraftChange={onSessionDraftChange}
        onFetchNewRandomImage={vi.fn()}
        onConfigChange={vi.fn()}
        onCropConfirmed={vi.fn()}
        onBack={vi.fn()}
        onGoToStartScreen={vi.fn()}
      />
    )

    const modeSelect = screen.getByLabelText(/Bildmodus/i) as HTMLSelectElement
    expect(modeSelect.value).toBe('full')

    await waitFor(() => {
      expect(onSessionDraftChange).toHaveBeenCalledWith({
        transform: initialTransform,
        useFullImage: true,
      })
    })

    fireEvent.change(modeSelect, {
      target: {
        value: 'crop',
      },
    })

    await waitFor(() => {
      expect(onSessionDraftChange).toHaveBeenLastCalledWith({
        transform: initialTransform,
        useFullImage: false,
      })
    })
  })

  it('reloads a random crop image without forwarding the click event as a query', async () => {
    const onFetchNewRandomImage = vi.fn()

    render(
      <CropScreen
        image="data:image/png;base64,test"
        config={{ rows: 4, cols: 4 }}
        onOpenHelp={vi.fn()}
        registerAppContextMenuHandler={vi.fn()}
        isRandomImage
        randomImageSource={{
          label: 'Lorem Picsum',
          url: 'https://picsum.photos/',
        }}
        onFetchNewRandomImage={onFetchNewRandomImage}
        onConfigChange={vi.fn()}
        onCropConfirmed={vi.fn()}
        onBack={vi.fn()}
        onGoToStartScreen={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Anderes Bild laden/i }))

    expect(onFetchNewRandomImage).toHaveBeenCalledTimes(1)
    expect(onFetchNewRandomImage).toHaveBeenCalledWith()
  })

  it('allows switching windows after restoring a last session', async () => {
    const user = userEvent.setup()
    const baseStats = createCompletionResult().stats
    const filteredStats: PuzzleStats = {
      ...baseStats,
      recentCompletions: [
        createCompletionRecord('1', '2026-04-11T10:00:00.000Z'),
        {
          ...createCompletionRecord('2', '2026-04-11T09:00:00.000Z'),
          config: { rows: 3, cols: 3 },
        },
      ],
      completionHistory: [
        createCompletionRecord('1', '2026-04-11T10:00:00.000Z'),
        {
          ...createCompletionRecord('2', '2026-04-11T09:00:00.000Z'),
          config: { rows: 3, cols: 3 },
        },
      ],
    }

    render(
      <UploadScreen
        onImageLoaded={vi.fn()}
        onGoToStartScreen={vi.fn()}
        onOpenHelp={vi.fn()}
        onHelpContextChange={vi.fn()}
        onSessionContextChange={vi.fn()}
        commandRequest={{
          id: 1,
          action: 'restore-session',
          window: 'stats',
          historyFilter: '4x4',
        }}
        registerAppContextMenuHandler={vi.fn()}
        savedGames={[]}
        isLoadingSavedGames={false}
        savedGamesError={null}
        stats={filteredStats}
        isLoadingStats={false}
        isResettingStats={false}
        statsError={null}
        gallery={null}
        isLoadingGallery={false}
        isResettingGallery={false}
        galleryError={null}
        isFetchingRandom={false}
        randomImageError={null}
        onFetchRandomImage={vi.fn()}
        onLoadSavedGame={vi.fn()}
        onDeleteSavedGame={vi.fn()}
        onDeleteAllSavedGames={vi.fn()}
        onResetStats={vi.fn()}
        onResetGallery={vi.fn()}
        onReplayGalleryEntry={vi.fn()}
        onDeleteGalleryEntries={vi.fn()}
        onCreateBackupFile={vi.fn()}
        onDeleteBackupFile={vi.fn()}
        onImportBackupFile={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(
        document.body.querySelector('.workspace-window-nav-button[data-workspace-window-nav="stats"]')?.getAttribute('aria-current')
      ).toBe('page')
    })

    const galleryButton = document.body.querySelector<HTMLButtonElement>(
      '.workspace-window-nav-button[data-workspace-window-nav="gallery"]'
    )

    expect(galleryButton).toBeTruthy()
    await user.click(galleryButton!)

    await waitFor(() => {
      expect(
        document.body.querySelector('.workspace-window-nav-button[data-workspace-window-nav="gallery"]')?.getAttribute('aria-current')
      ).toBe('page')
    })

    expect(
      document.body.querySelector('.workspace-window-nav-button[data-workspace-window-nav="stats"]')?.getAttribute('aria-current')
    ).not.toBe('page')
  })

  it('forwards refs to the three workspace launcher cards', () => {
    const savedGamesActionRef = React.createRef<HTMLButtonElement>()
    const statsActionRef = React.createRef<HTMLButtonElement>()
    const galleryActionRef = React.createRef<HTMLButtonElement>()

    render(
      <UploadWorkspaceLauncher
        savedGamesActionRef={savedGamesActionRef}
        statsActionRef={statsActionRef}
        galleryActionRef={galleryActionRef}
        savedGamesCount={1}
        totalSolved={20}
        activeDays={5}
        galleryEntriesCount={1}
        gallerySolveCount={1}
        latestActivityAt="2026-04-11T10:00:00.000Z"
        latestGalleryAt="2026-04-11T11:00:00.000Z"
        isLoadingSavedGames={false}
        isLoadingStats={false}
        isLoadingGallery={false}
        onOpenSavedGames={vi.fn()}
        onOpenStats={vi.fn()}
        onOpenGallery={vi.fn()}
      />
    )

    expect(savedGamesActionRef.current).toBe(screen.getByRole('button', { name: /Spielstaende/i }))
    expect(statsActionRef.current).toBe(screen.getByRole('button', { name: /Statistik/i }))
    expect(galleryActionRef.current).toBe(screen.getByRole('button', { name: /Galerie/i }))
  })

  it('returns to the backup import action when the import confirm dialog is cancelled', async () => {
    vi.mocked(listPuzzleDataBackupFiles).mockResolvedValueOnce([createBackup('backup-a.spbkp')])

    render(
      <UploadScreen
        onImageLoaded={vi.fn()}
        onGoToStartScreen={vi.fn()}
        onOpenHelp={vi.fn()}
        onHelpContextChange={vi.fn()}
        registerAppContextMenuHandler={vi.fn()}
        savedGames={[]}
        isLoadingSavedGames={false}
        savedGamesError={null}
        stats={null}
        isLoadingStats={false}
        isResettingStats={false}
        statsError={null}
        gallery={null}
        isLoadingGallery={false}
        isResettingGallery={false}
        galleryError={null}
        isFetchingRandom={false}
        randomImageError={null}
        onFetchRandomImage={vi.fn()}
        onLoadSavedGame={vi.fn()}
        onDeleteSavedGame={vi.fn()}
        onDeleteAllSavedGames={vi.fn()}
        onResetStats={vi.fn()}
        onResetGallery={vi.fn()}
        onReplayGalleryEntry={vi.fn()}
        onDeleteGalleryEntries={vi.fn()}
        onCreateBackupFile={vi.fn()}
        onDeleteBackupFile={vi.fn()}
        onImportBackupFile={vi.fn()}
      />
    )

    const importButton = await screen.findByRole('button', { name: 'Backup importieren' })
    importButton.focus()
    fireEvent.click(importButton)

    const selectBackupButton = await screen.findByRole('button', { name: 'Auswaehlen' })
    fireEvent.click(selectBackupButton)

    const cancelButton = await screen.findByRole('button', { name: 'Abbrechen' })
    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).toBeNull()
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Backup importieren' }))
    })

    expect(cancelButton.isConnected).toBe(false)
  })

  it('returns to the backup import action when the backup browser is closed', async () => {
    vi.mocked(listPuzzleDataBackupFiles).mockResolvedValueOnce([createBackup('backup-a.spbkp')])

    render(
      <UploadScreen
        onImageLoaded={vi.fn()}
        onGoToStartScreen={vi.fn()}
        onOpenHelp={vi.fn()}
        onHelpContextChange={vi.fn()}
        registerAppContextMenuHandler={vi.fn()}
        savedGames={[]}
        isLoadingSavedGames={false}
        savedGamesError={null}
        stats={null}
        isLoadingStats={false}
        isResettingStats={false}
        statsError={null}
        gallery={null}
        isLoadingGallery={false}
        isResettingGallery={false}
        galleryError={null}
        isFetchingRandom={false}
        randomImageError={null}
        onFetchRandomImage={vi.fn()}
        onLoadSavedGame={vi.fn()}
        onDeleteSavedGame={vi.fn()}
        onDeleteAllSavedGames={vi.fn()}
        onResetStats={vi.fn()}
        onResetGallery={vi.fn()}
        onReplayGalleryEntry={vi.fn()}
        onDeleteGalleryEntries={vi.fn()}
        onCreateBackupFile={vi.fn()}
        onDeleteBackupFile={vi.fn()}
        onImportBackupFile={vi.fn()}
      />
    )

    const importButton = await screen.findByRole('button', { name: 'Backup importieren' })
    importButton.focus()
    fireEvent.click(importButton)

    await screen.findByRole('button', { name: 'Schliessen' })
    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Backup importieren' })).toBeNull()
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Backup importieren' }))
    })
  })

  it('returns focus to the saved games workspace card after deleting all saves', async () => {
    const firstSave = createSavedGame('1', '2026-04-11T10:00:00.000Z')
    const secondSave = createSavedGame('2', '2026-04-11T11:00:00.000Z')

    function DeleteAllSavedGamesHarness() {
      const [savedGames, setSavedGames] = React.useState([firstSave, secondSave])

      return (
        <UploadScreen
          onImageLoaded={vi.fn()}
          onGoToStartScreen={vi.fn()}
          onOpenHelp={vi.fn()}
          onHelpContextChange={vi.fn()}
          registerAppContextMenuHandler={vi.fn()}
          savedGames={savedGames}
          isLoadingSavedGames={false}
          savedGamesError={null}
          stats={null}
          isLoadingStats={false}
          isResettingStats={false}
          statsError={null}
          gallery={null}
          isLoadingGallery={false}
          isResettingGallery={false}
          galleryError={null}
          isFetchingRandom={false}
          randomImageError={null}
          onFetchRandomImage={vi.fn()}
          onLoadSavedGame={vi.fn()}
          onDeleteSavedGame={vi.fn()}
          onDeleteAllSavedGames={async () => {
            setSavedGames([])
          }}
          onResetStats={vi.fn()}
          onResetGallery={vi.fn()}
          onReplayGalleryEntry={vi.fn()}
          onDeleteGalleryEntries={vi.fn()}
          onCreateBackupFile={vi.fn()}
          onDeleteBackupFile={vi.fn()}
          onImportBackupFile={vi.fn()}
        />
      )
    }

    render(<DeleteAllSavedGamesHarness />)

    fireEvent.click(screen.getByRole('button', { name: /Spielstaende/i }))

    const deleteAllButton = await screen.findByRole('button', { name: 'Alle loeschen' })
    deleteAllButton.focus()
    fireEvent.click(deleteAllButton)

    const dialog = await screen.findByRole('alertdialog', { name: 'Alle Spielstaende loeschen?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Alle loeschen' }))

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).toBeNull()
      expect(document.activeElement).toBe(
        document.body.querySelector('.workspace-window-nav-button[data-workspace-window-nav="savedGames"]')
      )
    })
  })

  it('returns focus to the statistics workspace card after resetting statistics', async () => {
    function ResetStatsHarness() {
      const [stats, setStats] = React.useState<PuzzleStats | null>(createCompletionResult().stats)

      return (
        <UploadScreen
          onImageLoaded={vi.fn()}
          onGoToStartScreen={vi.fn()}
          onOpenHelp={vi.fn()}
          onHelpContextChange={vi.fn()}
          registerAppContextMenuHandler={vi.fn()}
          savedGames={[]}
          isLoadingSavedGames={false}
          savedGamesError={null}
          stats={stats}
          isLoadingStats={false}
          isResettingStats={false}
          statsError={null}
          gallery={null}
          isLoadingGallery={false}
          isResettingGallery={false}
          galleryError={null}
          isFetchingRandom={false}
          randomImageError={null}
          onFetchRandomImage={vi.fn()}
          onLoadSavedGame={vi.fn()}
          onDeleteSavedGame={vi.fn()}
          onDeleteAllSavedGames={vi.fn()}
          onResetStats={async () => {
            setStats(null)
          }}
          onResetGallery={vi.fn()}
          onReplayGalleryEntry={vi.fn()}
          onDeleteGalleryEntries={vi.fn()}
          onCreateBackupFile={vi.fn()}
          onDeleteBackupFile={vi.fn()}
          onImportBackupFile={vi.fn()}
        />
      )
    }

    render(<ResetStatsHarness />)

    fireEvent.click(screen.getByRole('button', { name: /Statistik/i }))

    const resetButton = await screen.findByRole('button', { name: 'Statistik loeschen' })
    resetButton.focus()
    fireEvent.click(resetButton)

    const dialog = await screen.findByRole('alertdialog', { name: 'Statistik loeschen?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Statistik loeschen' }))

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).toBeNull()
      expect(document.activeElement).toBe(
        document.body.querySelector('.workspace-window-nav-button[data-workspace-window-nav="stats"]')
      )
    })
  })

  it('returns focus to the gallery workspace card after resetting the gallery', async () => {
    function ResetGalleryHarness() {
      const [gallery, setGallery] = React.useState<SolvedGallery | null>(
        createSolvedGallery('1', '2026-04-11T10:00:00.000Z')
      )

      return (
        <UploadScreen
          onImageLoaded={vi.fn()}
          onGoToStartScreen={vi.fn()}
          onOpenHelp={vi.fn()}
          onHelpContextChange={vi.fn()}
          registerAppContextMenuHandler={vi.fn()}
          savedGames={[]}
          isLoadingSavedGames={false}
          savedGamesError={null}
          stats={null}
          isLoadingStats={false}
          isResettingStats={false}
          statsError={null}
          gallery={gallery}
          isLoadingGallery={false}
          isResettingGallery={false}
          galleryError={null}
          isFetchingRandom={false}
          randomImageError={null}
          onFetchRandomImage={vi.fn()}
          onLoadSavedGame={vi.fn()}
          onDeleteSavedGame={vi.fn()}
          onDeleteAllSavedGames={vi.fn()}
          onResetStats={vi.fn()}
          onResetGallery={async () => {
            setGallery(null)
          }}
          onReplayGalleryEntry={vi.fn()}
          onDeleteGalleryEntries={vi.fn()}
          onCreateBackupFile={vi.fn()}
          onDeleteBackupFile={vi.fn()}
          onImportBackupFile={vi.fn()}
        />
      )
    }

    render(<ResetGalleryHarness />)

    fireEvent.click(screen.getByRole('button', { name: /Galerie/i }))

    const resetButton = await screen.findByRole('button', { name: 'Galerie loeschen' })
    resetButton.focus()
    fireEvent.click(resetButton)

    const dialog = await screen.findByRole('alertdialog', { name: 'Galerie loeschen?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Galerie loeschen' }))

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).toBeNull()
      expect(document.activeElement).toBe(
        document.body.querySelector('.workspace-window-nav-button[data-workspace-window-nav="gallery"]')
      )
    })
  })

  it('returns from the crop screen with Escape when focus stays in the page', async () => {
    const onBack = vi.fn()

    render(
      <CropScreen
        image="data:image/png;base64,test"
        config={{ rows: 4, cols: 4 }}
        onOpenHelp={vi.fn()}
        registerAppContextMenuHandler={vi.fn()}
        onConfigChange={vi.fn()}
        onCropConfirmed={vi.fn()}
        onBack={onBack}
        onGoToStartScreen={vi.fn()}
      />
    )

    const difficultyOption = await screen.findByRole('radio', { checked: true })
    difficultyOption.focus()
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('focuses the crop preview with B from the active crop controls', async () => {
    const OriginalImage = window.Image

    class LoadingImage {
      onload: ((event: Event) => void) | null = null
      onerror: ((event: Event) => void) | null = null
      naturalWidth = 640
      naturalHeight = 480
      width = 640
      height = 480
      private currentSrc = ''

      get src() {
        return this.currentSrc
      }

      set src(value: string) {
        this.currentSrc = value
        window.setTimeout(() => this.onload?.(new Event('load')), 0)
      }
    }

    Object.defineProperty(window, 'Image', {
      configurable: true,
      writable: true,
      value: LoadingImage,
    })

    try {
      render(
        <CropScreen
          image="data:image/png;base64,test"
          config={{ rows: 4, cols: 4 }}
          onOpenHelp={vi.fn()}
          registerAppContextMenuHandler={vi.fn()}
          initialUseFullImage
          onConfigChange={vi.fn()}
          onCropConfirmed={vi.fn()}
          onBack={vi.fn()}
          onGoToStartScreen={vi.fn()}
        />
      )

      const preview = await screen.findByRole('group', { name: /Bildvorschau/i })
      const activeDifficulty = screen.getByRole('radio', { checked: true })

      await waitFor(() => {
        expect(document.activeElement).toBe(activeDifficulty)
      })

      fireEvent.keyDown(window, { key: 'B' })

      expect(document.activeElement).toBe(preview)
      expect(screen.getByText(/B fokussiert die Vorschau/i)).toBeTruthy()
    } finally {
      Object.defineProperty(window, 'Image', {
        configurable: true,
        writable: true,
        value: OriginalImage,
      })
    }
  })

  it('switches between help and command palette without leaving both overlays open', () => {
    function OverlayShortcutHarness() {
      const [activeOverlay, setActiveOverlay] = React.useState<'help' | 'commandPalette' | null>(null)
      const isHelpOpen = activeOverlay === 'help'
      const isCommandPaletteOpen = activeOverlay === 'commandPalette'

      const openHelp = React.useCallback(() => {
        setActiveOverlay('help')
      }, [])

      const closeHelp = React.useCallback(() => {
        setActiveOverlay((current) => (current === 'help' ? null : current))
      }, [])

      const openCommandPalette = React.useCallback(() => {
        setActiveOverlay('commandPalette')
      }, [])

      const closeCommandPalette = React.useCallback(() => {
        setActiveOverlay((current) => (current === 'commandPalette' ? null : current))
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

      return (
        <AnimatePresence initial={false} mode="wait">
          {activeOverlay === 'help' ? (
            <GlobalHelpOverlay key="help" helpContext="welcome" onClose={closeHelp} />
          ) : activeOverlay === 'commandPalette' ? (
            <CommandPalette
              key="command-palette"
              commands={[
                {
                  id: 'gallery',
                  title: 'Galerie oeffnen',
                  detail: 'Motive und geloeste Eintraege anzeigen.',
                  section: 'Navigation',
                  icon: 'image',
                  onSelect: vi.fn(),
                },
              ]}
              contextLabel="Willkommen"
              onClose={closeCommandPalette}
            />
          ) : null}
        </AnimatePresence>
      )
    }

    render(<OverlayShortcutHarness />)

    fireEvent.keyDown(window, { key: 'F1' })
    expect(screen.getByRole('heading', { name: 'Shortcuts und Bedienung' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Command Palette' })).toBeNull()

    fireEvent.keyDown(window, { key: 'F8' })
    expect(screen.getByRole('heading', { name: 'Command Palette' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Shortcuts und Bedienung' })).toBeNull()

    fireEvent.keyDown(window, { key: 'F1' })
    expect(screen.getByRole('heading', { name: 'Shortcuts und Bedienung' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Command Palette' })).toBeNull()
  })
})
