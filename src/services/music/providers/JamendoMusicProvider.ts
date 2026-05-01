import { getMusicStyleDefinition, type MusicStyleId } from '../../musicStyles.ts'
import { buildRecentMemory, fetchJsonWithTimeout, formatCreativeCommonsLicense, uniqueById } from '../providerUtils.ts'
import { getMusicProviderLabel, type MusicProvider, type MusicTrackDescriptor } from '../types.ts'

const JAMENDO_API_BASE_URL = 'https://api.jamendo.com/v3.0'
const JAMENDO_PROVIDER_URL = 'https://www.jamendo.com/'
const TRACK_LIMIT_PER_PROFILE = 8
const MIN_TRACK_POOL_SIZE = 2
const MIN_TRACK_DURATION_SECONDS = 45
const MAX_TRACK_DURATION_SECONDS = 720
const RECENT_ARTIST_MEMORY = 3

interface JamendoTracksResponse {
  headers?: {
    status?: string
    error_message?: string
  }
  results?: JamendoTrackResult[]
}

interface JamendoTrackResult {
  id: string | number
  name?: string
  duration?: string | number
  artist_name?: string
  audio?: string
  audiodownload?: string
  shareurl?: string
  license_ccurl?: string
}

interface JamendoTrackQuery {
  order: string
  fuzzytags: string
  speed?: string
  exactTags?: string[]
  featured?: boolean
  vocalinstrumental?: 'instrumental' | 'vocal'
  acousticelectric?: 'acoustic' | 'electric'
  limit?: number
  groupByArtist?: boolean
}

export default class JamendoMusicProvider implements MusicProvider {
  readonly id = 'jamendo' as const
  readonly label = getMusicProviderLabel('jamendo')

  private readonly clientId: string
  private trackPoolPromises = new Map<MusicStyleId, Promise<MusicTrackDescriptor[]>>()
  private recentArtistNamesByStyle = new Map<MusicStyleId, string[]>()

  constructor(clientId: string) {
    this.clientId = clientId.trim()
  }

  isConfigured(): boolean {
    return this.clientId.length > 0
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
    if (!this.isConfigured()) {
      return []
    }

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
    const discoveryProfiles = getMusicStyleDefinition(styleId).discoveryProfiles
    const responses = await Promise.allSettled(
      discoveryProfiles.map((profile) => this.fetchTracksForProfile(profile))
    )

    const tracks = responses.flatMap((response) => {
      if (response.status !== 'fulfilled') {
        return []
      }

      return response.value
    })

    return uniqueById(tracks)
  }

  private async fetchTracksForProfile(profile: JamendoTrackQuery): Promise<MusicTrackDescriptor[]> {
    const variants = this.buildProfileVariants(profile)
    const uniqueTracks = new Map<string, MusicTrackDescriptor>()

    for (const variant of variants) {
      try {
        const tracks = await this.fetchTracksForQuery(variant)
        tracks.forEach((track) => {
          if (!uniqueTracks.has(track.id)) {
            uniqueTracks.set(track.id, track)
          }
        })

        if (uniqueTracks.size >= Math.max(MIN_TRACK_POOL_SIZE, profile.limit ?? TRACK_LIMIT_PER_PROFILE)) {
          break
        }
      } catch {
        // Try a broader fallback variant next.
      }
    }

    return Array.from(uniqueTracks.values())
  }

  private buildProfileVariants(profile: JamendoTrackQuery): JamendoTrackQuery[] {
    const fuzzyTagTokens = profile.fuzzytags
      .split('+')
      .map((token) => token.trim())
      .filter(Boolean)
    const focusedFuzzytags = fuzzyTagTokens.slice(0, Math.min(3, fuzzyTagTokens.length)).join('+') || profile.fuzzytags
    const broadFuzzytags = fuzzyTagTokens.slice(0, Math.min(2, fuzzyTagTokens.length)).join('+') || profile.fuzzytags
    const relaxedLimit = Math.max(profile.limit ?? TRACK_LIMIT_PER_PROFILE, TRACK_LIMIT_PER_PROFILE + 4)

    const variants: JamendoTrackQuery[] = [
      { ...profile, groupByArtist: true },
      { ...profile, featured: false, groupByArtist: true },
      {
        ...profile,
        featured: false,
        exactTags: undefined,
        groupByArtist: true,
        fuzzytags: focusedFuzzytags,
      },
      {
        ...profile,
        featured: false,
        exactTags: undefined,
        groupByArtist: false,
        fuzzytags: focusedFuzzytags,
        speed: this.relaxSpeed(profile.speed),
      },
      {
        ...profile,
        featured: false,
        exactTags: undefined,
        vocalinstrumental: undefined,
        acousticelectric: undefined,
        groupByArtist: false,
        fuzzytags: broadFuzzytags,
        speed: this.relaxSpeed(profile.speed),
        limit: relaxedLimit,
      },
      {
        ...profile,
        featured: false,
        exactTags: undefined,
        vocalinstrumental: undefined,
        acousticelectric: undefined,
        groupByArtist: false,
        fuzzytags: broadFuzzytags,
        speed: undefined,
        limit: relaxedLimit,
      },
    ]

    const seen = new Set<string>()
    return variants.filter((variant) => {
      const key = JSON.stringify({
        order: variant.order,
        fuzzytags: variant.fuzzytags,
        speed: variant.speed ?? null,
        exactTags: variant.exactTags ?? null,
        featured: variant.featured ?? null,
        vocalinstrumental: variant.vocalinstrumental ?? null,
        acousticelectric: variant.acousticelectric ?? null,
        limit: variant.limit ?? null,
        groupByArtist: variant.groupByArtist ?? true,
      })

      if (seen.has(key)) {
        return false
      }

      seen.add(key)
      return true
    })
  }

  private relaxSpeed(speed: string | undefined): string | undefined {
    switch (speed) {
      case 'verylow+low':
        return 'low+medium'
      case 'high+veryhigh':
        return 'medium+high'
      default:
        return speed
    }
  }

  private async fetchTracksForQuery(profile: JamendoTrackQuery): Promise<MusicTrackDescriptor[]> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      format: 'json',
      limit: String(profile.limit ?? TRACK_LIMIT_PER_PROFILE),
      order: profile.order,
      audioformat: 'mp32',
      fuzzytags: profile.fuzzytags,
    })

    if (profile.groupByArtist !== false) {
      params.set('groupby', 'artist_id')
    }

    if (profile.speed) {
      params.set('speed', profile.speed)
    }

    if (profile.vocalinstrumental) {
      params.set('vocalinstrumental', profile.vocalinstrumental)
    }

    if (profile.featured !== false) {
      params.set('featured', '1')
    }

    if (profile.acousticelectric) {
      params.set('acousticelectric', profile.acousticelectric)
    }

    profile.exactTags?.forEach((tag) => {
      params.append('tags[]', tag)
    })

    const response = await fetchJsonWithTimeout<JamendoTracksResponse>(`${JAMENDO_API_BASE_URL}/tracks/?${params.toString()}`)
    if (response.headers?.status && response.headers.status !== 'success') {
      throw new Error(response.headers.error_message ?? 'Jamendo API request failed.')
    }

    return (response.results ?? [])
      .map((track) => this.normalizeTrack(track))
      .filter((track): track is MusicTrackDescriptor => track !== null)
  }

  private normalizeTrack(track: JamendoTrackResult): MusicTrackDescriptor | null {
    const id = String(track.id ?? '').trim()
    const title = (track.name ?? '').trim()
    const artist = (track.artist_name ?? '').trim()
    const audioUrl = (track.audio ?? track.audiodownload ?? '').trim()
    const trackUrl = (track.shareurl ?? JAMENDO_PROVIDER_URL).trim()
    const durationSeconds = Number(track.duration ?? 0)

    if (!id || !title || !artist || !audioUrl || !Number.isFinite(durationSeconds)) {
      return null
    }

    if (durationSeconds < MIN_TRACK_DURATION_SECONDS || durationSeconds > MAX_TRACK_DURATION_SECONDS) {
      return null
    }

    return {
      id: `jamendo:${id}`,
      provider: 'jamendo',
      providerLabel: this.label,
      title,
      artist,
      audioUrl,
      trackUrl,
      providerUrl: JAMENDO_PROVIDER_URL,
      licenseLabel: formatCreativeCommonsLicense(track.license_ccurl),
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
