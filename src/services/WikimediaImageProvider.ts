import { DEFAULT_RANDOM_IMAGE_MAX_EDGE } from './RandomImageDimensions.ts'

interface CommonsRandomEntry {
  title?: string
}

interface CommonsImageInfo {
  url?: string
  thumburl?: string
  mime?: string
  mediatype?: string
}

const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php'
const COMMONS_RANDOM_LIMIT = 6
const COMMONS_MAX_ATTEMPTS = 4
const COMMONS_RECENT_IMAGE_MEMORY = 10

const SUPPORTED_COMMONS_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/avif',
])

const recentCommonsTitles: string[] = []

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Bilddaten konnten nicht gelesen werden'))
        return
      }
      resolve(reader.result)
    }
    reader.onerror = () => reject(new Error('Bilddaten konnten nicht gelesen werden'))
    reader.readAsDataURL(blob)
  })
}

function rememberCommonsTitle(title: string): void {
  recentCommonsTitles.unshift(title)
  while (recentCommonsTitles.length > COMMONS_RECENT_IMAGE_MEMORY) {
    recentCommonsTitles.pop()
  }
}

function pickCommonsRandomTitle(entries: CommonsRandomEntry[]): string | null {
  const titles = entries
    .map((entry) => entry.title?.trim() ?? '')
    .filter((title) => title.length > 0)

  if (titles.length === 0) {
    return null
  }

  const recentTitles = new Set(recentCommonsTitles)
  const candidates = titles.filter((title) => !recentTitles.has(title))
  const pool = candidates.length > 0 ? candidates : titles
  return pool[Math.floor(Math.random() * pool.length)] ?? null
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Wikimedia-Bild konnte nicht geladen werden (${response.status})`)
  }

  return readBlobAsDataUrl(await response.blob())
}

async function fetchCommonsRandomEntries(): Promise<CommonsRandomEntry[]> {
  const response = await fetch(
    `${COMMONS_API_URL}?action=query&list=random&rnnamespace=6&rnfilterredir=nonredirects&rnlimit=${COMMONS_RANDOM_LIMIT}&format=json&origin=*`,
    { cache: 'no-store' }
  )

  if (!response.ok) {
    throw new Error(`Wikimedia-Zufallsliste konnte nicht geladen werden (${response.status})`)
  }

  const payload = (await response.json()) as {
    query?: { random?: CommonsRandomEntry[] }
  }

  return Array.isArray(payload.query?.random) ? payload.query.random : []
}

function extractCommonsImageInfo(payload: unknown): CommonsImageInfo | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const query = 'query' in payload ? payload.query : null
  if (!query || typeof query !== 'object' || !('pages' in query)) {
    return null
  }

  const pages = query.pages
  if (!pages || typeof pages !== 'object') {
    return null
  }

  for (const page of Object.values(pages)) {
    if (!page || typeof page !== 'object' || !('imageinfo' in page) || !Array.isArray(page.imageinfo)) {
      continue
    }

    const [imageInfo] = page.imageinfo as CommonsImageInfo[]
    if (imageInfo) {
      return imageInfo
    }
  }

  return null
}

function isSupportedCommonsImageInfo(imageInfo: CommonsImageInfo | null): imageInfo is CommonsImageInfo {
  if (!imageInfo) {
    return false
  }

  const mediaType = imageInfo.mediatype?.toUpperCase() ?? ''
  if (mediaType && mediaType !== 'BITMAP' && mediaType !== 'DRAWING') {
    return false
  }

  return typeof imageInfo.mime === 'string' && SUPPORTED_COMMONS_MIME_TYPES.has(imageInfo.mime)
}

async function fetchCommonsImageInfo(title: string, maxEdge: number): Promise<CommonsImageInfo | null> {
  const encodedTitle = encodeURIComponent(title)
  const response = await fetch(
    `${COMMONS_API_URL}?action=query&titles=${encodedTitle}&prop=imageinfo&iiprop=url|mime|mediatype&iiurlwidth=${maxEdge}&iiurlheight=${maxEdge}&format=json&origin=*`,
    { cache: 'no-store' }
  )

  if (!response.ok) {
    throw new Error(`Wikimedia-Bildinfo konnte nicht geladen werden (${response.status})`)
  }

  return extractCommonsImageInfo(await response.json())
}

export async function fetchRandomWikimediaImage(maxEdge: number = DEFAULT_RANDOM_IMAGE_MAX_EDGE): Promise<string> {
  for (let attempt = 0; attempt < COMMONS_MAX_ATTEMPTS; attempt += 1) {
    const entries = await fetchCommonsRandomEntries()
    const title = pickCommonsRandomTitle(entries)
    if (!title) {
      continue
    }

    const imageInfo = await fetchCommonsImageInfo(title, maxEdge)
    if (!isSupportedCommonsImageInfo(imageInfo)) {
      continue
    }

    const imageUrl = imageInfo.thumburl ?? imageInfo.url
    if (!imageUrl) {
      continue
    }

    rememberCommonsTitle(title)
    return fetchImageAsDataUrl(imageUrl)
  }

  throw new Error('Wikimedia-Bild konnte nicht gefunden werden')
}
