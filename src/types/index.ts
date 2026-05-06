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
}

// Gewinn-Statistiken
export interface WinStats extends PuzzleRunMetrics {
  moves: number
  time: number
  assistanceMode: PuzzleAssistanceMode
}

// Persistenter Spielstand (lokal gespeichert)
export interface SolverProgress {
  shuffleMoves: string[]
  reducedMovePath: string[]
}

export type PuzzleMoveDirection = 'up' | 'down' | 'left' | 'right'
export type GhostPreviewMode = 'image' | 'contours' | 'edges'

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
  heatmapOverlayVisible?: boolean
  solverProgress?: SolverProgress
}

export interface PersistedPuzzleMeta {
  image: string
  croppedImage: string
  config: PuzzleConfig
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
  version: 1 | 2 | 3
  exportedAt: string
  savedGames: PuzzleDataBackupSavedGame[]
  stats: PuzzleDataBackupStats | null
  gallery: PuzzleDataBackupGallery | null
  collections?: ImageCollections | null
  assets?: BackupImageAssets
}

export interface PuzzleDataImportResult {
  importedAt: string
  savedGames: SavedGameSummary[]
  stats: PuzzleStats
  gallery: SolvedGallery
  collections: ImageCollections
}

export interface PuzzleDataBackupFile {
  fileName: string
  exportedAt: string | null
  savedGamesCount: number
  totalSolved: number
  galleryEntriesCount: number
  size: number
  modifiedAt: string
  alreadyCurrent: boolean
  deletedBackupFileNames: string[]
  retentionLimit: number
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
}

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






