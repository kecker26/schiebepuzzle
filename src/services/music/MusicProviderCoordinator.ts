import type { MusicStyleId } from '../musicStyles.ts'
import CcMixterMusicProvider from './providers/CcMixterMusicProvider.ts'
import InternetArchiveMusicProvider from './providers/InternetArchiveMusicProvider.ts'
import JamendoMusicProvider from './providers/JamendoMusicProvider.ts'
import LocalFallbackMusicProvider from './providers/LocalFallbackMusicProvider.ts'
import OpenverseMusicProvider from './providers/OpenverseMusicProvider.ts'
import WikimediaCommonsMusicProvider from './providers/WikimediaCommonsMusicProvider.ts'
import type { MusicProvider, MusicProviderId, MusicTrackRequest, MusicTrackResponse } from './types.ts'

interface ProviderHealth {
  failureCount: number
  cooldownUntil: number
}

const SOFT_FAILURE_COOLDOWNS_MS = [4000, 12000, 30000]
const HARD_FAILURE_COOLDOWNS_MS = [10000, 30000, 90000]
const PRIMARY_PROVIDER_ID = 'jamendo' as const
const PRIMARY_PROVIDER_TIMEOUT_MS = 4500
const BACKUP_PROVIDER_TOTAL_BUDGET_MS = 4000
const PROVIDER_TIMEOUT_MS: Record<MusicProviderId, number> = {
  jamendo: PRIMARY_PROVIDER_TIMEOUT_MS,
  openverse: 1800,
  ccmixter: 1800,
  'wikimedia-commons': 2000,
  'internet-archive': 1500,
  'local-fallback': 0,
}

export default class MusicProviderCoordinator {
  private readonly remoteProviders: MusicProvider[]
  private readonly localFallbackProvider: MusicProvider
  private readonly providerHealthById = new Map<MusicProviderId, ProviderHealth>()
  private readonly nextProviderOffsetByStyle = new Map<MusicStyleId, number>()

  constructor(jamendoClientId: string) {
    this.remoteProviders = [
      new JamendoMusicProvider(jamendoClientId),
      new OpenverseMusicProvider(),
      new CcMixterMusicProvider(),
      new WikimediaCommonsMusicProvider(),
      new InternetArchiveMusicProvider(),
    ]
    this.localFallbackProvider = new LocalFallbackMusicProvider()
  }

  async pickTrack(request: MusicTrackRequest): Promise<MusicTrackResponse> {
    const allowFallback = request.allowFallback !== false
    const excludeTrackIds = new Set(request.excludeTrackIds)
    if (request.failedTrackId) {
      excludeTrackIds.add(request.failedTrackId)
    }

    if (request.failedProvider) {
      this.markProviderFailure(request.failedProvider, request.styleId, true)
    }

    const attemptedProviders: MusicProviderId[] = []
    const candidates = this.getReadyRemoteProviders(request.styleId)
    const backupDeadline = Date.now() + BACKUP_PROVIDER_TOTAL_BUDGET_MS

    for (const provider of candidates) {
      if (provider.id !== PRIMARY_PROVIDER_ID && Date.now() >= backupDeadline) {
        break
      }

      attemptedProviders.push(provider.id)
      const timeoutMs =
        provider.id === PRIMARY_PROVIDER_ID
          ? PRIMARY_PROVIDER_TIMEOUT_MS
          : Math.min(PROVIDER_TIMEOUT_MS[provider.id], Math.max(0, backupDeadline - Date.now()))

      if (timeoutMs <= 0) {
        this.markProviderFailure(provider.id, request.styleId, true)
        continue
      }

      try {
        const pickResult = await this.pickTrackWithTimeout(
          provider,
          request.styleId,
          Array.from(excludeTrackIds),
          timeoutMs
        )
        if (pickResult.status === 'timed-out') {
          this.markProviderFailure(provider.id, request.styleId, true)
          continue
        }

        const track = pickResult.track
        if (!track) {
          this.markProviderFailure(provider.id, request.styleId, false)
          continue
        }

        this.markProviderSuccess(provider.id, request.styleId)
        return {
          track,
          attemptedProviders,
          usedFallback: false,
        }
      } catch {
        this.markProviderFailure(provider.id, request.styleId, true)
      }
    }

    if (!allowFallback) {
      return {
        track: null,
        attemptedProviders,
        usedFallback: false,
      }
    }

    const fallbackTrack = await this.localFallbackProvider.pickTrack(request.styleId, Array.from(excludeTrackIds))
    return {
      track: fallbackTrack,
      attemptedProviders,
      usedFallback: fallbackTrack?.isFallback ?? false,
    }
  }

  clearCache(styleId?: MusicStyleId): void {
    this.remoteProviders.forEach((provider) => {
      provider.clearCache(styleId)
    })
    this.localFallbackProvider.clearCache(styleId)
  }

  private getReadyRemoteProviders(styleId: MusicStyleId): MusicProvider[] {
    const now = Date.now()
    const readyProviders = this.remoteProviders.filter((provider) => {
      if (!provider.isConfigured()) {
        return false
      }

      const health = this.providerHealthById.get(provider.id)
      return !health || health.cooldownUntil <= now
    })

    const primaryProvider = readyProviders.find((provider) => provider.id === PRIMARY_PROVIDER_ID) ?? null
    const backupProviders = readyProviders.filter((provider) => provider.id !== PRIMARY_PROVIDER_ID)
    if (backupProviders.length === 0) {
      return primaryProvider ? [primaryProvider] : []
    }

    const offset = this.nextProviderOffsetByStyle.get(styleId) ?? 0
    const orderedBackups = backupProviders.map((_, index) => {
      return backupProviders[(index + offset) % backupProviders.length]
    })

    return primaryProvider ? [primaryProvider, ...orderedBackups] : orderedBackups
  }

  private markProviderSuccess(providerId: MusicProviderId, styleId: MusicStyleId): void {
    this.providerHealthById.delete(providerId)
    if (providerId === PRIMARY_PROVIDER_ID) {
      return
    }

    const backupProviders = this.remoteProviders.filter((provider) => provider.id !== PRIMARY_PROVIDER_ID)
    const providerIndex = backupProviders.findIndex((provider) => provider.id === providerId)
    if (providerIndex >= 0 && backupProviders.length > 0) {
      this.nextProviderOffsetByStyle.set(styleId, (providerIndex + 1) % backupProviders.length)
    }
  }

  private markProviderFailure(providerId: MusicProviderId, styleId: MusicStyleId, hardFailure: boolean): void {
    const current = this.providerHealthById.get(providerId) ?? { failureCount: 0, cooldownUntil: 0 }
    const delays = hardFailure ? HARD_FAILURE_COOLDOWNS_MS : SOFT_FAILURE_COOLDOWNS_MS
    const nextFailureCount = Math.min(current.failureCount + 1, delays.length)
    const cooldownMs = delays[Math.min(nextFailureCount - 1, delays.length - 1)]

    this.providerHealthById.set(providerId, {
      failureCount: nextFailureCount,
      cooldownUntil: Date.now() + cooldownMs,
    })

    const provider = this.remoteProviders.find((entry) => entry.id === providerId)
    provider?.clearCache(styleId)
  }

  private async pickTrackWithTimeout(
    provider: MusicProvider,
    styleId: MusicStyleId,
    excludedTrackIds: string[],
    timeoutMs: number
  ): Promise<{ status: 'resolved'; track: Awaited<ReturnType<MusicProvider['pickTrack']>> } | { status: 'timed-out' }> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const trackPromise = provider.pickTrack(styleId, excludedTrackIds).then((track) => ({ status: 'resolved' as const, track }))

    const timeoutPromise = new Promise<{ status: 'timed-out' }>((resolve) => {
      timeoutId = setTimeout(() => resolve({ status: 'timed-out' }), timeoutMs)
    })

    try {
      return await Promise.race([trackPromise, timeoutPromise])
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }
}
