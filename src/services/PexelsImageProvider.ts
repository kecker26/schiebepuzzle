const PEXELS_API_BASE_URL = 'https://api.pexels.com/v1'
const PEXELS_API_KEY = import.meta.env.VITE_PEXELS_API_KEY?.trim() ?? ''
const PEXELS_MAX_ATTEMPTS = 4
const PEXELS_PER_PAGE = 40
const PEXELS_RANDOM_PAGE_MAX = 50
const PEXELS_RECENT_IMAGE_MEMORY = 10

interface PexelsPhotoSourceSet {
  original?: string
  large2x?: string
  large?: string
  medium?: string
}

interface PexelsPhoto {
  id?: number
  src?: PexelsPhotoSourceSet
}

interface PexelsSearchResponse {
  photos?: PexelsPhoto[]
}

const recentPexelsPhotoIds: number[] = []

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

function rememberPexelsPhotoId(photoId: number): void {
  recentPexelsPhotoIds.unshift(photoId)
  while (recentPexelsPhotoIds.length > PEXELS_RECENT_IMAGE_MEMORY) {
    recentPexelsPhotoIds.pop()
  }
}

function getPexelsImageUrl(photo: PexelsPhoto): string | null {
  return photo.src?.large2x ?? photo.src?.large ?? photo.src?.original ?? photo.src?.medium ?? null
}

function pickRandomPexelsPhoto(photos: PexelsPhoto[]): PexelsPhoto | null {
  const candidates = photos.filter((photo) => typeof photo.id === 'number' && getPexelsImageUrl(photo) !== null)
  if (candidates.length === 0) {
    return null
  }

  const recentIds = new Set(recentPexelsPhotoIds)
  const freshCandidates = candidates.filter((photo) => !recentIds.has(photo.id as number))
  const pool = freshCandidates.length > 0 ? freshCandidates : candidates
  return pool[Math.floor(Math.random() * pool.length)] ?? null
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Pexels-Bild konnte nicht geladen werden (${response.status})`)
  }

  return readBlobAsDataUrl(await response.blob())
}

async function fetchCuratedPexelsPhotos(page: number, query?: string): Promise<PexelsPhoto[]> {
  const searchQuery = query?.trim()
  const endpoint = searchQuery
    ? `${PEXELS_API_BASE_URL}/search?query=${encodeURIComponent(searchQuery)}&page=${page}&per_page=${PEXELS_PER_PAGE}`
    : `${PEXELS_API_BASE_URL}/curated?page=${page}&per_page=${PEXELS_PER_PAGE}`

  const response = await fetch(
    endpoint,
    {
      cache: 'no-store',
      headers: {
        Authorization: PEXELS_API_KEY,
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Pexels-Suche konnte nicht geladen werden (${response.status})`)
  }

  const payload = (await response.json()) as PexelsSearchResponse
  return Array.isArray(payload.photos) ? payload.photos : []
}

export function isPexelsConfigured(): boolean {
  return PEXELS_API_KEY.length > 0
}

export async function fetchRandomPexelsImage(query?: string): Promise<string> {
  if (!isPexelsConfigured()) {
    throw new Error('Pexels-API-Key fehlt')
  }

  for (let attempt = 0; attempt < PEXELS_MAX_ATTEMPTS; attempt += 1) {
    const page = randomInt(1, PEXELS_RANDOM_PAGE_MAX)
    const photos = await fetchCuratedPexelsPhotos(page, query)
    const selectedPhoto = pickRandomPexelsPhoto(photos)
    const imageUrl = selectedPhoto ? getPexelsImageUrl(selectedPhoto) : null

    if (typeof selectedPhoto?.id !== 'number' || !imageUrl) {
      continue
    }

    rememberPexelsPhotoId(selectedPhoto.id)
    return fetchImageAsDataUrl(imageUrl)
  }

  throw new Error('Pexels-Bild konnte nicht gefunden werden')
}
