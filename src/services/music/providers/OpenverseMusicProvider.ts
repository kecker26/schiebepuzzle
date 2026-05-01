import type { MusicStyleId } from '../../musicStyles.ts'
import { buildRecentMemory, fetchJsonWithTimeout, formatCreativeCommonsLicense, uniqueById } from '../providerUtils.ts'
import {
  buildMusicStyleMatchText,
  getMusicStyleKeywordVariants,
  getMusicStyleTempoHint,
  isStrictMusicStyleMatch,
  stylePrefersInstrumental,
} from '../styleSearch.ts'
import { getMusicProviderLabel, type MusicProvider, type MusicTrackDescriptor } from '../types.ts'

const OPENVERSE_AUDIO_API_URL = 'https://api.openverse.org/v1/audio'
const OPENVERSE_PROVIDER_URL = 'https://openverse.org/'
const TRACK_LIMIT_PER_QUERY = 8
const QUERY_VARIANT_LIMIT = 2
const REQUEST_TIMEOUT_MS = 2200
const MIN_TRACK_POOL_SIZE = 2
const MIN_TRACK_DURATION_MS = 45000
const MAX_TRACK_DURATION_MS = 720000
const RECENT_ARTIST_MEMORY = 3

interface OpenverseAudioSearchResponse {
  results?: OpenverseAudioResult[]
}

interface OpenverseAudioResult {
  id?: string
  title?: string
  creator?: string
  url?: string
  foreign_landing_url?: string
  license?: string
  license_version?: string
  license_url?: string
  source?: string
  provider?: string
  category?: string
  duration?: number
  mature?: boolean
}

function formatOpenverseLicense(result: OpenverseAudioResult): string | null {
  const normalized = formatCreativeCommonsLicense(result.license_url ?? result.license ?? null)
  if (normalized) {
    return result.license_version ? `${normalized} ${result.license_version}` : normalized
  }

  const license = result.license?.trim()
  const version = result.license_version?.trim()
  if (license && version) {
    return `CC ${license.toUpperCase()} ${version}`
  }

  if (license) {
    return `CC ${license.toUpperCase()}`
  }

  return null
}

export default class OpenverseMusicProvider implements MusicProvider {
  readonly id = 'openverse' as const
  readonly label = getMusicProviderLabel('openverse')

  private trackPoolPromises = new Map<MusicStyleId, Promise<MusicTrackDescriptor[]>>()
  private recentArtistNamesByStyle = new Map<MusicStyleId, string[]>()

  isConfigured(): boolean {
    return true
  }

  async pickTrack(styleId: MusicStyleId, excludedTrackIds: string[]): Promise<MusicTrackDescriptor | null> {
    const trackPool = await this.getTrackPool(styleId)
    if (trackPool.length === 0) {
      return null
    }

    const excludedTrackSet = new Set(excludedTrackIds)
    const recentArtistSet = new Set(this.getRecentArtists(styleId))

    let candidates = trackPool.filter(
      (track) => !excludedTrackSet.has(track.id) && !recentArtistSet.has(track.artist.toLowerCase())
    )

    if (candidates.length === 0) {
      candidates = trackPool.filter((track) => !excludedTrackSet.has(track.id))
    }

    if (candidates.length === 0) {
      candidates = [...trackPool]
    }

    const selectedTrack = candidates[Math.floor(Math.random() * candidates.length)] ?? null
    if (!selectedTrack) {
      return null
    }

    this.rememberArtist(styleId, selectedTrack.artist)
    return selectedTrack
  }

  clearCache(styleId?: MusicStyleId): void {
    if (styleId) {
      this.trackPoolPromises.delete(styleId)
      this.recentArtistNamesByStyle.delete(styleId)
      return
    }

    this.trackPoolPromises.clear()
    this.recentArtistNamesByStyle.clear()
  }

  private async getTrackPool(styleId: MusicStyleId): Promise<MusicTrackDescriptor[]> {
    const existingPromise = this.trackPoolPromises.get(styleId)
    if (existingPromise) {
      return existingPromise
    }

    const nextPromise = this.fetchTrackPool(styleId)
      .then((tracks) => {
        if (tracks.length === 0) {
          this.trackPoolPromises.delete(styleId)
        }

        return tracks
      })
      .catch((error: unknown) => {
        this.trackPoolPromises.delete(styleId)
        throw error
      })

    this.trackPoolPromises.set(styleId, nextPromise)
    return nextPromise
  }

  private async fetchTrackPool(styleId: MusicStyleId): Promise<MusicTrackDescriptor[]> {
    const queryVariants = this.buildQueryVariants(styleId).slice(0, QUERY_VARIANT_LIMIT)
    const uniqueTracks = new Map<string, MusicTrackDescriptor>()

    for (const query of queryVariants) {
      try {
        const params = new URLSearchParams({
          q: query,
          page_size: String(TRACK_LIMIT_PER_QUERY),
        })
        const response = await fetchJsonWithTimeout<OpenverseAudioSearchResponse>(
          `${OPENVERSE_AUDIO_API_URL}?${params.toString()}`,
          undefined,
          REQUEST_TIMEOUT_MS
        )

        for (const result of response.results ?? []) {
          const track = this.normalizeTrack(styleId, result)
          if (track && !uniqueTracks.has(track.id)) {
            uniqueTracks.set(track.id, track)
          }
        }

        if (uniqueTracks.size >= MIN_TRACK_POOL_SIZE) {
          break
        }
      } catch {
        // Try the next query variant.
      }
    }

    return uniqueById(Array.from(uniqueTracks.values()))
  }

  private buildQueryVariants(styleId: MusicStyleId): string[] {
    const tempoHint = getMusicStyleTempoHint(styleId)
    const variants = getMusicStyleKeywordVariants(styleId, 3).map((tokens) => {
      const queryTokens = [...tokens]
      if (stylePrefersInstrumental(styleId)) {
        queryTokens.push('instrumental')
      }
      if (tempoHint === 'fast') {
        queryTokens.push('upbeat')
      } else if (tempoHint === 'slow') {
        queryTokens.push('calm')
      }
      return queryTokens.join(' ')
    })

    return Array.from(new Set(variants.filter(Boolean)))
  }

  private normalizeTrack(styleId: MusicStyleId, result: OpenverseAudioResult): MusicTrackDescriptor | null {
    const id = result.id?.trim()
    const title = result.title?.trim()
    const artist = result.creator?.trim()
    const audioUrl = result.url?.trim()

    if (!id || !title || !artist || !audioUrl) {
      return null
    }

    if (result.category && result.category !== 'music') {
      return null
    }

    if (result.source?.trim().toLowerCase() === 'jamendo') {
      return null
    }

    if (result.mature) {
      return null
    }

    const matchText = buildMusicStyleMatchText(title, artist)
    if (!isStrictMusicStyleMatch(styleId, matchText)) {
      return null
    }

    if (
      typeof result.duration === 'number' &&
      (result.duration < MIN_TRACK_DURATION_MS || result.duration > MAX_TRACK_DURATION_MS)
    ) {
      return null
    }

    return {
      id: `openverse:${id}`,
      provider: 'openverse',
      providerLabel: this.label,
      title,
      artist,
      audioUrl,
      trackUrl: result.foreign_landing_url?.trim() || null,
      providerUrl: OPENVERSE_PROVIDER_URL,
      licenseLabel: formatOpenverseLicense(result),
      isFallback: false,
    }
  }

  private getRecentArtists(styleId: MusicStyleId): string[] {
    return this.recentArtistNamesByStyle.get(styleId) ?? []
  }

  private rememberArtist(styleId: MusicStyleId, artistName: string): void {
    const normalizedArtist = artistName.toLowerCase()
    this.recentArtistNamesByStyle.set(
      styleId,
      buildRecentMemory(this.getRecentArtists(styleId), normalizedArtist, RECENT_ARTIST_MEMORY)
    )
  }
}
