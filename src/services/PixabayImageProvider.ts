const PIXABAY_API_BASE_URL = 'https://pixabay.com/api/'
const PIXABAY_API_KEY = import.meta.env.VITE_PIXABAY_API_KEY?.trim() ?? ''
const PIXABAY_MAX_ATTEMPTS = 4
const PIXABAY_PER_PAGE = 50
const PIXABAY_RANDOM_PAGE_MAX = 10
const PIXABAY_RECENT_IMAGE_MEMORY = 10

interface PixabayImageHit {
  id?: number
  type?: string
  largeImageURL?: string
  webformatURL?: string
  pageURL?: string
  tags?: string
}

interface PixabayImageSearchResponse {
  hits?: PixabayImageHit[]
}

const recentPixabayImageIds: number[] = []

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

function rememberPixabayImageId(imageId: number): void {
  recentPixabayImageIds.unshift(imageId)
  while (recentPixabayImageIds.length > PIXABAY_RECENT_IMAGE_MEMORY) {
    recentPixabayImageIds.pop()
  }
}

function pickRandomPixabayHit(hits: PixabayImageHit[]): PixabayImageHit | null {
  const candidates = hits.filter((hit) => {
    return typeof hit.id === 'number'
      && hit.type === 'photo'
      && typeof (hit.largeImageURL ?? hit.webformatURL) === 'string'
  })

  if (candidates.length === 0) {
    return null
  }

  const recentIds = new Set(recentPixabayImageIds)
  const freshCandidates = candidates.filter((hit) => !recentIds.has(hit.id as number))
  const pool = freshCandidates.length > 0 ? freshCandidates : candidates
  return pool[Math.floor(Math.random() * pool.length)] ?? null
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Pixabay-Bild konnte nicht geladen werden (${response.status})`)
  }

  return readBlobAsDataUrl(await response.blob())
}

async function fetchPixabayImages(page: number, query?: string): Promise<PixabayImageHit[]> {
  const params = new URLSearchParams({
    key: PIXABAY_API_KEY,
    image_type: 'photo',
    safesearch: 'false',
    order: 'popular',
    page: String(page),
    per_page: String(PIXABAY_PER_PAGE),
  })
  const searchQuery = query?.trim()
  if (searchQuery) {
    params.set('q', searchQuery)
  }

  const response = await fetch(
    `${PIXABAY_API_BASE_URL}?${params.toString()}`,
    { cache: 'no-store' }
  )

  if (!response.ok) {
    throw new Error(`Pixabay-Suche konnte nicht geladen werden (${response.status})`)
  }

  const payload = (await response.json()) as PixabayImageSearchResponse
  return Array.isArray(payload.hits) ? payload.hits : []
}

export function isPixabayConfigured(): boolean {
  return PIXABAY_API_KEY.length > 0
}

export async function fetchRandomPixabayImage(query?: string): Promise<string> {
  if (!isPixabayConfigured()) {
    throw new Error('Pixabay-API-Key fehlt')
  }

  for (let attempt = 0; attempt < PIXABAY_MAX_ATTEMPTS; attempt += 1) {
    const page = randomInt(1, PIXABAY_RANDOM_PAGE_MAX)
    const hits = await fetchPixabayImages(page, query)
    const selectedHit = pickRandomPixabayHit(hits)
    const imageUrl = selectedHit?.largeImageURL ?? selectedHit?.webformatURL

    if (typeof selectedHit?.id !== 'number' || !imageUrl) {
      continue
    }

    rememberPixabayImageId(selectedHit.id)
    return fetchImageAsDataUrl(imageUrl)
  }

  throw new Error('Pixabay-Bild konnte nicht gefunden werden')
}
