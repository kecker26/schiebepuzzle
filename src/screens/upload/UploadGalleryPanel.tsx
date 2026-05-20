import type { AriaRole, RefObject } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ensureElementVisible } from '../../app/focusVisibility.ts'
import AnimatedStateSwap from '../../motion/AnimatedStateSwap.tsx'
import { ImageCollection, SolvedGallery, SolvedGalleryEntry } from '../../types/index'
import { formatDifficultyLabel } from '../../utils/puzzleDifficulty.ts'
import UploadConfirmDialog from './UploadConfirmDialog.tsx'
import UploadGalleryCard from './UploadGalleryCard.tsx'
import UploadGalleryDetailDialog from './UploadGalleryDetailDialog.tsx'
import UploadGalleryTagManagerDialog from './UploadGalleryTagManagerDialog.tsx'
import UploadCollectionPickerDialog from './UploadCollectionPickerDialog.tsx'
import UploadPageNavigation from './UploadPageNavigation.tsx'
import {
  buildGalleryDisplayEntriesFromGroups,
  buildGalleryDisplayGroups,
  formatGallerySolveCount,
  GalleryDisplayEntry,
  getGalleryMotifKey,
  sortGalleryDisplayEntries,
} from './UploadGalleryDisplayUtils.ts'
import UploadGalleryToolbar, { type GalleryTagFilterOption } from './UploadGalleryToolbar.tsx'
import UploadStateNotice from './UploadStateNotice.tsx'
import {
  GalleryAssistanceFilter,
  GalleryDifficultyFilter,
  GallerySortOption,
  formatDate,
  getGalleryDifficultyFilterOptions,
} from './uploadUtils.ts'
import type { GalleryReplayRequestHandler } from './galleryReplayRequest.ts'

interface UploadGalleryPanelProps {
  gallery: SolvedGallery | null
  collections?: ImageCollection[]
  isLoadingGallery: boolean
  isLoadingCollections?: boolean
  onReplayEntry: GalleryReplayRequestHandler
  onDeleteEntries: (entryIds: string[]) => Promise<void>
  onUpdateTags?: (action: 'rename' | 'remove', sourceLabel: string, targetLabel?: string) => Promise<void>
  onRetryTagging?: (entryId: string) => Promise<void>
  onCreateCollection?: (name: string, imageIds: string[], description?: string) => Promise<void>
  onAddCollectionImages?: (collectionId: string, imageIds: string[]) => Promise<void>
  titleId?: string
  panelRole?: AriaRole
  primaryFilterRef?: RefObject<HTMLSelectElement>
}

type GalleryAction = 'preview' | 'play-primary' | 'details' | 'collect' | 'tag' | 'delete'

interface PendingGalleryDeletionFocus {
  entryId: string
  action: GalleryAction
  visibleIndex: number
}

interface PendingGalleryDeletionRequest extends PendingGalleryDeletionFocus {
  entry: GalleryDisplayEntry
}

type GalleryToolbarFocusTarget = 'difficulty' | 'assistance' | 'sort'

const GALLERY_MOTIFS_PER_PAGE = 9

export function getGalleryTagKey(label: string): string {
  return label.trim().toLocaleLowerCase('de-DE')
}

function entryMatchesGalleryTag(entry: SolvedGalleryEntry, tagKey: string): boolean {
  return (entry.tags ?? []).some((tag) => getGalleryTagKey(tag.label) === tagKey)
}

export function galleryDisplayEntryMatchesAllTagKeys(
  entry: Pick<GalleryDisplayEntry, 'visibleEntries'>,
  tagKeys: string[]
): boolean {
  if (tagKeys.length === 0) return true

  return tagKeys.every((tagKey) =>
    entry.visibleEntries.some((galleryEntry) => entryMatchesGalleryTag(galleryEntry, tagKey))
  )
}

function addMotifTagOption(
  tagCounts: Map<string, GalleryTagFilterOption>,
  tagKey: string,
  label: string,
  motifEntryId: string
): void {
  const current = tagCounts.get(tagKey)
  if (current) {
    current.count += 1
    current.entryIds = [...(current.entryIds ?? []), motifEntryId]
    return
  }

  tagCounts.set(tagKey, {
    id: tagKey,
    label,
    count: 1,
    entryIds: [motifEntryId],
  })
}

export default function UploadGalleryPanel({
  gallery,
  collections = [],
  isLoadingGallery,
  isLoadingCollections = false,
  onReplayEntry,
  onDeleteEntries,
  onUpdateTags = async () => undefined,
  onRetryTagging = async () => undefined,
  onCreateCollection = async () => undefined,
  onAddCollectionImages = async () => undefined,
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
  const [tagFilters, setTagFilters] = useState<string[]>([])
  const [sortOption, setSortOption] = useState<GallerySortOption>('latest')
  const [selectedEntry, setSelectedEntry] = useState<GalleryDisplayEntry | null>(null)
  const [collectingEntry, setCollectingEntry] = useState<GalleryDisplayEntry | null>(null)
  const [isManagingTags, setIsManagingTags] = useState(false)
  const [isUpdatingTags, setIsUpdatingTags] = useState(false)
  const [retryingTagEntryId, setRetryingTagEntryId] = useState<string | null>(null)
  const [isSavingCollection, setIsSavingCollection] = useState(false)
  const [isCreatingTagCollection, setIsCreatingTagCollection] = useState(false)
  const [suggestedCollectionBusyKey, setSuggestedCollectionBusyKey] = useState<string | null>(null)
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState<PendingGalleryDeletionRequest | null>(null)
  const deletingEntryIdRef = useRef<string | null>(null)
  const pendingDeletionFocusRef = useRef<PendingGalleryDeletionFocus | null>(null)
  const pendingCancelFocusRef = useRef<Pick<PendingGalleryDeletionFocus, 'entryId' | 'action'> | null>(null)
  const pendingToolbarFocusRef = useRef<GalleryToolbarFocusTarget | null>(null)

  const difficultyOptions = useMemo(() => getGalleryDifficultyFilterOptions(), [])
  const galleryGroups = useMemo(() => buildGalleryDisplayGroups(entries), [entries])
  const motifIdByEntryId = useMemo(() => {
    const motifIds = new Map<string, string>()
    for (const entry of entries) {
      motifIds.set(entry.id, getGalleryMotifKey(entry))
    }

    return motifIds
  }, [entries])
  const groupedEntries = useMemo(
    () =>
      buildGalleryDisplayEntriesFromGroups(galleryGroups, {
        difficultyFilter: 'all',
        assistanceFilter: 'all',
      }),
    [galleryGroups]
  )
  const baseFilteredEntries = useMemo(
    () => buildGalleryDisplayEntriesFromGroups(galleryGroups, {
      difficultyFilter,
      assistanceFilter,
    }),
    [assistanceFilter, difficultyFilter, galleryGroups]
  )
  const tagOptions = useMemo<GalleryTagFilterOption[]>(() => {
    const tagCounts = new Map<string, GalleryTagFilterOption>()

    for (const entry of baseFilteredEntries) {
      const seenTagsForCard = new Set<string>()
      const motifEntryId = entry.representativeEntry.id
      for (const galleryEntry of entry.visibleEntries) {
        for (const tag of galleryEntry.tags ?? []) {
          const key = getGalleryTagKey(tag.label)
          if (!key || seenTagsForCard.has(key)) continue

          seenTagsForCard.add(key)
          addMotifTagOption(tagCounts, key, tag.label, motifEntryId)
        }
      }
    }

    return Array.from(tagCounts.values())
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'de'))
  }, [baseFilteredEntries])
  const allTagOptions = useMemo<GalleryTagFilterOption[]>(() => {
    const tagCounts = new Map<string, GalleryTagFilterOption>()

    for (const group of galleryGroups) {
      const seenTagsForMotif = new Set<string>()
      const motifEntryId = group.allEntries[0]?.id
      if (!motifEntryId) continue

      for (const entry of group.allEntries) {
        for (const tag of entry.tags ?? []) {
          const key = getGalleryTagKey(tag.label)
          if (!key || seenTagsForMotif.has(key)) continue

          seenTagsForMotif.add(key)
          addMotifTagOption(tagCounts, key, tag.label, motifEntryId)
        }
      }
    }

    return Array.from(tagCounts.values())
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'de'))
  }, [galleryGroups])
  const visibleEntries = useMemo(() => {
    const filteredEntries = tagFilters.length === 0
      ? baseFilteredEntries
      : baseFilteredEntries.filter((entry) => galleryDisplayEntryMatchesAllTagKeys(entry, tagFilters))

    return sortGalleryDisplayEntries(filteredEntries, sortOption)
  }, [baseFilteredEntries, sortOption, tagFilters])
  const galleryPageCount = Math.max(1, Math.ceil(visibleEntries.length / GALLERY_MOTIFS_PER_PAGE))
  const activeGalleryPage = Math.min(currentPage, galleryPageCount)
  const pagedVisibleEntries = useMemo(() => {
    const startIndex = (activeGalleryPage - 1) * GALLERY_MOTIFS_PER_PAGE
    return visibleEntries.slice(startIndex, startIndex + GALLERY_MOTIFS_PER_PAGE)
  }, [activeGalleryPage, visibleEntries])
  const activeTagOption = useMemo(
    () => tagFilters.length === 1 ? tagOptions.find((option) => option.id === tagFilters[0]) ?? null : null,
    [tagFilters, tagOptions]
  )
  const activeTagCollection = useMemo(() => {
    if (!activeTagOption) return null

    const activeTagName = getGalleryTagKey(activeTagOption.label)
    return collections.find((collection) => getGalleryTagKey(collection.name) === activeTagName) ?? null
  }, [activeTagOption, collections])
  const matchingTagImageIds = useMemo(() => {
    if (tagFilters.length !== 1) return []

    const seenMotifs = new Set<string>()
    const imageIds: string[] = []
    for (const entry of visibleEntries) {
      if (!galleryDisplayEntryMatchesAllTagKeys(entry, tagFilters)) {
        continue
      }

      if (seenMotifs.has(entry.motifId)) continue

      seenMotifs.add(entry.motifId)
      imageIds.push(entry.representativeEntry.id)
    }

    return imageIds
  }, [tagFilters, visibleEntries])
  const tagCollectionImageIds = useMemo(() => {
    if (!activeTagCollection) return matchingTagImageIds

    const existingMotifIds = new Set(
      activeTagCollection.imageIds
        .map((imageId) => motifIdByEntryId.get(imageId))
        .filter((motifId): motifId is string => Boolean(motifId))
    )
    return matchingTagImageIds.filter((imageId) => {
      const motifId = motifIdByEntryId.get(imageId)
      return motifId ? !existingMotifIds.has(motifId) : true
    })
  }, [activeTagCollection, matchingTagImageIds, motifIdByEntryId])
  const tagCollectionActionLabel = activeTagCollection ? 'Tag-Motive ergaenzen' : 'Sammlung aus Tag'

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, galleryPageCount))
  }, [galleryPageCount])

  useEffect(() => {
    deletingEntryIdRef.current = deletingEntryId
  }, [deletingEntryId])

  useEffect(() => {
    if (tagFilters.length === 0) return

    const availableTagKeys = new Set(tagOptions.map((option) => option.id))
    const nextTagFilters = tagFilters.filter((tagFilter) => availableTagKeys.has(tagFilter))
    if (nextTagFilters.length === tagFilters.length) return

    setTagFilters(nextTagFilters)
  }, [tagFilters, tagOptions])

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

    const isStillVisible = pagedVisibleEntries.some((entry) => entry.id === focusRequest.entryId)

    pendingDeletionFocusRef.current = null

    if (focusRequest.visibleIndex < 0 || isStillVisible) {
      return
    }

    const nextEntry =
      pagedVisibleEntries[focusRequest.visibleIndex]
      ?? pagedVisibleEntries[focusRequest.visibleIndex - 1]
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
    pagedVisibleEntries,
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
    tagFilters,
  ])

  const handleDifficultyFilterChange = useCallback((value: GalleryDifficultyFilter) => {
    pendingToolbarFocusRef.current = 'difficulty'
    setCurrentPage(1)
    setDifficultyFilter(value)
  }, [])

  const handleAssistanceFilterChange = useCallback((value: GalleryAssistanceFilter) => {
    pendingToolbarFocusRef.current = 'assistance'
    setCurrentPage(1)
    setAssistanceFilter(value)
  }, [])

  const handleTagFilterRequest = useCallback((tagLabel: string) => {
    pendingToolbarFocusRef.current = 'difficulty'
    setCurrentPage(1)
    setTagFilters([getGalleryTagKey(tagLabel)])
  }, [])

  const handleApplyTagFilters = useCallback((tagKeys: string[]) => {
    const normalizedTagKeys = Array.from(new Set(tagKeys.map((tagKey) => getGalleryTagKey(tagKey)).filter(Boolean)))
    setCurrentPage(1)
    setTagFilters(normalizedTagKeys)
    setIsManagingTags(false)
  }, [])

  const handleSortOptionChange = useCallback((value: GallerySortOption) => {
    pendingToolbarFocusRef.current = 'sort'
    setCurrentPage(1)
    setSortOption(value)
  }, [])

  function handleResetFilters() {
    pendingToolbarFocusRef.current = 'difficulty'
    setCurrentPage(1)
    setDifficultyFilter('all')
    setAssistanceFilter('all')
    setTagFilters([])
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
      visibleIndex: pagedVisibleEntries.findIndex((visibleEntry) => visibleEntry.id === entry.id),
    })
  }, [pagedVisibleEntries])

  const handleCollectEntryRequest = useCallback((entry: GalleryDisplayEntry) => {
    if (deletingEntryIdRef.current !== null) return
    setCollectingEntry(entry)
  }, [])

  const handleCollectEntryFromDetails = useCallback((entry: GalleryDisplayEntry) => {
    if (deletingEntryIdRef.current !== null) return
    setSelectedEntry(null)
    setCollectingEntry(entry)
  }, [])

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
      ? `filtered-empty:${difficultyFilter}:${assistanceFilter}:${tagFilters.join('|')}:${sortOption}`
      : `grid:${difficultyFilter}:${assistanceFilter}:${tagFilters.join('|')}:${sortOption}:${activeGalleryPage}`
  const collectingImageIds = collectingEntry ? [collectingEntry.representativeEntry.id] : []
  const collectingRepresentativeEntry = collectingEntry?.representativeEntry ?? null
  const collectingImageLabel = collectingRepresentativeEntry
    ? `${formatDifficultyLabel(collectingRepresentativeEntry.config)} vom ${formatDate(collectingRepresentativeEntry.completedAt)}`
    : 'Dieses Motiv'

  const handleCreateCollection = useCallback(async (name: string, imageIds: string[]) => {
    setIsSavingCollection(true)
    try {
      await onCreateCollection(name, imageIds)
      setCollectingEntry(null)
    } finally {
      setIsSavingCollection(false)
    }
  }, [onCreateCollection])

  const handleAddCollectionImages = useCallback(async (collectionId: string, imageIds: string[]) => {
    setIsSavingCollection(true)
    try {
      await onAddCollectionImages(collectionId, imageIds)
      setCollectingEntry(null)
    } finally {
      setIsSavingCollection(false)
    }
  }, [onAddCollectionImages])

  const handleAddSuggestedCollection = useCallback(async (collectionId: string, entry: GalleryDisplayEntry) => {
    const busyKey = `${entry.id}:${collectionId}`
    setSuggestedCollectionBusyKey(busyKey)
    try {
      await onAddCollectionImages(collectionId, [entry.representativeEntry.id])
    } finally {
      setSuggestedCollectionBusyKey(null)
    }
  }, [onAddCollectionImages])

  const handleCreateCollectionFromTag = useCallback(async () => {
    if (!activeTagOption || tagCollectionImageIds.length === 0) return

    setIsCreatingTagCollection(true)
    try {
      if (activeTagCollection) {
        await onAddCollectionImages(activeTagCollection.id, tagCollectionImageIds)
      } else {
        await onCreateCollection(
          activeTagOption.label,
          tagCollectionImageIds,
          `Automatisch aus Galerie-KI-Tag #${activeTagOption.label} erstellt.`
        )
      }
    } finally {
      setIsCreatingTagCollection(false)
    }
  }, [activeTagCollection, activeTagOption, onAddCollectionImages, onCreateCollection, tagCollectionImageIds])

  const handleRenameTag = useCallback(async (sourceLabel: string, targetLabel: string) => {
    setIsUpdatingTags(true)
    try {
      await onUpdateTags('rename', sourceLabel, targetLabel)
    } finally {
      setIsUpdatingTags(false)
    }
  }, [onUpdateTags])

  const handleRemoveTag = useCallback(async (sourceLabel: string) => {
    setIsUpdatingTags(true)
    try {
      await onUpdateTags('remove', sourceLabel)
    } finally {
      setIsUpdatingTags(false)
    }
  }, [onUpdateTags])

  const handleRetryTagging = useCallback(async (entry: SolvedGalleryEntry) => {
    setRetryingTagEntryId(entry.id)
    try {
      await onRetryTagging(entry.id)
    } finally {
      setRetryingTagEntryId((current) => current === entry.id ? null : current)
    }
  }, [onRetryTagging])

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
              iconName="gallery"
              title="Galerie wird geladen ..."
              detail="Die zuletzt geloesten Motive und Laufdaten werden vorbereitet."
              role="status"
              ariaLive="polite"
            />
          ) : entries.length === 0 ? (
            <UploadStateNotice
              icon={'\u{1F5BC}'}
              iconName="image"
              title="Noch keine Galerie-Eintraege vorhanden."
              detail="Nach jedem geloesten Puzzle landet hier automatisch ein Thumbnail mit Zeit, Zuegen und Schwierigkeit."
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
                activeTagFilterCount={tagFilters.length}
                activeTagFilterLabel={activeTagOption?.label ?? null}
                sortOption={sortOption}
                visibleCount={visibleEntries.length}
                totalCount={groupedEntries.length}
                activeTagCollectionCount={tagCollectionImageIds.length}
                tagCollectionActionLabel={tagCollectionActionLabel}
                isCreatingTagCollection={isCreatingTagCollection}
                canManageTags={allTagOptions.length > 0}
                onDifficultyFilterChange={handleDifficultyFilterChange}
                onAssistanceFilterChange={handleAssistanceFilterChange}
                onSortOptionChange={handleSortOptionChange}
                onCreateCollectionFromTag={() => {
                  void handleCreateCollectionFromTag()
                }}
                onManageTags={() => setIsManagingTags(true)}
                onReset={handleResetFilters}
              />

              <AnimatedStateSwap stateKey={visibleGalleryStateKey} className="dashboard-state-swap">
                {visibleEntries.length === 0 ? (
                  <UploadStateNotice
                    icon={'\u{1F50E}'}
                    iconName="search"
                    title="Mit den aktuellen Filtern ist gerade kein Galerie-Bild sichtbar."
                    detail="Probiere eine andere Schwierigkeit, Laufart oder andere Tags, oder setze die Auswahl wieder auf alle Eintraege zurueck."
                    className="gallery-empty-state-filtered"
                  />
                ) : (
                  <div className="gallery-grid" aria-label="Galerie geloester Spiele">
                    {pagedVisibleEntries.map((entry) => (
                      <UploadGalleryCard
                        key={entry.id}
                        entry={entry}
                        onOpenDetails={setSelectedEntry}
                        onCollectEntry={handleCollectEntryRequest}
                        onTagFilter={handleTagFilterRequest}
                        onRetryTagging={handleRetryTagging}
                        onAddSuggestedCollection={handleAddSuggestedCollection}
                        collections={collections}
                        suggestedCollectionBusyKey={suggestedCollectionBusyKey}
                        retryingTagEntryId={retryingTagEntryId}
                        onDeleteEntry={handleDeleteEntryRequest}
                        isDeleting={deletingEntryId === entry.id}
                      />
                    ))}
                  </div>
                )}
              </AnimatedStateSwap>
              <UploadPageNavigation
                activePage={activeGalleryPage}
                ariaLabel="Galerieseiten"
                isDisabled={deletingEntryId !== null}
                onPageChange={setCurrentPage}
                pageCount={galleryPageCount}
              />
            </>
          )}
        </AnimatedStateSwap>
      </div>

      {selectedEntry && (
        <UploadGalleryDetailDialog
          entry={selectedEntry}
          onReplayEntry={onReplayEntry}
          onCollectEntry={handleCollectEntryFromDetails}
          onRetryTagging={handleRetryTagging}
          isRetryingTagging={retryingTagEntryId === selectedEntry.representativeEntry.id}
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

      {collectingEntry && (
        <UploadCollectionPickerDialog
          collections={collections}
          imageIds={collectingImageIds}
          imageLabel={collectingImageLabel}
          isBusy={isSavingCollection || isLoadingCollections}
          onCreateCollection={handleCreateCollection}
          onAddToCollection={handleAddCollectionImages}
          onClose={() => {
            if (!isSavingCollection) {
              setCollectingEntry(null)
            }
          }}
        />
      )}

      {isManagingTags && (
        <UploadGalleryTagManagerDialog
          tagOptions={allTagOptions}
          activeTagFilterKeys={tagFilters}
          isBusy={isUpdatingTags}
          onRenameTag={handleRenameTag}
          onRemoveTag={handleRemoveTag}
          onApplyTagFilters={handleApplyTagFilters}
          onClose={() => {
            if (!isUpdatingTags) {
              setIsManagingTags(false)
            }
          }}
        />
      )}
    </>
  )
}
