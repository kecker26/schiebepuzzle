import type { AriaRole, CSSProperties, RefObject } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ensureElementVisible } from '../../app/focusVisibility.ts'
import AnimatedStateSwap from '../../motion/AnimatedStateSwap.tsx'
import {
  classifyTagCategories,
  createTagCategory,
  deleteTagCategory,
  loadTagCategoryCatalog,
  updateTagCategoryAssignments,
} from '../../services/GalleryService.ts'
import { STATIC_TAG_CATEGORIES } from '../../services/tagCategories/staticTagTaxonomy.ts'
import type {
  TagCategoryCatalog,
  TagCategoryIconId,
  TagCategorySuggestion,
} from '../../services/tagCategories/tagCategoryTypes.ts'
import { ImageCollection, SolvedGallery, SolvedGalleryEntry } from '../../types/index'
import { formatDifficultyLabel } from '../../utils/puzzleDifficulty.ts'
import UploadConfirmDialog from './UploadConfirmDialog.tsx'
import UploadGalleryCard from './UploadGalleryCard.tsx'
import UploadGalleryDetailDialog from './UploadGalleryDetailDialog.tsx'
import UploadGalleryMedalCollection from './UploadGalleryMedalCollection.tsx'
import UploadGalleryTagManagerDialog from './UploadGalleryTagManagerDialog.tsx'
import UploadCollectionPickerDialog from './UploadCollectionPickerDialog.tsx'
import UploadPageNavigation from './UploadPageNavigation.tsx'
import UploadPanelFooterNavigation from './UploadPanelFooterNavigation.tsx'
import {
  buildGalleryDisplayEntriesFromGroups,
  buildGalleryDisplayGroups,
  buildGalleryMedalCollection,
  formatGallerySolveCount,
  GalleryDisplayEntry,
  getGalleryMotifKey,
  getSimilarGalleryEntries,
  GalleryMedalFilter,
  matchesGalleryMedalHuntFilter,
  matchesGalleryMedalFilter,
  sortGalleryDisplayEntries,
} from './UploadGalleryDisplayUtils.ts'
import UploadGalleryToolbar, { type GalleryTagFilterOption } from './UploadGalleryToolbar.tsx'
import UploadStateNotice from './UploadStateNotice.tsx'
import {
  GalleryAssistanceFilter,
  GalleryDifficultyFilter,
  GalleryMedalHuntFilter,
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
  onFetchRandomImage?: (query?: string) => Promise<void> | void
  requestedTagFilterLabel?: string | null
  onDeleteEntries: (entryIds: string[]) => Promise<void>
  onUpdateTags?: (action: 'rename' | 'remove', sourceLabel: string, targetLabel?: string) => Promise<void>
  onEditEntryTags?: (entryIds: string[], add?: string[], remove?: string[]) => Promise<void>
  onRetryTagging?: (entryId: string) => Promise<void>
  onCreateCollection?: (name: string, imageIds: string[], description?: string) => Promise<void>
  onAddCollectionImages?: (collectionId: string, imageIds: string[]) => Promise<void>
  onBackToStart?: () => void
  onScrollToStart?: () => void
  titleId?: string
  panelRole?: AriaRole
  primaryFilterRef?: RefObject<HTMLSelectElement>
  paletteStyle?: CSSProperties
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

type GalleryToolbarFocusTarget = 'difficulty' | 'assistance' | 'medal-hunt' | 'sort'

const GALLERY_MOTIFS_PER_PAGE = 9

export function getGalleryTagKey(label: string): string {
  return label.trim().toLocaleLowerCase('de-DE')
}

function getRequestedGalleryTagFilters(label: string | null): string[] {
  if (!label) return []

  const tagKey = getGalleryTagKey(label)
  return tagKey ? [tagKey] : []
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
  onFetchRandomImage = async () => undefined,
  requestedTagFilterLabel = null,
  onDeleteEntries,
  onUpdateTags = async () => undefined,
  onEditEntryTags = async () => undefined,
  onRetryTagging = async () => undefined,
  onCreateCollection = async () => undefined,
  onAddCollectionImages = async () => undefined,
  onBackToStart,
  onScrollToStart,
  titleId = 'workspace-window-gallery-title',
  panelRole = 'region',
  primaryFilterRef,
  paletteStyle,
}: UploadGalleryPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const difficultySelectInternalRef = useRef<HTMLSelectElement>(null)
  const assistanceSelectRef = useRef<HTMLSelectElement>(null)
  const medalHuntSelectRef = useRef<HTMLSelectElement>(null)
  const sortSelectRef = useRef<HTMLSelectElement>(null)
  const resetButtonRef = useRef<HTMLButtonElement>(null)
  const entries = useMemo(() => gallery?.entries ?? [], [gallery])
  const totalSolveCount = gallery?.totalEntries ?? entries.length
  const latestCompletedAt = gallery?.lastCompletedAt ?? entries[0]?.completedAt ?? null

  const [difficultyFilter, setDifficultyFilter] = useState<GalleryDifficultyFilter>('all')
  const [assistanceFilter, setAssistanceFilter] = useState<GalleryAssistanceFilter>('all')
  const [medalFilter, setMedalFilter] = useState<GalleryMedalFilter>('all')
  const [medalHuntFilter, setMedalHuntFilter] = useState<GalleryMedalHuntFilter>('all')
  const [tagFilters, setTagFilters] = useState<string[]>(() => getRequestedGalleryTagFilters(requestedTagFilterLabel))
  const [sortOption, setSortOption] = useState<GallerySortOption>('latest')
  const [selectedEntry, setSelectedEntry] = useState<GalleryDisplayEntry | null>(null)
  const [collectingEntry, setCollectingEntry] = useState<GalleryDisplayEntry | null>(null)
  const [isManagingTags, setIsManagingTags] = useState(false)
  const [tagCategoryCatalog, setTagCategoryCatalog] = useState<TagCategoryCatalog>({
    categories: STATIC_TAG_CATEGORIES,
    assignments: [],
    lastUpdatedAt: null,
  })
  const [tagCategorySuggestions, setTagCategorySuggestions] = useState<TagCategorySuggestion[]>([])
  const [tagManagerOperation, setTagManagerOperation] = useState<
    'ai-classification' | 'rename-tag' | 'remove-tag' | 'edit-tags' | 'assign-category' | 'create-category' | 'delete-category' | null
  >(null)
  const isUpdatingTags = tagManagerOperation !== null
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
  const motifEntryIdsByEntryId = useMemo(() => {
    const idsByEntryId = new Map<string, string[]>()
    for (const group of galleryGroups) {
      const groupEntryIds = group.allEntries.map((entry) => entry.id)
      for (const entryId of groupEntryIds) {
        idsByEntryId.set(entryId, groupEntryIds)
      }
    }
    return idsByEntryId
  }, [galleryGroups])
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
  const medalCollection = useMemo(() => buildGalleryMedalCollection(groupedEntries), [groupedEntries])
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
    const tagFilteredEntries = tagFilters.length === 0
      ? baseFilteredEntries
      : baseFilteredEntries.filter((entry) => galleryDisplayEntryMatchesAllTagKeys(entry, tagFilters))
    const medalFilteredEntries = medalFilter === 'all'
      ? tagFilteredEntries
      : tagFilteredEntries.filter((entry) => matchesGalleryMedalFilter(entry, medalFilter))
    const filteredEntries = medalHuntFilter === 'all'
      ? medalFilteredEntries
      : medalFilteredEntries.filter((entry) => matchesGalleryMedalHuntFilter(entry, medalHuntFilter))

    return sortGalleryDisplayEntries(filteredEntries, sortOption)
  }, [baseFilteredEntries, medalFilter, medalHuntFilter, sortOption, tagFilters])
  const visibleTagOptions = useMemo<GalleryTagFilterOption[]>(() => {
    const tagCounts = new Map<string, GalleryTagFilterOption>()

    for (const entry of visibleEntries) {
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
  }, [visibleEntries])
  const similarEntries = useMemo(
    () => selectedEntry ? getSimilarGalleryEntries(selectedEntry, groupedEntries) : [],
    [groupedEntries, selectedEntry]
  )
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
    if (!isManagingTags) return
    void loadTagCategoryCatalog()
      .then(setTagCategoryCatalog)
      .catch(() => {
        // The static taxonomy remains available when the local API cache cannot be loaded.
      })
  }, [isManagingTags])

  useEffect(() => {
    if (tagFilters.length === 0) return

    const availableTagKeys = new Set(tagOptions.map((option) => option.id))
    const nextTagFilters = tagFilters.filter((tagFilter) => availableTagKeys.has(tagFilter))
    if (nextTagFilters.length === tagFilters.length) return

    setTagFilters(nextTagFilters)
  }, [tagFilters, tagOptions])

  useEffect(() => {
    if (!requestedTagFilterLabel) return

    const requestedTagFilters = getRequestedGalleryTagFilters(requestedTagFilterLabel)
    if (requestedTagFilters.length === 0) return

    pendingToolbarFocusRef.current = 'difficulty'
    setCurrentPage(1)
    setTagFilters(requestedTagFilters)
  }, [requestedTagFilterLabel])

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
      case 'medal-hunt':
        return medalHuntSelectRef.current?.isConnected ? medalHuntSelectRef.current : getDifficultySelectTarget()
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
    medalHuntFilter,
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

  const handleTagFilterToggle = useCallback((tagKey: string) => {
    const normalizedTagKey = getGalleryTagKey(tagKey)
    if (!normalizedTagKey) return

    setCurrentPage(1)
    setTagFilters((currentTagFilters) => (
      currentTagFilters.includes(normalizedTagKey)
        ? currentTagFilters.filter((currentTagKey) => currentTagKey !== normalizedTagKey)
        : [...currentTagFilters, normalizedTagKey]
    ))
  }, [])

  const handleClearTagFilters = useCallback(() => {
    setCurrentPage(1)
    setTagFilters([])
  }, [])

  const handleDetailTagFilter = useCallback((tagLabel: string) => {
    handleTagFilterRequest(tagLabel)
    setSelectedEntry(null)
  }, [handleTagFilterRequest])

  const handleDetailTagImageSearch = useCallback((tagLabel: string) => {
    setSelectedEntry(null)
    void onFetchRandomImage(tagLabel)
  }, [onFetchRandomImage])

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

  const handleMedalHuntFilterChange = useCallback((value: GalleryMedalHuntFilter) => {
    pendingToolbarFocusRef.current = 'medal-hunt'
    setCurrentPage(1)
    setMedalHuntFilter(value)
  }, [])

  const handleMedalFilterChange = useCallback((value: GalleryMedalFilter) => {
    setCurrentPage(1)
    setMedalFilter(value)
  }, [])

  function handleResetFilters() {
    pendingToolbarFocusRef.current = 'difficulty'
    setCurrentPage(1)
    setDifficultyFilter('all')
    setAssistanceFilter('all')
    setMedalFilter('all')
    setMedalHuntFilter('all')
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
      ? `filtered-empty:${difficultyFilter}:${assistanceFilter}:${medalFilter}:${medalHuntFilter}:${tagFilters.join('|')}:${sortOption}`
      : `grid:${difficultyFilter}:${assistanceFilter}:${medalFilter}:${medalHuntFilter}:${tagFilters.join('|')}:${sortOption}:${activeGalleryPage}`
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

  const handleAddSuggestedCollection = useCallback(async (
    collectionId: string,
    entry: GalleryDisplayEntry,
    source: 'tag' | 'ai'
  ) => {
    const busyKey = `${entry.id}:${collectionId}`
    setSuggestedCollectionBusyKey(busyKey)
    try {
      await onAddCollectionImages(collectionId, [entry.representativeEntry.id])
      if (source === 'ai') {
        const collection = collections.find((candidate) => candidate.id === collectionId)
        if (collection) {
          const motifEntryIds = Array.from(new Set(
            entry.allEntries.flatMap((galleryEntry) => motifEntryIdsByEntryId.get(galleryEntry.id) ?? [galleryEntry.id])
          ))
          await onEditEntryTags(motifEntryIds, [collection.name], [])
        }
      }
    } finally {
      setSuggestedCollectionBusyKey(null)
    }
  }, [collections, motifEntryIdsByEntryId, onAddCollectionImages, onEditEntryTags])

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
          `Automatisch aus Galerie-Tag #${activeTagOption.label} erstellt.`
        )
      }
    } finally {
      setIsCreatingTagCollection(false)
    }
  }, [activeTagCollection, activeTagOption, onAddCollectionImages, onCreateCollection, tagCollectionImageIds])

  const handleRenameTag = useCallback(async (sourceLabel: string, targetLabel: string) => {
    setTagManagerOperation('rename-tag')
    try {
      await onUpdateTags('rename', sourceLabel, targetLabel)
    } finally {
      setTagManagerOperation(null)
    }
  }, [onUpdateTags])

  const handleRemoveTag = useCallback(async (sourceLabel: string) => {
    setTagManagerOperation('remove-tag')
    try {
      await onUpdateTags('remove', sourceLabel)
    } finally {
      setTagManagerOperation(null)
    }
  }, [onUpdateTags])

  const handleEditEntryTags = useCallback(async (entryIds: string[], add: string[] = [], remove: string[] = []) => {
    const motifEntryIds = Array.from(new Set(entryIds.flatMap((entryId) => motifEntryIdsByEntryId.get(entryId) ?? [entryId])))
    setTagManagerOperation('edit-tags')
    try {
      await onEditEntryTags(motifEntryIds, add, remove)
    } finally {
      setTagManagerOperation(null)
    }
  }, [motifEntryIdsByEntryId, onEditEntryTags])

  const handleUpdateTagCategory = useCallback(async (
    labels: string[],
    categoryId: string | null
  ) => {
    setTagManagerOperation('assign-category')
    try {
      setTagCategoryCatalog(await updateTagCategoryAssignments({ labels, categoryId }))
    } finally {
      setTagManagerOperation(null)
    }
  }, [])

  const handleClassifyUnknownTags = useCallback(async (labels: string[]) => {
    if (labels.length === 0) return
    setTagManagerOperation('ai-classification')
    try {
      const result = await classifyTagCategories({ labels, allowCategorySuggestions: true })
      setTagCategoryCatalog(result.catalog)
      setTagCategorySuggestions(result.suggestions)
    } finally {
      setTagManagerOperation(null)
    }
  }, [])

  const handleCreateTagCategory = useCallback(async (
    label: string,
    iconId: TagCategoryIconId,
    assignedLabels: string[] = []
  ) => {
    setTagManagerOperation('create-category')
    try {
      let nextCatalog = await createTagCategory({ label, iconId })
      const createdCategory = nextCatalog.categories
        .filter((category) => category.source === 'manual')
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))[0]
      if (createdCategory && assignedLabels.length > 0) {
        nextCatalog = await updateTagCategoryAssignments({
          labels: assignedLabels,
          categoryId: createdCategory.id,
        })
      }
      setTagCategoryCatalog(nextCatalog)
      setTagCategorySuggestions((current) => current.filter((suggestion) => suggestion.label !== label))
    } finally {
      setTagManagerOperation(null)
    }
  }, [])

  const handleDeleteTagCategory = useCallback(async (categoryId: string) => {
    setTagManagerOperation('delete-category')
    try {
      setTagCategoryCatalog(await deleteTagCategory(categoryId))
    } finally {
      setTagManagerOperation(null)
    }
  }, [])

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
              busy
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
              <div className="gallery-overview-tools">
                <UploadGalleryMedalCollection
                  items={medalCollection}
                  activeFilter={medalFilter}
                  onFilterChange={handleMedalFilterChange}
                />
                <UploadGalleryToolbar
                  difficultySelectRef={primaryFilterRef ?? difficultySelectInternalRef}
                  assistanceSelectRef={assistanceSelectRef}
                  medalHuntSelectRef={medalHuntSelectRef}
                  sortSelectRef={sortSelectRef}
                  resetButtonRef={resetButtonRef}
                  difficultyFilter={difficultyFilter}
                  difficultyOptions={difficultyOptions}
                  assistanceFilter={assistanceFilter}
                  medalHuntFilter={medalHuntFilter}
                  hasActiveMedalFilter={medalFilter !== 'all'}
                  activeTagFilterCount={tagFilters.length}
                  activeTagFilterLabel={activeTagOption?.label ?? null}
                  activeTagFilterKeys={tagFilters}
                  tagOptions={visibleTagOptions}
                  sortOption={sortOption}
                  visibleCount={visibleEntries.length}
                  totalCount={groupedEntries.length}
                  activeTagCollectionCount={tagCollectionImageIds.length}
                  tagCollectionActionLabel={tagCollectionActionLabel}
                  isCreatingTagCollection={isCreatingTagCollection}
                  canManageTags={allTagOptions.length > 0}
                  onDifficultyFilterChange={handleDifficultyFilterChange}
                  onAssistanceFilterChange={handleAssistanceFilterChange}
                  onMedalHuntFilterChange={handleMedalHuntFilterChange}
                  onSortOptionChange={handleSortOptionChange}
                  onTagFilterToggle={handleTagFilterToggle}
                  onClearTagFilters={handleClearTagFilters}
                  onCreateCollectionFromTag={() => {
                    void handleCreateCollectionFromTag()
                  }}
                  onManageTags={() => setIsManagingTags(true)}
                  onReset={handleResetFilters}
                />
              </div>

              <AnimatedStateSwap stateKey={visibleGalleryStateKey} className="dashboard-state-swap">
                {visibleEntries.length === 0 ? (
                  <UploadStateNotice
                    icon={'\u{1F50E}'}
                    iconName="search"
                    title="Mit den aktuellen Filtern ist gerade kein Galerie-Bild sichtbar."
                    detail="Probiere eine andere Medaillen-Jagd, Medaille, Schwierigkeit, Laufart oder andere Tags, oder setze die Auswahl wieder auf alle Eintraege zurueck."
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
        <UploadPanelFooterNavigation onBackToStart={onBackToStart} onScrollToStart={onScrollToStart} />
      </div>

      {selectedEntry && (
        <UploadGalleryDetailDialog
          entry={selectedEntry}
          onReplayEntry={onReplayEntry}
          onCollectEntry={handleCollectEntryFromDetails}
          onTagFilter={handleDetailTagFilter}
          onFetchRandomImage={handleDetailTagImageSearch}
          onOpenSimilarEntry={setSelectedEntry}
          similarEntries={similarEntries}
          onRetryTagging={handleRetryTagging}
          isRetryingTagging={retryingTagEntryId === selectedEntry.representativeEntry.id}
          allTagLabels={allTagOptions.map((option) => option.label)}
          onEditTags={handleEditEntryTags}
          isEditingTags={isUpdatingTags}
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
          paletteStyle={paletteStyle}
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
          paletteStyle={paletteStyle}
        />
      )}

      {isManagingTags && (
        <UploadGalleryTagManagerDialog
          tagOptions={allTagOptions}
          activeTagFilterKeys={tagFilters}
          isBusy={isUpdatingTags}
          busyOperation={tagManagerOperation}
          onRenameTag={handleRenameTag}
          onRemoveTag={handleRemoveTag}
          onEditEntryTags={handleEditEntryTags}
          tagCategoryCatalog={tagCategoryCatalog}
          tagCategorySuggestions={tagCategorySuggestions}
          onUpdateTagCategory={handleUpdateTagCategory}
          onClassifyUnknownTags={handleClassifyUnknownTags}
          onCreateTagCategory={handleCreateTagCategory}
          onDeleteTagCategory={handleDeleteTagCategory}
          onApplyTagFilters={handleApplyTagFilters}
          onClose={() => {
            if (!isUpdatingTags) {
              setIsManagingTags(false)
            }
          }}
          paletteStyle={paletteStyle}
        />
      )}
    </>
  )
}
