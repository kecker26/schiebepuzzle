import type { MusicStyleId } from '../../musicStyles.ts'
import { buildRecentMemory, fetchJsonWithTimeout, formatCreativeCommonsLicense, uniqueById } from '../providerUtils.ts'
import { buildMusicStyleMatchText, getMusicStyleKeywordVariants, isStrictMusicStyleMatch } from '../styleSearch.ts'
import { getMusicProviderLabel, type MusicProvider, type MusicTrackDescriptor } from '../types.ts'

const WIKIMEDIA_API_URL = 'https://commons.wikimedia.org/w/api.php'
const WIKIMEDIA_PROVIDER_URL = 'https://commons.wikimedia.org/'
const TRACK_LIMIT_PER_QUERY = 4
const KEYWORD_VARIANT_LIMIT = 2
const SEARCH_TIMEOUT_MS = 2000
const DETAILS_TIMEOUT_MS = 2200
const MIN_TRACK_POOL_SIZE = 2
const RECENT_ARTIST_MEMORY = 3

interface WikimediaSearchResponse {
  query?: {
    search?: WikimediaSearchResult[]
  }
}

interface WikimediaSearchResult {
  pageid?: number
  title?: string
}

interface WikimediaImageInfoResponse {
  query?: {
    pages?: Record<string, WikimediaPageResult>
  }
}

interface WikimediaPageResult {
  pageid?: number
  title?: string
  imageinfo?: WikimediaImageInfo[]
}

interface WikimediaImageInfo {
  url?: string
  descriptionurl?: string
  mime?: string
  extmetadata?: Record<string, WikimediaMetadataField>
}

interface WikimediaMetadataField {
  value?: string
}

function decodeBasicHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}

function stripHtml(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const withoutTags = decodeBasicHtmlEntities(value).replace(/<[^>]+>/g, ' ')
  const normalized = withoutTags.replace(/\s+/g, ' ').trim()
  return normalized || null
}

function readMetadataField(
  metadata: Record<string, WikimediaMetadataField> | undefined,
  key: string
): string | null {
  return stripHtml(metadata?.[key]?.value)
}

function isMusicLikeTrack(title: string, metadataText: string, keywords: string[]): boolean {
  const normalizedText = `${title} ${metadataText}`.toLowerCase()
  if (keywords.some((keyword) => normalizedText.includes(keyword.toLowerCase()))) {
    return true
  }

  return ['music', 'song', 'instrumental', 'guitar', 'piano', 'band', 'track'].some((term) =>
    normalizedText.includes(term)
  )
}

export default class WikimediaCommonsMusicProvider implements MusicProvider {
  readonly id = 'wikimedia-commons' as const
  readonly label = getMusicProviderLabel('wikimedia-commons')

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
    const keywordVariants = getMusicStyleKeywordVariants(styleId, 3).slice(0, KEYWORD_VARIANT_LIMIT)
    const flattenedKeywords = Array.from(new Set(keywordVariants.flat()))
    const uniqueTracks = new Map<string, MusicTrackDescriptor>()

    for (const keywords of keywordVariants) {
      const titles = await this.searchTitles(keywords)
      if (titles.length === 0) {
        continue
      }

      const tracks = await this.loadTrackDetails(styleId, titles, flattenedKeywords)
      tracks.forEach((track) => {
        if (!uniqueTracks.has(track.id)) {
          uniqueTracks.set(track.id, track)
        }
      })

      if (uniqueTracks.size >= MIN_TRACK_POOL_SIZE) {
        break
      }
    }

    return uniqueById(Array.from(uniqueTracks.values()))
  }

  private async searchTitles(keywords: string[]): Promise<string[]> {
    const searchQuery = `filemime:audio ${keywords.join(' ')}`
    const params = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: searchQuery,
      srnamespace: '6',
      srlimit: String(TRACK_LIMIT_PER_QUERY),
      format: 'json',
      origin: '*',
    })

    try {
      const response = await fetchJsonWithTimeout<WikimediaSearchResponse>(
        `${WIKIMEDIA_API_URL}?${params.toString()}`,
        undefined,
        SEARCH_TIMEOUT_MS
      )
      return (response.query?.search ?? [])
        .map((result) => result.title?.trim() ?? '')
        .filter(Boolean)
    } catch {
      return []
    }
  }

  private async loadTrackDetails(
    styleId: MusicStyleId,
    titles: string[],
    keywords: string[]
  ): Promise<MusicTrackDescriptor[]> {
    const params = new URLSearchParams({
      action: 'query',
      titles: titles.join('|'),
      prop: 'imageinfo',
      iiprop: 'url|mime|extmetadata',
      format: 'json',
      origin: '*',
    })
    const response = await fetchJsonWithTimeout<WikimediaImageInfoResponse>(
      `${WIKIMEDIA_API_URL}?${params.toString()}`,
      undefined,
      DETAILS_TIMEOUT_MS
    )
    const pages = Object.values(response.query?.pages ?? {})
    return pages
      .map((page) => this.normalizeTrack(styleId, page, keywords))
      .filter((track): track is MusicTrackDescriptor => track !== null)
  }

  private normalizeTrack(styleId: MusicStyleId, page: WikimediaPageResult, keywords: string[]): MusicTrackDescriptor | null {
    const title = page.title?.trim() ?? ''
    const pageId = page.pageid
    const imageInfo = page.imageinfo?.[0]
    if (!title || !pageId || !imageInfo?.url || !imageInfo.descriptionurl) {
      return null
    }

    if (!imageInfo.mime?.startsWith('audio/')) {
      return null
    }

    const metadata = imageInfo.extmetadata
    const objectName = readMetadataField(metadata, 'ObjectName')
    const artist = readMetadataField(metadata, 'Artist') ?? readMetadataField(metadata, 'Attribution') ?? 'Wikimedia Commons'
    const categories = readMetadataField(metadata, 'Categories') ?? ''
    const description = readMetadataField(metadata, 'ImageDescription') ?? ''
    const metadataText = buildMusicStyleMatchText(objectName, title, artist, categories, description)

    if (!isMusicLikeTrack(title, metadataText, keywords) || !isStrictMusicStyleMatch(styleId, metadataText)) {
      return null
    }

    const licenseLabel =
      readMetadataField(metadata, 'LicenseShortName') ??
      formatCreativeCommonsLicense(readMetadataField(metadata, 'LicenseUrl')) ??
      readMetadataField(metadata, 'UsageTerms') ??
      'Freie Wikimedia-Lizenz'

    return {
      id: `wikimedia-commons:${pageId}`,
      provider: 'wikimedia-commons',
      providerLabel: this.label,
      title: objectName ?? title.replace(/^File:/i, '').replace(/\.[a-z0-9]+$/i, ''),
      artist,
      audioUrl: imageInfo.url,
      trackUrl: imageInfo.descriptionurl,
      providerUrl: WIKIMEDIA_PROVIDER_URL,
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
