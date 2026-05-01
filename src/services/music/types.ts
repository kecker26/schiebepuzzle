import type { MusicStyleId } from '../musicStyles.ts'

export type MusicProviderId =
  | 'jamendo'
  | 'openverse'
  | 'ccmixter'
  | 'wikimedia-commons'
  | 'internet-archive'
  | 'local-fallback'

export type MusicPlaybackState = 'idle' | 'loading' | 'playing' | 'recovering' | 'fallback' | 'muted'

export interface MusicTrackDescriptor {
  id: string
  provider: MusicProviderId
  providerLabel: string
  title: string
  artist: string
  audioUrl: string
  trackUrl: string | null
  providerUrl: string | null
  licenseLabel: string | null
  isFallback: boolean
}

export interface MusicAttributionSnapshot {
  provider: MusicProviderId | null
  providerLabel: string | null
  title: string | null
  artist: string | null
  trackUrl: string | null
  providerUrl: string | null
  licenseLabel: string | null
  isFallback: boolean
}

export interface MusicPlaybackStatusSnapshot {
  state: MusicPlaybackState
  provider: MusicProviderId | null
  providerLabel: string | null
  message: string
  detail: string | null
  isFallback: boolean
}

export interface MusicTrackRequest {
  styleId: MusicStyleId
  excludeTrackIds: string[]
  allowFallback?: boolean
  failedTrackId?: string | null
  failedProvider?: MusicProviderId | null
  failureReason?: string | null
}

export interface MusicTrackResponse {
  track: MusicTrackDescriptor | null
  attemptedProviders: MusicProviderId[]
  usedFallback: boolean
}

export interface MusicProvider {
  readonly id: MusicProviderId
  readonly label: string
  isConfigured(): boolean
  clearCache(styleId?: MusicStyleId): void
  pickTrack(styleId: MusicStyleId, excludedTrackIds: string[]): Promise<MusicTrackDescriptor | null>
}

export function createEmptyMusicAttribution(): MusicAttributionSnapshot {
  return {
    provider: null,
    providerLabel: null,
    title: null,
    artist: null,
    trackUrl: null,
    providerUrl: null,
    licenseLabel: null,
    isFallback: false,
  }
}

export function createMusicPlaybackStatus(
  state: MusicPlaybackState,
  overrides: Partial<Omit<MusicPlaybackStatusSnapshot, 'state'>> = {}
): MusicPlaybackStatusSnapshot {
  return {
    state,
    provider: null,
    providerLabel: null,
    message: '',
    detail: null,
    isFallback: false,
    ...overrides,
  }
}

export function getMusicProviderLabel(providerId: MusicProviderId): string {
  switch (providerId) {
    case 'jamendo':
      return 'Jamendo'
    case 'openverse':
      return 'Openverse'
    case 'ccmixter':
      return 'ccMixter'
    case 'wikimedia-commons':
      return 'Wikimedia Commons'
    case 'internet-archive':
      return 'Internet Archive'
    case 'local-fallback':
      return 'Lokaler Fallback'
  }
}
