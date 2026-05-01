import type { MusicStyleId } from '../../musicStyles.ts'
import { buildRecentMemory, fetchJsonWithTimeout, firstString, isRecord, normalizeAbsoluteUrl } from '../providerUtils.ts'
import { buildMusicStyleMatchText, getMusicStyleKeywordVariants, isStrictMusicStyleMatch } from '../styleSearch.ts'
import { getMusicProviderLabel, type MusicProvider, type MusicTrackDescriptor } from '../types.ts'

const CCMIXTER_API_URL = 'https://ccmixter.org/api/query'
const CCMIXTER_PROVIDER_URL = 'https://ccmixter.org/'
const RECENT_ARTIST_MEMORY = 3
const MIN_TRACK_POOL_SIZE = 2
const KEYWORD_VARIANT_LIMIT = 2
const REQUEST_TIMEOUT_MS = 2200
const TRACK_LIMIT_PER_QUERY = 12

function collectRecords(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord)
  }

  if (!isRecord(payload)) {
    return []
  }

  const directArrays = ['items', 'results', 'data', 'records', 'uploads']
    .map((key) => payload[key])
    .filter(Array.isArray)
    .flatMap((value) => value)
    .filter(isRecord)

  if (directArrays.length > 0) {
    return directArrays
  }

  return Object.values(payload)
    .filter(Array.isArray)
    .flatMap((value) => value)
    .filter(isRecord)
}

function collectStrings(value: unknown, depth: number = 0): string[] {
  if (depth > 4 || value == null) {
    return []
  }

  if (typeof value === 'string') {
    return [value]
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectStrings(entry, depth + 1))
  }

  if (!isRecord(value)) {
    return []
  }

  return Object.values(value).flatMap((entry) => collectStrings(entry, depth + 1))
}

function isLikelyAudioUrl(url: string): boolean {
  const lower = url.toLowerCase()
  return (
    lower.endsWith('.mp3') ||
    lower.endsWith('.ogg') ||
    lower.endsWith('.wav') ||
    lower.includes('/content/') ||
    lower.includes('/download/')
  )
}

function isLikelyPageUrl(url: string): boolean {
  const lower = url.toLowerCase()
  return lower.startsWith('https://ccmixter.org/') && !isLikelyAudioUrl(lower)
}

export default class CcMixterMusicProvider implements MusicProvider {
  readonly id = 'ccmixter' as const
  readonly label = getMusicProviderLabel('ccmixter')

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
    const variants = getMusicStyleKeywordVariants(styleId, 3).slice(0, KEYWORD_VARIANT_LIMIT)
    const uniqueTracks = new Map<string, MusicTrackDescriptor>()

    for (const variant of variants) {
      const params = new URLSearchParams({
        f: 'json',
        limit: String(TRACK_LIMIT_PER_QUERY),
        tags: variant.join('+'),
        type: 'any',
        sort: 'rank',
      })

      try {
        const payload = await fetchJsonWithTimeout<unknown>(`${CCMIXTER_API_URL}?${params.toString()}`, undefined, REQUEST_TIMEOUT_MS)
        collectRecords(payload).forEach((record) => {
          const track = this.normalizeTrack(styleId, record)
          if (track && !uniqueTracks.has(track.id)) {
            uniqueTracks.set(track.id, track)
          }
        })

        if (uniqueTracks.size >= MIN_TRACK_POOL_SIZE) {
          break
        }
      } catch {
        // Try the next keyword variant.
      }
    }

    return Array.from(uniqueTracks.values())
  }

  private normalizeTrack(styleId: MusicStyleId, record: Record<string, unknown>): MusicTrackDescriptor | null {
    const title = firstString(record, ['upload_name', 'name', 'title'])
    const artist = firstString(record, ['user_name', 'artist_name', 'artist', 'user', 'author'])
    const rawId = firstString(record, ['upload_id', 'id'])
    const stringCandidates = collectStrings(record)
    const audioUrl =
      stringCandidates
        .map((value) => normalizeAbsoluteUrl(value, CCMIXTER_PROVIDER_URL))
        .find((value) => value !== null && isLikelyAudioUrl(value)) ?? null
    const trackUrl =
      [
        firstString(record, ['file_page_url', 'upload_page_url', 'page_url', 'url']),
        ...stringCandidates.filter(isLikelyPageUrl),
      ]
        .map((value) => normalizeAbsoluteUrl(value, CCMIXTER_PROVIDER_URL))
        .find((value) => value !== null) ?? null

    if (!title || !artist || !audioUrl) {
      return null
    }

    const metadataText = buildMusicStyleMatchText(
      title,
      artist,
      ...stringCandidates.filter((value) => !/^https?:/i.test(value)).slice(0, 24)
    )
    if (!isStrictMusicStyleMatch(styleId, metadataText)) {
      return null
    }

    const fallbackId = rawId ?? trackUrl ?? audioUrl
    if (!fallbackId) {
      return null
    }

    const licenseLabel =
      firstString(record, ['license_name', 'license', 'lic_name']) ??
      firstString(record, ['license_url', 'lic_url']) ??
      'Creative Commons'

    return {
      id: `ccmixter:${fallbackId}`,
      provider: 'ccmixter',
      providerLabel: this.label,
      title,
      artist,
      audioUrl,
      trackUrl,
      providerUrl: CCMIXTER_PROVIDER_URL,
      licenseLabel,
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
