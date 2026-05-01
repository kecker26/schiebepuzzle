import type { HistoryFilter, UploadWorkspaceWindow } from '../screens/upload/uploadUtils.ts'

const LAST_SESSION_STORAGE_KEY = 'schiebepuzzle.last-session.v1'

export interface LastSessionSnapshot {
  version: 1
  updatedAt: number
  target: 'save' | 'upload' | 'crop'
  saveId: string | null
  uploadWindow: UploadWorkspaceWindow
  historyFilter: HistoryFilter
}

interface LastSessionSnapshotInput {
  updatedAt?: number
  target: 'save' | 'upload' | 'crop'
  saveId?: string | null
  uploadWindow?: UploadWorkspaceWindow
  historyFilter?: HistoryFilter
}

function isUploadWorkspaceWindow(value: unknown): value is UploadWorkspaceWindow {
  return value === 'start' || value === 'savedGames' || value === 'stats' || value === 'gallery'
}

function isHistoryFilter(value: unknown): value is HistoryFilter {
  return value === 'all' || (typeof value === 'string' && /^\d+x\d+$/.test(value))
}

function isLastSessionSnapshot(input: unknown): input is LastSessionSnapshot {
  if (!input || typeof input !== 'object') {
    return false
  }

  const candidate = input as Partial<LastSessionSnapshot>
  return candidate.version === 1
    && (candidate.target === 'save' || candidate.target === 'upload' || candidate.target === 'crop')
    && (candidate.saveId === null || typeof candidate.saveId === 'string')
    && typeof candidate.updatedAt === 'number'
    && Number.isFinite(candidate.updatedAt)
    && isUploadWorkspaceWindow(candidate.uploadWindow)
    && isHistoryFilter(candidate.historyFilter)
}

export function readLastSessionSnapshot(): LastSessionSnapshot | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const rawValue = window.localStorage.getItem(LAST_SESSION_STORAGE_KEY)
    if (!rawValue) {
      return null
    }

    const parsedValue = JSON.parse(rawValue) as unknown
    return isLastSessionSnapshot(parsedValue) ? parsedValue : null
  } catch {
    return null
  }
}

export function writeLastSessionSnapshot(input: LastSessionSnapshotInput): LastSessionSnapshot {
  const snapshot: LastSessionSnapshot = {
    version: 1,
    updatedAt: typeof input.updatedAt === 'number' && Number.isFinite(input.updatedAt)
      ? input.updatedAt
      : Date.now(),
    target: input.target,
    saveId: typeof input.saveId === 'string' && input.saveId.length > 0 ? input.saveId : null,
    uploadWindow: isUploadWorkspaceWindow(input.uploadWindow) ? input.uploadWindow : 'start',
    historyFilter: isHistoryFilter(input.historyFilter) ? input.historyFilter : 'all',
  }

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LAST_SESSION_STORAGE_KEY, JSON.stringify(snapshot))
    } catch {
      // Ignore storage failures. Session restore is best-effort only.
    }
  }

  return snapshot
}

export function clearLastSessionSnapshot(): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.removeItem(LAST_SESSION_STORAGE_KEY)
  } catch {
    // Ignore storage failures. Session restore is best-effort only.
  }
}
