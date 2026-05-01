import type { MusicStyleId } from '../../musicStyles.ts'
import { buildRecentMemory, fetchJsonWithTimeout, firstString, isRecord, normalizeAbsoluteUrl } from '../providerUtils.ts'
import { buildMusicStyleMatchText, getMusicStyleKeywordVariants, isStrictMusicStyleMatch } from '../styleSearch.ts'
import { getMusicProviderLabel, type MusicProvider, type MusicTrackDescriptor } from '../types.ts'

const ARCHIVE_ADVANCED_SEARCH_URL = 'https://archive.org/advancedsearch.php'
const ARCHIVE_METADATA_URL = 'https://archive.org/metadata'
const ARCHIVE_PROVIDER_URL = 'https://archive.org/'
const RECENT_ARTIST_MEMORY = 3
const TRACK_LIMIT_PER_QUERY = 4
const QUERY_VARIANT_LIMIT = 2
const SEARCH_TIMEOUT_MS = 2200
const METADATA_TIMEOUT_MS = 1600
const MAX_METADATA_REQUESTS_PER_QUERY = 3
const MIN_TRACK_POOL_SIZE = 2

interface ArchiveSearchResponse {
  response?: {
    docs?: ArchiveSearchDoc[]
  }
}

interface ArchiveSearchDoc {
  identifier?: string
  title?: string | string[]
  creator?: string | string[]
  licenseurl?: string | string[]
  rights?: string | string[]
}

interface ArchiveMetadataResponse {
  metadata?: Record<string, unknown>
  files?: Array<Record<string, unknown>>
}

function readArchiveField(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') {
    return value.trim() || null
  }

  if (Array.isArray(value)) {
    const firstEntry = value.find((entry) => typeof entry === 'string' && entry.trim().length > 0)
    return typeof firstEntry === 'string' ? firstEntry.trim() : null
  }

  return null
}

function isAllowedArchiveLicense(licenseValue: string | null, rightsValue: string | null): boolean {
  const lower = `${licenseValue ?? ''} ${rightsValue ?? ''}`.toLowerCase()
  if (!lower.trim()) {
    return false
  }

  if (lower.includes('public domain') || lower.includes('publicdomain/zero') || lower.includes('cc0')) {
    return true
  }

  if (lower.includes('/licenses/by-sa/')) {
    return true
  }

  if (lower.includes('/licenses/by/')) {
    return !lower.includes('/by-nd/') && !lower.includes('/by-nc/')
  }

  return false
}

function getArchiveLicenseLabel(licenseValue: string | null, rightsValue: string | null): string | null {
  const lower = `${licenseValue ?? ''} ${rightsValue ?? ''}`.toLowerCase()
  if (!lower.trim()) {
    return null
  }

  if (lower.includes('public domain') || lower.includes('publicdomain/zero') || lower.includes('cc0')) {
    return 'Public Domain / CC0'
  }

  if (lower.includes('/licenses/by-sa/')) {
    return 'CC BY-SA'
  }

  if (lower.includes('/licenses/by/')) {
    return 'CC BY'
  }

  return rightsValue ?? licenseValue
}

function isAllowedArchiveFile(file: Record<string, unknown>): boolean {
  const fileName = firstString(file, ['name'])
  const format = firstString(file, ['format'])?.toLowerCase() ?? ''
  const source = firstString(file, ['source'])?.toLowerCase() ?? ''
  const privateFlag = firstString(file, ['private'])?.toLowerCase() ?? ''

  if (!fileName || privateFlag === 'true') {
    return false
  }

  if (source && source !== 'original') {
    return false
  }

  const lowerName = fileName.toLowerCase()
  return (
    lowerName.endsWith('.mp3') ||
    lowerName.endsWith('.ogg') ||
    format.includes('mp3') ||
    format.includes('ogg') ||
    format.includes('vorbis')
  )
}

export default class InternetArchiveMusicProvider implements MusicProvider {
  readonly id = 'internet-archive' as const
  readonly label = getMusicProviderLabel('internet-archive')

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
    const queryVariants = getMusicStyleKeywordVariants(styleId, 3).slice(0, QUERY_VARIANT_LIMIT)
    const uniqueTracks = new Map<string, MusicTrackDescriptor>()

    for (const keywords of queryVariants) {
      const searchQuery = this.buildSearchQuery(keywords)
      const params = new URLSearchParams({
        q: searchQuery,
        rows: String(TRACK_LIMIT_PER_QUERY),
        page: '1',
        output: 'json',
      })
      ;['identifier', 'title', 'creator', 'licenseurl', 'rights'].forEach((field) => {
        params.append('fl[]', field)
      })
      params.append('sort[]', 'downloads desc')

      try {
        const response = await fetchJsonWithTimeout<ArchiveSearchResponse>(
          `${ARCHIVE_ADVANCED_SEARCH_URL}?${params.toString()}`,
          undefined,
          SEARCH_TIMEOUT_MS
        )
        const docs = response.response?.docs ?? []
        const trackResults = await Promise.allSettled(
          docs.slice(0, MAX_METADATA_REQUESTS_PER_QUERY).map((doc) => this.loadTrackFromDoc(styleId, doc))
        )
        trackResults.forEach((result) => {
          if (result.status !== 'fulfilled' || !result.value || uniqueTracks.has(result.value.id)) {
            return
          }

          uniqueTracks.set(result.value.id, result.value)
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

  private buildSearchQuery(keywords: string[]): string {
    const escapedTerms = keywords
      .map((term) => term.trim())
      .filter(Boolean)
      .map((term) => `"${term}"`)

    if (escapedTerms.length === 0) {
      return 'mediatype:(audio)'
    }

    const termQuery = escapedTerms.join(' OR ')
    return `mediatype:(audio) AND (title:(${termQuery}) OR subject:(${termQuery}) OR description:(${termQuery}))`
  }

  private async loadTrackFromDoc(styleId: MusicStyleId, doc: ArchiveSearchDoc): Promise<MusicTrackDescriptor | null> {
    const identifier = readArchiveField(doc.identifier)
    if (!identifier) {
      return null
    }

    const searchTitle = readArchiveField(doc.title)
    const searchArtist = readArchiveField(doc.creator)
    const searchLicense = readArchiveField(doc.licenseurl)
    const searchRights = readArchiveField(doc.rights)

    const metadata = await fetchJsonWithTimeout<ArchiveMetadataResponse>(
      `${ARCHIVE_METADATA_URL}/${encodeURIComponent(identifier)}`,
      undefined,
      METADATA_TIMEOUT_MS
    )
    const metadataRecord = isRecord(metadata.metadata) ? metadata.metadata : {}
    const licenseValue = searchLicense ?? firstString(metadataRecord, ['licenseurl'])
    const rightsValue = searchRights ?? firstString(metadataRecord, ['rights'])

    if (!isAllowedArchiveLicense(licenseValue, rightsValue)) {
      return null
    }

    const selectedFile = (metadata.files ?? []).find((file) => isAllowedArchiveFile(file))
    if (!selectedFile) {
      return null
    }

    const fileName = firstString(selectedFile, ['name'])
    if (!fileName) {
      return null
    }

    const title = searchTitle ?? firstString(metadataRecord, ['title']) ?? identifier
    const artist = searchArtist ?? firstString(metadataRecord, ['creator']) ?? 'Internet Archive'
    const subject = firstString(metadataRecord, ['subject'])
    const description = firstString(metadataRecord, ['description'])
    const metadataText = buildMusicStyleMatchText(title, artist, subject, description)
    if (!isStrictMusicStyleMatch(styleId, metadataText)) {
      return null
    }

    const audioUrl = normalizeAbsoluteUrl(`/download/${identifier}/${encodeURIComponent(fileName)}`, ARCHIVE_PROVIDER_URL)
    if (!audioUrl) {
      return null
    }

    return {
      id: `internet-archive:${identifier}:${fileName}`,
      provider: 'internet-archive',
      providerLabel: this.label,
      title,
      artist,
      audioUrl,
      trackUrl: normalizeAbsoluteUrl(`/details/${identifier}`, ARCHIVE_PROVIDER_URL),
      providerUrl: normalizeAbsoluteUrl(`/details/${identifier}`, ARCHIVE_PROVIDER_URL),
      licenseLabel: getArchiveLicenseLabel(licenseValue, rightsValue),
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
