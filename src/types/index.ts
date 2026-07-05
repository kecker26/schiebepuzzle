import type { CropTransform } from '../services/CropService.ts'

// App State Machine
export type AppState = 'welcome' | 'idle' | 'imageLoaded' | 'playing' | 'solved'

// Konfiguration
export interface PuzzleConfig {
  rows: number
  cols: number
}

// Kachel (Tile)
export interface Tile {
  id: string
  // Ist-Position
  row: number
  col: number
  index: number
  // Soll-Position (fuer Win-Check)
  correctRow: number
  correctCol: number
  correctIndex: number
  // Rendering
  imageSliceRef: CanvasImageData
  isEmpty: boolean
  // UI-State
  isDragging?: boolean
  canMove?: boolean
}

// Bild-Daten fuer Canvas
export interface CanvasImageData {
  sourceX: number
  sourceY: number
  sourceWidth: number
  sourceHeight: number
}

// Puzzle Board State
export interface PuzzleState {
  tiles: Tile[]
  board: number[] // Array von Tile-IDs fuer schnelle Lookups
  emptyIndex: number
  emptyRow: number
  emptyCol: number
  moveCount: number
  startTime: number
  isSolved: boolean
  isAnimating: boolean
  dragState: DragState | null
}

// Drag-Zustand
export interface DragState {
  tileId: string
  startX: number
  startY: number
  startRow: number
  startCol: number
  currentX: number
  currentY: number
  axis: 'horizontal' | 'vertical' | null
}

export interface TileMoveAnimation {
  tileId: string
  fromRow: number
  fromCol: number
  toRow: number
  toCol: number
  progress: number
}

export type PuzzleAssistanceMode = 'clean' | 'hinted' | 'auto-assisted'

export interface PuzzleRunMetrics {
  actionMoves: number
  undoCount: number
  redoCount: number
  hintCount: number
  suggestedMoveCount: number
  ghostUsageCount?: number
  ghostUsageDurationMs?: number
  ghostUsageByMode?: Partial<Record<GhostPreviewMode, number>>
  heatmapUsageCount?: number
  heatmapUsageDurationMs?: number
  heatmapUsageByMode?: Partial<Record<HeatmapMode, number>>
}

// Gewinn-Statistiken
export interface WinStats extends PuzzleRunMetrics {
  moves: number
  time: number
  assistanceMode: PuzzleAssistanceMode
  replaySetup?: GalleryReplaySetup
}

// Persistenter Spielstand (lokal gespeichert)
export interface SolverProgress {
  shuffleMoves: string[]
  reducedMovePath: string[]
}

export type PuzzleMoveDirection = 'up' | 'down' | 'left' | 'right'
export type GhostPreviewMode = 'image' | 'contours' | 'edges'
export type GhostPreviewScope = 'misplaced' | 'focus'
export type GhostPreviewMotion = 'static' | 'pulse'
export type HeatmapMode = 'classic' | 'arrows' | 'delta'

export type OptimalStartMoveCountKind = 'exact' | 'lower-bound' | 'unavailable'

export interface PuzzleMoveRecord {
  tileId: string
  tileValue: number
  direction: PuzzleMoveDirection
  moveNumber: number
}


export interface PersistedPuzzleProgress {
  puzzleState: PuzzleState
  moveCount: number
  elapsedTime: number
  isPaused?: boolean
  optimalStartMoveCount?: number | null
  optimalStartMoveCountKind?: OptimalStartMoveCountKind
  optimalStartMoveCountSolverVersion?: string
  runMetrics?: PuzzleRunMetrics
  moveHistory: PuzzleState[]
  redoHistory?: PuzzleState[]
  previewVisible: boolean
  ghostPreviewVisible?: boolean
  ghostPreviewWeight?: number
  ghostPreviewMode?: GhostPreviewMode
  ghostPreviewScope?: GhostPreviewScope
  ghostPreviewMotion?: GhostPreviewMotion
  ghostPreviewProgressive?: boolean
  ghostPreviewProgressPeak?: number
  heatmapOverlayVisible?: boolean
  heatmapMode?: HeatmapMode
  heatmapIntensity?: number
  heatmapDistancesVisible?: boolean
  solverProgress?: SolverProgress
  challengeTarget?: GalleryChallengeTarget | null
  challengeMode?: ChallengeMode | null
}

export interface PersistedPuzzleMeta {
  image: string
  croppedImage: string
  config: PuzzleConfig
}

export type ImageThemeMoodId =
  | 'joyful'
  | 'melancholic'
  | 'dark'
  | 'energetic'
  | 'calm'
  | 'dramatic'
  | 'nostalgic'
  | 'dreamy'
  | 'epic'
  | 'minimal'

export type ImageThemePaletteSource = 'local-color' | 'fallback'

export interface ImageThemePalette {
  accentSolid: string
  accentSoft: string
  accentStrong: string
  glow: string
  primaryColor: string
  primaryHover: string
  primaryShadow: string
  primaryShadowHover: string
  mood: ImageThemeMoodId
  moodLabel: string
  confidence: number
  source: ImageThemePaletteSource
  reason: string | null
  analyzedAt: string
}

export type SavedGameTitleSource = 'gemini' | 'reused' | 'fallback'
export type SavedGameAiTitleStatus = 'generated' | 'reused' | 'failed' | 'unavailable' | 'pending'
export type AiMetadataProvider = 'gemini' | 'openrouter' | 'openai-compatible' | 'groq'

export interface SavedGameAiTitle {
  status: SavedGameAiTitleStatus
  provider: AiMetadataProvider
  model: string | null
  generatedAt: string | null
  error: string | null
  reusedFromSaveId?: string | null
}

export interface SavedGameSummary {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  previewImage: string
  config: PuzzleConfig
  moves: number
  elapsedTime: number
  runMetrics?: PuzzleRunMetrics
  challengeTarget?: GalleryChallengeTarget | null
  challengeMode?: ChallengeMode | null
  imageFingerprint?: string
  titleSource?: SavedGameTitleSource
  aiTitle?: SavedGameAiTitle
  imageTheme?: ImageThemePalette
}

export interface SavedGameData extends SavedGameSummary {
  image: string
  croppedImage: string
  progress: PersistedPuzzleProgress
}

export interface PuzzleCompletionRecord {
  id: string
  completedAt: string
  previewImage: string | null
  config: PuzzleConfig
  moves: number
  time: number
  actionMoves: number
  undoCount: number
  redoCount: number
  hintCount: number
  suggestedMoveCount: number
  ghostUsageCount?: number
  ghostUsageDurationMs?: number
  ghostUsageByMode?: Partial<Record<GhostPreviewMode, number>>
  heatmapUsageCount?: number
  heatmapUsageDurationMs?: number
  heatmapUsageByMode?: Partial<Record<HeatmapMode, number>>
  assistanceMode: PuzzleAssistanceMode
  hasDetailedProfile: boolean
}

export interface SolvedGalleryEntry {
  id: string
  completedAt: string
  previewImage: string | null
  sourceImage: string | null
  config: PuzzleConfig
  moves: number
  time: number
  actionMoves: number
  assistanceMode: PuzzleAssistanceMode
  hasDetailedProfile: boolean
  tags?: GalleryImageTag[]
  rejectedAiTags?: string[]
  aiTagging?: GalleryAiTagging
  cropTransform?: CropTransform | null
  useFullImage?: boolean
  replaySetup?: GalleryReplaySetup
  imageTheme?: ImageThemePalette
  challengeTargetId?: string
  challengeMedal?: ChallengeMedal
  estimatedChallengeTarget?: GalleryChallengeTarget
  challengeRunKind?: ChallengeRunKind
  qualificationResult?: QualificationResult
}

export interface GalleryReplaySetup {
  version: 1
  startBoard: number[]
  emptyIndex: number
  shuffleMoves: string[]
  optimalStartMoveCount?: number | null
  optimalStartMoveCountKind?: OptimalStartMoveCountKind
  optimalStartMoveCountSolverVersion?: string
}

export interface GalleryChallengeTarget {
  entryId: string
  completedAt: string
  time: number
  moves: number
  actionMoves: number
  assistanceMode: PuzzleAssistanceMode
  optimalStartMoveCount?: number | null
  optimalStartMoveCountKind?: OptimalStartMoveCountKind
  synthetic?: boolean
  estimate?: GalleryChallengeEstimate
}

export type ChallengeMedal = 'bronze' | 'silver' | 'gold' | 'diamond'
export type ChallengeMode = 'soft' | 'qualification' | 'medal'
export type ChallengeRunKind = 'medal' | 'qualification'
export type QualificationResult = 'created-template' | 'failed'

export interface GalleryChallengeEstimate {
  version: 1
  method: 'heuristic-personal-v1'
  heuristicScore: number
  createdAt: string
  personalMedianApplied: boolean
}

export interface ChallengeResult {
  targetId: string
  medal: ChallengeMedal | null
  previousBestMedal?: ChallengeMedal | null
  mode?: ChallengeMode
  qualificationResult?: QualificationResult | null
  estimatedTarget?: GalleryChallengeTarget | null
}

export type GalleryTagSource = 'gemini' | 'imported' | 'manual'

export interface GalleryImageTag {
  label: string
  confidence: number
  source: GalleryTagSource
}

export type GalleryAiTaggingStatus = 'tagged' | 'failed' | 'unavailable' | 'pending'

export interface GalleryCollectionSuggestion {
  collectionId: string
  collectionName: string
  reason: string
  confidence: number
  source: 'gemini'
}

export interface GalleryAiTagging {
  status: GalleryAiTaggingStatus
  provider: AiMetadataProvider
  model: string | null
  generatedAt: string | null
  error: string | null
  collectionSuggestions: GalleryCollectionSuggestion[]
}

export interface PuzzleDifficultyStats {
  config: PuzzleConfig
  solveCount: number
  cleanSolveCount: number
  assistedSolveCount: number
  autoAssistedSolveCount: number
  profiledSolveCount: number
  legacySolveCount: number
  totalMoves: number
  totalActionMoves: number
  totalTime: number
  averageMoves: number
  averageActionMoves: number | null
  averageTime: number
  medianMoves: number
  medianActionMoves: number | null
  medianTime: number
  averageExtraMoves: number | null
  medianExtraMoves: number | null
  bestMoves: number | null
  bestCleanMoves: number | null
  bestTime: number | null
  bestCleanTime: number | null
  recentMedianMoves: number
  recentMedianTime: number
  lastMoves: number | null
  lastActionMoves: number | null
  lastExtraMoves: number | null
  lastTime: number | null
  lastAssistanceMode: PuzzleAssistanceMode | null
  lastHasDetailedProfile: boolean | null
  lastCompletedAt: string | null
}

export interface PuzzleStats {
  totalSolved: number
  cleanSolvedCount: number
  assistedSolvedCount: number
  autoAssistedSolvedCount: number
  profiledSolvedCount: number
  legacySolvedCount: number
  totalMoves: number
  totalTime: number
  averageMoves: number
  averageTime: number
  medianMoves: number
  medianTime: number
  currentStreak: number
  bestStreak: number
  activeDays: number
  bestMoves: number | null
  bestCleanMoves: number | null
  bestTime: number | null
  bestCleanTime: number | null
  byDifficulty: PuzzleDifficultyStats[]
  recentCompletions: PuzzleCompletionRecord[]
  completionHistory: PuzzleCompletionRecord[]
  lastCompletedAt: string | null
  lastUpdatedAt: string | null
}

export interface SolvedGallery {
  entries: SolvedGalleryEntry[]
  totalEntries: number
  lastCompletedAt: string | null
  lastUpdatedAt: string | null
}

export interface ImageCollection {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  imageIds: string[]
}

export interface ImageCollections {
  collections: ImageCollection[]
  totalCollections: number
  lastUpdatedAt: string | null
}

export interface CreateImageCollectionPayload {
  name: string
  description?: string
  imageIds?: string[]
}

export interface UpdateImageCollectionPayload {
  name?: string
  description?: string
  imageIds?: string[]
}

export interface UpdateImageCollectionImagesPayload {
  imageIds: string[]
}

export interface BackupImageAssetRef {
  assetId: string
}

export type BackupImageValue = string | BackupImageAssetRef | null

export type BackupImageAssets = Record<string, string>

export interface PuzzleDataBackupSavedGame extends Omit<SavedGameData, 'previewImage' | 'image' | 'croppedImage'> {
  previewImage: BackupImageValue
  image: BackupImageValue
  croppedImage: BackupImageValue
}

export interface PuzzleDataBackupCompletionRecord extends Omit<PuzzleCompletionRecord, 'previewImage'> {
  previewImage: BackupImageValue
}

export interface PuzzleDataBackupStats extends Omit<PuzzleStats, 'recentCompletions' | 'completionHistory'> {
  recentCompletions: PuzzleDataBackupCompletionRecord[]
  completionHistory: PuzzleDataBackupCompletionRecord[]
}

export interface PuzzleDataBackupGalleryEntry extends Omit<SolvedGalleryEntry, 'previewImage' | 'sourceImage'> {
  previewImage: BackupImageValue
  sourceImage: BackupImageValue
}

export interface PuzzleDataBackupGallery extends Omit<SolvedGallery, 'entries'> {
  entries: PuzzleDataBackupGalleryEntry[]
}

export interface PuzzleDataBackup {
  app: 'schiebepuzzle'
  version: 1 | 2 | 3 | 4
  exportedAt: string
  savedGames: PuzzleDataBackupSavedGame[]
  stats: PuzzleDataBackupStats | null
  gallery: PuzzleDataBackupGallery | null
  collections?: ImageCollections | null
  tagCategoryCache?: {
    version: 1
    assignments: import('../services/tagCategories/tagCategoryTypes.ts').TagCategoryAssignment[]
    lastUpdatedAt: string | null
  } | null
  customTagCategories?: {
    version: 1
    categories: import('../services/tagCategories/tagCategoryTypes.ts').TagCategoryDefinition[]
    lastUpdatedAt: string | null
  } | null
  assets?: BackupImageAssets
}

export interface PuzzleDataImportResult {
  importedAt: string
  savedGames: SavedGameSummary[]
  stats: PuzzleStats
  gallery: SolvedGallery
  collections: ImageCollections
  tagCategoryCatalog: import('../services/tagCategories/tagCategoryTypes.ts').TagCategoryCatalog
}

export interface PuzzleDataBackupFile {
  fileName: string
  exportedAt: string | null
  savedGamesCount: number
  totalSolved: number
  galleryEntriesCount: number
  galleryMotifsCount?: number
  size: number
  modifiedAt: string
  alreadyCurrent: boolean
  deletedBackupFileNames: string[]
  retentionLimit: number
}

export interface PuzzleStatsExportFile {
  fileName: string
  directory: string
  relativePath: string
  size: number
  savedAt: string
  mimeType: 'text/csv' | 'application/json'
}

export interface RecordPuzzleCompletionPayload extends PuzzleRunMetrics {
  config: PuzzleConfig
  moves: number
  time: number
  previewImage?: string | null
}

export interface RecordSolvedGalleryEntryPayload {
  id?: string
  completedAt?: string | null
  previewImage?: string | null
  sourceImage?: string | null
  config: PuzzleConfig
  moves: number
  time: number
  actionMoves: number
  assistanceMode: PuzzleAssistanceMode
  hasDetailedProfile: boolean
  cropTransform?: CropTransform | null
  useFullImage?: boolean
  replaySetup?: GalleryReplaySetup
  imageTheme?: ImageThemePalette | null
  challengeTargetId?: string
  challengeMedal?: ChallengeMedal
  estimatedChallengeTarget?: GalleryChallengeTarget
  challengeRunKind?: ChallengeRunKind
  qualificationResult?: QualificationResult
}

export interface AnalyzeSolvedGalleryEntryResult {
  gallery: SolvedGallery
  entry: SolvedGalleryEntry
}

export interface AnalyzeWinEffectImagePayload {
  image: string
  config: PuzzleConfig
}

export interface AnalyzeWinEffectImageResult {
  tags: GalleryImageTag[]
}

export type UpdateSolvedGalleryTagsAction = 'rename' | 'remove'

export interface UpdateSolvedGalleryTagsPayload {
  action: UpdateSolvedGalleryTagsAction
  sourceLabel: string
  targetLabel?: string
}

export interface EditSolvedGalleryEntryTagsPayload {
  entryIds: string[]
  add?: string[]
  remove?: string[]
}

export type {
  StaticTagCategoryId,
  TagCategoryId,
  TagCategoryIconId,
  TagCategoryAssignment,
  TagCategoryAssignmentSource,
  TagCategoryCatalog,
  TagCategoryDefinition,
  TagCategoryResolution,
  UpdateTagCategoryAssignmentsPayload,
  CreateTagCategoryPayload,
  UpdateTagCategoryPayload,
  TagCategorySuggestion,
  ClassifyTagCategoriesPayload,
  ClassifyTagCategoriesResult,
} from '../services/tagCategories/tagCategoryTypes.ts'

export interface RecordPuzzleCompletionResult {
  stats: PuzzleStats
  completion: PuzzleCompletionRecord
  difficultyStats: PuzzleDifficultyStats
  previousCompletion: PuzzleCompletionRecord | null
  previousRecentMedianMoves: number | null
  previousRecentMedianTime: number | null
  isNewBestMoves: boolean
  isNewBestTime: boolean
  isNewBestCleanMoves: boolean
  isNewBestCleanTime: boolean
}






