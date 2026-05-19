import { createHash, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { gunzipSync, gzipSync } from 'node:zlib'
import type { Plugin } from 'vite'
import MusicProviderCoordinator from './src/services/music/MusicProviderCoordinator.ts'
import { isMusicStyleId } from './src/services/musicStyles.ts'
import type { MusicProviderId } from './src/services/music/types.ts'

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url))
const SAVES_DIR = path.join(ROOT_DIR, 'spielstaende')
const BACKUPS_DIR = path.join(ROOT_DIR, 'backups')
const STATS_EXPORTS_DIR = path.join(ROOT_DIR, 'statistik-exporte')
const STATS_FILE = path.join(SAVES_DIR, '__stats.json')
const GALLERY_FILE = path.join(SAVES_DIR, '__gallery.json')
const COLLECTIONS_FILE = path.join(SAVES_DIR, '__collections.json')
const LEGACY_BACKUP_FILE_EXTENSION = '.spbkp'
const COMPRESSED_BACKUP_FILE_EXTENSION = '.spbkp.gz'
const BACKUP_FILE_EXTENSION = COMPRESSED_BACKUP_FILE_EXTENSION
const SAVE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/
const BACKUP_FILE_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.spbkp(?:\.gz)?$/
const STATS_EXPORT_FILE_NAME_PATTERN = /^schiebepuzzle-statistik-[a-zA-Z0-9._-]+\.(?:csv|json)$/
const MAX_BODY_SIZE = 40 * 1024 * 1024
const MAX_SAVED_GAMES = 30
const MAX_BACKUP_FILES = 3
const BACKUP_FORMAT_VERSION = 3
const RECENT_COMPLETION_PREVIEW_LIMIT = 8
const RECENT_MEDIAN_SAMPLE_SIZE = 5
const GZIP_MAGIC_BYTE_1 = 0x1f
const GZIP_MAGIC_BYTE_2 = 0x8b
const CLIPBOARD_COMMAND_MAX_BUFFER = 64 * 1024 * 1024
const POLLINATIONS_BASE_URL = 'https://gen.pollinations.ai'
const POLLINATIONS_GENERATED_IMAGE_MODEL = 'zimage'
const POLLINATIONS_GENERATED_IMAGE_WIDTH = 1280
const POLLINATIONS_GENERATED_IMAGE_HEIGHT = 960
const POLLINATIONS_GENERATED_IMAGE_TIMEOUT_MS = 120000
const GENERATED_IMAGE_MAX_SEED = 999999999
const CLOUDFLARE_BASE_URL = 'https://api.cloudflare.com'
const CLOUDFLARE_GENERATED_IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell'
const CLOUDFLARE_GENERATED_IMAGE_STEPS = 4
const CLOUDFLARE_GENERATED_IMAGE_TIMEOUT_MS = 120000
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com'
const GEMINI_GALLERY_MODEL = 'gemini-2.5-flash'
const GEMINI_GALLERY_TIMEOUT_MS = 45000
const GEMINI_GALLERY_MAX_INLINE_IMAGE_BYTES = 18 * 1024 * 1024
const GEMINI_SAVE_TITLE_TIMEOUT_MS = 30000
const GEMINI_SAVE_TITLE_MAX_INLINE_IMAGE_BYTES = 18 * 1024 * 1024
const GALLERY_AI_TAG_LIMIT = 8
const GALLERY_AI_COLLECTION_SUGGESTION_LIMIT = 4
const SAVE_AI_TITLE_MAX_LENGTH = 64
const MAX_GENERATED_IMAGE_PROMPT_LENGTH = 1000
const POWERSHELL_PATH = process.platform === 'win32'
  ? path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  : 'powershell'
const execFileAsync = promisify(execFile)

interface LocalApiPluginOptions {
  jamendoClientId?: string
  pollinationsApiKey?: string
  pollinationsImageModel?: string
  cloudflareAccountId?: string
  cloudflareApiToken?: string
  cloudflareImageModel?: string
  geminiApiKey?: string
  geminiGalleryModel?: string
}

interface PollinationsGeneratedImageConfig {
  apiKey: string
  model: string
}

interface CloudflareGeneratedImageConfig {
  accountId: string
  apiToken: string
  model: string
}

interface GeneratedImageConfig {
  pollinations: PollinationsGeneratedImageConfig
  cloudflare: CloudflareGeneratedImageConfig
}

interface GeminiGalleryConfig {
  apiKey: string
  model: string
}

const POWERSHELL_CLIPBOARD_IMAGE_STATUS_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  '$image = Get-Clipboard -Format Image -ErrorAction SilentlyContinue',
  'try {',
  "  if ($null -eq $image) { [Console]::Out.Write('NO_IMAGE'); exit 0 }",
  "  [Console]::Out.Write('HAS_IMAGE')",
  '} finally {',
  "  if ($image -is [System.IDisposable]) { $image.Dispose() }",
  '}',
].join('\n')

const POWERSHELL_CLIPBOARD_IMAGE_READ_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  'Add-Type -AssemblyName System.Drawing',
  '$image = Get-Clipboard -Format Image -ErrorAction SilentlyContinue',
  'if ($null -eq $image) { throw "NO_IMAGE" }',
  '$stream = New-Object System.IO.MemoryStream',
  'try {',
  '  $image.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)',
  '  [Console]::Out.Write([Convert]::ToBase64String($stream.ToArray()))',
  '} finally {',
  '  $stream.Dispose()',
  "  if ($image -is [System.IDisposable]) { $image.Dispose() }",
  '}',
].join('\n')

const POWERSHELL_CLIPBOARD_TEXT_READ_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  '$text = Get-Clipboard -Raw -Format Text -ErrorAction SilentlyContinue',
  'if ($null -eq $text) { exit 0 }',
  '[Console]::Out.Write($text)',
].join('\n')

interface StoredPuzzleConfig {
  rows: number
  cols: number
}

type StoredAssistanceMode = 'clean' | 'hinted' | 'auto-assisted'

interface StoredRunMetrics {
  actionMoves: number
  undoCount: number
  redoCount: number
  hintCount: number
  suggestedMoveCount: number
}

type StoredSaveTitleSource = 'gemini' | 'reused' | 'fallback'
type StoredSaveAiTitleStatus = 'generated' | 'reused' | 'failed' | 'unavailable' | 'pending'

interface StoredSaveAiTitle {
  status: StoredSaveAiTitleStatus
  provider: 'gemini'
  model: string | null
  generatedAt: string | null
  error: string | null
  reusedFromSaveId?: string | null
}

type StoredImageThemeMoodId =
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

type StoredImageThemePaletteSource = 'local-color' | 'fallback'

interface StoredImageThemePalette {
  accentSolid: string
  accentSoft: string
  accentStrong: string
  glow: string
  primaryColor: string
  primaryHover: string
  primaryShadow: string
  primaryShadowHover: string
  mood: StoredImageThemeMoodId
  moodLabel: string
  confidence: number
  source: StoredImageThemePaletteSource
  reason: string | null
  analyzedAt: string
}

interface StoredSaveProgress {
  moveCount: number
  elapsedTime: number
  runMetrics?: StoredRunMetrics
  [key: string]: unknown
}

interface StoredSaveFile {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  image: string
  croppedImage: string
  previewImage: string
  config: StoredPuzzleConfig
  progress: StoredSaveProgress
  imageFingerprint?: string
  titleSource?: StoredSaveTitleSource
  aiTitle?: StoredSaveAiTitle
  imageTheme?: StoredImageThemePalette
}

interface StoredSaveMetaFile {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  previewImage: string
  config: StoredPuzzleConfig
  imageFingerprint?: string
  titleSource?: StoredSaveTitleSource
  aiTitle?: StoredSaveAiTitle
  imageTheme?: StoredImageThemePalette
}

interface StoredSaveProgressFile {
  progress: StoredSaveProgress
}

interface SaveSummary {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  previewImage: string
  config: StoredPuzzleConfig
  moves: number
  elapsedTime: number
  imageFingerprint?: string
  titleSource?: StoredSaveTitleSource
  aiTitle?: StoredSaveAiTitle
  imageTheme?: StoredImageThemePalette
}

interface StoredCompletionRecord {
  id: string
  completedAt: string
  previewImage: string | null
  config: StoredPuzzleConfig
  moves: number
  actionMoves: number
  time: number
  undoCount: number
  redoCount: number
  hintCount: number
  suggestedMoveCount: number
  assistanceMode: StoredAssistanceMode
  hasDetailedProfile: boolean
}

interface StoredDifficultyStats {
  config: StoredPuzzleConfig
  solveCount: number
  cleanSolveCount: number
  assistedSolveCount: number
  autoAssistedSolveCount: number
  totalMoves: number
  totalActionMoves: number
  totalTime: number
  bestMoves: number | null
  bestCleanMoves: number | null
  bestTime: number | null
  bestCleanTime: number | null
  lastCompletedAt: string | null
}

interface StoredStatsFile {
  totalSolved: number
  cleanSolvedCount: number
  assistedSolvedCount: number
  autoAssistedSolvedCount: number
  totalMoves: number
  totalTime: number
  bestMoves: number | null
  bestCleanMoves: number | null
  bestTime: number | null
  bestCleanTime: number | null
  byDifficulty: StoredDifficultyStats[]
  completionHistory: StoredCompletionRecord[]
  lastUpdatedAt: string | null
}

interface StoredGalleryEntry {
  id: string
  completedAt: string
  previewImage: string | null
  sourceImage: string | null
  config: StoredPuzzleConfig
  moves: number
  time: number
  actionMoves: number
  assistanceMode: StoredAssistanceMode
  hasDetailedProfile: boolean
  tags?: StoredGalleryImageTag[]
  aiTagging?: StoredGalleryAiTagging
  cropTransform?: StoredCropTransform | null
  useFullImage?: boolean
  replaySetup?: StoredGalleryReplaySetup
  imageTheme?: StoredImageThemePalette
}

type StoredGalleryTagSource = 'gemini' | 'imported'

interface StoredCropTransform {
  zoom: number
  rotationDeg: number
  offsetX: number
  offsetY: number
}

interface StoredGalleryReplaySetup {
  version: 1
  startBoard: number[]
  emptyIndex: number
  shuffleMoves: string[]
  optimalStartMoveCount?: number | null
  optimalStartMoveCountKind?: 'exact' | 'lower-bound' | 'unavailable'
  optimalStartMoveCountSolverVersion?: string
}

interface StoredGalleryImageTag {
  label: string
  confidence: number
  source: StoredGalleryTagSource
}

type StoredGalleryAiTaggingStatus = 'tagged' | 'failed' | 'unavailable' | 'pending'

interface StoredGalleryCollectionSuggestion {
  collectionId: string
  collectionName: string
  reason: string
  confidence: number
  source: 'gemini'
}

interface StoredGalleryAiTagging {
  status: StoredGalleryAiTaggingStatus
  provider: 'gemini'
  model: string | null
  generatedAt: string | null
  error: string | null
  collectionSuggestions: StoredGalleryCollectionSuggestion[]
}

interface StoredGalleryFile {
  entries: StoredGalleryEntry[]
  lastUpdatedAt: string | null
}

interface StoredImageCollection {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  imageIds: string[]
}

interface StoredImageCollectionsFile {
  collections: StoredImageCollection[]
  lastUpdatedAt: string | null
}

interface DifficultyStatsResponse extends StoredDifficultyStats {
  averageMoves: number
  averageActionMoves: number | null
  averageTime: number
  medianMoves: number
  medianActionMoves: number | null
  medianTime: number
  averageExtraMoves: number | null
  medianExtraMoves: number | null
  recentMedianMoves: number
  recentMedianTime: number
  profiledSolveCount: number
  legacySolveCount: number
  lastMoves: number | null
  lastActionMoves: number | null
  lastExtraMoves: number | null
  lastTime: number | null
  lastAssistanceMode: StoredAssistanceMode | null
  lastHasDetailedProfile: boolean | null
}

interface StatsResponse {
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
  byDifficulty: DifficultyStatsResponse[]
  recentCompletions: StoredCompletionRecord[]
  completionHistory: StoredCompletionRecord[]
  lastCompletedAt: string | null
  lastUpdatedAt: string | null
}

interface GalleryResponse {
  entries: StoredGalleryEntry[]
  totalEntries: number
  lastCompletedAt: string | null
  lastUpdatedAt: string | null
}

interface ImageCollectionsResponse {
  collections: StoredImageCollection[]
  totalCollections: number
  lastUpdatedAt: string | null
}

interface BackupImageAssetRef {
  assetId: string
}

type BackupImageValue = string | BackupImageAssetRef | null

type BackupAssetMap = Record<string, string>

interface BackupCompletionRecord extends Omit<StoredCompletionRecord, 'previewImage'> {
  previewImage: BackupImageValue
}

interface BackupGalleryResponse extends Omit<GalleryResponse, 'entries'> {
  entries: BackupGalleryEntry[]
}

interface BackupGalleryEntry extends Omit<StoredGalleryEntry, 'previewImage' | 'sourceImage'> {
  previewImage: BackupImageValue
  sourceImage: BackupImageValue
}

interface BackupStatsResponse extends Omit<StatsResponse, 'recentCompletions' | 'completionHistory'> {
  recentCompletions: BackupCompletionRecord[]
  completionHistory: BackupCompletionRecord[]
}

interface BackupSaveResponse extends Omit<SaveSummary, 'previewImage'> {
  previewImage: BackupImageValue
  image: BackupImageValue
  croppedImage: BackupImageValue
  progress: StoredSaveProgress
}

interface BackupResponse {
  app: 'schiebepuzzle'
  version: 1 | 2 | 3
  exportedAt: string
  savedGames: BackupSaveResponse[]
  stats: BackupStatsResponse
  gallery: BackupGalleryResponse
  collections?: ImageCollectionsResponse | null
  assets?: BackupAssetMap
}

interface BackupImportResponse {
  importedAt: string
  savedGames: SaveSummary[]
  stats: StatsResponse
  gallery: GalleryResponse
  collections: ImageCollectionsResponse
}

interface BackupFileResponse {
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

interface ClipboardImageStatusResponse {
  hasImage: boolean
}

interface ClipboardImageResponse {
  imageDataUrl: string
}

interface ClipboardTextResponse {
  text: string
}

interface RecordCompletionResponse {
  stats: StatsResponse
  completion: StoredCompletionRecord
  difficultyStats: DifficultyStatsResponse
  previousCompletion: StoredCompletionRecord | null
  previousRecentMedianMoves: number | null
  previousRecentMedianTime: number | null
  isNewBestMoves: boolean
  isNewBestTime: boolean
  isNewBestCleanMoves: boolean
  isNewBestCleanTime: boolean
}

interface StatsExportFileResponse {
  fileName: string
  directory: string
  relativePath: string
  size: number
  savedAt: string
  mimeType: 'text/csv' | 'application/json'
}

interface GeneratedImageRequest {
  prompt: string
}

interface GeneratedImageResponse {
  imageSrc: string
  source: {
    label: string
    url: string
  }
}

interface CloudflareAiResponse {
  success?: boolean
  errors?: Array<{ message?: string }>
  messages?: Array<{ message?: string }>
  result?: {
    image?: string
    dataURI?: string
  }
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
  error?: {
    message?: string
  }
}

interface GeminiGalleryAnalysisPayload {
  tags?: unknown
  collectionSuggestions?: unknown
}

interface GeminiSaveTitlePayload {
  title?: unknown
}

interface AnalyzeGalleryEntryResponse {
  gallery: GalleryResponse
  entry: StoredGalleryEntry
}

type UpdateGalleryTagsAction = 'rename' | 'remove'

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function bufferToDataUrl(buffer: Buffer, contentType: string): string {
  return `data:${contentType};base64,${buffer.toString('base64')}`
}

function isValidSaveId(id: string): boolean {
  return SAVE_ID_PATTERN.test(id)
}

function isValidPuzzleConfig(config: unknown): config is StoredPuzzleConfig {
  if (!config || typeof config !== 'object') return false
  const input = config as { rows?: unknown; cols?: unknown }

  return (
    typeof input.rows === 'number' &&
    Number.isInteger(input.rows) &&
    input.rows > 0 &&
    typeof input.cols === 'number' &&
    Number.isInteger(input.cols) &&
    input.cols > 0
  )
}

function sanitizeCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.round(value))
}

function sanitizeOptionalCount(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.max(0, Math.round(value))
}

function getBestOptionalValue(values: Array<number | null | undefined>): number | null {
  const candidates = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (candidates.length === 0) return null
  return Math.min(...candidates)
}

function normalizeCleanBestValue(input: {
  explicitValue: unknown
  generalValue: number | null
  cleanCount: number
  assistedCount: number
  autoAssistedCount: number
  derivedValue?: number | null
}): number | null {
  if (input.cleanCount === 0) return null

  const explicitValue = sanitizeOptionalCount(input.explicitValue)
  if (explicitValue !== null) return explicitValue

  if (input.assistedCount === 0 && input.autoAssistedCount === 0) {
    return input.generalValue
  }

  return input.derivedValue ?? null
}
function comparePuzzleConfig(a: StoredPuzzleConfig, b: StoredPuzzleConfig): number {
  const areaDiff = a.rows * a.cols - b.rows * b.cols
  if (areaDiff !== 0) return areaDiff

  const rowDiff = a.rows - b.rows
  if (rowDiff !== 0) return rowDiff

  return a.cols - b.cols
}

function getIsoTimestampValue(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

async function ensureSavesDir(): Promise<void> {
  await mkdir(SAVES_DIR, { recursive: true })
}

async function ensureBackupsDir(): Promise<void> {
  await mkdir(BACKUPS_DIR, { recursive: true })
}

async function ensureStatsExportsDir(): Promise<void> {
  await mkdir(STATS_EXPORTS_DIR, { recursive: true })
}

function legacySaveFilePath(saveId: string): string {
  if (!isValidSaveId(saveId)) {
    throw new Error('Ungueltige Spielstand-ID')
  }

  return path.join(SAVES_DIR, `${saveId}.json`)
}

function saveDirPath(saveId: string): string {
  if (!isValidSaveId(saveId)) {
    throw new Error('Ungueltige Spielstand-ID')
  }

  return path.join(SAVES_DIR, saveId)
}

function saveMetaPath(saveId: string): string {
  return path.join(saveDirPath(saveId), 'meta.json')
}

function saveProgressPath(saveId: string): string {
  return path.join(saveDirPath(saveId), 'progress.json')
}

function saveImagePath(saveId: string): string {
  return path.join(saveDirPath(saveId), 'image.txt')
}

function saveCroppedImagePath(saveId: string): string {
  return path.join(saveDirPath(saveId), 'cropped-image.txt')
}

function isValidBackupFileName(fileName: string): boolean {
  return BACKUP_FILE_NAME_PATTERN.test(fileName)
}

function backupFilePath(fileName: string): string {
  if (!isValidBackupFileName(fileName)) {
    throw new Error('Ungueltiger Backup-Dateiname')
  }

  return path.join(BACKUPS_DIR, fileName)
}

function isValidStatsExportFileName(fileName: string): boolean {
  return STATS_EXPORT_FILE_NAME_PATTERN.test(fileName)
}

function statsExportFilePath(fileName: string): string {
  if (!isValidStatsExportFileName(fileName)) {
    throw new Error('Ungueltiger Statistik-Export-Dateiname')
  }

  return path.join(STATS_EXPORTS_DIR, fileName)
}

function isCompressedBackupFileName(fileName: string): boolean {
  return fileName.endsWith(COMPRESSED_BACKUP_FILE_EXTENSION)
}

function isLegacyBackupFileName(fileName: string): boolean {
  return fileName.endsWith(LEGACY_BACKUP_FILE_EXTENSION) && !isCompressedBackupFileName(fileName)
}

function isGzipBuffer(value: Uint8Array): boolean {
  return value.length >= 2 && value[0] === GZIP_MAGIC_BYTE_1 && value[1] === GZIP_MAGIC_BYTE_2
}

function parseBackupPayloadFromFileContent(content: Uint8Array, fileName: string): unknown {
  const useCompressedContent = isCompressedBackupFileName(fileName) || (!isLegacyBackupFileName(fileName) && isGzipBuffer(content))
  const rawJson = useCompressedContent
    ? gunzipSync(content).toString('utf-8')
    : Buffer.from(content).toString('utf-8')

  return JSON.parse(rawJson) as unknown
}

function serializeBackupPayload(backup: BackupResponse): Buffer {
  return gzipSync(JSON.stringify(backup))
}

function isReservedDataFilename(filename: string): boolean {
  return (
    filename === path.basename(STATS_FILE)
    || filename === path.basename(GALLERY_FILE)
    || filename === path.basename(COLLECTIONS_FILE)
  )
}
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = ''

    req.on('data', (chunk) => {
      raw += chunk.toString()
      if (raw.length > MAX_BODY_SIZE) {
        reject(new Error('Anfrage zu gross'))
      }
    })

    req.on('end', () => {
      if (!raw) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('Ungueltiges JSON'))
      }
    })

    req.on('error', reject)
  })
}

function isGeneratedImageRequest(value: unknown): value is GeneratedImageRequest {
  if (!value || typeof value !== 'object') return false
  const input = value as { prompt?: unknown }
  return typeof input.prompt === 'string'
}

function normalizeGeneratedImagePrompt(prompt: string): string {
  return prompt.trim().replace(/\s+/g, ' ')
}

function createGeneratedImageSeed(): number {
  return Math.floor(Math.random() * GENERATED_IMAGE_MAX_SEED)
}

function getErrorDetail(error: unknown): string {
  return error instanceof Error ? error.message : 'Unbekannter Fehler'
}

async function parsePollinationsError(response: Response): Promise<string> {
  try {
    const payload = await response.json() as {
      error?: string | { message?: string }
      message?: string
    }

    if (typeof payload.error === 'string') return payload.error
    if (payload.error?.message) return payload.error.message
    if (payload.message) return payload.message
  } catch {
    // Fall through to a generic status message.
  }

  return `Pollinations API antwortete mit Fehler ${response.status}`
}

async function parseCloudflareError(response: Response): Promise<string> {
  try {
    const payload = await response.json() as CloudflareAiResponse
    const errorMessage = payload.errors?.map((entry) => entry.message).filter(Boolean).join('; ')
    if (errorMessage) return errorMessage
    const message = payload.messages?.map((entry) => entry.message).filter(Boolean).join('; ')
    if (message) return message
  } catch {
    // Fall through to a generic status message.
  }

  return `Cloudflare Workers AI antwortete mit Fehler ${response.status}`
}

async function generatePollinationsImage(
  prompt: string,
  config: PollinationsGeneratedImageConfig
): Promise<GeneratedImageResponse> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), POLLINATIONS_GENERATED_IMAGE_TIMEOUT_MS)
  const url = new URL(`/image/${encodeURIComponent(prompt)}`, POLLINATIONS_BASE_URL)
  url.searchParams.set('model', config.model)
  url.searchParams.set('width', `${POLLINATIONS_GENERATED_IMAGE_WIDTH}`)
  url.searchParams.set('height', `${POLLINATIONS_GENERATED_IMAGE_HEIGHT}`)
  url.searchParams.set('seed', `${createGeneratedImageSeed()}`)

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Cache-Control': 'no-cache',
      },
      cache: 'no-store',
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(await parsePollinationsError(response))
    }

    const contentType = response.headers.get('content-type') ?? 'image/jpeg'
    if (!contentType.startsWith('image/')) {
      throw new Error('Pollinations hat kein Bild zurueckgegeben')
    }

    const arrayBuffer = await response.arrayBuffer()
    const imageBuffer = Buffer.from(arrayBuffer)
    if (imageBuffer.length === 0) {
      throw new Error('Pollinations hat ein leeres Bild zurueckgegeben')
    }

    return {
      imageSrc: bufferToDataUrl(imageBuffer, contentType.split(';')[0] || 'image/jpeg'),
      source: {
        label: 'Pollinations Z-Image Turbo',
        url: 'https://gen.pollinations.ai/image/models',
      },
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Pollinations hat zu lange fuer die Bildgenerierung gebraucht')
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}

async function generateCloudflareImage(
  prompt: string,
  config: CloudflareGeneratedImageConfig
): Promise<GeneratedImageResponse> {
  if (!config.accountId || !config.apiToken) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID oder CLOUDFLARE_API_TOKEN ist nicht konfiguriert')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), CLOUDFLARE_GENERATED_IMAGE_TIMEOUT_MS)
  const url = `${CLOUDFLARE_BASE_URL}/client/v4/accounts/${encodeURIComponent(config.accountId)}/ai/run/${config.model}`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        steps: CLOUDFLARE_GENERATED_IMAGE_STEPS,
        seed: createGeneratedImageSeed(),
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(await parseCloudflareError(response))
    }

    const payload = await response.json() as CloudflareAiResponse
    if (payload.success === false) {
      const message = payload.errors?.map((entry) => entry.message).filter(Boolean).join('; ')
      throw new Error(message || 'Cloudflare Workers AI konnte kein Bild erzeugen')
    }

    const image = payload.result?.image
    if (!image) {
      throw new Error('Cloudflare Workers AI hat kein Bild zurueckgegeben')
    }

    return {
      imageSrc: image.startsWith('data:')
        ? image
        : `data:image/jpeg;charset=utf-8;base64,${image}`,
      source: {
        label: 'Cloudflare Workers AI Flux Schnell',
        url: 'https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/',
      },
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Cloudflare Workers AI hat zu lange fuer die Bildgenerierung gebraucht')
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}

async function generateImageWithFallback(prompt: string, config: GeneratedImageConfig): Promise<GeneratedImageResponse> {
  try {
    return await generatePollinationsImage(prompt, config.pollinations)
  } catch (pollinationsError) {
    try {
      return await generateCloudflareImage(prompt, config.cloudflare)
    } catch (cloudflareError) {
      throw new Error(
        `Pollinations fehlgeschlagen: ${getErrorDetail(pollinationsError)}. Cloudflare Workers AI fehlgeschlagen: ${getErrorDetail(cloudflareError)}`
      )
    }
  }
}

async function parseGeminiError(response: Response): Promise<string> {
  try {
    const payload = await response.json() as GeminiGenerateContentResponse
    if (payload.error?.message) return payload.error.message
  } catch {
    // Fall through to a generic status message.
  }

  return `Gemini API antwortete mit Fehler ${response.status}`
}

function extractGeminiText(payload: GeminiGenerateContentResponse): string {
  return payload.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text)
    .filter((text): text is string => typeof text === 'string' && text.length > 0)
    .join('\n')
    .trim() ?? ''
}

function parseGeminiJson<T>(text: string): T {
  const trimmedText = text.trim()
  const unfencedText = trimmedText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  return JSON.parse(unfencedText) as T
}

function createGalleryAnalysisPrompt(
  entry: StoredGalleryEntry,
  collections: StoredImageCollection[]
): string {
  const collectionContext = collections.length > 0
    ? collections
      .map((collection) => {
        const description = collection.description ? ` - ${collection.description}` : ''
        return `- ${collection.id}: ${collection.name}${description}`
      })
      .join('\n')
    : '- Keine bestehenden Sammlungen vorhanden.'

  return [
    'Analysiere dieses geloeste Schiebepuzzle-Motiv fuer eine lokale deutsche Galerie.',
    'Erzeuge kurze deutsche Motiv-Tags ohne fuehrendes #, zum Beispiel Landschaft, Architektur, Dunkel, Portrait, Natur, Stadt, Kunst, Tiere, Wasser oder Nacht.',
    'Nutze nur sichtbare Bildinhalte und offensichtliche Stimmung/Farbwirkung. Keine personenbezogenen sensiblen Vermutungen.',
    'Schlage nur bestehende Sammlungen vor, wenn das Bild gut dazu passt. Nutze dabei exakt die vorhandenen collectionId-Werte.',
    '',
    `Puzzle-Groesse: ${entry.config.rows}x${entry.config.cols}`,
    'Bestehende Sammlungen:',
    collectionContext,
    '',
    `Antwortformat: JSON mit maximal ${GALLERY_AI_TAG_LIMIT} tags und maximal ${GALLERY_AI_COLLECTION_SUGGESTION_LIMIT} collectionSuggestions.`,
  ].join('\n')
}

function createGeminiGallerySchema(): object {
  return {
    type: 'object',
    properties: {
      tags: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            confidence: { type: 'number' },
          },
          required: ['label', 'confidence'],
        },
      },
      collectionSuggestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            collectionId: { type: 'string' },
            collectionName: { type: 'string' },
            reason: { type: 'string' },
            confidence: { type: 'number' },
          },
          required: ['collectionId', 'collectionName', 'reason', 'confidence'],
        },
      },
    },
    required: ['tags', 'collectionSuggestions'],
  }
}

async function analyzeGalleryImageWithGemini(
  entry: StoredGalleryEntry,
  collections: StoredImageCollection[],
  config: GeminiGalleryConfig
): Promise<Pick<StoredGalleryEntry, 'tags' | 'aiTagging'>> {
  if (!config.apiKey) {
    return {
      tags: entry.tags,
      aiTagging: {
        status: 'unavailable',
        provider: 'gemini',
        model: config.model,
        generatedAt: new Date().toISOString(),
        error: 'GEMINI_API_KEY ist nicht konfiguriert',
        collectionSuggestions: [],
      },
    }
  }

  const image = parseDataUrlImage(entry.previewImage ?? entry.sourceImage ?? '')
  if (!image) {
    return {
      tags: entry.tags,
      aiTagging: {
        status: 'failed',
        provider: 'gemini',
        model: config.model,
        generatedAt: new Date().toISOString(),
        error: 'Kein unterstuetztes Galerie-Bild fuer KI-Tagging gefunden',
        collectionSuggestions: [],
      },
    }
  }

  if (image.byteLength > GEMINI_GALLERY_MAX_INLINE_IMAGE_BYTES) {
    return {
      tags: entry.tags,
      aiTagging: {
        status: 'failed',
        provider: 'gemini',
        model: config.model,
        generatedAt: new Date().toISOString(),
        error: 'Galerie-Bild ist zu gross fuer Gemini Inline-Analyse',
        collectionSuggestions: [],
      },
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GEMINI_GALLERY_TIMEOUT_MS)
  const url = `${GEMINI_BASE_URL}/v1beta/models/${encodeURIComponent(config.model)}:generateContent`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey,
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: image.mimeType,
                data: image.base64Data,
              },
            },
            { text: createGalleryAnalysisPrompt(entry, collections) },
          ],
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: createGeminiGallerySchema(),
        },
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(await parseGeminiError(response))
    }

    const payload = await response.json() as GeminiGenerateContentResponse
    const text = extractGeminiText(payload)
    if (!text) {
      throw new Error('Gemini hat keine Analyse zurueckgegeben')
    }

    const analysis = parseGeminiJson<GeminiGalleryAnalysisPayload>(text)
    const tags = normalizeGalleryTags(analysis.tags)
    const collectionSuggestions = normalizeGalleryCollectionSuggestions(analysis.collectionSuggestions, collections)

    return {
      tags,
      aiTagging: {
        status: 'tagged',
        provider: 'gemini',
        model: config.model,
        generatedAt: new Date().toISOString(),
        error: null,
        collectionSuggestions,
      },
    }
  } catch (error) {
    const message = error instanceof DOMException && error.name === 'AbortError'
      ? 'Gemini hat zu lange fuer das Galerie-Tagging gebraucht'
      : getErrorDetail(error)

    return {
      tags: entry.tags,
      aiTagging: {
        status: 'failed',
        provider: 'gemini',
        model: config.model,
        generatedAt: new Date().toISOString(),
        error: message,
        collectionSuggestions: [],
      },
    }
  } finally {
    clearTimeout(timeout)
  }
}

function createSaveTitlePrompt(config: StoredPuzzleConfig): string {
  return [
    'Gib diesem Schiebepuzzle-Motiv einen kurzen, kreativen deutschen Titel.',
    'Der Titel soll 2 bis 6 Woerter haben, gut in eine Spielstandliste passen und auf sichtbaren Bildinhalten oder offensichtlicher Stimmung basieren.',
    'Keine Dateinamen, keine technischen Begriffe, keine Anfuehrungszeichen, keine sensiblen personenbezogenen Vermutungen.',
    '',
    `Puzzle-Groesse: ${config.rows}x${config.cols}`,
    'Antwortformat: JSON mit dem Feld title.',
  ].join('\n')
}

function createGeminiSaveTitleSchema(): object {
  return {
    type: 'object',
    properties: {
      title: { type: 'string' },
    },
    required: ['title'],
  }
}

async function generateSaveTitleWithGemini(
  save: StoredSaveFile,
  config: GeminiGalleryConfig
): Promise<{
  title: string | null
  aiTitle: StoredSaveAiTitle
}> {
  const generatedAt = new Date().toISOString()

  if (!config.apiKey) {
    return {
      title: null,
      aiTitle: {
        status: 'unavailable',
        provider: 'gemini',
        model: config.model,
        generatedAt,
        error: 'GEMINI_API_KEY ist nicht konfiguriert',
      },
    }
  }

  const image = parseDataUrlImage(save.previewImage || save.croppedImage || save.image)
  if (!image) {
    return {
      title: null,
      aiTitle: {
        status: 'failed',
        provider: 'gemini',
        model: config.model,
        generatedAt,
        error: 'Kein unterstuetztes Spielstand-Bild fuer KI-Titel gefunden',
      },
    }
  }

  if (image.byteLength > GEMINI_SAVE_TITLE_MAX_INLINE_IMAGE_BYTES) {
    return {
      title: null,
      aiTitle: {
        status: 'failed',
        provider: 'gemini',
        model: config.model,
        generatedAt,
        error: 'Spielstand-Bild ist zu gross fuer Gemini Inline-Analyse',
      },
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GEMINI_SAVE_TITLE_TIMEOUT_MS)
  const url = `${GEMINI_BASE_URL}/v1beta/models/${encodeURIComponent(config.model)}:generateContent`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey,
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: image.mimeType,
                data: image.base64Data,
              },
            },
            { text: createSaveTitlePrompt(save.config) },
          ],
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: createGeminiSaveTitleSchema(),
        },
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(await parseGeminiError(response))
    }

    const payload = await response.json() as GeminiGenerateContentResponse
    const text = extractGeminiText(payload)
    if (!text) {
      throw new Error('Gemini hat keinen Spielstand-Titel zurueckgegeben')
    }

    const analysis = parseGeminiJson<GeminiSaveTitlePayload>(text)
    const title = sanitizeGeneratedSaveTitle(analysis.title)
    if (!title) {
      throw new Error('Gemini hat keinen nutzbaren Spielstand-Titel erzeugt')
    }

    return {
      title,
      aiTitle: {
        status: 'generated',
        provider: 'gemini',
        model: config.model,
        generatedAt,
        error: null,
      },
    }
  } catch (error) {
    const message = error instanceof DOMException && error.name === 'AbortError'
      ? 'Gemini hat zu lange fuer den Spielstand-Titel gebraucht'
      : getErrorDetail(error)

    return {
      title: null,
      aiTitle: {
        status: 'failed',
        provider: 'gemini',
        model: config.model,
        generatedAt,
        error: message,
      },
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

async function readTextFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8')
  } catch {
    return null
  }
}

function sanitizeRunMetrics(input: unknown, fallbackMoveCount: number = 0): StoredRunMetrics {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  return {
    actionMoves: Math.max(fallbackMoveCount, sanitizeCount(source.actionMoves)),
    undoCount: sanitizeCount(source.undoCount),
    redoCount: sanitizeCount(source.redoCount),
    hintCount: sanitizeCount(source.hintCount),
    suggestedMoveCount: sanitizeCount(source.suggestedMoveCount),
  }
}

function sanitizeProgress(progress: unknown): StoredSaveProgress {
  const input = progress && typeof progress === 'object' ? (progress as Record<string, unknown>) : {}
  const moveCount = sanitizeCount(input.moveCount)
  return {
    ...input,
    moveCount,
    elapsedTime: sanitizeCount(input.elapsedTime),
    runMetrics: sanitizeRunMetrics(input.runMetrics, moveCount),
  }
}

function sanitizeSaveTitleSource(value: unknown): StoredSaveTitleSource | undefined {
  return value === 'gemini' || value === 'reused' || value === 'fallback'
    ? value
    : undefined
}

function sanitizeSaveAiTitle(value: unknown): StoredSaveAiTitle | undefined {
  if (!value || typeof value !== 'object') return undefined

  const input = value as {
    status?: unknown
    model?: unknown
    generatedAt?: unknown
    error?: unknown
    reusedFromSaveId?: unknown
  }
  const status: StoredSaveAiTitleStatus =
    input.status === 'generated'
    || input.status === 'reused'
    || input.status === 'failed'
    || input.status === 'unavailable'
    || input.status === 'pending'
      ? input.status
      : 'generated'

  return {
    status,
    provider: 'gemini',
    model: typeof input.model === 'string' && input.model.length > 0 ? input.model : null,
    generatedAt: typeof input.generatedAt === 'string' && input.generatedAt.length > 0 ? input.generatedAt : null,
    error: typeof input.error === 'string' && input.error.length > 0 ? input.error.slice(0, 240) : null,
    reusedFromSaveId: typeof input.reusedFromSaveId === 'string' && input.reusedFromSaveId.length > 0
      ? input.reusedFromSaveId
      : null,
  }
}

function sanitizeImageFingerprint(value: unknown): string | undefined {
  return typeof value === 'string' && /^sha256:[a-f0-9]{64}$/i.test(value)
    ? value.toLocaleLowerCase()
    : undefined
}

function toSummary(save: Pick<StoredSaveFile, 'id' | 'name' | 'createdAt' | 'updatedAt' | 'previewImage' | 'config' | 'progress'>): SaveSummary {
  const titleSource = sanitizeSaveTitleSource((save as Partial<StoredSaveFile>).titleSource)
  const aiTitle = sanitizeSaveAiTitle((save as Partial<StoredSaveFile>).aiTitle)
  const imageFingerprint = sanitizeImageFingerprint((save as Partial<StoredSaveFile>).imageFingerprint)
  const imageTheme = sanitizeImageThemePalette((save as Partial<StoredSaveFile>).imageTheme)

  return {
    id: save.id,
    name: save.name,
    createdAt: save.createdAt,
    updatedAt: save.updatedAt,
    previewImage: save.previewImage,
    config: save.config,
    moves: sanitizeCount(save.progress?.moveCount),
    elapsedTime: sanitizeCount(save.progress?.elapsedTime),
    ...(imageFingerprint ? { imageFingerprint } : {}),
    ...(titleSource ? { titleSource } : {}),
    ...(aiTitle ? { aiTitle } : {}),
    ...(imageTheme ? { imageTheme } : {}),
  }
}

async function readStructuredSaveMeta(saveId: string): Promise<StoredSaveMetaFile | null> {
  const meta = await readJsonFile<StoredSaveMetaFile>(saveMetaPath(saveId))
  if (!meta || typeof meta.id !== 'string' || !isValidPuzzleConfig(meta.config)) {
    return null
  }

  const imageFingerprint = sanitizeImageFingerprint(meta.imageFingerprint)
  const titleSource = sanitizeSaveTitleSource(meta.titleSource)
  const aiTitle = sanitizeSaveAiTitle(meta.aiTitle)
  const imageTheme = sanitizeImageThemePalette(meta.imageTheme)

  return {
    id: meta.id,
    name: sanitizeTextValue(meta.name, generateSaveName()),
    createdAt: sanitizeTextValue(meta.createdAt, new Date().toISOString()),
    updatedAt: sanitizeTextValue(meta.updatedAt, meta.createdAt),
    previewImage: sanitizeTextValue(meta.previewImage, ''),
    config: meta.config,
    ...(imageFingerprint ? { imageFingerprint } : {}),
    ...(titleSource ? { titleSource } : {}),
    ...(aiTitle ? { aiTitle } : {}),
    ...(imageTheme ? { imageTheme } : {}),
  }
}

async function readStructuredSaveProgress(saveId: string): Promise<StoredSaveProgress> {
  const progressFile = await readJsonFile<StoredSaveProgressFile>(saveProgressPath(saveId))
  return sanitizeProgress(progressFile?.progress)
}

async function readLegacySaveById(saveId: string): Promise<StoredSaveFile | null> {
  try {
    const raw = await readFile(legacySaveFilePath(saveId), 'utf-8')
    return JSON.parse(raw) as StoredSaveFile
  } catch {
    return null
  }
}

async function readSaveById(saveId: string): Promise<StoredSaveFile | null> {
  const meta = await readStructuredSaveMeta(saveId)
  if (meta) {
    const [progress, image, croppedImage] = await Promise.all([
      readStructuredSaveProgress(saveId),
      readTextFile(saveImagePath(saveId)),
      readTextFile(saveCroppedImagePath(saveId)),
    ])

    if (!image || !croppedImage) {
      return null
    }

    return {
      ...meta,
      image,
      croppedImage,
      progress,
    }
  }

  return readLegacySaveById(saveId)
}

async function writeStructuredSave(save: StoredSaveFile): Promise<void> {
  await ensureSavesDir()
  await mkdir(saveDirPath(save.id), { recursive: true })

  const meta: StoredSaveMetaFile = {
    id: save.id,
    name: save.name,
    createdAt: save.createdAt,
    updatedAt: save.updatedAt,
    previewImage: save.previewImage,
    config: save.config,
    ...(save.imageFingerprint ? { imageFingerprint: save.imageFingerprint } : {}),
    ...(save.titleSource ? { titleSource: save.titleSource } : {}),
    ...(save.aiTitle ? { aiTitle: save.aiTitle } : {}),
    ...(save.imageTheme ? { imageTheme: save.imageTheme } : {}),
  }
  const progressFile: StoredSaveProgressFile = {
    progress: sanitizeProgress(save.progress),
  }

  // Write sequentially: images first (most valuable), then meta+progress, finally legacy cleanup.
  // This avoids a partial-failure state where some files are written but others are not.
  await writeFile(saveImagePath(save.id), save.image, 'utf-8')
  await writeFile(saveCroppedImagePath(save.id), save.croppedImage, 'utf-8')
  await writeFile(saveMetaPath(save.id), JSON.stringify(meta, null, 2), 'utf-8')
  await writeFile(saveProgressPath(save.id), JSON.stringify(progressFile, null, 2), 'utf-8')
  await rm(legacySaveFilePath(save.id), { force: true })
}

async function updateSaveProgress(saveId: string, progress: StoredSaveProgress): Promise<SaveSummary | null> {
  const meta = await readStructuredSaveMeta(saveId)
  if (meta) {
    const nextUpdatedAt = new Date().toISOString()
    const nextMeta: StoredSaveMetaFile = {
      ...meta,
      updatedAt: nextUpdatedAt,
    }
    const nextProgress = sanitizeProgress(progress)

    await Promise.all([
      writeFile(saveMetaPath(saveId), JSON.stringify(nextMeta, null, 2), 'utf-8'),
      writeFile(saveProgressPath(saveId), JSON.stringify({ progress: nextProgress }, null, 2), 'utf-8'),
    ])

    return toSummary({
      ...nextMeta,
      progress: nextProgress,
    })
  }

  const legacy = await readLegacySaveById(saveId)
  if (!legacy) {
    return null
  }

  const migrated: StoredSaveFile = {
    ...legacy,
    progress: sanitizeProgress(progress),
    updatedAt: new Date().toISOString(),
  }
  await writeStructuredSave(migrated)
  return toSummary(migrated)
}

async function deleteAllSaves(): Promise<void> {
  await ensureSavesDir()
  const entries = await readdir(SAVES_DIR, { withFileTypes: true })
  const deleteTasks: Array<Promise<void>> = []

  for (const entry of entries) {
    if (entry.isDirectory() && isValidSaveId(entry.name)) {
      deleteTasks.push(rm(saveDirPath(entry.name), { recursive: true, force: true }))
      continue
    }

    if (!entry.isFile() || !entry.name.endsWith('.json') || isReservedDataFilename(entry.name)) {
      continue
    }

    const saveId = entry.name.slice(0, -5)
    if (!isValidSaveId(saveId)) continue
    deleteTasks.push(rm(legacySaveFilePath(saveId), { force: true }))
  }

  await Promise.all(deleteTasks)
}

async function deleteSaveById(saveId: string): Promise<void> {
  await Promise.all([
    rm(saveDirPath(saveId), { recursive: true, force: true }),
    rm(legacySaveFilePath(saveId), { force: true }),
  ])
}

async function pruneSavesToRetentionLimit(limit: number): Promise<string[]> {
  if (limit < 1) {
    return []
  }

  const summaries = await listAllSaveSummaries()
  const savesToDelete = summaries.slice(limit)
  if (savesToDelete.length === 0) {
    return []
  }

  await Promise.all(savesToDelete.map((save) => deleteSaveById(save.id)))
  return savesToDelete.map((save) => save.id)
}

async function listAllSaveSummaries(): Promise<SaveSummary[]> {
  await ensureSavesDir()
  const entries = await readdir(SAVES_DIR, { withFileTypes: true })
  const summaries: SaveSummary[] = []

  for (const entry of entries) {
    if (entry.isDirectory() && isValidSaveId(entry.name)) {
      const meta = await readStructuredSaveMeta(entry.name)
      if (!meta) continue
      const progress = await readStructuredSaveProgress(entry.name)
      summaries.push(
        toSummary({
          ...meta,
          progress,
        })
      )
      continue
    }

    if (!entry.isFile() || !entry.name.endsWith('.json') || isReservedDataFilename(entry.name)) {
      continue
    }

    const saveId = entry.name.slice(0, -5)
    if (!isValidSaveId(saveId)) continue

    const legacy = await readLegacySaveById(saveId)
    if (legacy) {
      summaries.push(toSummary(legacy))
    }
  }

  summaries.sort((a, b) => getIsoTimestampValue(b.updatedAt) - getIsoTimestampValue(a.updatedAt))
  return summaries
}

async function listAllSaveData(): Promise<StoredSaveFile[]> {
  const summaries = await listAllSaveSummaries()
  const loadedSaves = await Promise.all(summaries.map((summary) => readSaveById(summary.id)))

  return loadedSaves
    .filter((save): save is StoredSaveFile => save !== null)
    .sort((a, b) => getIsoTimestampValue(b.updatedAt) - getIsoTimestampValue(a.updatedAt))
}

function limitSavesToRetention<T extends { updatedAt: string }>(saves: T[], limit: number): T[] {
  if (limit < 1) {
    return []
  }

  return [...saves]
    .sort((a, b) => getIsoTimestampValue(b.updatedAt) - getIsoTimestampValue(a.updatedAt))
    .slice(0, limit)
}

function hasReusableSaveTitle(save: Pick<StoredSaveFile, 'name'> & Partial<StoredSaveFile>): boolean {
  const titleSource = sanitizeSaveTitleSource(save.titleSource)
  const aiTitle = sanitizeSaveAiTitle(save.aiTitle)
  return (
    !!sanitizeGeneratedSaveTitle(save.name)
    && titleSource !== 'fallback'
    && (titleSource === 'gemini' || titleSource === 'reused' || aiTitle?.status === 'generated' || aiTitle?.status === 'reused')
  )
}

async function findReusableSaveTitleByFingerprint(
  imageFingerprint: string,
  excludeSaveId?: string
): Promise<SaveSummary | null> {
  const saves = await listAllSaveSummaries()
  return saves.find((save) => (
    save.id !== excludeSaveId
    && save.imageFingerprint === imageFingerprint
    && hasReusableSaveTitle(save)
  )) ?? null
}

async function updateSaveTitleMetadata(
  saveId: string,
  updates: {
    name?: string
    imageFingerprint?: string
    titleSource?: StoredSaveTitleSource
    aiTitle?: StoredSaveAiTitle
  }
): Promise<SaveSummary | null> {
  const save = await readSaveById(saveId)
  if (!save) return null

  const nextSave: StoredSaveFile = {
    ...save,
    ...(updates.name ? { name: updates.name } : {}),
    ...(updates.imageFingerprint ? { imageFingerprint: updates.imageFingerprint } : {}),
    ...(updates.titleSource ? { titleSource: updates.titleSource } : {}),
    ...(updates.aiTitle ? { aiTitle: updates.aiTitle } : {}),
  }

  await writeStructuredSave(nextSave)
  return toSummary(nextSave)
}

function toBackupSaveResponse(
  save: StoredSaveFile,
  assetRegistry: ReturnType<typeof createBackupAssetRegistry>
): BackupSaveResponse {
  return {
    ...toSummary(save),
    previewImage: assetRegistry.store(save.previewImage),
    image: assetRegistry.store(save.image),
    croppedImage: assetRegistry.store(save.croppedImage),
    progress: sanitizeProgress(save.progress),
  }
}

function sanitizeTextValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function normalizeImportedSave(
  entry: unknown,
  index: number,
  usedIds: Set<string>,
  assets: BackupAssetMap = {}
): StoredSaveFile | null {
  if (!entry || typeof entry !== 'object') return null

  const input = entry as Record<string, unknown>
  if (
    !isValidPuzzleConfig(input.config)
    || typeof input.progress !== 'object'
    || input.progress === null
  ) {
    return null
  }

  const image = resolveBackupImageValue(input.image, assets)
  const croppedImage = resolveBackupImageValue(input.croppedImage, assets)
  if (!image || !croppedImage) {
    return null
  }

  const requestedId = typeof input.id === 'string' && isValidSaveId(input.id) ? input.id : null
  const saveId = requestedId && !usedIds.has(requestedId) ? requestedId : randomUUID()
  usedIds.add(saveId)

  const createdAt = sanitizeTextValue(input.createdAt, new Date().toISOString())
  const updatedAt = sanitizeTextValue(input.updatedAt, createdAt)
  const previewImage = resolveBackupImageValue(input.previewImage, assets) ?? croppedImage
  const imageFingerprint = sanitizeImageFingerprint(input.imageFingerprint) ?? createImageFingerprint(previewImage)
  const titleSource = sanitizeSaveTitleSource(input.titleSource)
  const aiTitle = sanitizeSaveAiTitle(input.aiTitle)
  const imageTheme = sanitizeImageThemePalette(input.imageTheme)

  return {
    id: saveId,
    name: sanitizeTextValue(input.name, `Importierter Spielstand ${index + 1}`),
    createdAt,
    updatedAt,
    image,
    croppedImage,
    previewImage,
    config: input.config,
    progress: sanitizeProgress(input.progress),
    ...(imageFingerprint ? { imageFingerprint } : {}),
    ...(titleSource ? { titleSource } : {}),
    ...(aiTitle ? { aiTitle } : {}),
    ...(imageTheme ? { imageTheme } : {}),
  }
}

function validateBackupPayload(payload: unknown): payload is {
  app?: unknown
  version?: unknown
  savedGames?: unknown
  stats?: unknown
  gallery?: unknown
  collections?: unknown
  assets?: unknown
} {
  if (!payload || typeof payload !== 'object') return false

  const input = payload as Record<string, unknown>
  return (
    (input.app === undefined || input.app === 'schiebepuzzle')
    && (input.version === undefined || input.version === 1 || input.version === 2 || input.version === 3)
    && (input.savedGames === undefined || Array.isArray(input.savedGames))
  )
}

async function buildBackupResponse(): Promise<BackupResponse> {
  const [saves, stats, gallery] = await Promise.all([
    listAllSaveData(),
    readStatsFile(),
    readGalleryFile(),
  ])
  const retainedSaves = limitSavesToRetention(saves, MAX_SAVED_GAMES)
  const collections = await readCollectionsFile(gallery)
  const assetRegistry = createBackupAssetRegistry()
  const rawSavedGames = retainedSaves.map((save) => toBackupSaveResponse(save, assetRegistry))
  const rawStatsResponse = toBackupStatsResponse(stats, assetRegistry)
  const rawGalleryResponse = toBackupGalleryResponse(gallery, assetRegistry)
  assetRegistry.finalize()

  const savedGames = rawSavedGames.map((save) => materializeBackupSaveResponse(save, assetRegistry))
  const statsResponse = materializeBackupStatsResponse(rawStatsResponse, assetRegistry)
  const galleryResponse = materializeBackupGalleryResponse(rawGalleryResponse, assetRegistry)
  const assets = normalizeBackupAssetMap(assetRegistry.assets)

  return {
    app: 'schiebepuzzle',
    version: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    savedGames,
    stats: statsResponse,
    gallery: galleryResponse,
    collections: toCollectionsResponse(collections),
    ...(Object.keys(assets).length > 0 ? { assets } : {}),
  }
}

async function importBackupPayload(payload: {
  savedGames?: unknown
  stats?: unknown
  gallery?: unknown
  collections?: unknown
  assets?: unknown
}): Promise<BackupImportResponse> {
  const importedAt = new Date().toISOString()
  const assets = normalizeBackupAssetMap(payload.assets)
  const rawSaves = Array.isArray(payload.savedGames) ? payload.savedGames : []
  const usedIds = new Set<string>()
  const importedSaves = rawSaves
    .map((entry, index) => normalizeImportedSave(entry, index, usedIds, assets))
    .filter((entry): entry is StoredSaveFile => entry !== null)
  const retainedImportedSaves = limitSavesToRetention(importedSaves, MAX_SAVED_GAMES)

  const importedStats = normalizeStatsFile(payload.stats, assets)
  const importedGallery = payload.gallery === null || payload.gallery === undefined
    ? createGalleryFileFromCompletionHistory(importedStats.completionHistory, importedStats.lastUpdatedAt)
    : normalizeGalleryFile(payload.gallery, assets)
  const importedCollections = normalizeCollectionsFile(payload.collections, importedGallery)

  await deleteAllSaves()
  await Promise.all(retainedImportedSaves.map((save) => writeStructuredSave(save)))
  await Promise.all([
    writeStatsFile(importedStats),
    writeGalleryFile(importedGallery),
    writeCollectionsFile(importedCollections),
  ])

  return {
    importedAt,
    savedGames: (await listAllSaveSummaries()).slice(0, MAX_SAVED_GAMES),
    stats: toStatsResponse(importedStats),
    gallery: toGalleryResponse(importedGallery),
    collections: toCollectionsResponse(importedCollections),
  }
}

function createBackupFileName(exportedAt: string): string {
  const stamp = exportedAt.replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
  return `schiebepuzzle-backup-${stamp}${BACKUP_FILE_EXTENSION}`
}

function getBackupFileGalleryEntriesCount(gallery: unknown): number {
  if (!gallery || typeof gallery !== 'object') {
    return 0
  }

  const input = gallery as { totalEntries?: unknown; entries?: unknown }
  if (typeof input.totalEntries === 'number' && Number.isFinite(input.totalEntries)) {
    return Math.max(0, Math.round(input.totalEntries))
  }

  return Array.isArray(input.entries) ? input.entries.length : 0
}

function buildBackupFileResponse(
  fileName: string,
  backup: {
    exportedAt?: unknown
    savedGames?: unknown
    stats?: unknown
    gallery?: unknown
  },
  size: number,
  modifiedAt: string,
  alreadyCurrent: boolean = false,
  deletedBackupFileNames: string[] = [],
  retentionLimit: number = MAX_BACKUP_FILES
): BackupFileResponse {
  const stats = backup.stats && typeof backup.stats === 'object'
    ? (backup.stats as { totalSolved?: unknown })
    : null

  return {
    fileName,
    exportedAt: typeof backup.exportedAt === 'string' ? backup.exportedAt : null,
    savedGamesCount: Array.isArray(backup.savedGames) ? backup.savedGames.length : 0,
    totalSolved: sanitizeCount(stats?.totalSolved),
    galleryEntriesCount: getBackupFileGalleryEntriesCount(backup.gallery),
    size: Math.max(0, Math.round(size)),
    modifiedAt,
    alreadyCurrent,
    deletedBackupFileNames,
    retentionLimit,
  }
}

function createBackupComparisonHash(backup: {
  app?: unknown
  version?: unknown
  savedGames?: unknown
  stats?: unknown
  gallery?: unknown
  collections?: unknown
  assets?: unknown
}): string {
  const comparableBackup = {
    app: backup.app === 'schiebepuzzle' ? backup.app : 'schiebepuzzle',
    version: backup.version === 3 ? 3 : backup.version === 2 ? 2 : 1,
    assets: normalizeBackupAssetMap(backup.assets),
    savedGames: Array.isArray(backup.savedGames) ? backup.savedGames : [],
    stats: backup.stats ?? null,
    gallery: backup.gallery ?? null,
    collections: backup.collections ?? null,
  }

  return createHash('sha256').update(JSON.stringify(comparableBackup)).digest('hex')
}

async function findMatchingBackupFile(backup: BackupResponse): Promise<BackupFileResponse | null> {
  await ensureBackupsDir()
  const entries = await readdir(BACKUPS_DIR, { withFileTypes: true })
  const targetHash = createBackupComparisonHash(backup)
  let newestMatch: BackupFileResponse | null = null

  for (const entry of entries) {
    if (!entry.isFile() || !isValidBackupFileName(entry.name)) {
      continue
    }

    try {
      const filePath = backupFilePath(entry.name)
      const [raw, fileStats] = await Promise.all([
        readFile(filePath),
        stat(filePath),
      ])
      const payload = parseBackupPayloadFromFileContent(raw, entry.name)
      if (!validateBackupPayload(payload)) {
        continue
      }

      if (createBackupComparisonHash(payload as {
        app?: unknown
        version?: unknown
        savedGames?: unknown
        stats?: unknown
        gallery?: unknown
        collections?: unknown
        assets?: unknown
      }) !== targetHash) {
        continue
      }

      const match = buildBackupFileResponse(
        entry.name,
        payload as {
          exportedAt?: unknown
          savedGames?: unknown
          stats?: unknown
          gallery?: unknown
        },
        fileStats.size,
        fileStats.mtime.toISOString(),
        true
      )

      if (!newestMatch || getIsoTimestampValue(match.modifiedAt) > getIsoTimestampValue(newestMatch.modifiedAt)) {
        newestMatch = match
      }
    } catch {
      continue
    }
  }

  return newestMatch
}

async function listBackupFiles(): Promise<BackupFileResponse[]> {
  await ensureBackupsDir()
  const entries = await readdir(BACKUPS_DIR, { withFileTypes: true })

  const backups = await Promise.all(entries.map(async (entry) => {
    if (!entry.isFile() || !isValidBackupFileName(entry.name)) {
      return null
    }

    try {
      const filePath = backupFilePath(entry.name)
      const [raw, fileStats] = await Promise.all([
        readFile(filePath),
        stat(filePath),
      ])
      const payload = parseBackupPayloadFromFileContent(raw, entry.name)
      if (!validateBackupPayload(payload)) {
        return null
      }

      return buildBackupFileResponse(
        entry.name,
        payload as {
          exportedAt?: unknown
          savedGames?: unknown
          stats?: unknown
          gallery?: unknown
        },
        fileStats.size,
        fileStats.mtime.toISOString()
      )
    } catch {
      return null
    }
  }))

  return backups
    .filter((entry): entry is BackupFileResponse => entry !== null)
    .sort((a, b) => {
      const modifiedDiff = getIsoTimestampValue(b.modifiedAt) - getIsoTimestampValue(a.modifiedAt)
      if (modifiedDiff !== 0) {
        return modifiedDiff
      }

      const exportedDiff = getIsoTimestampValue(b.exportedAt) - getIsoTimestampValue(a.exportedAt)
      if (exportedDiff !== 0) {
        return exportedDiff
      }

      return b.fileName.localeCompare(a.fileName)
    })
}

async function pruneBackupFilesToRetentionLimit(limit: number): Promise<string[]> {
  if (limit < 1) {
    return []
  }

  const backups = await listBackupFiles()
  const backupsToDelete = backups.slice(limit)
  if (backupsToDelete.length === 0) {
    return []
  }

  await Promise.all(backupsToDelete.map((backup) => rm(backupFilePath(backup.fileName), { force: true })))
  return backupsToDelete.map((backup) => backup.fileName)
}

async function createBackupFile(): Promise<BackupFileResponse> {
  const backup = await buildBackupResponse()
  const existingMatch = await findMatchingBackupFile(backup)
  if (existingMatch) {
    return existingMatch
  }

  const fileName = createBackupFileName(backup.exportedAt)
  const filePath = backupFilePath(fileName)

  await ensureBackupsDir()
  await writeFile(filePath, serializeBackupPayload(backup))

  const deletedBackupFileNames = await pruneBackupFilesToRetentionLimit(MAX_BACKUP_FILES)
  const fileStats = await stat(filePath)
  return buildBackupFileResponse(
    fileName,
    backup,
    fileStats.size,
    fileStats.mtime.toISOString(),
    false,
    deletedBackupFileNames,
    MAX_BACKUP_FILES
  )
}

async function deleteBackupFile(fileName: string): Promise<void> {
  await rm(backupFilePath(fileName))
}

async function importBackupFile(fileName: string): Promise<BackupImportResponse> {
  const raw = await readFile(backupFilePath(fileName))
  const payload = parseBackupPayloadFromFileContent(raw, fileName)

  if (!validateBackupPayload(payload)) {
    throw new Error('Ungueltige Backup-Datei')
  }

  return importBackupPayload(payload)
}

function isMissingFileError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false
  }

  return (error as { code?: unknown }).code === 'ENOENT'
}

function generateSaveName(): string {
  const now = new Date()
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `Spielstand ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function createEmptyStatsFile(): StoredStatsFile {
  return {
    totalSolved: 0,
    cleanSolvedCount: 0,
    assistedSolvedCount: 0,
    autoAssistedSolvedCount: 0,
    totalMoves: 0,
    totalTime: 0,
    bestMoves: null,
    bestCleanMoves: null,
    bestTime: null,
    bestCleanTime: null,
    byDifficulty: [],
    completionHistory: [],
    lastUpdatedAt: null,
  }
}

function createEmptyGalleryFile(): StoredGalleryFile {
  return {
    entries: [],
    lastUpdatedAt: null,
  }
}

function createEmptyCollectionsFile(): StoredImageCollectionsFile {
  return {
    collections: [],
    lastUpdatedAt: null,
  }
}
function deriveAssistanceMode(runMetrics: Pick<StoredRunMetrics, 'hintCount' | 'suggestedMoveCount'>): StoredAssistanceMode {
  if (runMetrics.suggestedMoveCount > 0) return 'auto-assisted'
  if (runMetrics.hintCount > 0) return 'hinted'
  return 'clean'
}

function sanitizeAssistanceMode(
  input: unknown,
  runMetrics: Pick<StoredRunMetrics, 'hintCount' | 'suggestedMoveCount'>
): StoredAssistanceMode {
  if (input === 'clean' || input === 'hinted' || input === 'auto-assisted') {
    return input
  }

  return deriveAssistanceMode(runMetrics)
}

function countExtraMoves(entry: Pick<StoredCompletionRecord, 'moves' | 'actionMoves'>): number {
  return Math.max(0, entry.actionMoves - entry.moves)
}

function sanitizeOptionalPreviewImage(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function clampConfidence(value: unknown): number {
  const numericValue = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return Math.max(0, Math.min(1, numericValue))
}

function isImageThemeMoodId(value: unknown): value is StoredImageThemeMoodId {
  return (
    value === 'joyful'
    || value === 'melancholic'
    || value === 'dark'
    || value === 'energetic'
    || value === 'calm'
    || value === 'dramatic'
    || value === 'nostalgic'
    || value === 'dreamy'
    || value === 'epic'
    || value === 'minimal'
  )
}

function sanitizeImageThemeSource(value: unknown): StoredImageThemePaletteSource {
  if (value === 'local-color') return 'local-color'
  if (value === 'gemini') return 'local-color'
  return 'fallback'
}

function sanitizeCssColorValue(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const color = value.trim()
  if (/^#[a-f0-9]{6}$/i.test(color) || /^#[a-f0-9]{3}$/i.test(color)) return color
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(color)) return color
  return null
}

function sanitizeImageThemePalette(value: unknown): StoredImageThemePalette | undefined {
  if (!value || typeof value !== 'object') return undefined
  const input = value as Record<string, unknown>
  const accentSolid = sanitizeCssColorValue(input.accentSolid)
  const accentSoft = sanitizeCssColorValue(input.accentSoft)
  const accentStrong = sanitizeCssColorValue(input.accentStrong)
  const glow = sanitizeCssColorValue(input.glow)
  const primaryColor = sanitizeCssColorValue(input.primaryColor)
  const primaryHover = sanitizeCssColorValue(input.primaryHover)
  const primaryShadow = sanitizeCssColorValue(input.primaryShadow)
  const primaryShadowHover = sanitizeCssColorValue(input.primaryShadowHover)

  if (!accentSolid || !accentSoft || !accentStrong || !glow || !primaryColor || !primaryHover || !primaryShadow || !primaryShadowHover) {
    return undefined
  }

  const mood = isImageThemeMoodId(input.mood) ? input.mood : 'calm'
  const moodLabel = typeof input.moodLabel === 'string' && input.moodLabel.trim().length > 0
    ? input.moodLabel.replace(/\s+/g, ' ').trim().slice(0, 40)
    : 'Ruhig'
  const analyzedAt = typeof input.analyzedAt === 'string' && input.analyzedAt.length > 0
    ? input.analyzedAt
    : new Date().toISOString()

  return {
    accentSolid,
    accentSoft,
    accentStrong,
    glow,
    primaryColor,
    primaryHover,
    primaryShadow,
    primaryShadowHover,
    mood,
    moodLabel,
    confidence: clampConfidence(input.confidence),
    source: sanitizeImageThemeSource(input.source),
    reason: typeof input.reason === 'string' && input.reason.trim().length > 0
      ? input.reason.replace(/\s+/g, ' ').trim().slice(0, 180)
      : null,
    analyzedAt,
  }
}

function sanitizeGalleryTagLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const normalizedLabel = value
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)

  if (!normalizedLabel) return null

  return normalizedLabel.charAt(0).toLocaleUpperCase('de-DE') + normalizedLabel.slice(1)
}

function normalizeGalleryTags(value: unknown): StoredGalleryImageTag[] {
  if (!Array.isArray(value)) return []

  const tags = new Map<string, StoredGalleryImageTag>()
  for (const item of value) {
    if (!item || typeof item !== 'object') continue

    const input = item as {
      label?: unknown
      confidence?: unknown
      source?: unknown
    }
    const label = sanitizeGalleryTagLabel(input.label)
    if (!label) continue

    const key = label.toLocaleLowerCase('de-DE')
    const tag: StoredGalleryImageTag = {
      label,
      confidence: clampConfidence(input.confidence),
      source: input.source === 'imported' ? 'imported' : 'gemini',
    }

    const existing = tags.get(key)
    if (!existing || tag.confidence > existing.confidence) {
      tags.set(key, tag)
    }
  }

  return Array.from(tags.values())
    .sort((a, b) => b.confidence - a.confidence || a.label.localeCompare(b.label, 'de'))
    .slice(0, GALLERY_AI_TAG_LIMIT)
}

function sanitizeGallerySuggestionReason(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, 140)
}

function normalizeGalleryCollectionSuggestions(
  value: unknown,
  collections?: StoredImageCollection[] | null
): StoredGalleryCollectionSuggestion[] {
  if (!Array.isArray(value)) return []

  const hasCollectionContext = Array.isArray(collections) && collections.length > 0
  const collectionsById = new Map((collections ?? []).map((collection) => [collection.id, collection]))
  const collectionsByName = new Map(
    (collections ?? []).map((collection) => [collection.name.toLocaleLowerCase('de-DE'), collection])
  )
  const suggestions = new Map<string, StoredGalleryCollectionSuggestion>()

  for (const item of value) {
    if (!item || typeof item !== 'object') continue

    const input = item as {
      collectionId?: unknown
      collectionName?: unknown
      reason?: unknown
      confidence?: unknown
    }
    const collectionId = typeof input.collectionId === 'string' ? input.collectionId : ''
    const collectionName = typeof input.collectionName === 'string' ? input.collectionName.trim() : ''
    const collection =
      collectionsById.get(collectionId)
      ?? collectionsByName.get(collectionName.toLocaleLowerCase('de-DE'))

    if (!collection && hasCollectionContext) continue

    const resolvedCollectionId = collection?.id ?? collectionId
    const resolvedCollectionName = collection?.name ?? collectionName
    if (!resolvedCollectionId || !resolvedCollectionName || suggestions.has(resolvedCollectionId)) continue

    suggestions.set(resolvedCollectionId, {
      collectionId: resolvedCollectionId,
      collectionName: resolvedCollectionName,
      reason: sanitizeGallerySuggestionReason(input.reason),
      confidence: clampConfidence(input.confidence),
      source: 'gemini',
    })
  }

  return Array.from(suggestions.values())
    .sort((a, b) => b.confidence - a.confidence || a.collectionName.localeCompare(b.collectionName, 'de'))
    .slice(0, GALLERY_AI_COLLECTION_SUGGESTION_LIMIT)
}

function normalizeGalleryAiTagging(value: unknown): StoredGalleryAiTagging | undefined {
  if (!value || typeof value !== 'object') return undefined

  const input = value as {
    status?: unknown
    provider?: unknown
    model?: unknown
    generatedAt?: unknown
    error?: unknown
    collectionSuggestions?: unknown
  }

  const status: StoredGalleryAiTaggingStatus =
    input.status === 'failed' || input.status === 'unavailable' || input.status === 'tagged' || input.status === 'pending'
      ? input.status
      : 'tagged'

  return {
    status,
    provider: 'gemini',
    model: typeof input.model === 'string' && input.model.length > 0 ? input.model : null,
    generatedAt: typeof input.generatedAt === 'string' && input.generatedAt.length > 0 ? input.generatedAt : null,
    error: typeof input.error === 'string' && input.error.length > 0 ? input.error.slice(0, 240) : null,
    collectionSuggestions: normalizeGalleryCollectionSuggestions(input.collectionSuggestions),
  }
}

function getGalleryTagMatchKey(label: string): string {
  return label.trim().toLocaleLowerCase('de-DE')
}

function parseDataUrlImage(value: string): { mimeType: string; base64Data: string; byteLength: number } | null {
  const match = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([a-zA-Z0-9+/=]+)$/i.exec(value)
  if (!match) return null

  const mimeType = match[1].toLocaleLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLocaleLowerCase()
  const base64Data = match[2]
  return {
    mimeType,
    base64Data,
    byteLength: Buffer.byteLength(base64Data, 'base64'),
  }
}

function createImageFingerprint(value: string | null | undefined): string | undefined {
  if (!value) return undefined

  const image = parseDataUrlImage(value)
  if (!image) return undefined

  const hash = createHash('sha256')
    .update(image.mimeType)
    .update(':')
    .update(image.base64Data)
    .digest('hex')

  return `sha256:${hash}`
}

function sanitizeGeneratedSaveTitle(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const title = value
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SAVE_AI_TITLE_MAX_LENGTH)

  if (title.length < 3) return null
  if (/^spielstand\b/i.test(title)) return null
  return title
}

function isBackupImageAssetRef(value: unknown): value is BackupImageAssetRef {
  return (
    !!value
    && typeof value === 'object'
    && typeof (value as { assetId?: unknown }).assetId === 'string'
    && (value as { assetId: string }).assetId.length > 0
  )
}

function normalizeBackupAssetMap(value: unknown): BackupAssetMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([assetId, assetValue]) => assetId.length > 0 && typeof assetValue === 'string' && assetValue.length > 0)
      .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
  )
}

function resolveBackupImageValue(value: unknown, assets: BackupAssetMap): string | null {
  if (typeof value === 'string') {
    return sanitizeOptionalPreviewImage(value)
  }

  if (!isBackupImageAssetRef(value)) {
    return null
  }

  return sanitizeOptionalPreviewImage(assets[value.assetId])
}

function createBackupAssetRegistry(): {
  assets: BackupAssetMap
  store: (value: string | null | undefined) => BackupImageValue
  finalize: () => void
  resolve: (value: BackupImageValue) => BackupImageValue
} {
  const assets: BackupAssetMap = {}
  const counts = new Map<string, number>()
  const orderedValues: string[] = []
  const assetIds = new Map<string, string>()

  return {
    assets,
    store: (value) => {
      const normalizedValue = sanitizeOptionalPreviewImage(value)
      if (!normalizedValue) {
        return null
      }

      const nextCount = (counts.get(normalizedValue) ?? 0) + 1
      counts.set(normalizedValue, nextCount)
      if (nextCount === 1) {
        orderedValues.push(normalizedValue)
      }

      return normalizedValue
    },
    finalize: () => {
      assetIds.clear()
      for (const assetId of Object.keys(assets)) {
        delete assets[assetId]
      }

      let nextAssetIndex = 1
      for (const value of orderedValues) {
        if ((counts.get(value) ?? 0) < 2) {
          continue
        }

        const assetId = `a${nextAssetIndex}`
        nextAssetIndex += 1
        assetIds.set(value, assetId)
        assets[assetId] = value
      }
    },
    resolve: (value) => {
      const normalizedValue = sanitizeOptionalPreviewImage(value)
      if (!normalizedValue) {
        return null
      }

      const assetId = assetIds.get(normalizedValue)
      return assetId ? { assetId } : normalizedValue
    },
  }
}

function materializeBackupCompletionRecord(
  entry: BackupCompletionRecord,
  assetRegistry: ReturnType<typeof createBackupAssetRegistry>
): BackupCompletionRecord {
  return {
    ...entry,
    previewImage: assetRegistry.resolve(entry.previewImage),
  }
}

function materializeBackupGalleryEntry(
  entry: BackupGalleryEntry,
  assetRegistry: ReturnType<typeof createBackupAssetRegistry>
): BackupGalleryEntry {
  return {
    ...entry,
    previewImage: assetRegistry.resolve(entry.previewImage),
    sourceImage: assetRegistry.resolve(entry.sourceImage),
  }
}

function materializeBackupSaveResponse(
  entry: BackupSaveResponse,
  assetRegistry: ReturnType<typeof createBackupAssetRegistry>
): BackupSaveResponse {
  return {
    ...entry,
    previewImage: assetRegistry.resolve(entry.previewImage),
    image: assetRegistry.resolve(entry.image),
    croppedImage: assetRegistry.resolve(entry.croppedImage),
  }
}

function materializeBackupStatsResponse(
  response: BackupStatsResponse,
  assetRegistry: ReturnType<typeof createBackupAssetRegistry>
): BackupStatsResponse {
  return {
    ...response,
    recentCompletions: response.recentCompletions.map((entry) => materializeBackupCompletionRecord(entry, assetRegistry)),
    completionHistory: response.completionHistory.map((entry) => materializeBackupCompletionRecord(entry, assetRegistry)),
  }
}

function materializeBackupGalleryResponse(
  response: BackupGalleryResponse,
  assetRegistry: ReturnType<typeof createBackupAssetRegistry>
): BackupGalleryResponse {
  return {
    ...response,
    entries: response.entries.map((entry) => materializeBackupGalleryEntry(entry, assetRegistry)),
  }
}

function toBackupCompletionRecord(
  entry: StoredCompletionRecord,
  assetRegistry: ReturnType<typeof createBackupAssetRegistry>
): BackupCompletionRecord {
  return {
    ...entry,
    previewImage: assetRegistry.store(entry.previewImage),
  }
}

function toBackupGalleryEntry(
  entry: StoredGalleryEntry,
  assetRegistry: ReturnType<typeof createBackupAssetRegistry>
): BackupGalleryEntry {
  return {
    ...entry,
    previewImage: assetRegistry.store(entry.previewImage),
    sourceImage: assetRegistry.store(entry.sourceImage),
  }
}

function toBackupStatsResponse(
  stats: StoredStatsFile,
  assetRegistry: ReturnType<typeof createBackupAssetRegistry>
): BackupStatsResponse {
  const response = toStatsResponse(stats)

  return {
    ...response,
    recentCompletions: response.recentCompletions.map((entry) => toBackupCompletionRecord(entry, assetRegistry)),
    completionHistory: response.completionHistory.map((entry) => toBackupCompletionRecord(entry, assetRegistry)),
  }
}

function toBackupGalleryResponse(
  gallery: StoredGalleryFile,
  assetRegistry: ReturnType<typeof createBackupAssetRegistry>
): BackupGalleryResponse {
  const response = toGalleryResponse(gallery)

  return {
    ...response,
    entries: response.entries.map((entry) => toBackupGalleryEntry(entry, assetRegistry)),
  }
}

function hasDetailedProfileData(input: {
  actionMoves?: unknown
  undoCount?: unknown
  redoCount?: unknown
  hintCount?: unknown
  suggestedMoveCount?: unknown
  assistanceMode?: unknown
  hasDetailedProfile?: unknown
}): boolean {
  return (
    input.hasDetailedProfile === true
    || input.actionMoves !== undefined
    || input.undoCount !== undefined
    || input.redoCount !== undefined
    || input.hintCount !== undefined
    || input.suggestedMoveCount !== undefined
    || input.assistanceMode !== undefined
  )
}

function sanitizeCropTransform(value: unknown): StoredCropTransform | undefined {
  if (!value || typeof value !== 'object') return undefined

  const input = value as Record<string, unknown>
  const zoom = typeof input.zoom === 'number' && Number.isFinite(input.zoom) ? input.zoom : null
  const rotationDeg = typeof input.rotationDeg === 'number' && Number.isFinite(input.rotationDeg) ? input.rotationDeg : null
  const offsetX = typeof input.offsetX === 'number' && Number.isFinite(input.offsetX) ? input.offsetX : null
  const offsetY = typeof input.offsetY === 'number' && Number.isFinite(input.offsetY) ? input.offsetY : null

  if (zoom === null || rotationDeg === null || offsetX === null || offsetY === null) {
    return undefined
  }

  return { zoom, rotationDeg, offsetX, offsetY }
}

function sanitizeStoredPuzzleBoard(value: unknown, tileCount: number): number[] | undefined {
  if (!Array.isArray(value) || value.length !== tileCount) return undefined

  const seen = new Set<number>()
  const board: number[] = []
  for (const entry of value) {
    if (typeof entry !== 'number' || !Number.isInteger(entry) || entry < 0 || entry >= tileCount) {
      return undefined
    }

    if (seen.has(entry)) {
      return undefined
    }

    seen.add(entry)
    board.push(entry)
  }

  return seen.size === tileCount ? board : undefined
}

function sanitizeOptimalStartMoveCountKind(value: unknown): StoredGalleryReplaySetup['optimalStartMoveCountKind'] | undefined {
  return value === 'exact' || value === 'lower-bound' || value === 'unavailable'
    ? value
    : undefined
}

function sanitizeGalleryReplaySetup(value: unknown, config: StoredPuzzleConfig): StoredGalleryReplaySetup | undefined {
  if (!value || typeof value !== 'object') return undefined

  const input = value as Record<string, unknown>
  if (input.version !== 1) return undefined

  const tileCount = config.rows * config.cols
  const startBoard = sanitizeStoredPuzzleBoard(input.startBoard, tileCount)
  const emptyIndex = typeof input.emptyIndex === 'number' && Number.isInteger(input.emptyIndex)
    ? input.emptyIndex
    : -1

  if (!startBoard || emptyIndex < 0 || emptyIndex >= tileCount || startBoard[emptyIndex] !== tileCount - 1) {
    return undefined
  }

  const shuffleMoves = Array.isArray(input.shuffleMoves)
    ? input.shuffleMoves.filter((move): move is string => typeof move === 'string' && move.length > 0)
    : []
  const optimalStartMoveCount = sanitizeOptionalCount(input.optimalStartMoveCount)
  const optimalStartMoveCountKind = sanitizeOptimalStartMoveCountKind(input.optimalStartMoveCountKind)
  const optimalStartMoveCountSolverVersion =
    typeof input.optimalStartMoveCountSolverVersion === 'string' && input.optimalStartMoveCountSolverVersion.trim().length > 0
      ? input.optimalStartMoveCountSolverVersion.trim()
      : undefined

  return {
    version: 1,
    startBoard,
    emptyIndex,
    shuffleMoves,
    ...(input.optimalStartMoveCount === null
      ? { optimalStartMoveCount: null }
      : optimalStartMoveCount !== null
        ? { optimalStartMoveCount }
        : {}),
    ...(optimalStartMoveCountKind ? { optimalStartMoveCountKind } : {}),
    ...(optimalStartMoveCountSolverVersion ? { optimalStartMoveCountSolverVersion } : {}),
  }
}

function normalizeCompletionRecord(entry: unknown, assets: BackupAssetMap = {}): StoredCompletionRecord | null {
  if (!entry || typeof entry !== 'object') return null
  const input = entry as {
    id?: unknown
    completedAt?: unknown
    previewImage?: unknown
    config?: unknown
    moves?: unknown
    actionMoves?: unknown
    time?: unknown
    undoCount?: unknown
    redoCount?: unknown
    hintCount?: unknown
    suggestedMoveCount?: unknown
    assistanceMode?: unknown
  }

  if (typeof input.id !== 'string' || typeof input.completedAt !== 'string' || !isValidPuzzleConfig(input.config)) {
    return null
  }

  const moves = sanitizeCount(input.moves)
  const runMetrics = sanitizeRunMetrics(
    {
      actionMoves: input.actionMoves,
      undoCount: input.undoCount,
      redoCount: input.redoCount,
      hintCount: input.hintCount,
      suggestedMoveCount: input.suggestedMoveCount,
    },
    moves
  )
  const hasDetailedProfile = hasDetailedProfileData(input)

  return {
    id: input.id,
    completedAt: input.completedAt,
    previewImage: resolveBackupImageValue(input.previewImage, assets),
    config: input.config,
    moves,
    actionMoves: runMetrics.actionMoves,
    time: sanitizeCount(input.time),
    undoCount: runMetrics.undoCount,
    redoCount: runMetrics.redoCount,
    hintCount: runMetrics.hintCount,
    suggestedMoveCount: runMetrics.suggestedMoveCount,
    assistanceMode: sanitizeAssistanceMode(input.assistanceMode, runMetrics),
    hasDetailedProfile,
  }
}

function normalizeDifficultyStats(entry: unknown): StoredDifficultyStats | null {
  if (!entry || typeof entry !== 'object') return null
  const input = entry as {
    config?: unknown
    solveCount?: unknown
    cleanSolveCount?: unknown
    assistedSolveCount?: unknown
    autoAssistedSolveCount?: unknown
    totalMoves?: unknown
    totalActionMoves?: unknown
    totalTime?: unknown
    bestMoves?: unknown
    bestCleanMoves?: unknown
    bestTime?: unknown
    bestCleanTime?: unknown
    lastCompletedAt?: unknown
  }

  if (!isValidPuzzleConfig(input.config)) return null

  const solveCount = sanitizeCount(input.solveCount)
  const cleanSolveCount = input.cleanSolveCount === undefined
    ? solveCount
    : Math.min(solveCount, sanitizeCount(input.cleanSolveCount))
  const autoAssistedSolveCount = input.autoAssistedSolveCount === undefined
    ? 0
    : Math.min(solveCount, sanitizeCount(input.autoAssistedSolveCount))
  const rawAssistedSolveCount = input.assistedSolveCount === undefined
    ? Math.max(0, solveCount - cleanSolveCount)
    : Math.max(autoAssistedSolveCount, Math.min(solveCount, sanitizeCount(input.assistedSolveCount)))
  // Ensure clean + assisted never exceeds total
  const assistedSolveCount = Math.min(rawAssistedSolveCount, Math.max(0, solveCount - cleanSolveCount))
  const bestMoves = sanitizeOptionalCount(input.bestMoves)
  const bestTime = sanitizeOptionalCount(input.bestTime)

  return {
    config: input.config,
    solveCount,
    cleanSolveCount,
    assistedSolveCount,
    autoAssistedSolveCount,
    totalMoves: sanitizeCount(input.totalMoves),
    totalActionMoves: Math.max(sanitizeCount(input.totalMoves), sanitizeCount(input.totalActionMoves)),
    totalTime: sanitizeCount(input.totalTime),
    bestMoves,
    bestCleanMoves: normalizeCleanBestValue({
      explicitValue: input.bestCleanMoves,
      generalValue: bestMoves,
      cleanCount: cleanSolveCount,
      assistedCount: assistedSolveCount,
      autoAssistedCount: autoAssistedSolveCount,
    }),
    bestTime,
    bestCleanTime: normalizeCleanBestValue({
      explicitValue: input.bestCleanTime,
      generalValue: bestTime,
      cleanCount: cleanSolveCount,
      assistedCount: assistedSolveCount,
      autoAssistedSolveCount: autoAssistedSolveCount,
    }),
    lastCompletedAt: typeof input.lastCompletedAt === 'string' ? input.lastCompletedAt : null,
  }
}

function normalizeStatsFile(payload: unknown, assets: BackupAssetMap = {}): StoredStatsFile {
  if (!payload || typeof payload !== 'object') {
    return createEmptyStatsFile()
  }

  const input = payload as {
    totalSolved?: unknown
    cleanSolvedCount?: unknown
    assistedSolvedCount?: unknown
    autoAssistedSolvedCount?: unknown
    totalMoves?: unknown
    totalTime?: unknown
    bestMoves?: unknown
    bestCleanMoves?: unknown
    bestTime?: unknown
    bestCleanTime?: unknown
    byDifficulty?: unknown
    recentCompletions?: unknown
    completionHistory?: unknown
    lastUpdatedAt?: unknown
  }

  const byDifficulty = Array.isArray(input.byDifficulty)
    ? input.byDifficulty
        .map((entry) => normalizeDifficultyStats(entry))
        .filter((entry): entry is StoredDifficultyStats => entry !== null)
        .sort((a, b) => comparePuzzleConfig(a.config, b.config))
    : []

  const rawHistory = Array.isArray(input.completionHistory)
    ? input.completionHistory
    : Array.isArray(input.recentCompletions)
      ? input.recentCompletions
      : []

  const completionHistory = rawHistory
    .map((entry) => normalizeCompletionRecord(entry, assets))
    .filter((entry): entry is StoredCompletionRecord => entry !== null)
    .sort((a, b) => getIsoTimestampValue(b.completedAt) - getIsoTimestampValue(a.completedAt))

  const totalSolved = sanitizeCount(input.totalSolved)
  const hasProfiledHistory = completionHistory.some((entry) => entry.hasDetailedProfile)
  const derivedCleanSolvedCount = completionHistory.filter((entry) => entry.assistanceMode === 'clean').length
  const derivedAssistedSolvedCount = completionHistory.filter((entry) => entry.assistanceMode !== 'clean').length
  const derivedAutoAssistedSolvedCount = completionHistory.filter((entry) => entry.assistanceMode === 'auto-assisted').length
  const cleanSolvedCount = Math.min(
    totalSolved,
    input.cleanSolvedCount === undefined
      ? completionHistory.length > 0
        ? hasProfiledHistory
          ? derivedCleanSolvedCount
          : totalSolved
        : totalSolved
      : sanitizeCount(input.cleanSolvedCount)
  )
  const rawAssistedSolvedCount = Math.min(
    totalSolved,
    input.assistedSolvedCount === undefined
      ? completionHistory.length > 0 && hasProfiledHistory
        ? derivedAssistedSolvedCount
        : 0
      : sanitizeCount(input.assistedSolvedCount)
  )
  // Ensure clean + assisted never exceeds total
  const assistedSolvedCount = Math.min(rawAssistedSolvedCount, Math.max(0, totalSolved - cleanSolvedCount))
  const autoAssistedSolvedCount = Math.min(
    assistedSolvedCount,
    input.autoAssistedSolvedCount === undefined
      ? completionHistory.length > 0 && hasProfiledHistory
        ? derivedAutoAssistedSolvedCount
        : 0
      : sanitizeCount(input.autoAssistedSolvedCount)
  )
  const derivedBestMoves = getBestOptionalValue(byDifficulty.map((entry) => entry.bestMoves))
  const derivedBestCleanMoves = getBestOptionalValue(byDifficulty.map((entry) => entry.bestCleanMoves))
  const derivedBestTime = getBestOptionalValue(byDifficulty.map((entry) => entry.bestTime))
  const derivedBestCleanTime = getBestOptionalValue(byDifficulty.map((entry) => entry.bestCleanTime))
  const bestMoves = sanitizeOptionalCount(input.bestMoves) ?? derivedBestMoves
  const bestTime = sanitizeOptionalCount(input.bestTime) ?? derivedBestTime

  return {
    totalSolved,
    cleanSolvedCount,
    assistedSolvedCount,
    autoAssistedSolvedCount,
    totalMoves: sanitizeCount(input.totalMoves),
    totalTime: sanitizeCount(input.totalTime),
    bestMoves,
    bestCleanMoves: normalizeCleanBestValue({
      explicitValue: input.bestCleanMoves,
      generalValue: bestMoves,
      cleanCount: cleanSolvedCount,
      assistedCount: assistedSolvedCount,
      autoAssistedCount: autoAssistedSolvedCount,
      derivedValue: derivedBestCleanMoves,
    }),
    bestTime,
    bestCleanTime: normalizeCleanBestValue({
      explicitValue: input.bestCleanTime,
      generalValue: bestTime,
      cleanCount: cleanSolvedCount,
      assistedCount: assistedSolvedCount,
      autoAssistedSolvedCount: autoAssistedSolvedCount,
      derivedValue: derivedBestCleanTime,
    }),
    byDifficulty,
    completionHistory,
    lastUpdatedAt: typeof input.lastUpdatedAt === 'string' ? input.lastUpdatedAt : null,
  }
}
function toGalleryEntryFromCompletion(entry: StoredCompletionRecord): StoredGalleryEntry {
  return {
    id: entry.id,
    completedAt: entry.completedAt,
    previewImage: entry.previewImage,
    sourceImage: entry.previewImage,
    config: entry.config,
    moves: entry.moves,
    time: entry.time,
    actionMoves: entry.actionMoves,
    assistanceMode: entry.assistanceMode,
    hasDetailedProfile: entry.hasDetailedProfile,
  }
}

function normalizeGalleryEntry(entry: unknown, assets: BackupAssetMap = {}): StoredGalleryEntry | null {
  if (!entry || typeof entry !== 'object') return null

  const input = entry as {
    id?: unknown
    completedAt?: unknown
    previewImage?: unknown
    sourceImage?: unknown
    config?: unknown
    moves?: unknown
    time?: unknown
    actionMoves?: unknown
    assistanceMode?: unknown
    hasDetailedProfile?: unknown
    tags?: unknown
    aiTagging?: unknown
    cropTransform?: unknown
    useFullImage?: unknown
    replaySetup?: unknown
    imageTheme?: unknown
  }

  if (typeof input.id !== 'string' || typeof input.completedAt !== 'string' || !isValidPuzzleConfig(input.config)) {
    return null
  }

  const moves = sanitizeCount(input.moves)
  const previewImage = resolveBackupImageValue(input.previewImage, assets)
  const sourceImage = resolveBackupImageValue(input.sourceImage, assets) ?? previewImage
  const tags = normalizeGalleryTags(input.tags)
  const aiTagging = normalizeGalleryAiTagging(input.aiTagging)
  const cropTransform = sanitizeCropTransform(input.cropTransform)
  const replaySetup = sanitizeGalleryReplaySetup(input.replaySetup, input.config)
  const imageTheme = sanitizeImageThemePalette(input.imageTheme)

  return {
    id: input.id,
    completedAt: input.completedAt,
    previewImage,
    sourceImage,
    config: input.config,
    moves,
    time: sanitizeCount(input.time),
    actionMoves: Math.max(moves, sanitizeCount(input.actionMoves)),
    assistanceMode: sanitizeAssistanceMode(input.assistanceMode, { hintCount: 0, suggestedMoveCount: 0 }),
    hasDetailedProfile: input.hasDetailedProfile === false ? false : true,
    ...(tags.length > 0 ? { tags } : {}),
    ...(aiTagging ? { aiTagging } : {}),
    ...(cropTransform ? { cropTransform } : {}),
    ...(typeof input.useFullImage === 'boolean' ? { useFullImage: input.useFullImage } : {}),
    ...(replaySetup ? { replaySetup } : {}),
    ...(imageTheme ? { imageTheme } : {}),
  }
}

function createGalleryFileFromCompletionHistory(
  history: StoredCompletionRecord[],
  lastUpdatedAt: string | null
): StoredGalleryFile {
  return {
    entries: history
      .map((entry) => toGalleryEntryFromCompletion(entry))
      .sort((a, b) => getIsoTimestampValue(b.completedAt) - getIsoTimestampValue(a.completedAt)),
    lastUpdatedAt,
  }
}

function normalizeGalleryFile(payload: unknown, assets: BackupAssetMap = {}): StoredGalleryFile {
  if (!payload || typeof payload !== 'object') {
    return createEmptyGalleryFile()
  }

  const input = payload as {
    entries?: unknown
    lastUpdatedAt?: unknown
  }

  const entries = Array.isArray(input.entries)
    ? input.entries
      .map((entry) => normalizeGalleryEntry(entry, assets))
      .filter((entry): entry is StoredGalleryEntry => entry !== null)
      .sort((a, b) => getIsoTimestampValue(b.completedAt) - getIsoTimestampValue(a.completedAt))
    : []

  return {
    entries,
    lastUpdatedAt: typeof input.lastUpdatedAt === 'string'
      ? input.lastUpdatedAt
      : entries[0]?.completedAt ?? null,
  }
}

function sanitizeCollectionText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed.slice(0, 80) : null
}

function sanitizeCollectionDescription(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed.slice(0, 220) : undefined
}

function normalizeCollectionImageIds(value: unknown, validImageIds?: Set<string>): string[] {
  if (!Array.isArray(value)) return []

  const uniqueIds = new Set<string>()
  for (const imageId of value) {
    if (typeof imageId !== 'string' || imageId.length === 0) {
      continue
    }

    if (validImageIds && !validImageIds.has(imageId)) {
      continue
    }

    uniqueIds.add(imageId)
  }

  return Array.from(uniqueIds)
}

function getGalleryMotifKeyForCollection(entry: StoredGalleryEntry): string {
  return getGalleryMotifKey(entry)
}

function normalizeCollectionImageIdsByMotif(value: unknown, gallery: StoredGalleryFile): string[] {
  const galleryEntriesById = new Map(gallery.entries.map((entry) => [entry.id, entry]))
  const imageIdsByMotif = new Map<string, { imageId: string; order: number; completedAt: number }>()

  normalizeCollectionImageIds(value, getValidGalleryEntryIds(gallery)).forEach((imageId, order) => {
    const entry = galleryEntriesById.get(imageId)
    if (!entry) return

    const motifKey = getGalleryMotifKeyForCollection(entry)
    const completedAt = getIsoTimestampValue(entry.completedAt)
    const existing = imageIdsByMotif.get(motifKey)
    if (existing && existing.completedAt >= completedAt) return

    imageIdsByMotif.set(motifKey, { imageId, order: existing?.order ?? order, completedAt })
  })

  return Array.from(imageIdsByMotif.values())
    .sort((a, b) => a.order - b.order)
    .map(({ imageId }) => imageId)
}

function normalizeImageCollection(
  collection: unknown,
  index: number,
  usedIds: Set<string>,
  gallery?: StoredGalleryFile
): StoredImageCollection | null {
  if (!collection || typeof collection !== 'object') return null

  const input = collection as {
    id?: unknown
    name?: unknown
    description?: unknown
    createdAt?: unknown
    updatedAt?: unknown
    imageIds?: unknown
  }
  const name = sanitizeCollectionText(input.name)
  if (!name) return null

  const requestedId = typeof input.id === 'string' && isValidSaveId(input.id) ? input.id : null
  const id = requestedId && !usedIds.has(requestedId) ? requestedId : randomUUID()
  usedIds.add(id)

  const createdAt = sanitizeTextValue(input.createdAt, new Date().toISOString())
  const updatedAt = sanitizeTextValue(input.updatedAt, createdAt)
  const description = sanitizeCollectionDescription(input.description)

  return {
    id,
    name: name || `Sammlung ${index + 1}`,
    ...(description ? { description } : {}),
    createdAt,
    updatedAt,
    imageIds: gallery
      ? normalizeCollectionImageIdsByMotif(input.imageIds, gallery)
      : normalizeCollectionImageIds(input.imageIds),
  }
}

function normalizeCollectionsFile(
  payload: unknown,
  gallery?: StoredGalleryFile
): StoredImageCollectionsFile {
  if (!payload || typeof payload !== 'object') {
    return createEmptyCollectionsFile()
  }

  const input = payload as {
    collections?: unknown
    lastUpdatedAt?: unknown
  }
  const usedIds = new Set<string>()
  const collections = Array.isArray(input.collections)
    ? input.collections
      .map((collection, index) => normalizeImageCollection(collection, index, usedIds, gallery))
      .filter((collection): collection is StoredImageCollection => collection !== null)
      .sort((a, b) => getIsoTimestampValue(b.updatedAt) - getIsoTimestampValue(a.updatedAt))
    : []

  return {
    collections,
    lastUpdatedAt: typeof input.lastUpdatedAt === 'string'
      ? input.lastUpdatedAt
      : collections[0]?.updatedAt ?? null,
  }
}
async function readStatsFile(): Promise<StoredStatsFile> {
  try {
    await ensureSavesDir()
    const raw = await readFile(STATS_FILE, 'utf-8')
    return normalizeStatsFile(JSON.parse(raw))
  } catch (error) {
    if (!isMissingFileError(error)) {
      console.warn('[localApi] Statistik-Datei konnte nicht gelesen werden, verwende leere Statistik:', error)
    }
    return createEmptyStatsFile()
  }
}

async function writeStatsFile(stats: StoredStatsFile): Promise<void> {
  await ensureSavesDir()
  await writeFile(STATS_FILE, JSON.stringify(stats, null, 2), 'utf-8')
}

async function readGalleryFile(): Promise<StoredGalleryFile> {
  await ensureSavesDir()

  const rawGallery = await readJsonFile<StoredGalleryFile>(GALLERY_FILE)
  if (rawGallery) {
    return normalizeGalleryFile(rawGallery)
  }

  const stats = await readStatsFile()
  const migratedGallery = createGalleryFileFromCompletionHistory(stats.completionHistory, stats.lastUpdatedAt)
  await writeGalleryFile(migratedGallery)
  return migratedGallery
}

async function writeGalleryFile(gallery: StoredGalleryFile): Promise<void> {
  await ensureSavesDir()
  await writeFile(GALLERY_FILE, JSON.stringify(gallery, null, 2), 'utf-8')
}

function getGalleryMotifKey(entry: StoredGalleryEntry): string {
  return entry.sourceImage ?? entry.previewImage ?? `missing:${entry.id}`
}

function getValidGalleryEntryIds(gallery: StoredGalleryFile): Set<string> {
  return new Set(gallery.entries.map((entry) => entry.id))
}

async function readCollectionsFile(gallery?: StoredGalleryFile): Promise<StoredImageCollectionsFile> {
  await ensureSavesDir()

  const currentGallery = gallery ?? await readGalleryFile()
  const rawCollections = await readJsonFile<StoredImageCollectionsFile>(COLLECTIONS_FILE)
  if (!rawCollections) {
    return createEmptyCollectionsFile()
  }

  return normalizeCollectionsFile(rawCollections, currentGallery)
}

async function writeCollectionsFile(collections: StoredImageCollectionsFile): Promise<void> {
  await ensureSavesDir()
  await writeFile(COLLECTIONS_FILE, JSON.stringify(collections, null, 2), 'utf-8')
}

function toGalleryResponse(gallery: StoredGalleryFile): GalleryResponse {
  const sortedEntries = gallery.entries
    .slice()
    .sort((a, b) => getIsoTimestampValue(b.completedAt) - getIsoTimestampValue(a.completedAt))

  return {
    entries: sortedEntries,
    totalEntries: sortedEntries.length,
    lastCompletedAt: sortedEntries[0]?.completedAt ?? null,
    lastUpdatedAt: gallery.lastUpdatedAt ?? sortedEntries[0]?.completedAt ?? null,
  }
}

function toCollectionsResponse(collectionsFile: StoredImageCollectionsFile): ImageCollectionsResponse {
  const sortedCollections = collectionsFile.collections
    .slice()
    .sort((a, b) => getIsoTimestampValue(b.updatedAt) - getIsoTimestampValue(a.updatedAt))

  return {
    collections: sortedCollections,
    totalCollections: sortedCollections.length,
    lastUpdatedAt: collectionsFile.lastUpdatedAt ?? sortedCollections[0]?.updatedAt ?? null,
  }
}

async function analyzeGalleryEntry(
  entryId: string,
  config: GeminiGalleryConfig
): Promise<AnalyzeGalleryEntryResponse | null> {
  const gallery = await readGalleryFile()
  const entry = gallery.entries.find((galleryEntry) => galleryEntry.id === entryId)
  if (!entry) return null

  const collections = await readCollectionsFile(gallery)
  const analysis = await analyzeGalleryImageWithGemini(entry, collections.collections, config)
  const nowIso = new Date().toISOString()
  const nextEntry: StoredGalleryEntry = {
    ...entry,
    ...(analysis.tags && analysis.tags.length > 0 ? { tags: analysis.tags } : {}),
    ...(analysis.aiTagging ? { aiTagging: analysis.aiTagging } : {}),
  }
  const nextGallery: StoredGalleryFile = {
    entries: gallery.entries.map((galleryEntry) => galleryEntry.id === entryId ? nextEntry : galleryEntry),
    lastUpdatedAt: nowIso,
  }

  await writeGalleryFile(nextGallery)

  return {
    gallery: toGalleryResponse(nextGallery),
    entry: nextEntry,
  }
}

async function updateGalleryTags(input: {
  action: UpdateGalleryTagsAction
  sourceLabel: string
  targetLabel?: string
}): Promise<StoredGalleryFile> {
  const sourceLabel = sanitizeGalleryTagLabel(input.sourceLabel)
  const targetLabel = input.action === 'rename' ? sanitizeGalleryTagLabel(input.targetLabel) : null
  if (!sourceLabel || (input.action === 'rename' && !targetLabel)) {
    return readGalleryFile()
  }

  const sourceKey = getGalleryTagMatchKey(sourceLabel)
  const gallery = await readGalleryFile()
  let didChange = false

  const entries = gallery.entries.map((entry) => {
    if (!entry.tags || entry.tags.length === 0) return entry

    let didEntryChange = false
    const nextTags = entry.tags.flatMap((tag) => {
      if (getGalleryTagMatchKey(tag.label) !== sourceKey) {
        return [tag]
      }

      didChange = true
      didEntryChange = true
      if (input.action === 'remove') {
        return []
      }

      return [{
        ...tag,
        label: targetLabel ?? tag.label,
      }]
    })

    if (!didEntryChange) return entry

    const normalizedTags = normalizeGalleryTags(nextTags)
    const nextEntry: StoredGalleryEntry = {
      ...entry,
    }
    if (normalizedTags.length > 0) {
      nextEntry.tags = normalizedTags
    } else {
      delete nextEntry.tags
    }

    return nextEntry
  })

  if (!didChange) return gallery

  const nextGallery: StoredGalleryFile = {
    entries,
    lastUpdatedAt: new Date().toISOString(),
  }

  await writeGalleryFile(nextGallery)
  return nextGallery
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0

  const sorted = [...values].sort((a, b) => a - b)
  const middleIndex = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middleIndex - 1] + sorted[middleIndex]) / 2)
  }

  return sorted[middleIndex]
}

function calculateRecentMedian(values: number[]): number {
  return calculateMedian(values.slice(0, RECENT_MEDIAN_SAMPLE_SIZE))
}

function toLocalDayKey(isoDate: string): string {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return ''

  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getUniqueCompletionDays(history: StoredCompletionRecord[]): string[] {
  return [...new Set(history.map((entry) => toLocalDayKey(entry.completedAt)).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a))
}

function calculateStreaks(history: StoredCompletionRecord[]): {
  currentStreak: number
  bestStreak: number
  activeDays: number
} {
  const uniqueDays = getUniqueCompletionDays(history)
  if (uniqueDays.length === 0) {
    return {
      currentStreak: 0,
      bestStreak: 0,
      activeDays: 0,
    }
  }

  let bestStreak = 1
  let runningStreak = 1

  for (let index = 1; index < uniqueDays.length; index++) {
    const previous = new Date(`${uniqueDays[index - 1]}T00:00:00`)
    const current = new Date(`${uniqueDays[index]}T00:00:00`)
    const diffDays = Math.round((previous.getTime() - current.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 1) {
      runningStreak += 1
      if (runningStreak > bestStreak) {
        bestStreak = runningStreak
      }
      continue
    }

    runningStreak = 1
  }

  let currentStreak = 1
  for (let index = 1; index < uniqueDays.length; index++) {
    const previous = new Date(`${uniqueDays[index - 1]}T00:00:00`)
    const current = new Date(`${uniqueDays[index]}T00:00:00`)
    const diffDays = Math.round((previous.getTime() - current.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 1) {
      currentStreak += 1
      continue
    }

    break
  }

  return {
    currentStreak,
    bestStreak,
    activeDays: uniqueDays.length,
  }
}

function getCompletionHistoryForConfig(
  history: StoredCompletionRecord[],
  config: StoredPuzzleConfig
): StoredCompletionRecord[] {
  return history.filter(
    (entry) => entry.config.rows === config.rows && entry.config.cols === config.cols
  )
}

function toDifficultyStatsResponse(
  entry: StoredDifficultyStats,
  completionHistory: StoredCompletionRecord[]
): DifficultyStatsResponse {
  const averageMoves = entry.solveCount > 0 ? Math.round(entry.totalMoves / entry.solveCount) : 0
  const averageTime = entry.solveCount > 0 ? Math.round(entry.totalTime / entry.solveCount) : 0
  const scopedHistory = getCompletionHistoryForConfig(completionHistory, entry.config)
  const profiledHistory = scopedHistory.filter((record) => record.hasDetailedProfile)
  const medianMoves = calculateMedian(scopedHistory.map((record) => record.moves))
  const medianTime = calculateMedian(scopedHistory.map((record) => record.time))
  const averageActionMoves = profiledHistory.length > 0
    ? Math.round(profiledHistory.reduce((sum, record) => sum + record.actionMoves, 0) / profiledHistory.length)
    : null
  const medianActionMoves = profiledHistory.length > 0
    ? calculateMedian(profiledHistory.map((record) => record.actionMoves))
    : null
  const averageExtraMoves = profiledHistory.length > 0
    ? Math.round(profiledHistory.reduce((sum, record) => sum + countExtraMoves(record), 0) / profiledHistory.length)
    : null
  const medianExtraMoves = profiledHistory.length > 0
    ? calculateMedian(profiledHistory.map((record) => countExtraMoves(record)))
    : null
  const recentHistory = scopedHistory.slice(0, RECENT_MEDIAN_SAMPLE_SIZE)
  const latestCompletion = scopedHistory[0] ?? null
  const profiledSolveCount = profiledHistory.length

  return {
    ...entry,
    averageMoves,
    averageActionMoves,
    averageTime,
    medianMoves,
    medianActionMoves,
    medianTime,
    averageExtraMoves,
    medianExtraMoves,
    recentMedianMoves: calculateMedian(recentHistory.map((record) => record.moves)),
    recentMedianTime: calculateMedian(recentHistory.map((record) => record.time)),
    profiledSolveCount,
    legacySolveCount: Math.max(0, entry.solveCount - profiledSolveCount),
    lastMoves: latestCompletion?.moves ?? null,
    lastActionMoves: latestCompletion?.hasDetailedProfile ? latestCompletion.actionMoves : null,
    lastExtraMoves: latestCompletion?.hasDetailedProfile ? countExtraMoves(latestCompletion) : null,
    lastTime: latestCompletion?.time ?? null,
    lastAssistanceMode: latestCompletion?.hasDetailedProfile ? latestCompletion.assistanceMode : null,
    lastHasDetailedProfile: latestCompletion?.hasDetailedProfile ?? null,
  }
}

function toStatsResponse(stats: StoredStatsFile): StatsResponse {
  const averageMoves = stats.totalSolved > 0 ? Math.round(stats.totalMoves / stats.totalSolved) : 0
  const averageTime = stats.totalSolved > 0 ? Math.round(stats.totalTime / stats.totalSolved) : 0
  const completionHistory = stats.completionHistory
    .slice()
    .sort((a, b) => getIsoTimestampValue(b.completedAt) - getIsoTimestampValue(a.completedAt))
  const medianMoves = calculateMedian(completionHistory.map((entry) => entry.moves))
  const medianTime = calculateMedian(completionHistory.map((entry) => entry.time))
  const streaks = calculateStreaks(completionHistory)
  const profiledSolvedCount = completionHistory.filter((entry) => entry.hasDetailedProfile).length

  return {
    totalSolved: stats.totalSolved,
    cleanSolvedCount: stats.cleanSolvedCount,
    assistedSolvedCount: stats.assistedSolvedCount,
    autoAssistedSolvedCount: stats.autoAssistedSolvedCount,
    profiledSolvedCount,
    legacySolvedCount: Math.max(0, stats.totalSolved - profiledSolvedCount),
    totalMoves: stats.totalMoves,
    totalTime: stats.totalTime,
    averageMoves,
    averageTime,
    medianMoves,
    medianTime,
    currentStreak: streaks.currentStreak,
    bestStreak: streaks.bestStreak,
    activeDays: streaks.activeDays,
    bestMoves: stats.bestMoves,
    bestCleanMoves: stats.bestCleanMoves,
    bestTime: stats.bestTime,
    bestCleanTime: stats.bestCleanTime,
    byDifficulty: stats.byDifficulty
      .slice()
      .sort((a, b) => comparePuzzleConfig(a.config, b.config))
      .map((entry) => toDifficultyStatsResponse(entry, completionHistory)),
    recentCompletions: completionHistory.slice(0, RECENT_COMPLETION_PREVIEW_LIMIT),
    completionHistory,
    lastCompletedAt: completionHistory[0]?.completedAt ?? null,
    lastUpdatedAt: stats.lastUpdatedAt,
  }
}

function validateCreatePayload(payload: unknown): payload is {
  image: string
  croppedImage: string
  previewImage: string
  config: StoredPuzzleConfig
  progress: StoredSaveProgress
  imageTheme?: StoredImageThemePalette | null
} {
  if (!payload || typeof payload !== 'object') return false

  const input = payload as Record<string, unknown>
  return (
    typeof input.image === 'string' &&
    typeof input.croppedImage === 'string' &&
    typeof input.previewImage === 'string' &&
    isValidPuzzleConfig(input.config) &&
    typeof input.progress === 'object' &&
    input.progress !== null
  )
}

function validateUpdatePayload(payload: unknown): payload is { progress: StoredSaveProgress } {
  if (!payload || typeof payload !== 'object') return false
  const input = payload as Record<string, unknown>
  return typeof input.progress === 'object' && input.progress !== null
}

function validateCompletionPayload(payload: unknown): payload is {
  config: StoredPuzzleConfig
  moves: number
  time: number
  previewImage?: string | null
  actionMoves: number
  undoCount: number
  redoCount: number
  hintCount: number
  suggestedMoveCount: number
} {
  if (!payload || typeof payload !== 'object') return false

  const input = payload as Record<string, unknown>
  return (
    isValidPuzzleConfig(input.config) &&
    typeof input.moves === 'number' &&
    Number.isFinite(input.moves) &&
    input.moves >= 0 &&
    typeof input.time === 'number' &&
    Number.isFinite(input.time) &&
    input.time >= 0 &&
    typeof input.actionMoves === 'number' &&
    Number.isFinite(input.actionMoves) &&
    input.actionMoves >= 0 &&
    typeof input.undoCount === 'number' &&
    Number.isFinite(input.undoCount) &&
    input.undoCount >= 0 &&
    typeof input.redoCount === 'number' &&
    Number.isFinite(input.redoCount) &&
    input.redoCount >= 0 &&
    typeof input.hintCount === 'number' &&
    Number.isFinite(input.hintCount) &&
    input.hintCount >= 0 &&
    typeof input.suggestedMoveCount === 'number' &&
    Number.isFinite(input.suggestedMoveCount) &&
    input.suggestedMoveCount >= 0 &&
    (input.previewImage === undefined || input.previewImage === null || typeof input.previewImage === 'string')
  )
}

function getStatsExportMimeType(fileName: string): 'text/csv' | 'application/json' {
  return fileName.endsWith('.csv') ? 'text/csv' : 'application/json'
}

function validateStatsExportPayload(payload: unknown): payload is {
  fileName: string
  contents: string
  mimeType: string
} {
  if (!payload || typeof payload !== 'object') return false

  const input = payload as Record<string, unknown>
  if (
    typeof input.fileName !== 'string' ||
    typeof input.contents !== 'string' ||
    typeof input.mimeType !== 'string' ||
    !isValidStatsExportFileName(input.fileName)
  ) {
    return false
  }

  const expectedMimeType = getStatsExportMimeType(input.fileName)
  return input.mimeType.startsWith(expectedMimeType)
}

async function createStatsExportFile(input: {
  fileName: string
  contents: string
  mimeType: string
}): Promise<StatsExportFileResponse> {
  const normalizedMimeType = getStatsExportMimeType(input.fileName)
  const filePath = statsExportFilePath(input.fileName)
  const savedAt = new Date().toISOString()

  await ensureStatsExportsDir()
  await writeFile(filePath, input.contents, 'utf-8')

  const fileStats = await stat(filePath)

  return {
    fileName: input.fileName,
    directory: 'statistik-exporte',
    relativePath: path.join('statistik-exporte', input.fileName),
    size: fileStats.size,
    savedAt,
    mimeType: normalizedMimeType,
  }
}

function validateGalleryPayload(payload: unknown): payload is {
  id?: string
  completedAt?: string | null
  previewImage?: string | null
  sourceImage?: string | null
  config: StoredPuzzleConfig
  moves: number
  time: number
  actionMoves: number
  assistanceMode: StoredAssistanceMode
  hasDetailedProfile: boolean
  cropTransform?: StoredCropTransform | null
  useFullImage?: boolean
  replaySetup?: StoredGalleryReplaySetup
  imageTheme?: StoredImageThemePalette | null
} {
  if (!payload || typeof payload !== 'object') return false

  const input = payload as Record<string, unknown>
  return (
    (input.id === undefined || typeof input.id === 'string') &&
    (input.completedAt === undefined || input.completedAt === null || typeof input.completedAt === 'string') &&
    (input.previewImage === undefined || input.previewImage === null || typeof input.previewImage === 'string') &&
    (input.sourceImage === undefined || input.sourceImage === null || typeof input.sourceImage === 'string') &&
    isValidPuzzleConfig(input.config) &&
    typeof input.moves === 'number' &&
    Number.isFinite(input.moves) &&
    input.moves >= 0 &&
    typeof input.time === 'number' &&
    Number.isFinite(input.time) &&
    input.time >= 0 &&
    typeof input.actionMoves === 'number' &&
    Number.isFinite(input.actionMoves) &&
    input.actionMoves >= 0 &&
    (input.assistanceMode === 'clean' || input.assistanceMode === 'hinted' || input.assistanceMode === 'auto-assisted') &&
    typeof input.hasDetailedProfile === 'boolean' &&
    (
      input.replaySetup === undefined ||
      sanitizeGalleryReplaySetup(input.replaySetup, input.config as StoredPuzzleConfig) !== undefined
    )
  )
}

function validateGalleryDeletePayload(payload: unknown): payload is { ids: string[] } {
  if (!payload || typeof payload !== 'object') return false

  const input = payload as { ids?: unknown }
  return (
    Array.isArray(input.ids) &&
    input.ids.length > 0 &&
    input.ids.every((id) => typeof id === 'string' && id.length > 0)
  )
}

function validateGalleryTagsUpdatePayload(payload: unknown): payload is {
  action: UpdateGalleryTagsAction
  sourceLabel: string
  targetLabel?: string
} {
  if (!payload || typeof payload !== 'object') return false

  const input = payload as { action?: unknown; sourceLabel?: unknown; targetLabel?: unknown }
  return (
    (input.action === 'rename' || input.action === 'remove') &&
    typeof input.sourceLabel === 'string' &&
    sanitizeGalleryTagLabel(input.sourceLabel) !== null &&
    (
      input.action === 'remove' ||
      (typeof input.targetLabel === 'string' && sanitizeGalleryTagLabel(input.targetLabel) !== null)
    )
  )
}

async function deleteGalleryEntries(entryIds: string[]): Promise<StoredGalleryFile> {
  const idsToDelete = new Set(entryIds.filter((id) => typeof id === 'string' && id.length > 0))
  if (idsToDelete.size === 0) {
    return readGalleryFile()
  }

  const gallery = await readGalleryFile()
  const nextEntries = gallery.entries.filter((entry) => !idsToDelete.has(entry.id))

  if (nextEntries.length === gallery.entries.length) {
    return gallery
  }

  const nextGallery: StoredGalleryFile = {
    entries: nextEntries,
    lastUpdatedAt: new Date().toISOString(),
  }

  await writeGalleryFile(nextGallery)
  const collections = await readCollectionsFile(nextGallery)
  await writeCollectionsFile(collections)
  return nextGallery
}

function validateCreateCollectionPayload(payload: unknown): payload is {
  name: unknown
  description?: unknown
  imageIds?: unknown
} {
  if (!payload || typeof payload !== 'object') return false

  const input = payload as { name?: unknown; imageIds?: unknown }
  return (
    sanitizeCollectionText(input.name) !== null
    && (input.imageIds === undefined || Array.isArray(input.imageIds))
  )
}

function validateUpdateCollectionPayload(payload: unknown): payload is {
  name?: unknown
  description?: unknown
  imageIds?: unknown
} {
  if (!payload || typeof payload !== 'object') return false

  const input = payload as { name?: unknown; imageIds?: unknown }
  return (
    (input.name === undefined || sanitizeCollectionText(input.name) !== null)
    && (input.imageIds === undefined || Array.isArray(input.imageIds))
  )
}

function validateCollectionImagesPayload(payload: unknown): payload is { imageIds: string[] } {
  if (!payload || typeof payload !== 'object') return false

  const input = payload as { imageIds?: unknown }
  return (
    Array.isArray(input.imageIds)
    && input.imageIds.length > 0
    && input.imageIds.every((imageId) => typeof imageId === 'string' && imageId.length > 0)
  )
}

function getValidCollectionImageIds(payloadImageIds: unknown, gallery: StoredGalleryFile): string[] {
  return normalizeCollectionImageIdsByMotif(payloadImageIds, gallery)
}

async function createCollection(payload: {
  name: unknown
  description?: unknown
  imageIds?: unknown
}): Promise<StoredImageCollectionsFile> {
  const gallery = await readGalleryFile()
  const collections = await readCollectionsFile(gallery)
  const nowIso = new Date().toISOString()
  const name = sanitizeCollectionText(payload.name)
  if (!name) {
    throw new Error('Sammlungsname fehlt')
  }

  const description = sanitizeCollectionDescription(payload.description)
  const collection: StoredImageCollection = {
    id: randomUUID(),
    name,
    ...(description ? { description } : {}),
    createdAt: nowIso,
    updatedAt: nowIso,
    imageIds: getValidCollectionImageIds(payload.imageIds, gallery),
  }
  const nextCollections = {
    collections: [collection, ...collections.collections],
    lastUpdatedAt: nowIso,
  }

  await writeCollectionsFile(nextCollections)
  return nextCollections
}

async function updateCollection(
  collectionId: string,
  payload: {
    name?: unknown
    description?: unknown
    imageIds?: unknown
  }
): Promise<StoredImageCollectionsFile | null> {
  const gallery = await readGalleryFile()
  const collections = await readCollectionsFile(gallery)
  const existing = collections.collections.find((collection) => collection.id === collectionId)
  if (!existing) {
    return null
  }

  const nowIso = new Date().toISOString()
  const nextCollection: StoredImageCollection = {
    ...existing,
    ...(payload.name !== undefined ? { name: sanitizeCollectionText(payload.name) ?? existing.name } : {}),
    ...(payload.description !== undefined
      ? (() => {
          const description = sanitizeCollectionDescription(payload.description)
          return description ? { description } : { description: undefined }
        })()
      : {}),
    ...(payload.imageIds !== undefined ? { imageIds: getValidCollectionImageIds(payload.imageIds, gallery) } : {}),
    updatedAt: nowIso,
  }
  if (nextCollection.description === undefined) {
    delete nextCollection.description
  }

  const nextCollections = {
    collections: collections.collections
      .map((collection) => collection.id === collectionId ? nextCollection : collection)
      .sort((a, b) => getIsoTimestampValue(b.updatedAt) - getIsoTimestampValue(a.updatedAt)),
    lastUpdatedAt: nowIso,
  }

  await writeCollectionsFile(nextCollections)
  return nextCollections
}

async function deleteCollection(collectionId: string): Promise<StoredImageCollectionsFile | null> {
  const collections = await readCollectionsFile()
  const nextCollectionEntries = collections.collections.filter((collection) => collection.id !== collectionId)
  if (nextCollectionEntries.length === collections.collections.length) {
    return null
  }

  const nextCollections = {
    collections: nextCollectionEntries,
    lastUpdatedAt: new Date().toISOString(),
  }

  await writeCollectionsFile(nextCollections)
  return nextCollections
}

async function addCollectionImages(collectionId: string, imageIds: string[]): Promise<StoredImageCollectionsFile | null> {
  const gallery = await readGalleryFile()
  const validImageIds = getValidCollectionImageIds(imageIds, gallery)
  const collections = await readCollectionsFile(gallery)
  const existing = collections.collections.find((collection) => collection.id === collectionId)
  if (!existing) {
    return null
  }

  const nextImageIds = Array.from(new Set([...existing.imageIds, ...validImageIds]))
  return updateCollection(collectionId, { imageIds: nextImageIds })
}

async function removeCollectionImages(
  collectionId: string,
  imageIds: string[]
): Promise<StoredImageCollectionsFile | null> {
  const collections = await readCollectionsFile()
  const existing = collections.collections.find((collection) => collection.id === collectionId)
  if (!existing) {
    return null
  }

  const idsToRemove = new Set(imageIds)
  const nextImageIds = existing.imageIds.filter((imageId) => !idsToRemove.has(imageId))
  return updateCollection(collectionId, { imageIds: nextImageIds })
}

async function runPowerShellClipboardCommand(script: string, shouldTrimOutput = true): Promise<string> {
  if (process.platform !== 'win32') {
    throw new Error('Zwischenablage-Zugriff wird nur unter Windows unterstuetzt')
  }

  const { stdout } = await execFileAsync(
    POWERSHELL_PATH,
    ['-NoProfile', '-NonInteractive', '-Command', script],
    {
      maxBuffer: CLIPBOARD_COMMAND_MAX_BUFFER,
      windowsHide: true,
      encoding: 'utf8',
    }
  )

  return shouldTrimOutput ? stdout.trim() : stdout
}

async function hasClipboardImage(): Promise<boolean> {
  const result = await runPowerShellClipboardCommand(POWERSHELL_CLIPBOARD_IMAGE_STATUS_SCRIPT)
  return result === 'HAS_IMAGE'
}

async function readClipboardImageDataUrl(): Promise<string | null> {
  try {
    const base64 = await runPowerShellClipboardCommand(POWERSHELL_CLIPBOARD_IMAGE_READ_SCRIPT)
    return base64.length > 0 ? `data:image/png;base64,${base64}` : null
  } catch (error) {
    if (error instanceof Error && error.message.includes('NO_IMAGE')) {
      return null
    }

    throw error
  }
}

async function readClipboardText(): Promise<string | null> {
  const text = await runPowerShellClipboardCommand(POWERSHELL_CLIPBOARD_TEXT_READ_SCRIPT, false)
  return text.length > 0 ? text : null
}

async function handleClipboardApi(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void
): Promise<void> {
  const reqUrl = req.url ?? '/'
  const url = new URL(reqUrl, 'http://localhost')

  if (!url.pathname.startsWith('/api/clipboard')) {
    next()
    return
  }

  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true })
    return
  }

  const parts = url.pathname.split('/').filter(Boolean)

  try {
    if (req.method === 'GET' && parts.length === 4 && parts[2] === 'image' && parts[3] === 'status') {
      const response: ClipboardImageStatusResponse = {
        hasImage: await hasClipboardImage(),
      }
      sendJson(res, 200, response)
      return
    }

    if (req.method === 'GET' && parts.length === 3 && parts[2] === 'image') {
      const imageDataUrl = await readClipboardImageDataUrl()
      if (!imageDataUrl) {
        sendJson(res, 404, { error: 'In der Zwischenablage befindet sich kein Bild' })
        return
      }

      const response: ClipboardImageResponse = { imageDataUrl }
      sendJson(res, 200, response)
      return
    }

    if (req.method === 'GET' && parts.length === 3 && parts[2] === 'text') {
      const text = await readClipboardText()
      if (!text) {
        sendJson(res, 404, { error: 'In der Zwischenablage befindet sich kein Text' })
        return
      }

      const response: ClipboardTextResponse = { text }
      sendJson(res, 200, response)
      return
    }

    sendJson(res, 405, { error: 'Methode nicht erlaubt' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler'
    sendJson(res, 500, { error: message })
  }
}

async function handleSaveApi(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
  geminiGalleryConfig: GeminiGalleryConfig
): Promise<void> {
  const reqUrl = req.url ?? '/'
  const url = new URL(reqUrl, 'http://localhost')

  if (!url.pathname.startsWith('/api/saves')) {
    next()
    return
  }

  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true })
    return
  }

  const parts = url.pathname.split('/').filter(Boolean)
  const saveId = parts.length > 2 ? decodeURIComponent(parts[2]) : null

  try {
    if (req.method === 'GET' && parts.length === 2) {
      const saves = await listAllSaveSummaries()
      sendJson(res, 200, saves.slice(0, MAX_SAVED_GAMES))
      return
    }

    if (req.method === 'DELETE' && parts.length === 2) {
      await deleteAllSaves()
      sendJson(res, 200, { ok: true })
      return
    }

    if (req.method === 'POST' && parts.length === 2) {
      const body = await readJsonBody(req)
      if (!validateCreatePayload(body)) {
        sendJson(res, 400, { error: 'Ungueltige Nutzdaten fuer neuen Spielstand' })
        return
      }

      const nowIso = new Date().toISOString()
      const imageFingerprint = createImageFingerprint(body.previewImage) ?? createImageFingerprint(body.croppedImage)
      const imageTheme = sanitizeImageThemePalette(body.imageTheme)
      const reusableTitle = imageFingerprint
        ? await findReusableSaveTitleByFingerprint(imageFingerprint)
        : null
      const save: StoredSaveFile = {
        id: randomUUID(),
        name: reusableTitle?.name ?? generateSaveName(),
        createdAt: nowIso,
        updatedAt: nowIso,
        image: body.image,
        croppedImage: body.croppedImage,
        previewImage: body.previewImage,
        config: body.config,
        progress: sanitizeProgress(body.progress),
        ...(imageFingerprint ? { imageFingerprint } : {}),
        ...(imageTheme ? { imageTheme } : {}),
        ...(reusableTitle
          ? {
              titleSource: 'reused',
              aiTitle: {
                status: 'reused',
                provider: 'gemini',
                model: reusableTitle.aiTitle?.model ?? geminiGalleryConfig.model,
                generatedAt: nowIso,
                error: null,
                reusedFromSaveId: reusableTitle.id,
              },
            }
          : { titleSource: 'fallback' }),
      }

      await writeStructuredSave(save)
      await pruneSavesToRetentionLimit(MAX_SAVED_GAMES)
      sendJson(res, 201, toSummary(save))
      return
    }

    if (!saveId || !isValidSaveId(saveId)) {
      sendJson(res, 400, { error: 'Ungueltige Spielstand-ID' })
      return
    }

    if (req.method === 'GET' && parts.length === 3) {
      const existing = await readSaveById(saveId)
      if (!existing) {
        sendJson(res, 404, { error: 'Spielstand nicht gefunden' })
        return
      }

      sendJson(res, 200, {
        ...toSummary(existing),
        image: existing.image,
        croppedImage: existing.croppedImage,
        progress: sanitizeProgress(existing.progress),
      })
      return
    }

    if (req.method === 'PUT' && parts.length === 3) {
      const body = await readJsonBody(req)
      if (!validateUpdatePayload(body)) {
        sendJson(res, 400, { error: 'Ungueltige Nutzdaten fuer Spielstand-Update' })
        return
      }

      const updated = await updateSaveProgress(saveId, body.progress)
      if (!updated) {
        sendJson(res, 404, { error: 'Spielstand nicht gefunden' })
        return
      }

      sendJson(res, 200, updated)
      return
    }

    if (req.method === 'POST' && parts.length === 4 && parts[3] === 'title') {
      const existing = await readSaveById(saveId)
      if (!existing) {
        sendJson(res, 404, { error: 'Spielstand nicht gefunden' })
        return
      }

      const imageFingerprint =
        existing.imageFingerprint
        ?? createImageFingerprint(existing.previewImage)
        ?? createImageFingerprint(existing.croppedImage)
      const reusableTitle = imageFingerprint
        ? await findReusableSaveTitleByFingerprint(imageFingerprint, existing.id)
        : null

      if (reusableTitle) {
        const updated = await updateSaveTitleMetadata(existing.id, {
          name: reusableTitle.name,
          ...(imageFingerprint ? { imageFingerprint } : {}),
          titleSource: 'reused',
          aiTitle: {
            status: 'reused',
            provider: 'gemini',
            model: reusableTitle.aiTitle?.model ?? geminiGalleryConfig.model,
            generatedAt: new Date().toISOString(),
            error: null,
            reusedFromSaveId: reusableTitle.id,
          },
        })
        sendJson(res, 200, updated ?? toSummary(existing))
        return
      }

      const titleResult = await generateSaveTitleWithGemini({
        ...existing,
        ...(imageFingerprint ? { imageFingerprint } : {}),
      }, geminiGalleryConfig)
      const updated = await updateSaveTitleMetadata(existing.id, {
        ...(titleResult.title ? { name: titleResult.title } : {}),
        ...(imageFingerprint ? { imageFingerprint } : {}),
        titleSource: titleResult.title ? 'gemini' : 'fallback',
        aiTitle: titleResult.aiTitle,
      })

      sendJson(res, 200, updated ?? toSummary(existing))
      return
    }

    if (req.method === 'DELETE' && parts.length === 3) {
      await deleteSaveById(saveId)
      sendJson(res, 200, { ok: true })
      return
    }

    sendJson(res, 405, { error: 'Methode nicht erlaubt' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler'
    sendJson(res, 500, { error: message })
  }
}

async function handleBackupApi(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void
): Promise<void> {
  const reqUrl = req.url ?? '/'
  const url = new URL(reqUrl, 'http://localhost')

  if (!url.pathname.startsWith('/api/backup')) {
    next()
    return
  }

  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true })
    return
  }

  const parts = url.pathname.split('/').filter(Boolean)

  try {
    if (req.method === 'GET' && parts.length === 3 && parts[2] === 'files') {
      sendJson(res, 200, await listBackupFiles())
      return
    }

    if (req.method === 'POST' && parts.length === 3 && parts[2] === 'files') {
      sendJson(res, 201, await createBackupFile())
      return
    }

    if (req.method === 'DELETE' && parts.length === 4 && parts[2] === 'files') {
      const fileName = decodeURIComponent(parts[3] ?? '')
      if (!isValidBackupFileName(fileName)) {
        sendJson(res, 400, { error: 'Ungueltiger Backup-Dateiname' })
        return
      }

      try {
        await deleteBackupFile(fileName)
        sendJson(res, 200, { ok: true })
      } catch (error) {
        if (isMissingFileError(error)) {
          sendJson(res, 404, { error: 'Backup-Datei nicht gefunden' })
          return
        }

        throw error
      }

      return
    }

    if (req.method === 'POST' && parts.length === 5 && parts[2] === 'files' && parts[4] === 'import') {
      const fileName = decodeURIComponent(parts[3] ?? '')
      if (!isValidBackupFileName(fileName)) {
        sendJson(res, 400, { error: 'Ungueltiger Backup-Dateiname' })
        return
      }

      try {
        sendJson(res, 200, await importBackupFile(fileName))
      } catch (error) {
        if (isMissingFileError(error)) {
          sendJson(res, 404, { error: 'Backup-Datei nicht gefunden' })
          return
        }

        throw error
      }

      return
    }

    if (req.method === 'GET' && parts.length === 2) {
      sendJson(res, 200, await buildBackupResponse())
      return
    }

    if (req.method === 'POST' && parts.length === 2) {
      const body = await readJsonBody(req)
      if (!validateBackupPayload(body)) {
        sendJson(res, 400, { error: 'Ungueltige Nutzdaten fuer Backup-Import' })
        return
      }

      sendJson(res, 200, await importBackupPayload(body))
      return
    }

    sendJson(res, 405, { error: 'Methode nicht erlaubt' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler'
    sendJson(res, 500, { error: message })
  }
}

async function handleGalleryApi(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
  geminiGalleryConfig: GeminiGalleryConfig
): Promise<void> {
  const reqUrl = req.url ?? '/'
  const url = new URL(reqUrl, 'http://localhost')

  if (!url.pathname.startsWith('/api/gallery')) {
    next()
    return
  }

  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true })
    return
  }

  const parts = url.pathname.split('/').filter(Boolean)

  try {
    if (req.method === 'GET' && parts.length === 2) {
      const gallery = await readGalleryFile()
      sendJson(res, 200, toGalleryResponse(gallery))
      return
    }

    if (req.method === 'POST' && parts.length === 4 && parts[3] === 'analyze') {
      const entryId = decodeURIComponent(parts[2])
      if (!isValidSaveId(entryId)) {
        sendJson(res, 400, { error: 'Ungueltige Galerie-ID' })
        return
      }

      const analysis = await analyzeGalleryEntry(entryId, geminiGalleryConfig)
      if (!analysis) {
        sendJson(res, 404, { error: 'Galerie-Eintrag nicht gefunden' })
        return
      }

      sendJson(res, 200, analysis)
      return
    }

    if (req.method === 'PUT' && parts.length === 3 && parts[2] === 'tags') {
      const body = await readJsonBody(req)
      if (!validateGalleryTagsUpdatePayload(body)) {
        sendJson(res, 400, { error: 'Ungueltige Nutzdaten fuer Galerie-Tags' })
        return
      }

      const nextGallery = await updateGalleryTags(body)
      sendJson(res, 200, toGalleryResponse(nextGallery))
      return
    }

    if (req.method === 'DELETE' && parts.length === 3 && parts[2] === 'entries') {
      const body = await readJsonBody(req)
      if (!validateGalleryDeletePayload(body)) {
        sendJson(res, 400, { error: 'Ungueltige Nutzdaten fuer Galerie-Loeschung' })
        return
      }

      const nextGallery = await deleteGalleryEntries(body.ids)
      sendJson(res, 200, toGalleryResponse(nextGallery))
      return
    }

    if (req.method === 'DELETE' && parts.length === 2) {
      const emptyGallery = createEmptyGalleryFile()
      await Promise.all([
        writeGalleryFile(emptyGallery),
        writeCollectionsFile(createEmptyCollectionsFile()),
      ])
      sendJson(res, 200, toGalleryResponse(emptyGallery))
      return
    }

    if (req.method === 'POST' && parts.length === 2) {
      const body = await readJsonBody(req)
      if (!validateGalleryPayload(body)) {
        sendJson(res, 400, { error: 'Ungueltige Nutzdaten fuer Galerie-Eintrag' })
        return
      }

      const gallery = await readGalleryFile()
      const nowIso = new Date().toISOString()
      const moves = sanitizeCount(body.moves)
      const completedAt = typeof body.completedAt === 'string' && body.completedAt.length > 0
        ? body.completedAt
        : nowIso
      const previewImage = sanitizeOptionalPreviewImage(body.previewImage)
      const sourceImage = sanitizeOptionalPreviewImage(body.sourceImage) ?? previewImage
      const imageTheme = sanitizeImageThemePalette(body.imageTheme)
      const entry: StoredGalleryEntry = {
        id: typeof body.id === 'string' && body.id.length > 0 ? body.id : randomUUID(),
        completedAt,
        previewImage,
        sourceImage,
        config: body.config,
        moves,
        time: sanitizeCount(body.time),
        actionMoves: Math.max(moves, sanitizeCount(body.actionMoves)),
        assistanceMode: body.assistanceMode,
        hasDetailedProfile: body.hasDetailedProfile,
        cropTransform: sanitizeCropTransform(body.cropTransform),
        useFullImage: typeof body.useFullImage === 'boolean' ? body.useFullImage : undefined,
        replaySetup: sanitizeGalleryReplaySetup(body.replaySetup, body.config),
        ...(imageTheme ? { imageTheme } : {}),
        aiTagging: {
          status: 'pending',
          provider: 'gemini',
          model: geminiGalleryConfig.model,
          generatedAt: null,
          error: null,
          collectionSuggestions: [],
        },
      }

      const nextGallery: StoredGalleryFile = {
        entries: [entry, ...gallery.entries.filter((existing) => existing.id !== entry.id)]
          .sort((a, b) => getIsoTimestampValue(b.completedAt) - getIsoTimestampValue(a.completedAt)),
        lastUpdatedAt: nowIso,
      }

      await writeGalleryFile(nextGallery)
      sendJson(res, 201, toGalleryResponse(nextGallery))
      return
    }

    sendJson(res, 405, { error: 'Methode nicht erlaubt' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler'
    sendJson(res, 500, { error: message })
  }
}

async function handleCollectionsApi(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void
): Promise<void> {
  const reqUrl = req.url ?? '/'
  const url = new URL(reqUrl, 'http://localhost')

  if (!url.pathname.startsWith('/api/collections')) {
    next()
    return
  }

  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true })
    return
  }

  const parts = url.pathname.split('/').filter(Boolean)
  const collectionId = parts.length > 2 ? decodeURIComponent(parts[2]) : null

  try {
    if (req.method === 'GET' && parts.length === 2) {
      sendJson(res, 200, toCollectionsResponse(await readCollectionsFile()))
      return
    }

    if (req.method === 'POST' && parts.length === 2) {
      const body = await readJsonBody(req)
      if (!validateCreateCollectionPayload(body)) {
        sendJson(res, 400, { error: 'Ungueltige Nutzdaten fuer neue Sammlung' })
        return
      }

      sendJson(res, 201, toCollectionsResponse(await createCollection(body)))
      return
    }

    if (!collectionId || !isValidSaveId(collectionId)) {
      sendJson(res, 400, { error: 'Ungueltige Sammlungs-ID' })
      return
    }

    if (req.method === 'PUT' && parts.length === 3) {
      const body = await readJsonBody(req)
      if (!validateUpdateCollectionPayload(body)) {
        sendJson(res, 400, { error: 'Ungueltige Nutzdaten fuer Sammlung' })
        return
      }

      const collections = await updateCollection(collectionId, body)
      if (!collections) {
        sendJson(res, 404, { error: 'Sammlung nicht gefunden' })
        return
      }

      sendJson(res, 200, toCollectionsResponse(collections))
      return
    }

    if (req.method === 'DELETE' && parts.length === 3) {
      const collections = await deleteCollection(collectionId)
      if (!collections) {
        sendJson(res, 404, { error: 'Sammlung nicht gefunden' })
        return
      }

      sendJson(res, 200, toCollectionsResponse(collections))
      return
    }

    if ((req.method === 'POST' || req.method === 'DELETE') && parts.length === 4 && parts[3] === 'images') {
      const body = await readJsonBody(req)
      if (!validateCollectionImagesPayload(body)) {
        sendJson(res, 400, { error: 'Ungueltige Bildauswahl fuer Sammlung' })
        return
      }

      const collections = req.method === 'POST'
        ? await addCollectionImages(collectionId, body.imageIds)
        : await removeCollectionImages(collectionId, body.imageIds)

      if (!collections) {
        sendJson(res, 404, { error: 'Sammlung nicht gefunden' })
        return
      }

      sendJson(res, 200, toCollectionsResponse(collections))
      return
    }

    sendJson(res, 405, { error: 'Methode nicht erlaubt' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler'
    sendJson(res, 500, { error: message })
  }
}

async function handleGeneratedImageApi(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
  config: GeneratedImageConfig
): Promise<void> {
  const reqUrl = req.url ?? '/'
  const url = new URL(reqUrl, 'http://localhost')

  if (!url.pathname.startsWith('/api/generated-image')) {
    next()
    return
  }

  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true })
    return
  }

  const parts = url.pathname.split('/').filter(Boolean)

  try {
    if (req.method === 'POST' && parts.length === 2) {
      const body = await readJsonBody(req)
      if (!isGeneratedImageRequest(body)) {
        sendJson(res, 400, { error: 'Ungueltige Nutzdaten fuer KI-Bildgenerierung' })
        return
      }

      const prompt = normalizeGeneratedImagePrompt(body.prompt)
      if (!prompt) {
        sendJson(res, 400, { error: 'Bitte gib zuerst einen Prompt ein' })
        return
      }

      if (prompt.length > MAX_GENERATED_IMAGE_PROMPT_LENGTH) {
        sendJson(res, 400, { error: `Der Prompt darf maximal ${MAX_GENERATED_IMAGE_PROMPT_LENGTH} Zeichen lang sein` })
        return
      }

      sendJson(res, 201, await generateImageWithFallback(prompt, config))
      return
    }

    sendJson(res, 405, { error: 'Methode nicht erlaubt' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler'
    sendJson(res, 500, { error: message })
  }
}

async function handleStatsApi(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void
): Promise<void> {
  const reqUrl = req.url ?? '/'
  const url = new URL(reqUrl, 'http://localhost')

  if (!url.pathname.startsWith('/api/stats')) {
    next()
    return
  }

  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true })
    return
  }

  const parts = url.pathname.split('/').filter(Boolean)

  try {
    if (req.method === 'POST' && parts.length === 3 && parts[2] === 'exports') {
      const body = await readJsonBody(req)
      if (!validateStatsExportPayload(body)) {
        sendJson(res, 400, { error: 'Ungueltige Nutzdaten fuer Statistik-Export' })
        return
      }

      sendJson(res, 201, await createStatsExportFile(body))
      return
    }

    if (req.method === 'GET' && parts.length === 2) {
      const stats = await readStatsFile()
      sendJson(res, 200, toStatsResponse(stats))
      return
    }

    if (req.method === 'DELETE' && parts.length === 2) {
      const emptyStats = createEmptyStatsFile()
      await writeStatsFile(emptyStats)
      sendJson(res, 200, toStatsResponse(emptyStats))
      return
    }

    if (req.method === 'POST' && parts.length === 3 && parts[2] === 'completions') {
      const body = await readJsonBody(req)
      if (!validateCompletionPayload(body)) {
        sendJson(res, 400, { error: 'Ungueltige Nutzdaten fuer Statistik-Update' })
        return
      }

      const stats = await readStatsFile()
      const moves = sanitizeCount(body.moves)
      const time = sanitizeCount(body.time)
      const actionMoves = Math.max(moves, sanitizeCount(body.actionMoves))
      const undoCount = sanitizeCount(body.undoCount)
      const redoCount = sanitizeCount(body.redoCount)
      const hintCount = sanitizeCount(body.hintCount)
      const suggestedMoveCount = sanitizeCount(body.suggestedMoveCount)
      const assistanceMode = deriveAssistanceMode({ hintCount, suggestedMoveCount })
      const nowIso = new Date().toISOString()
      const previousHistory = getCompletionHistoryForConfig(stats.completionHistory, body.config)
      const previousCompletion = previousHistory[0] ?? null
      const previousRecentMedianMoves = previousHistory.length > 0
        ? calculateRecentMedian(previousHistory.map((entry) => entry.moves))
        : null
      const previousRecentMedianTime = previousHistory.length > 0
        ? calculateRecentMedian(previousHistory.map((entry) => entry.time))
        : null
      const completion: StoredCompletionRecord = {
        id: randomUUID(),
        completedAt: nowIso,
        previewImage: sanitizeOptionalPreviewImage(body.previewImage),
        config: body.config,
        moves,
        actionMoves,
        time,
        undoCount,
        redoCount,
        hintCount,
        suggestedMoveCount,
        assistanceMode,
        hasDetailedProfile: true,
      }

      stats.totalSolved += 1
      stats.totalMoves += moves
      stats.totalTime += time
      stats.lastUpdatedAt = nowIso

      if (assistanceMode === 'clean') {
        stats.cleanSolvedCount += 1
      } else {
        stats.assistedSolvedCount += 1
        if (assistanceMode === 'auto-assisted') {
          stats.autoAssistedSolvedCount += 1
        }
      }

      if (stats.bestMoves === null || moves < stats.bestMoves) {
        stats.bestMoves = moves
      }
      if (stats.bestTime === null || time < stats.bestTime) {
        stats.bestTime = time
      }

      const isCleanRun = assistanceMode === 'clean'
      if (isCleanRun && (stats.bestCleanMoves === null || moves < stats.bestCleanMoves)) {
        stats.bestCleanMoves = moves
      }
      if (isCleanRun && (stats.bestCleanTime === null || time < stats.bestCleanTime)) {
        stats.bestCleanTime = time
      }

      let difficultyStats = stats.byDifficulty.find(
        (entry) => entry.config.rows === body.config.rows && entry.config.cols === body.config.cols
      )

      if (!difficultyStats) {
        difficultyStats = {
          config: body.config,
          solveCount: 0,
          cleanSolveCount: 0,
          assistedSolveCount: 0,
          autoAssistedSolveCount: 0,
          totalMoves: 0,
          totalActionMoves: 0,
          totalTime: 0,
          bestMoves: null,
          bestCleanMoves: null,
          bestTime: null,
          bestCleanTime: null,
          lastCompletedAt: null,
        }
        stats.byDifficulty.push(difficultyStats)
      }

      const isNewBestMoves = difficultyStats.bestMoves === null || moves < difficultyStats.bestMoves
      const isNewBestTime = difficultyStats.bestTime === null || time < difficultyStats.bestTime
      const isNewBestCleanMoves = isCleanRun
        && (difficultyStats.bestCleanMoves === null || moves < difficultyStats.bestCleanMoves)
      const isNewBestCleanTime = isCleanRun
        && (difficultyStats.bestCleanTime === null || time < difficultyStats.bestCleanTime)

      difficultyStats.solveCount += 1
      difficultyStats.totalMoves += moves
      difficultyStats.totalActionMoves += actionMoves
      difficultyStats.totalTime += time
      difficultyStats.lastCompletedAt = nowIso

      if (isCleanRun) {
        difficultyStats.cleanSolveCount += 1
      } else {
        difficultyStats.assistedSolveCount += 1
        if (assistanceMode === 'auto-assisted') {
          difficultyStats.autoAssistedSolveCount += 1
        }
      }

      if (isNewBestMoves) {
        difficultyStats.bestMoves = moves
      }
      if (isNewBestTime) {
        difficultyStats.bestTime = time
      }
      if (isNewBestCleanMoves) {
        difficultyStats.bestCleanMoves = moves
      }
      if (isNewBestCleanTime) {
        difficultyStats.bestCleanTime = time
      }

      stats.byDifficulty.sort((a, b) => comparePuzzleConfig(a.config, b.config))
      stats.completionHistory = [completion, ...stats.completionHistory]
        .sort((a, b) => getIsoTimestampValue(b.completedAt) - getIsoTimestampValue(a.completedAt))

      await writeStatsFile(stats)

      const response: RecordCompletionResponse = {
        stats: toStatsResponse(stats),
        completion,
        difficultyStats: toDifficultyStatsResponse(difficultyStats, stats.completionHistory),
        previousCompletion,
        previousRecentMedianMoves,
        previousRecentMedianTime,
        isNewBestMoves,
        isNewBestTime,
        isNewBestCleanMoves,
        isNewBestCleanTime,
      }

      sendJson(res, 201, response)
      return
    }

    sendJson(res, 405, { error: 'Methode nicht erlaubt' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler'
    sendJson(res, 500, { error: message })
  }
}

function isMusicProviderId(value: string | null | undefined): value is MusicProviderId {
  return (
    value === 'jamendo' ||
    value === 'openverse' ||
    value === 'ccmixter' ||
    value === 'wikimedia-commons' ||
    value === 'internet-archive' ||
    value === 'local-fallback'
  )
}

async function handleMusicApi(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
  musicProviderCoordinator: MusicProviderCoordinator
): Promise<void> {
  const reqUrl = req.url ?? '/'
  const url = new URL(reqUrl, 'http://localhost')

  if (!url.pathname.startsWith('/api/music')) {
    next()
    return
  }

  try {
    const parts = url.pathname.split('/').filter(Boolean)
    if (req.method === 'GET' && parts.length === 3 && parts[2] === 'next') {
      const styleId = url.searchParams.get('style')
      if (!styleId || !isMusicStyleId(styleId)) {
        sendJson(res, 400, { error: 'Ungueltiger Musikstil' })
        return
      }

      const excludeTrackIds = url.searchParams
        .getAll('exclude')
        .map((value) => value.trim())
        .filter(Boolean)
      const failedTrackId = url.searchParams.get('failedTrackId')?.trim() ?? null
      const failedProviderRaw = url.searchParams.get('failedProvider')?.trim() ?? null
      const failureReason = url.searchParams.get('failureReason')?.trim() ?? null
      const failedProvider = isMusicProviderId(failedProviderRaw) ? failedProviderRaw : null

      const response = await musicProviderCoordinator.pickTrack({
        styleId,
        excludeTrackIds,
        allowFallback: url.searchParams.get('allowFallback') !== 'false',
        failedTrackId,
        failedProvider,
        failureReason,
      })

      sendJson(res, 200, response)
      return
    }

    sendJson(res, 405, { error: 'Methode nicht erlaubt' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler'
    sendJson(res, 500, { error: message })
  }
}

async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
  musicProviderCoordinator: MusicProviderCoordinator,
  generatedImageConfig: GeneratedImageConfig,
  geminiGalleryConfig: GeminiGalleryConfig
): Promise<void> {
  const reqUrl = req.url ?? '/'
  const url = new URL(reqUrl, 'http://localhost')

  if (url.pathname.startsWith('/api/saves')) {
    await handleSaveApi(req, res, next, geminiGalleryConfig)
    return
  }

  if (url.pathname.startsWith('/api/backup')) {
    await handleBackupApi(req, res, next)
    return
  }

  if (url.pathname.startsWith('/api/clipboard')) {
    await handleClipboardApi(req, res, next)
    return
  }

  if (url.pathname.startsWith('/api/stats')) {
    await handleStatsApi(req, res, next)
    return
  }

  if (url.pathname.startsWith('/api/gallery')) {
    await handleGalleryApi(req, res, next, geminiGalleryConfig)
    return
  }

  if (url.pathname.startsWith('/api/collections')) {
    await handleCollectionsApi(req, res, next)
    return
  }

  if (url.pathname.startsWith('/api/generated-image')) {
    await handleGeneratedImageApi(req, res, next, generatedImageConfig)
    return
  }

  if (url.pathname.startsWith('/api/music')) {
    await handleMusicApi(req, res, next, musicProviderCoordinator)
    return
  }

  next()
}

export function apiPlugin(options: LocalApiPluginOptions = {}): Plugin {
  const musicProviderCoordinator = new MusicProviderCoordinator(options.jamendoClientId ?? '')
  const generatedImageConfig: GeneratedImageConfig = {
    pollinations: {
      apiKey: options.pollinationsApiKey ?? '',
      model: options.pollinationsImageModel || POLLINATIONS_GENERATED_IMAGE_MODEL,
    },
    cloudflare: {
      accountId: options.cloudflareAccountId ?? '',
      apiToken: options.cloudflareApiToken ?? '',
      model: options.cloudflareImageModel || CLOUDFLARE_GENERATED_IMAGE_MODEL,
    },
  }
  const geminiGalleryConfig: GeminiGalleryConfig = {
    apiKey: options.geminiApiKey ?? '',
    model: options.geminiGalleryModel || GEMINI_GALLERY_MODEL,
  }

  return {
    name: 'schiebepuzzle-local-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void handleApiRequest(req, res, next, musicProviderCoordinator, generatedImageConfig, geminiGalleryConfig)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        void handleApiRequest(req, res, next, musicProviderCoordinator, generatedImageConfig, geminiGalleryConfig)
      })
    },
  }
}













