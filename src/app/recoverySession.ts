const RECOVERY_SESSION_STORAGE_KEY = 'schiebepuzzle.recovery-session.v1'
const RECOVERY_IGNORE_STORAGE_KEY = 'schiebepuzzle.recovery-session.ignore.v1'

export interface RecoverySessionSnapshot {
  version: 1
  saveId: string
  interruptedAt: number
}

interface RecoveryIgnoreSnapshot {
  version: 1
  saveId: string
}

function isRecoverySessionSnapshot(input: unknown): input is RecoverySessionSnapshot {
  if (!input || typeof input !== 'object') {
    return false
  }

  const candidate = input as Partial<RecoverySessionSnapshot>
  return candidate.version === 1
    && typeof candidate.saveId === 'string'
    && candidate.saveId.length > 0
    && typeof candidate.interruptedAt === 'number'
    && Number.isFinite(candidate.interruptedAt)
}

function isRecoveryIgnoreSnapshot(input: unknown): input is RecoveryIgnoreSnapshot {
  if (!input || typeof input !== 'object') {
    return false
  }

  const candidate = input as Partial<RecoveryIgnoreSnapshot>
  return candidate.version === 1
    && typeof candidate.saveId === 'string'
    && candidate.saveId.length > 0
}

export function readRecoverySessionSnapshot(): RecoverySessionSnapshot | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const rawValue = window.localStorage.getItem(RECOVERY_SESSION_STORAGE_KEY)
    if (!rawValue) {
      return null
    }

    const parsedValue = JSON.parse(rawValue) as unknown
    return isRecoverySessionSnapshot(parsedValue) ? parsedValue : null
  } catch {
    return null
  }
}

export function readIgnoredRecoverySaveId(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const rawValue = window.localStorage.getItem(RECOVERY_IGNORE_STORAGE_KEY)
    if (!rawValue) {
      return null
    }

    const parsedValue = JSON.parse(rawValue) as unknown
    return isRecoveryIgnoreSnapshot(parsedValue) ? parsedValue.saveId : null
  } catch {
    return null
  }
}

export function writeRecoverySessionSnapshot(saveId: string): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const snapshot: RecoverySessionSnapshot = {
      version: 1,
      saveId,
      interruptedAt: Date.now(),
    }
    window.localStorage.setItem(RECOVERY_SESSION_STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // Ignore storage failures. Recovery is best-effort only.
  }
}

export function writeIgnoredRecoverySaveId(saveId: string): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const snapshot: RecoveryIgnoreSnapshot = {
      version: 1,
      saveId,
    }
    window.localStorage.setItem(RECOVERY_IGNORE_STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // Ignore storage failures. Recovery preferences are best-effort only.
  }
}

export function clearRecoverySessionSnapshot(): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.removeItem(RECOVERY_SESSION_STORAGE_KEY)
  } catch {
    // Ignore storage failures. Recovery is best-effort only.
  }
}

export function clearIgnoredRecoverySaveId(saveId?: string | null): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (typeof saveId === 'string' && saveId.length > 0) {
      const currentSaveId = readIgnoredRecoverySaveId()
      if (currentSaveId !== saveId) {
        return
      }
    }

    window.localStorage.removeItem(RECOVERY_IGNORE_STORAGE_KEY)
  } catch {
    // Ignore storage failures. Recovery preferences are best-effort only.
  }
}
