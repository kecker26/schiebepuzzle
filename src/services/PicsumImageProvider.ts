import { DEFAULT_RANDOM_IMAGE_MAX_EDGE, scaleImageDimensions } from './RandomImageDimensions.ts'

interface PicsumImageListEntry {
  id: string
  width?: number
  height?: number
}

const PICSUM_API_BASE_URL = 'https://picsum.photos'
const PICSUM_LIST_LIMIT = 100
const PICSUM_RANDOM_PAGE_MAX = 10
const PICSUM_RECENT_IMAGE_MEMORY = 10

const recentPicsumImageIds: string[] = []

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

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function rememberPicsumImageId(imageId: string): void {
  recentPicsumImageIds.unshift(imageId)
  while (recentPicsumImageIds.length > PICSUM_RECENT_IMAGE_MEMORY) {
    recentPicsumImageIds.pop()
  }
}

function pickRandomEntry(entries: PicsumImageListEntry[]): PicsumImageListEntry | null {
  if (entries.length === 0) return null

  const recentIds = new Set(recentPicsumImageIds)
  const candidates = entries.filter((entry) => !recentIds.has(entry.id))
  const pool = candidates.length > 0 ? candidates : entries
  return pool[Math.floor(Math.random() * pool.length)] ?? null
}

function buildRandomImageUrl(imageId: string, width: number, height: number): string {
  const cacheBust = `${Date.now()}-${Math.round(Math.random() * 1_000_000_000)}`
  return `${PICSUM_API_BASE_URL}/id/${imageId}/${width}/${height}.jpg?random=${cacheBust}`
}

function resolvePicsumImageSize(entry: PicsumImageListEntry, maxEdge: number): { width: number; height: number } | null {
  if (
    typeof entry.width !== 'number'
    || entry.width <= 0
    || typeof entry.height !== 'number'
    || entry.height <= 0
  ) {
    return null
  }

  return scaleImageDimensions(entry.width, entry.height, maxEdge)
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Zufälliges Bild konnte nicht geladen werden (${response.status})`)
  }

  return readBlobAsDataUrl(await response.blob())
}

async function fetchPicsumListPage(page: number): Promise<PicsumImageListEntry[]> {
  const response = await fetch(`${PICSUM_API_BASE_URL}/v2/list?page=${page}&limit=${PICSUM_LIST_LIMIT}`, {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Bildliste konnte nicht geladen werden (${response.status})`)
  }

  const payload = (await response.json()) as unknown
  return Array.isArray(payload) ? (payload as PicsumImageListEntry[]) : []
}

export async function fetchRandomPicsumImage(maxEdge: number = DEFAULT_RANDOM_IMAGE_MAX_EDGE): Promise<string> {
  const pagesToTry = Array.from(new Set([
    randomInt(1, PICSUM_RANDOM_PAGE_MAX),
    randomInt(1, PICSUM_RANDOM_PAGE_MAX),
    randomInt(1, PICSUM_RANDOM_PAGE_MAX),
  ]))

  for (const page of pagesToTry) {
    try {
      const entries = await fetchPicsumListPage(page)
      const selectedEntry = pickRandomEntry(entries)
      if (!selectedEntry) {
        continue
      }

      const imageSize = resolvePicsumImageSize(selectedEntry, maxEdge)
      if (!imageSize) {
        continue
      }

      rememberPicsumImageId(selectedEntry.id)
      return await fetchImageAsDataUrl(
        buildRandomImageUrl(selectedEntry.id, imageSize.width, imageSize.height)
      )
    } catch {
      // Try the next page before failing over to another provider.
    }
  }

  throw new Error('Picsum-Bild konnte nicht gefunden werden')
}
