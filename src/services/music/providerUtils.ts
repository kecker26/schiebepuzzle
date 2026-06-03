const DEFAULT_REQUEST_TIMEOUT_MS = 12000

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function firstString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }

    if (Array.isArray(value)) {
      const firstEntry = value.find((entry) => typeof entry === 'string' && entry.trim().length > 0)
      if (typeof firstEntry === 'string') {
        return firstEntry.trim()
      }
    }
  }

  return null
}

export function firstNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }

    if (typeof value === 'string') {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }

  return null
}

export function normalizeAbsoluteUrl(value: string | null | undefined, baseUrl?: string): string | null {
  if (!value) return null

  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    return new URL(trimmed, baseUrl).toString()
  } catch {
    return null
  }
}

export function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false
    }

    seen.add(item.id)
    return true
  })
}

export async function fetchJsonWithTimeout<T>(
  url: string,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return (await response.json()) as T
  } finally {
    clearTimeout(timeoutId)
  }
}

export function buildRecentMemory<T extends string>(recentItems: T[], nextItem: T, maxLength: number): T[] {
  return [nextItem, ...recentItems.filter((item) => item !== nextItem)].slice(0, maxLength)
}

export function formatCreativeCommonsLicense(value: string | null | undefined): string | null {
  if (!value) return null
  const lower = value.toLowerCase()

  if (lower.includes('publicdomain/zero') || lower.includes('cc0')) return 'CC0'
  if (lower.includes('/by-sa/')) return 'CC BY-SA'
  if (lower.includes('/by/')) return 'CC BY'
  if (lower.includes('public domain')) return 'Public Domain'
  if (lower.includes('creative commons')) return 'Creative Commons'

  return null
}
