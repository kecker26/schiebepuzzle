import { createDefaultCropTransform, type CropTransform } from '../services/CropService.ts'
import type { RandomImageSourceInfo } from '../services/RandomImageService.ts'
import type { PuzzleConfig } from '../types/index'

const CROP_DRAFT_SESSION_STORAGE_KEY = 'schiebepuzzle.crop-draft-session.v1'
const LEGACY_CROP_DRAFT_SESSION_STORAGE_KEY = CROP_DRAFT_SESSION_STORAGE_KEY

export interface CropDraftSnapshot {
  version: 1
  updatedAt: number
  image: string
  config: PuzzleConfig
  isRandomImage: boolean
  randomImageSource: RandomImageSourceInfo | null
  transform: CropTransform
  useFullImage: boolean
}

interface CropDraftSnapshotInput {
  updatedAt?: number
  image: string
  config: PuzzleConfig
  isRandomImage?: boolean
  randomImageSource?: RandomImageSourceInfo | null
  transform?: CropTransform
  useFullImage?: boolean
}

function isPuzzleConfig(value: unknown): value is PuzzleConfig {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<PuzzleConfig>
  return typeof candidate.rows === 'number'
    && Number.isFinite(candidate.rows)
    && candidate.rows > 0
    && typeof candidate.cols === 'number'
    && Number.isFinite(candidate.cols)
    && candidate.cols > 0
}

function isRandomImageSourceInfo(value: unknown): value is RandomImageSourceInfo | null {
  if (value === null || typeof value === 'undefined') {
    return true
  }

  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<RandomImageSourceInfo>
  return typeof candidate.label === 'string'
    && candidate.label.length > 0
    && (
      typeof candidate.url === 'undefined'
      || candidate.url === null
      || typeof candidate.url === 'string'
    )
}

function isCropTransform(value: unknown): value is CropTransform {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<CropTransform>
  return typeof candidate.zoom === 'number'
    && Number.isFinite(candidate.zoom)
    && typeof candidate.rotationDeg === 'number'
    && Number.isFinite(candidate.rotationDeg)
    && typeof candidate.offsetX === 'number'
    && Number.isFinite(candidate.offsetX)
    && typeof candidate.offsetY === 'number'
    && Number.isFinite(candidate.offsetY)
}

function isCropDraftSnapshot(value: unknown): value is CropDraftSnapshot {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<CropDraftSnapshot>
  return candidate.version === 1
    && typeof candidate.updatedAt === 'number'
    && Number.isFinite(candidate.updatedAt)
    && typeof candidate.image === 'string'
    && candidate.image.length > 0
    && isPuzzleConfig(candidate.config)
    && typeof candidate.isRandomImage === 'boolean'
    && isRandomImageSourceInfo(candidate.randomImageSource)
    && isCropTransform(candidate.transform)
    && typeof candidate.useFullImage === 'boolean'
}

export function readCropDraftSessionSnapshot(): CropDraftSnapshot | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const rawValue = window.localStorage.getItem(CROP_DRAFT_SESSION_STORAGE_KEY)
    if (rawValue) {
      const parsedValue = JSON.parse(rawValue) as unknown
      return isCropDraftSnapshot(parsedValue) ? parsedValue : null
    }
  } catch {
    return null
  }

  try {
    const legacyRawValue = window.sessionStorage.getItem(LEGACY_CROP_DRAFT_SESSION_STORAGE_KEY)
    if (!legacyRawValue) {
      return null
    }

    const parsedLegacyValue = JSON.parse(legacyRawValue) as unknown
    if (!isCropDraftSnapshot(parsedLegacyValue)) {
      return null
    }

    try {
      window.localStorage.setItem(CROP_DRAFT_SESSION_STORAGE_KEY, JSON.stringify(parsedLegacyValue))
      window.sessionStorage.removeItem(LEGACY_CROP_DRAFT_SESSION_STORAGE_KEY)
    } catch {
      // Ignore migration failures. Crop restore is best-effort only.
    }

    return parsedLegacyValue
  } catch {
    return null
  }
}

export function writeCropDraftSessionSnapshot(input: CropDraftSnapshotInput): CropDraftSnapshot {
  const snapshot: CropDraftSnapshot = {
    version: 1,
    updatedAt: typeof input.updatedAt === 'number' && Number.isFinite(input.updatedAt)
      ? input.updatedAt
      : Date.now(),
    image: input.image,
    config: input.config,
    isRandomImage: input.isRandomImage ?? false,
    randomImageSource: isRandomImageSourceInfo(input.randomImageSource) ? input.randomImageSource ?? null : null,
    transform: isCropTransform(input.transform) ? input.transform : createDefaultCropTransform(),
    useFullImage: input.useFullImage ?? false,
  }

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(CROP_DRAFT_SESSION_STORAGE_KEY, JSON.stringify(snapshot))
    } catch {
      // Ignore storage failures. Crop restore is best-effort only.
    }
  }

  return snapshot
}

export function clearCropDraftSessionSnapshot(): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.removeItem(CROP_DRAFT_SESSION_STORAGE_KEY)
    window.sessionStorage.removeItem(LEGACY_CROP_DRAFT_SESSION_STORAGE_KEY)
  } catch {
    // Ignore storage failures. Crop restore is best-effort only.
  }
}
