import {
  PuzzleAssistanceMode,
  PuzzleCompletionRecord,
  PuzzleConfig,
  PuzzleDifficultyStats,
  PuzzleStats,
  SavedGameSummary,
  SolvedGallery,
  SolvedGalleryEntry,
} from '../../types/index'
import { DIFFICULTY_OPTIONS } from '../../utils/puzzleDifficulty.ts'

export type UploadWorkspaceWindow = 'start' | 'savedGames' | 'stats' | 'gallery' | 'collections'

export type StatsDashboardTab = 'overview' | 'difficulties' | 'history'

export type HistoryFilter = 'all' | `${number}x${number}`
export type GalleryDifficultyFilter = 'all' | `${number}x${number}`
export type GalleryAssistanceFilter =
  | 'all'
  | 'clean'
  | 'assisted'
  | 'hinted'
  | 'auto-assisted'
  | 'legacy'
export type GalleryMedalHuntFilter =
  | 'all'
  | 'no-medal'
  | 'no-gold'
  | 'upgradeable'
export type GallerySortOption =
  | 'latest'
  | 'oldest'
  | 'fastest'
  | 'fewest-moves'
  | 'fewest-actions'
  | 'fewest-detours'
  | 'upgrade-potential'

export interface DashboardTabDefinition {
  id: StatsDashboardTab
  label: string
  description: string
}

export interface HistoryFilterDefinition {
  id: HistoryFilter
  label: string
}

export interface GallerySelectOption<T extends string> {
  id: T
  label: string
}

export interface DashboardMetric {
  id: string
  label: string
  value: string
  detail: string
  helpText: string
  springValue?: number | null
  springFormatter?: (value: number) => string
}

export interface StandardDifficultyStatsEntry {
  option: (typeof DIFFICULTY_OPTIONS)[number]
  stats: PuzzleDifficultyStats | null
}

export interface DifficultyReportRow {
  option: (typeof DIFFICULTY_OPTIONS)[number]
  stats: PuzzleDifficultyStats | null
  solveCount: number
  cleanSolveCount: number
  assistedSolveCount: number
  autoAssistedSolveCount: number
  profiledSolveCount: number
  legacySolveCount: number
  cleanRate: number | null
  profileCoverage: number | null
  bestTime: number | null
  worstTime: number | null
  bestMoves: number | null
  worstMoves: number | null
  averageTime: number | null
  medianTime: number | null
  recentMedianTime: number | null
  averageMoves: number | null
  medianMoves: number | null
  recentMedianMoves: number | null
  averageExtraMoves: number | null
  lastCompletedAt: string | null
  lastTime: number | null
  lastMoves: number | null
  lastAssistanceMode: PuzzleAssistanceMode | null
  lastHasDetailedProfile: boolean | null
}

interface DifficultyAssistanceCounts {
  solveCount: number
  cleanSolveCount: number
  assistedSolveCount: number
  autoAssistedSolveCount: number
  profiledSolveCount: number
}

export const STATS_DIFFICULTY_COLORS = ['#60a5fa', '#34d399', '#f59e0b', '#f472b6', '#a78bfa', '#22d3ee']

export function getStatsDifficultyKey(config: Pick<PuzzleConfig, 'rows' | 'cols'>): `${number}x${number}` {
  return `${config.rows}x${config.cols}`
}

export function buildStatsDifficultyColorMap(rows: DifficultyReportRow[]): Map<string, string> {
  let colorIndex = 0

  return rows.reduce<Map<string, string>>((colorMap, row) => {
    if (row.solveCount <= 0) return colorMap

    colorMap.set(
      getStatsDifficultyKey(row.option),
      STATS_DIFFICULTY_COLORS[colorIndex % STATS_DIFFICULTY_COLORS.length]
    )
    colorIndex += 1

    return colorMap
  }, new Map())
}

export const STATS_DASHBOARD_TABS: DashboardTabDefinition[] = [
  {
    id: 'overview',
    label: 'Überblick',
    description: 'Kernwerte und Einordnung auf einen Blick',
  },
  {
    id: 'difficulties',
    label: 'Schwierigkeiten',
    description: 'Vergleich aller Stufen mit Rekorden und Medianwerten',
  },
  {
    id: 'history',
    label: 'Verlauf',
    description: 'Alle abgeschlossenen Siege als Historie',
  },
]

const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Byte`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function validateImageFile(file: File): string | null {
  if (file.size === 0) {
    return 'Die Datei ist leer (0 Byte).'
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return `Die Datei ist zu gross (${formatFileSize(file.size)}). Maximal erlaubt sind ${formatFileSize(MAX_UPLOAD_SIZE_BYTES)}.`
  }

  if (file.type === 'image/svg+xml') {
    return 'SVG-Dateien sind nicht direkt als Puzzle-Motiv geeignet. Bitte verwende ein Rasterbild (JPG, PNG, WebP, GIF).'
  }

  if (!file.type.startsWith('image/')) {
    const displayType = file.type || 'unbekannt'
    return `Dateityp \u201E${displayType}\u201C wird nicht unterstützt. Bitte verwende JPG, PNG, WebP oder GIF.`
  }

  return null
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result
      if (typeof result !== 'string') {
        reject(new Error('Fehler beim Lesen der Datei'))
        return
      }
      resolve(result)
    }
    reader.onerror = () => reject(new Error('Fehler beim Lesen der Datei'))
    reader.readAsDataURL(file)
  })
}

function loadHtmlImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Bild konnte nicht geladen werden'))
    image.src = source
  })
}

export async function optimizeImageForPuzzle(file: File): Promise<string> {
  const rawDataUrl = await readFileAsDataUrl(file)

  try {
    const image = await loadHtmlImage(rawDataUrl)

    if (image.width <= 0 || image.height <= 0) {
      throw new Error('Das Bild hat keine gültigen Abmessungen.')
    }

    const maxEdge = 2200
    const longestEdge = Math.max(image.width, image.height)
    const scale = longestEdge > maxEdge ? maxEdge / longestEdge : 1
    const targetWidth = Math.max(1, Math.round(image.width * scale))
    const targetHeight = Math.max(1, Math.round(image.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const context = canvas.getContext('2d')

    if (!context) {
      return rawDataUrl
    }

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, targetWidth, targetHeight)
    context.drawImage(image, 0, 0, targetWidth, targetHeight)

    const result = canvas.toDataURL('image/jpeg', 0.88)
    if (!result || result === 'data:,') {
      return rawDataUrl
    }

    return result
  } catch {
    return rawDataUrl
  }
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function formatDuration(seconds: number): string {
  if (seconds < 3600) return formatTime(seconds)

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`
}

export function formatDate(isoDate: string): string {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatOptionalTime(seconds: number | null): string {
  return seconds === null ? '--' : formatTime(seconds)
}

export function formatOptionalDuration(seconds: number | null): string {
  return seconds === null ? '--' : formatDuration(seconds)
}

export function formatOptionalMoves(moves: number | null): string {
  return moves === null ? '--' : `${moves}`
}

export function formatExtraMoves(extraMoves: number | null | undefined): string {
  if (typeof extraMoves !== 'number') return '--'
  return `${Math.max(0, extraMoves)}`
}

export function formatPercent(value: number | null | undefined): string {
  if (typeof value !== 'number') return '--'
  return `${Math.max(0, Math.round(value))}%`
}

export function getCompletionExtraMoves(entry: Pick<PuzzleCompletionRecord, 'moves' | 'actionMoves'>): number {
  return Math.max(0, entry.actionMoves - entry.moves)
}

export function formatAssistanceModeLabel(mode: PuzzleAssistanceMode | null | undefined): string {
  switch (mode) {
    case 'clean':
      return 'Clean'
    case 'hinted':
      return 'Hilfen'
    case 'auto-assisted':
      return 'Auto-Zug'
    default:
      return '--'
  }
}

export function formatProfileSourceLabel(hasDetailedProfile: boolean): string {
  return hasDetailedProfile ? 'Laufprofil' : 'Legacy-Daten'
}

export function formatDayLabel(days: number): string {
  return `${days} ${days === 1 ? 'Tag' : 'Tage'}`
}

function getDifficultyFilterId(config: PuzzleConfig): `${number}x${number}` {
  return getStatsDifficultyKey(config)
}

function parseTimestamp(timestamp: string | null | undefined): number {
  if (!timestamp) return Number.NEGATIVE_INFINITY

  const parsed = Date.parse(timestamp)
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed
}

export function getLatestSavedGame(savedGames: SavedGameSummary[]): SavedGameSummary | null {
  if (savedGames.length === 0) return null

  return savedGames.reduce<SavedGameSummary | null>((latest, current) => {
    if (!latest) return current
    return parseTimestamp(current.updatedAt) > parseTimestamp(latest.updatedAt) ? current : latest
  }, null)
}

export function getLatestGalleryEntry(gallery: SolvedGallery | null): SolvedGalleryEntry | null {
  return gallery?.entries[0] ?? null
}

export function getLatestActivityTimestamp(
  stats: PuzzleStats | null,
  savedGames: SavedGameSummary[],
  gallery: SolvedGallery | null
): string | null {
  const latestSavedGame = getLatestSavedGame(savedGames)
  const statTimestamp = stats?.lastUpdatedAt ?? stats?.lastCompletedAt ?? null
  const saveTimestamp = latestSavedGame?.updatedAt ?? null
  const galleryTimestamp = gallery?.lastCompletedAt ?? null

  const timestamps = [statTimestamp, saveTimestamp, galleryTimestamp]
  return timestamps.reduce<string | null>((latest, current) => {
    return parseTimestamp(current) > parseTimestamp(latest) ? current ?? null : latest
  }, null)
}

function calculateRate(part: number, total: number): number | null {
  if (total <= 0) return null
  return Math.round((part / total) * 100)
}

function buildDifficultyAssistanceCounts(
  completionHistory: PuzzleCompletionRecord[]
): Map<HistoryFilter, DifficultyAssistanceCounts> {
  return completionHistory.reduce<Map<HistoryFilter, DifficultyAssistanceCounts>>((countsByDifficulty, entry) => {
    const difficultyId = getDifficultyFilterId(entry.config)
    const counts = countsByDifficulty.get(difficultyId) ?? {
      solveCount: 0,
      cleanSolveCount: 0,
      assistedSolveCount: 0,
      autoAssistedSolveCount: 0,
      profiledSolveCount: 0,
    }

    counts.solveCount += 1

    if (entry.hasDetailedProfile) {
      counts.profiledSolveCount += 1

      if (entry.hintCount > 0) {
        counts.assistedSolveCount += 1
      } else if (entry.suggestedMoveCount > 0) {
        counts.assistedSolveCount += 1
        counts.autoAssistedSolveCount += 1
      } else if (entry.assistanceMode === 'clean') {
        counts.cleanSolveCount += 1
      } else {
        counts.assistedSolveCount += 1
      }
    }

    countsByDifficulty.set(difficultyId, counts)
    return countsByDifficulty
  }, new Map())
}

export function buildDifficultyReportRows(
  standardDifficultyStats: StandardDifficultyStatsEntry[],
  completionHistory: PuzzleCompletionRecord[]
): DifficultyReportRow[] {
  const assistanceCountsByDifficulty = buildDifficultyAssistanceCounts(completionHistory)
  const worstByDifficulty = completionHistory.reduce<
    Map<`${number}x${number}`, { worstTime: number; worstMoves: number }>
  >((accumulator, entry) => {
    const difficultyId = getDifficultyFilterId(entry.config)
    const current = accumulator.get(difficultyId)

    if (current) {
      if (entry.time > current.worstTime) current.worstTime = entry.time
      if (entry.moves > current.worstMoves) current.worstMoves = entry.moves
      return accumulator
    }

    accumulator.set(difficultyId, {
      worstTime: entry.time,
      worstMoves: entry.moves,
    })
    return accumulator
  }, new Map())

  return standardDifficultyStats.map(({ option, stats }) => {
    const difficultyId = getDifficultyFilterId({ rows: option.rows, cols: option.cols })
    const worstValues = worstByDifficulty.get(difficultyId)
    const assistanceCounts = assistanceCountsByDifficulty.get(difficultyId)
    const solveCount = Math.max(stats?.solveCount ?? 0, assistanceCounts?.solveCount ?? 0)
    const hasHistoryCounts = (assistanceCounts?.solveCount ?? 0) > 0
    const cleanSolveCount = hasHistoryCounts
      ? assistanceCounts?.cleanSolveCount ?? 0
      : stats?.cleanSolveCount ?? 0
    const assistedSolveCount = hasHistoryCounts
      ? assistanceCounts?.assistedSolveCount ?? 0
      : stats?.assistedSolveCount ?? 0
    const autoAssistedSolveCount = hasHistoryCounts
      ? assistanceCounts?.autoAssistedSolveCount ?? 0
      : stats?.autoAssistedSolveCount ?? 0
    const profiledSolveCount = hasHistoryCounts
      ? assistanceCounts?.profiledSolveCount ?? 0
      : stats?.profiledSolveCount ?? 0
    const legacySolveCount = hasHistoryCounts
      ? Math.max(0, solveCount - profiledSolveCount)
      : stats?.legacySolveCount ?? 0

    return {
      option,
      stats,
      solveCount,
      cleanSolveCount,
      assistedSolveCount,
      autoAssistedSolveCount,
      profiledSolveCount,
      legacySolveCount,
      cleanRate: calculateRate(cleanSolveCount, solveCount),
      profileCoverage: calculateRate(profiledSolveCount, solveCount),
      bestTime: stats?.bestTime ?? null,
      worstTime: worstValues?.worstTime ?? null,
      bestMoves: stats?.bestMoves ?? null,
      worstMoves: worstValues?.worstMoves ?? null,
      averageTime: solveCount > 0 ? stats?.averageTime ?? null : null,
      medianTime: solveCount > 0 ? stats?.medianTime ?? null : null,
      recentMedianTime: solveCount > 0 ? stats?.recentMedianTime ?? null : null,
      averageMoves: solveCount > 0 ? stats?.averageMoves ?? null : null,
      medianMoves: solveCount > 0 ? stats?.medianMoves ?? null : null,
      recentMedianMoves: solveCount > 0 ? stats?.recentMedianMoves ?? null : null,
      averageExtraMoves: profiledSolveCount > 0 ? stats?.averageExtraMoves ?? null : null,
      lastCompletedAt: stats?.lastCompletedAt ?? null,
      lastTime: stats?.lastTime ?? null,
      lastMoves: stats?.lastMoves ?? null,
      lastAssistanceMode: stats?.lastAssistanceMode ?? null,
      lastHasDetailedProfile: stats?.lastHasDetailedProfile ?? null,
    }
  })
}

export function findDifficultyStats(
  stats: PuzzleStats | null,
  rows: number,
  cols: number
): PuzzleDifficultyStats | null {
  return stats?.byDifficulty.find((entry) => entry.config.rows === rows && entry.config.cols === cols) ?? null
}

export function getDifficultyHistoryFilterOptions(): HistoryFilterDefinition[] {
  return [
    { id: 'all', label: 'Alle Siege' },
    ...DIFFICULTY_OPTIONS.map((option) => ({
      id: getDifficultyFilterId({ rows: option.rows, cols: option.cols }),
      label: option.label,
    })),
  ]
}

export function getGalleryDifficultyFilterOptions(): GallerySelectOption<GalleryDifficultyFilter>[] {
  return [
    { id: 'all', label: 'Alle Schwierigkeitsgrade' },
    ...DIFFICULTY_OPTIONS.map((option) => ({
      id: getDifficultyFilterId({ rows: option.rows, cols: option.cols }),
      label: `${option.label} (${option.description})`,
    })),
  ]
}

export const GALLERY_ASSISTANCE_FILTER_OPTIONS: GallerySelectOption<GalleryAssistanceFilter>[] = [
  { id: 'all', label: 'Alle Laufarten' },
  { id: 'clean', label: 'Nur clean' },
  { id: 'assisted', label: 'Nur unterstützt' },
  { id: 'hinted', label: 'Nur mit Hilfen' },
  { id: 'auto-assisted', label: 'Nur mit Auto-Zug' },
  { id: 'legacy', label: 'Nur Legacy-Daten' },
]

export const GALLERY_MEDAL_HUNT_FILTER_OPTIONS: GallerySelectOption<GalleryMedalHuntFilter>[] = [
  { id: 'all', label: 'Alle Motive' },
  { id: 'no-medal', label: 'Ohne Medaille' },
  { id: 'no-gold', label: 'Ohne Gold oder Diamant' },
  { id: 'upgradeable', label: 'Noch upgradefähig' },
]

export const GALLERY_SORT_OPTIONS: GallerySelectOption<GallerySortOption>[] = [
  { id: 'latest', label: 'Neueste zuerst' },
  { id: 'oldest', label: 'Älteste zuerst' },
  { id: 'fastest', label: 'Schnellste Zeit' },
  { id: 'fewest-moves', label: 'Wenigste Netto-Züge' },
  { id: 'fewest-actions', label: 'Wenigste Aktionen' },
  { id: 'fewest-detours', label: 'Wenigste Korrekturen' },
  { id: 'upgrade-potential', label: 'Bestes Upgrade-Potenzial' },
]

export function matchesGalleryDifficultyFilter(
  entry: SolvedGalleryEntry,
  filter: GalleryDifficultyFilter
): boolean {
  return filter === 'all' || getDifficultyFilterId(entry.config) === filter
}

export function matchesGalleryAssistanceFilter(
  entry: SolvedGalleryEntry,
  filter: GalleryAssistanceFilter
): boolean {
  if (filter === 'all') return true

  if (!entry.hasDetailedProfile) {
    return filter === 'legacy'
  }

  if (filter === 'legacy') return false
  if (filter === 'clean') return entry.assistanceMode === 'clean'
  if (filter === 'assisted') return entry.assistanceMode === 'hinted' || entry.assistanceMode === 'auto-assisted'
  if (filter === 'hinted') return entry.assistanceMode === 'hinted'
  return entry.assistanceMode === 'auto-assisted'
}

function compareNumbersAscending(a: number, b: number, fallback: number): number {
  if (a !== b) return a - b
  return fallback
}

function compareGalleryEntriesByLatest(a: SolvedGalleryEntry, b: SolvedGalleryEntry): number {
  const timestampA = parseTimestamp(a.completedAt)
  const timestampB = parseTimestamp(b.completedAt)

  if (timestampA === timestampB) return 0
  return timestampB > timestampA ? 1 : -1
}

export function sortGalleryEntries(
  entries: SolvedGalleryEntry[],
  sortOption: GallerySortOption
): SolvedGalleryEntry[] {
  const sortedEntries = [...entries]

  sortedEntries.sort((a, b) => {
    const latestFallback = compareGalleryEntriesByLatest(a, b)

    switch (sortOption) {
      case 'oldest':
        return -latestFallback
      case 'fastest':
        return compareNumbersAscending(a.time, b.time, latestFallback)
      case 'fewest-moves':
        return compareNumbersAscending(a.moves, b.moves, latestFallback)
      case 'fewest-actions':
        return compareNumbersAscending(a.actionMoves, b.actionMoves, latestFallback)
      case 'fewest-detours':
        return compareNumbersAscending(getCompletionExtraMoves(a), getCompletionExtraMoves(b), latestFallback)
      case 'latest':
      default:
        return latestFallback
    }
  })

  return sortedEntries
}

function compareDifficultyStats(a: PuzzleDifficultyStats, b: PuzzleDifficultyStats): number {
  if (b.solveCount !== a.solveCount) return b.solveCount - a.solveCount

  const areaA = a.config.rows * a.config.cols
  const areaB = b.config.rows * b.config.cols
  if (areaB !== areaA) return areaB - areaA

  if (a.averageTime !== b.averageTime) return a.averageTime - b.averageTime
  return a.averageMoves - b.averageMoves
}

export function findFavoriteDifficulty(stats: PuzzleStats | null): PuzzleDifficultyStats | null {
  if (!stats) return null

  const solvedDifficulties = stats.byDifficulty.filter((entry) => entry.solveCount > 0)
  if (solvedDifficulties.length === 0) return null
  return [...solvedDifficulties].sort(compareDifficultyStats)[0] ?? null
}

export function findFastestDifficulty(stats: PuzzleStats | null): PuzzleDifficultyStats | null {
  if (!stats) return null

  const solvedDifficulties = stats.byDifficulty.filter((entry) => entry.solveCount > 0)
  if (solvedDifficulties.length === 0) return null

  return [...solvedDifficulties].sort((a, b) => {
    if (a.averageTime !== b.averageTime) return a.averageTime - b.averageTime
    if (a.averageMoves !== b.averageMoves) return a.averageMoves - b.averageMoves
    return compareDifficultyStats(a, b)
  })[0] ?? null
}

export function getCompletionBadges(entry: PuzzleCompletionRecord, stats: PuzzleStats | null): string[] {
  const difficultyStats = findDifficultyStats(stats, entry.config.rows, entry.config.cols)
  const badges: string[] = []
  const bestTime = difficultyStats?.bestTime ?? null
  const bestCleanMoves = difficultyStats?.bestCleanMoves ?? null

  if (entry.hasDetailedProfile) {
    badges.push(formatAssistanceModeLabel(entry.assistanceMode))
  } else {
    badges.push(formatProfileSourceLabel(false))
  }

  if (bestTime !== null && entry.time === bestTime) {
    badges.push('Bestzeit')
  }

  if (
    entry.hasDetailedProfile
    && bestCleanMoves !== null
    && entry.assistanceMode === 'clean'
    && entry.moves === bestCleanMoves
  ) {
    badges.push('Clean-Rekord')
  }

  return badges
}

