interface OpenverseImageResult {
  id?: string
  url?: string
  thumbnail?: string
}

interface OpenverseImageSearchResponse {
  results?: OpenverseImageResult[]
}

const OPENVERSE_IMAGE_API_URL = 'https://api.openverse.org/v1/images/'
const OPENVERSE_MAX_ATTEMPTS = 4
const OPENVERSE_PAGE_SIZE = 20
const OPENVERSE_RANDOM_PAGE_MAX = 12
const OPENVERSE_RECENT_IMAGE_MEMORY = 10

const OPENVERSE_FALLBACK_QUERIES = [
  'landscape',
  'nature',
  'city',
  'architecture',
  'forest',
  'mountain',
  'ocean',
  'flowers',
  'art',
  'night',
]

const recentOpenverseImageIds: string[] = []

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

function pickFallbackQuery(): string {
  return OPENVERSE_FALLBACK_QUERIES[
    Math.floor(Math.random() * OPENVERSE_FALLBACK_QUERIES.length)
  ] ?? OPENVERSE_FALLBACK_QUERIES[0]
}

function rememberOpenverseImageId(imageId: string): void {
  recentOpenverseImageIds.unshift(imageId)
  while (recentOpenverseImageIds.length > OPENVERSE_RECENT_IMAGE_MEMORY) {
    recentOpenverseImageIds.pop()
  }
}

function getOpenverseImageUrls(result: OpenverseImageResult): string[] {
  return [result.url, result.thumbnail]
    .map((url) => url?.trim() ?? '')
    .filter((url, index, urls): url is string => {
      return url.length > 0 && urls.indexOf(url) === index
    })
}

function pickRandomOpenverseImage(results: OpenverseImageResult[]): OpenverseImageResult | null {
  const candidates = results.filter((result) => {
    return typeof result.id === 'string'
      && result.id.trim().length > 0
      && getOpenverseImageUrls(result).length > 0
  })

  if (candidates.length === 0) {
    return null
  }

  const recentIds = new Set(recentOpenverseImageIds)
  const freshCandidates = candidates.filter((result) => !recentIds.has(result.id as string))
  const pool = freshCandidates.length > 0 ? freshCandidates : candidates
  return pool[Math.floor(Math.random() * pool.length)] ?? null
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Openverse-Bild konnte nicht geladen werden (${response.status})`)
  }

  return readBlobAsDataUrl(await response.blob())
}

async function fetchFirstLoadableImageUrl(urls: string[]): Promise<string> {
  let lastError: unknown = null

  for (const url of urls) {
    try {
      return await fetchImageAsDataUrl(url)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Openverse-Bild konnte nicht geladen werden')
}

async function fetchOpenverseImages(page: number, query?: string): Promise<OpenverseImageResult[]> {
  const params = new URLSearchParams({
    q: query?.trim() || pickFallbackQuery(),
    license_type: 'commercial',
    page: String(page),
    page_size: String(OPENVERSE_PAGE_SIZE),
  })

  const response = await fetch(
    `${OPENVERSE_IMAGE_API_URL}?${params.toString()}`,
    { cache: 'no-store' }
  )

  if (!response.ok) {
    throw new Error(`Openverse-Suche konnte nicht geladen werden (${response.status})`)
  }

  const payload = (await response.json()) as OpenverseImageSearchResponse
  return Array.isArray(payload.results) ? payload.results : []
}

export async function fetchRandomOpenverseImage(query?: string): Promise<string> {
  for (let attempt = 0; attempt < OPENVERSE_MAX_ATTEMPTS; attempt += 1) {
    const results = await fetchOpenverseImages(randomInt(1, OPENVERSE_RANDOM_PAGE_MAX), query)
    const selectedImage = pickRandomOpenverseImage(results)

    if (!selectedImage?.id) {
      continue
    }

    const imageUrls = getOpenverseImageUrls(selectedImage)
    if (imageUrls.length === 0) {
      continue
    }

    rememberOpenverseImageId(selectedImage.id)
    return fetchFirstLoadableImageUrl(imageUrls)
  }

  throw new Error('Openverse-Bild konnte nicht gefunden werden')
}
