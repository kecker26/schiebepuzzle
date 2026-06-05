import {
  type AriaRole,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ensureElementVisible } from '../../app/focusVisibility.ts'
import AnimatedStateSwap from '../../motion/AnimatedStateSwap.tsx'
import { SavedGameSummary } from '../../types/index'
import UploadPageNavigation from './UploadPageNavigation.tsx'
import UploadSavedGameItem from './UploadSavedGameItem.tsx'
import UploadStateNotice from './UploadStateNotice.tsx'

interface UploadSavedGamesPanelProps {
  isLoadingSavedGames: boolean
  savedGames: SavedGameSummary[]
  savedGamesCount: number
  loadingSaveId: string | null
  deletingSaveId: string | null
  isDeletingAllSavedGames: boolean
  onLoadSave: (saveId: string) => void
  onDeleteRequest: (save: SavedGameSummary) => void
  onDeleteAllRequest: () => void
  titleId?: string
  panelRole?: AriaRole
  primaryActionRef?: RefObject<HTMLButtonElement>
}

interface PendingSavedGameDeletionFocus {
  saveId: string
  savedIndex: number
}

const SAVED_GAMES_PER_PAGE = 5

export default function UploadSavedGamesPanel({
  isLoadingSavedGames,
  savedGames,
  savedGamesCount,
  loadingSaveId,
  deletingSaveId,
  isDeletingAllSavedGames,
  onLoadSave,
  onDeleteRequest,
  onDeleteAllRequest,
  titleId = 'dashboard-savedgames-title',
  panelRole = 'tabpanel',
  primaryActionRef,
}: UploadSavedGamesPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const pendingDeletionFocusRef = useRef<PendingSavedGameDeletionFocus | null>(null)
  const pendingDeleteAllFocusRef = useRef(false)
  const previousDeletingSaveIdRef = useRef<string | null>(null)
  const previousDeletingAllSavedGamesRef = useRef(isDeletingAllSavedGames)
  const [currentPage, setCurrentPage] = useState(1)
  const isBulkActionDisabled =
    isLoadingSavedGames ||
    isDeletingAllSavedGames ||
    loadingSaveId !== null ||
    deletingSaveId !== null
  const savedGamesPageCount = Math.max(1, Math.ceil(savedGames.length / SAVED_GAMES_PER_PAGE))
  const activeSavedGamesPage = Math.min(currentPage, savedGamesPageCount)
  const visibleSavedGames = useMemo(() => {
    const startIndex = (activeSavedGamesPage - 1) * SAVED_GAMES_PER_PAGE
    return savedGames.slice(startIndex, startIndex + SAVED_GAMES_PER_PAGE)
  }, [activeSavedGamesPage, savedGames])
  const savedGamesStateKey = isLoadingSavedGames
    ? 'loading'
    : savedGames.length === 0
      ? 'empty'
      : `content-${activeSavedGamesPage}`

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, savedGamesPageCount))
  }, [savedGamesPageCount])

  const handlePageClick = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  const focusSavedGamesElement = useCallback((target: HTMLElement | null) => {
    if (!target) {
      return
    }

    target.focus({ preventScroll: true })
    const visibleTarget = target.closest<HTMLElement>('.saved-game-item') ?? target
    ensureElementVisible(visibleTarget)
  }, [])

  const findSaveActionButton = useCallback((saveId: string, action: 'load' | 'delete'): HTMLButtonElement | null => {
    const panel = panelRef.current
    if (!panel) {
      return null
    }

    return Array.from(
      panel.querySelectorAll<HTMLButtonElement>(`button[data-save-action="${action}"]:not([disabled])`)
    ).find((button) => button.dataset.saveId === saveId) ?? null
  }, [])

  const findWorkspaceFallbackTarget = useCallback((): HTMLElement | null => {
    const panel = panelRef.current
    if (!panel) {
      return null
    }

    return (
      panel
        .closest<HTMLElement>('.workspace-window-shell')
        ?.querySelector<HTMLElement>('.workspace-window-nav-button[aria-current="page"]')
      ?? null
    )
  }, [])

  useEffect(() => {
    const previousDeletingSaveId = previousDeletingSaveIdRef.current
    const previousWasDeletingAllSavedGames = previousDeletingAllSavedGamesRef.current

    if (deletingSaveId && previousDeletingSaveId === null) {
      pendingDeletionFocusRef.current = {
        saveId: deletingSaveId,
        savedIndex: savedGames.findIndex((save) => save.id === deletingSaveId),
      }
    }

    if (isDeletingAllSavedGames && !previousWasDeletingAllSavedGames) {
      pendingDeleteAllFocusRef.current = savedGames.length > 0
    }

    if (previousDeletingSaveId && deletingSaveId === null) {
      const focusRequest = pendingDeletionFocusRef.current
      const deletedIndex = focusRequest?.saveId === previousDeletingSaveId ? focusRequest.savedIndex : -1
      const wasDeleted = deletedIndex >= 0 && !savedGames.some((save) => save.id === previousDeletingSaveId)

      pendingDeletionFocusRef.current = null

      if (wasDeleted) {
        const nextSave =
          savedGames[deletedIndex]
          ?? savedGames[deletedIndex - 1]
          ?? null

        if (nextSave) {
          focusSavedGamesElement(
            findSaveActionButton(nextSave.id, 'delete')
            ?? findSaveActionButton(nextSave.id, 'load')
          )
        } else {
          focusSavedGamesElement(findWorkspaceFallbackTarget())
        }
      }
    }

    if (previousWasDeletingAllSavedGames && !isDeletingAllSavedGames) {
      const shouldRestoreFocus = pendingDeleteAllFocusRef.current && savedGames.length === 0
      pendingDeleteAllFocusRef.current = false

      if (shouldRestoreFocus) {
        focusSavedGamesElement(findWorkspaceFallbackTarget())
      }
    }
  }, [
    deletingSaveId,
    findSaveActionButton,
    findWorkspaceFallbackTarget,
    focusSavedGamesElement,
    isDeletingAllSavedGames,
    savedGames,
  ])

  useEffect(() => {
    previousDeletingSaveIdRef.current = deletingSaveId
    previousDeletingAllSavedGamesRef.current = isDeletingAllSavedGames
  }, [deletingSaveId, isDeletingAllSavedGames])

  const handleSaveActionKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
      return
    }

    const currentButton = event.currentTarget
    const action = currentButton.dataset.saveAction
    const actionGroup = currentButton.closest<HTMLElement>('.saved-game-actions')
    const list = currentButton.closest<HTMLElement>('.saved-games-list')

    if (!action || !actionGroup || !list) {
      return
    }

    const siblingButtons = Array.from(
      actionGroup.querySelectorAll<HTMLButtonElement>('button:not([disabled])')
    )
    const sameActionButtons = Array.from(
      list.querySelectorAll<HTMLButtonElement>(`button[data-save-action="${action}"]:not([disabled])`)
    )
    const siblingIndex = siblingButtons.indexOf(currentButton)
    const actionIndex = sameActionButtons.indexOf(currentButton)

    const focusSiblingAtIndex = (nextIndex: number) => {
      const targetButton = siblingButtons[nextIndex]
      if (!targetButton) {
        return
      }

      targetButton.focus({ preventScroll: true })
      targetButton.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'auto',
      })
    }

    const focusSameActionAtIndex = (nextIndex: number) => {
      const targetButton = sameActionButtons[nextIndex]
      if (!targetButton) {
        return
      }

      targetButton.focus({ preventScroll: true })
      targetButton.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'auto',
      })
    }

    switch (event.key) {
      case 'ArrowLeft':
        if (siblingIndex > 0) {
          event.preventDefault()
          focusSiblingAtIndex(siblingIndex - 1)
        }
        return
      case 'ArrowRight':
        if (siblingIndex >= 0 && siblingIndex < siblingButtons.length - 1) {
          event.preventDefault()
          focusSiblingAtIndex(siblingIndex + 1)
        }
        return
      case 'ArrowUp':
        if (actionIndex > 0) {
          event.preventDefault()
          focusSameActionAtIndex(actionIndex - 1)
        }
        return
      case 'ArrowDown':
        if (actionIndex >= 0 && actionIndex < sameActionButtons.length - 1) {
          event.preventDefault()
          focusSameActionAtIndex(actionIndex + 1)
        }
        return
      case 'Home':
        if (sameActionButtons.length > 0) {
          event.preventDefault()
          focusSameActionAtIndex(0)
        }
        return
      case 'End':
        if (sameActionButtons.length > 0) {
          event.preventDefault()
          focusSameActionAtIndex(sameActionButtons.length - 1)
        }
        return
    }
  }, [])

  return (
    <div
      ref={panelRef}
      id="dashboard-panel-savedGames"
      className="dashboard-panel-scroll"
      role={panelRole}
      aria-labelledby={titleId}
    >
      <div className="dashboard-section-header">
        <div>
          <span className="saved-games-kicker">Fortsetzen</span>
          <h3 id={titleId} className="dashboard-section-title">
            Gespeicherte Spielstaende
          </h3>
        </div>
        {!isLoadingSavedGames && savedGamesCount > 0 && (
          <div className="dashboard-section-header-actions">
            <span className="saved-games-count">{savedGamesCount} aktiv</span>
            <button
              type="button"
              className="secondary saved-games-delete-all-button"
              onClick={onDeleteAllRequest}
              disabled={isBulkActionDisabled}
              data-app-tooltip="Alle gespeicherten Zwischenstaende loeschen. Statistik und Galerie bleiben erhalten."
              data-app-tooltip-position="top"
            >
              {isDeletingAllSavedGames ? 'Loesche alle ...' : 'Alle loeschen'}
            </button>
          </div>
        )}
      </div>

      <AnimatedStateSwap stateKey={savedGamesStateKey} className="dashboard-state-swap">
        {isLoadingSavedGames ? (
          <UploadStateNotice
            icon={'\u{23F3}'}
            iconName="timer"
            title="Spielstaende werden geladen ..."
            detail="Die zuletzt gesicherten Partien werden gerade eingelesen."
            role="status"
            ariaLive="polite"
          />
        ) : savedGames.length === 0 ? (
          <UploadStateNotice
            icon={'\u{1F4E6}'}
            iconName="folder"
            title="Keine Spielstaende vorhanden."
            detail="Starte auf der Auswahlseite ein neues Puzzle. Dein Fortschritt landet danach automatisch hier im Bereich."
            className="saved-games-empty-state"
          />
        ) : (
          <div className="dashboard-saves-shell">
            <ul className="saved-games-list">
              {visibleSavedGames.map((save) => {
                return (
                  <UploadSavedGameItem
                    key={save.id}
                    save={save}
                    isLoading={loadingSaveId === save.id}
                    isDeleting={deletingSaveId === save.id}
                    isDeletingAllSavedGames={isDeletingAllSavedGames}
                    primaryActionRef={primaryActionRef && visibleSavedGames[0]?.id === save.id ? primaryActionRef : undefined}
                    onLoadSave={onLoadSave}
                    onDeleteRequest={onDeleteRequest}
                    onActionKeyDown={handleSaveActionKeyDown}
                  />
                )
              })}
            </ul>
            <UploadPageNavigation
              activePage={activeSavedGamesPage}
              ariaLabel="Spielstandseiten"
              isDisabled={isBulkActionDisabled}
              onPageChange={handlePageClick}
              pageCount={savedGamesPageCount}
            />
          </div>
        )}
      </AnimatedStateSwap>
    </div>
  )
}
