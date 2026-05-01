import type { AriaRole, RefObject } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ensureElementVisible } from '../../app/focusVisibility.ts'
import AnimatedStateSwap from '../../motion/AnimatedStateSwap.tsx'
import { SolvedGallery, SolvedGalleryEntry } from '../../types/index'
import { formatDifficultyLabel } from '../../utils/puzzleDifficulty.ts'
import UploadConfirmDialog from './UploadConfirmDialog.tsx'
import UploadGalleryCard from './UploadGalleryCard.tsx'
import UploadGalleryDetailDialog from './UploadGalleryDetailDialog.tsx'
import {
  buildGalleryDisplayEntriesFromGroups,
  buildGalleryDisplayGroups,
  formatGallerySolveCount,
  GalleryDisplayEntry,
  sortGalleryDisplayEntries,
} from './UploadGalleryDisplayUtils.ts'
import UploadGalleryToolbar from './UploadGalleryToolbar.tsx'
import UploadStateNotice from './UploadStateNotice.tsx'
import {
  GalleryAssistanceFilter,
  GalleryDifficultyFilter,
  GallerySortOption,
  formatDate,
  getGalleryDifficultyFilterOptions,
} from './uploadUtils.ts'

interface UploadGalleryPanelProps {
  gallery: SolvedGallery | null
  isLoadingGallery: boolean
  onReplayEntry: (entry: SolvedGalleryEntry) => void
  onDeleteEntries: (entryIds: string[]) => Promise<void>
  titleId?: string
  panelRole?: AriaRole
  primaryFilterRef?: RefObject<HTMLSelectElement>
}

type GalleryAction = 'preview' | 'play-primary' | 'play-secondary' | 'details' | 'delete'

interface PendingGalleryDeletionFocus {
  entryId: string
  action: GalleryAction
  visibleIndex: number
}

interface PendingGalleryDeletionRequest extends PendingGalleryDeletionFocus {
  entry: GalleryDisplayEntry
}

type GalleryToolbarFocusTarget = 'difficulty' | 'assistance' | 'sort'

export default function UploadGalleryPanel({
  gallery,
  isLoadingGallery,
  onReplayEntry,
  onDeleteEntries,
  titleId = 'workspace-window-gallery-title',
  panelRole = 'region',
  primaryFilterRef,
}: UploadGalleryPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const difficultySelectInternalRef = useRef<HTMLSelectElement>(null)
  const assistanceSelectRef = useRef<HTMLSelectElement>(null)
  const sortSelectRef = useRef<HTMLSelectElement>(null)
  const resetButtonRef = useRef<HTMLButtonElement>(null)
  const entries = useMemo(() => gallery?.entries ?? [], [gallery])
  const totalSolveCount = gallery?.totalEntries ?? entries.length
  const latestCompletedAt = gallery?.lastCompletedAt ?? entries[0]?.completedAt ?? null

  const [difficultyFilter, setDifficultyFilter] = useState<GalleryDifficultyFilter>('all')
  const [assistanceFilter, setAssistanceFilter] = useState<GalleryAssistanceFilter>('all')
  const [sortOption, setSortOption] = useState<GallerySortOption>('latest')
  const [selectedEntry, setSelectedEntry] = useState<GalleryDisplayEntry | null>(null)
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null)
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState<PendingGalleryDeletionRequest | null>(null)
  const deletingEntryIdRef = useRef<string | null>(null)
  const pendingDeletionFocusRef = useRef<PendingGalleryDeletionFocus | null>(null)
  const pendingCancelFocusRef = useRef<Pick<PendingGalleryDeletionFocus, 'entryId' | 'action'> | null>(null)
  const pendingToolbarFocusRef = useRef<GalleryToolbarFocusTarget | null>(null)

  const difficultyOptions = useMemo(() => getGalleryDifficultyFilterOptions(), [])
  const galleryGroups = useMemo(() => buildGalleryDisplayGroups(entries), [entries])
  const groupedEntries = useMemo(
    () =>
      buildGalleryDisplayEntriesFromGroups(galleryGroups, {
        difficultyFilter: 'all',
        assistanceFilter: 'all',
      }),
    [galleryGroups]
  )
  const visibleEntries = useMemo(() => {
    const filteredEntries = buildGalleryDisplayEntriesFromGroups(galleryGroups, {
      difficultyFilter,
      assistanceFilter,
    })

    return sortGalleryDisplayEntries(filteredEntries, sortOption)
  }, [assistanceFilter, difficultyFilter, galleryGroups, sortOption])

  useEffect(() => {
    deletingEntryIdRef.current = deletingEntryId
  }, [deletingEntryId])

  useEffect(() => {
    if (!selectedEntry) return

    const nextSelectedEntry =
      visibleEntries.find((entry) => entry.id === selectedEntry.id) ??
      groupedEntries.find((entry) => entry.id === selectedEntry.id) ??
      null

    if (!nextSelectedEntry) {
      setSelectedEntry(null)
      return
    }

    if (nextSelectedEntry !== selectedEntry) {
      setSelectedEntry(nextSelectedEntry)
    }
  }, [groupedEntries, selectedEntry, visibleEntries])

  const focusPanelElement = useCallback((target: HTMLElement | null) => {
    if (!target) {
      return
    }

    target.focus({ preventScroll: true })
    ensureElementVisible(target)
  }, [])

  const findGalleryActionButton = useCallback((entryId: string, action: GalleryAction): HTMLButtonElement | null => {
    const panel = panelRef.current
    if (!panel) {
      return null
    }

    return Array.from(
      panel.querySelectorAll<HTMLButtonElement>(`button[data-gallery-action="${action}"]:not([disabled])`)
    ).find((button) => button.dataset.galleryEntryId === entryId) ?? null
  }, [])

  const findGalleryFallbackButton = useCallback((entryId: string): HTMLElement | null => {
    const panel = panelRef.current
    if (!panel) {
      return null
    }

    return Array.from(
      panel.querySelectorAll<HTMLButtonElement>('button[data-gallery-entry-id]:not([disabled])')
    ).find((button) => button.dataset.galleryEntryId === entryId) ?? null
  }, [])

  const findPanelFallbackTarget = useCallback((): HTMLElement | null => {
    const panel = panelRef.current
    if (!panel) {
      return null
    }

    const resetButton = panel.querySelector<HTMLElement>('.gallery-toolbar-reset:not([disabled])')
    if (resetButton) {
      return resetButton
    }

    if (primaryFilterRef?.current?.isConnected) {
      return primaryFilterRef.current
    }

    return (
      panel
        .closest<HTMLElement>('.workspace-window-shell')
        ?.querySelector<HTMLElement>('.workspace-window-nav-button[aria-current="page"]')
      ?? null
    )
  }, [primaryFilterRef])

  const getDifficultySelectTarget = useCallback((): HTMLSelectElement | null => {
    if (primaryFilterRef?.current?.isConnected) {
      return primaryFilterRef.current
    }

    return difficultySelectInternalRef.current?.isConnected
      ? difficultySelectInternalRef.current
      : null
  }, [primaryFilterRef])

  const findToolbarFocusTarget = useCallback((target: GalleryToolbarFocusTarget): HTMLElement | null => {
    switch (target) {
      case 'difficulty':
        return getDifficultySelectTarget()
      case 'assistance':
        return assistanceSelectRef.current?.isConnected ? assistanceSelectRef.current : getDifficultySelectTarget()
      case 'sort':
        return sortSelectRef.current?.isConnected ? sortSelectRef.current : getDifficultySelectTarget()
    }
  }, [getDifficultySelectTarget])

  useEffect(() => {
    const focusRequest = pendingDeletionFocusRef.current
    if (!focusRequest || deletingEntryId !== null) {
      return
    }

    const isStillVisible = visibleEntries.some((entry) => entry.id === focusRequest.entryId)

    pendingDeletionFocusRef.current = null

    if (focusRequest.visibleIndex < 0 || isStillVisible) {
      return
    }

    const nextEntry =
      visibleEntries[focusRequest.visibleIndex]
      ?? visibleEntries[focusRequest.visibleIndex - 1]
      ?? null

    if (nextEntry) {
      focusPanelElement(
        findGalleryActionButton(nextEntry.id, focusRequest.action)
        ?? findGalleryActionButton(nextEntry.id, 'preview')
        ?? findGalleryFallbackButton(nextEntry.id)
      )
      return
    }

    focusPanelElement(findPanelFallbackTarget())
  }, [
    deletingEntryId,
    findGalleryActionButton,
    findGalleryFallbackButton,
    findPanelFallbackTarget,
    focusPanelElement,
    visibleEntries,
  ])

  useEffect(() => {
    const focusRequest = pendingCancelFocusRef.current
    if (!focusRequest || pendingDeleteEntry !== null || deletingEntryId !== null) {
      return
    }

    pendingCancelFocusRef.current = null

    const frameId = window.requestAnimationFrame(() => {
      focusPanelElement(
        findGalleryActionButton(focusRequest.entryId, focusRequest.action)
        ?? findGalleryFallbackButton(focusRequest.entryId)
        ?? findPanelFallbackTarget()
      )
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [
    deletingEntryId,
    findGalleryActionButton,
    findGalleryFallbackButton,
    findPanelFallbackTarget,
    focusPanelElement,
    pendingDeleteEntry,
  ])

  useEffect(() => {
    const focusTarget = pendingToolbarFocusRef.current
    if (!focusTarget) {
      return
    }

    pendingToolbarFocusRef.current = null

    const frameId = window.requestAnimationFrame(() => {
      focusPanelElement(findToolbarFocusTarget(focusTarget))
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [
    assistanceFilter,
    difficultyFilter,
    findToolbarFocusTarget,
    focusPanelElement,
    sortOption,
  ])

  const handleDifficultyFilterChange = useCallback((value: GalleryDifficultyFilter) => {
    pendingToolbarFocusRef.current = 'difficulty'
    setDifficultyFilter(value)
  }, [])

  const handleAssistanceFilterChange = useCallback((value: GalleryAssistanceFilter) => {
    pendingToolbarFocusRef.current = 'assistance'
    setAssistanceFilter(value)
  }, [])

  const handleSortOptionChange = useCallback((value: GallerySortOption) => {
    pendingToolbarFocusRef.current = 'sort'
    setSortOption(value)
  }, [])

  function handleResetFilters() {
    pendingToolbarFocusRef.current = 'difficulty'
    setDifficultyFilter('all')
    setAssistanceFilter('all')
    setSortOption('latest')
  }

  const handleDeleteEntryRequest = useCallback((entry: GalleryDisplayEntry) => {
    if (deletingEntryIdRef.current !== null) return

    const activeElement = document.activeElement
    setPendingDeleteEntry({
      entry,
      entryId: entry.id,
      action:
        activeElement instanceof HTMLButtonElement
        && activeElement.dataset.galleryEntryId === entry.id
        && activeElement.dataset.galleryAction
          ? activeElement.dataset.galleryAction as GalleryAction
          : 'delete',
      visibleIndex: visibleEntries.findIndex((visibleEntry) => visibleEntry.id === entry.id),
    })
  }, [visibleEntries])

  const handleCancelDeleteEntry = useCallback(() => {
    if (deletingEntryIdRef.current !== null || !pendingDeleteEntry) {
      return
    }

    pendingCancelFocusRef.current = {
      entryId: pendingDeleteEntry.entryId,
      action: pendingDeleteEntry.action,
    }
    setPendingDeleteEntry(null)
  }, [pendingDeleteEntry])

  const handleConfirmDeleteEntry = useCallback(async () => {
    if (!pendingDeleteEntry || deletingEntryIdRef.current !== null) return

    const { entry, ...focusRequest } = pendingDeleteEntry
    const entryIds = entry.allEntries.map((galleryEntry) => galleryEntry.id)
    if (entryIds.length === 0) return

    pendingDeletionFocusRef.current = focusRequest
    deletingEntryIdRef.current = entry.id
    setDeletingEntryId(entry.id)
    try {
      await onDeleteEntries(entryIds)
      setPendingDeleteEntry(null)
    } catch {
      // UploadScreen/App expose the error state already.
    } finally {
      setDeletingEntryId((current) => {
        const nextValue = current === entry.id ? null : current
        deletingEntryIdRef.current = nextValue
        return nextValue
      })
    }
  }, [onDeleteEntries, pendingDeleteEntry])

  const pendingDeleteRepresentativeEntry = pendingDeleteEntry?.entry.representativeEntry ?? null
  const pendingDeleteLabel = pendingDeleteRepresentativeEntry
    ? `${formatDifficultyLabel(pendingDeleteRepresentativeEntry.config)} vom ${formatDate(pendingDeleteRepresentativeEntry.completedAt)}`
    : null

  const galleryStateKey = isLoadingGallery
    ? 'loading'
    : entries.length === 0
      ? 'empty'
      : 'content'
  const visibleGalleryStateKey =
    visibleEntries.length === 0
      ? `filtered-empty:${difficultyFilter}:${assistanceFilter}:${sortOption}`
      : `grid:${difficultyFilter}:${assistanceFilter}:${sortOption}`

  return (
    <>
      <div
        ref={panelRef}
        id="dashboard-panel-gallery"
        className="dashboard-panel-scroll"
        role={panelRole}
        aria-labelledby={titleId}
      >
        <div className="dashboard-section-header">
          <div>
            <span className="saved-games-kicker">Galerie</span>
            <h3 id={titleId} className="dashboard-section-title">
              Geloeste Spiele als Bildwand
            </h3>
          </div>
          {!isLoadingGallery && totalSolveCount > 0 && (
            <span className="dashboard-section-note">
              {groupedEntries.length} Motive aus {formatGallerySolveCount(totalSolveCount)}
              {latestCompletedAt ? `, zuletzt ${formatDate(latestCompletedAt)}` : ''}
            </span>
          )}
        </div>

        <AnimatedStateSwap stateKey={galleryStateKey} className="dashboard-state-swap">
          {isLoadingGallery ? (
            <UploadStateNotice
              icon={'\u{1F5BC}'}
              title="Galerie wird geladen ..."
              detail="Die zuletzt geloesten Motive und Laufdaten werden vorbereitet."
              role="status"
              ariaLive="polite"
            />
          ) : entries.length === 0 ? (
            <UploadStateNotice
              icon={'\u{1F5BC}'}
              title="Noch keine Galerie-Eintraege vorhanden."
              detail="Nach jedem geloesten Puzzle landet hier automatisch ein Thumbnail des Motivs mit Zeit, Zuegen und Schwierigkeit."
            />
          ) : (
            <>
              <UploadGalleryToolbar
                difficultySelectRef={primaryFilterRef ?? difficultySelectInternalRef}
                assistanceSelectRef={assistanceSelectRef}
                sortSelectRef={sortSelectRef}
                resetButtonRef={resetButtonRef}
                difficultyFilter={difficultyFilter}
                difficultyOptions={difficultyOptions}
                assistanceFilter={assistanceFilter}
                sortOption={sortOption}
                visibleCount={visibleEntries.length}
                totalCount={groupedEntries.length}
                onDifficultyFilterChange={handleDifficultyFilterChange}
                onAssistanceFilterChange={handleAssistanceFilterChange}
                onSortOptionChange={handleSortOptionChange}
                onReset={handleResetFilters}
              />

              <AnimatedStateSwap stateKey={visibleGalleryStateKey} className="dashboard-state-swap">
                {visibleEntries.length === 0 ? (
                  <UploadStateNotice
                    icon={'\u{1F50E}'}
                    title="Mit den aktuellen Filtern ist gerade kein Galerie-Bild sichtbar."
                    detail="Probiere eine andere Schwierigkeit, eine andere Laufart oder setze die Auswahl wieder auf alle Eintraege zurueck."
                    className="gallery-empty-state-filtered"
                  />
                ) : (
                  <div className="gallery-grid" aria-label="Galerie geloester Spiele">
                    {visibleEntries.map((entry) => (
                      <UploadGalleryCard
                        key={entry.id}
                        entry={entry}
                        onOpenDetails={setSelectedEntry}
                        onReplayEntry={onReplayEntry}
                        onDeleteEntry={handleDeleteEntryRequest}
                        isDeleting={deletingEntryId === entry.id}
                      />
                    ))}
                  </div>
                )}
              </AnimatedStateSwap>
            </>
          )}
        </AnimatedStateSwap>
      </div>

      {selectedEntry && (
        <UploadGalleryDetailDialog
          entry={selectedEntry}
          onReplayEntry={onReplayEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}

      {pendingDeleteEntry && pendingDeleteLabel && (
        <UploadConfirmDialog
          titleId="gallery-entry-delete-confirm-title"
          title="Galerie-Eintrag loeschen?"
          description={
            <p>
              Moechtest du <span className="delete-confirm-name">{pendingDeleteLabel}</span> wirklich entfernen?{' '}
              Dabei werden {formatGallerySolveCount(pendingDeleteEntry.entry.totalSolveCount)} dieses Motivs geloescht.
              Dieser Schritt kann nicht rueckgaengig gemacht werden.
            </p>
          }
          confirmLabel="Loeschen"
          busyLabel="Loesche ..."
          isBusy={deletingEntryId === pendingDeleteEntry.entry.id}
          onCancel={handleCancelDeleteEntry}
          onConfirm={() => {
            void handleConfirmDeleteEntry()
          }}
        />
      )}
    </>
  )
}
