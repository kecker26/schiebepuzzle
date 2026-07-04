const UNSPLASH_API_BASE_URL = 'https://api.unsplash.com'
const UNSPLASH_ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY?.trim() ?? ''
const UNSPLASH_MAX_ATTEMPTS = 4
const UNSPLASH_PER_PAGE = 30
const UNSPLASH_RANDOM_PAGE_MAX = 40
const UNSPLASH_RECENT_IMAGE_MEMORY = 10

interface UnsplashPhotoUrls {
  regular?: string
  full?: string
  raw?: string
}

interface UnsplashPhotoLinks {
  download_location?: string
}

interface UnsplashPhoto {
  id?: string
  urls?: UnsplashPhotoUrls
  links?: UnsplashPhotoLinks
}

interface UnsplashSearchResponse {
  total_pages?: number
  results?: UnsplashPhoto[]
}

interface ImageProxyResponse {
  imageDataUrl: string
}

const recentUnsplashPhotoIds: string[] = []

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function rememberUnsplashPhotoId(photoId: string): void {
  recentUnsplashPhotoIds.unshift(photoId)
  while (recentUnsplashPhotoIds.length > UNSPLASH_RECENT_IMAGE_MEMORY) {
    recentUnsplashPhotoIds.pop()
  }
}

function getUnsplashImageUrl(photo: UnsplashPhoto): string | null {
  return photo.urls?.regular ?? photo.urls?.full ?? photo.urls?.raw ?? null
}

function pickRandomUnsplashPhoto(photos: UnsplashPhoto[]): UnsplashPhoto | null {
  const candidates = photos.filter((photo) => {
    return typeof photo.id === 'string'
      && photo.id.trim().length > 0
      && getUnsplashImageUrl(photo) !== null
  })

  if (candidates.length === 0) {
    return null
  }

  const recentIds = new Set(recentUnsplashPhotoIds)
  const freshCandidates = candidates.filter((photo) => !recentIds.has(photo.id as string))
  const pool = freshCandidates.length > 0 ? freshCandidates : candidates
  return pool[Math.floor(Math.random() * pool.length)] ?? null
}

function getUnsplashHeaders(): HeadersInit {
  return {
    Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
  }
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const response = await fetch('/api/image-proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  })
  if (!response.ok) {
    throw new Error(`Unsplash-Bild konnte nicht geladen werden (${response.status})`)
  }

  const payload = (await response.json()) as ImageProxyResponse
  if (typeof payload.imageDataUrl !== 'string' || !payload.imageDataUrl.startsWith('data:image/')) {
    throw new Error('Unsplash-Bilddaten konnten nicht gelesen werden')
  }

  return payload.imageDataUrl
}

async function trackUnsplashDownload(photo: UnsplashPhoto): Promise<void> {
  const downloadLocation = photo.links?.download_location
  if (!downloadLocation) {
    return
  }

  try {
    await fetch(downloadLocation, {
      cache: 'no-store',
      headers: getUnsplashHeaders(),
    })
  } catch {
    // Tracking should not block a usable image.
  }
}

async function fetchRandomUnsplashPhoto(): Promise<UnsplashPhoto | null> {
  const response = await fetch(`${UNSPLASH_API_BASE_URL}/photos/random`, {
    cache: 'no-store',
    headers: getUnsplashHeaders(),
  })

  if (!response.ok) {
    throw new Error(`Unsplash-Zufallsbild konnte nicht geladen werden (${response.status})`)
  }

  return (await response.json()) as UnsplashPhoto
}

async function fetchUnsplashSearchPhotos(page: number, query: string): Promise<UnsplashSearchResponse> {
  const params = new URLSearchParams({
    query,
    content_filter: 'high',
    page: String(page),
    per_page: String(UNSPLASH_PER_PAGE),
  })

  const response = await fetch(
    `${UNSPLASH_API_BASE_URL}/search/photos?${params.toString()}`,
    {
      cache: 'no-store',
      headers: getUnsplashHeaders(),
    }
  )

  if (!response.ok) {
    throw new Error(`Unsplash-Suche konnte nicht geladen werden (${response.status})`)
  }

  return (await response.json()) as UnsplashSearchResponse
}

export function isUnsplashConfigured(): boolean {
  return UNSPLASH_ACCESS_KEY.length > 0
}

export async function fetchRandomUnsplashImage(query?: string): Promise<string> {
  if (!isUnsplashConfigured()) {
    throw new Error('Unsplash-Access-Key fehlt')
  }

  const searchQuery = query?.trim()
  let maxPage = UNSPLASH_RANDOM_PAGE_MAX

  for (let attempt = 0; attempt < UNSPLASH_MAX_ATTEMPTS; attempt += 1) {
    let selectedPhoto: UnsplashPhoto | null = null
    if (searchQuery) {
      const page = attempt === 0 ? 1 : randomInt(1, maxPage)
      const searchResult = await fetchUnsplashSearchPhotos(page, searchQuery)
      const totalPages = searchResult.total_pages
      if (typeof totalPages === 'number' && Number.isFinite(totalPages) && totalPages > 0) {
        maxPage = Math.max(1, Math.min(UNSPLASH_RANDOM_PAGE_MAX, totalPages))
      }
      selectedPhoto = pickRandomUnsplashPhoto(searchResult.results ?? [])
    } else {
      selectedPhoto = await fetchRandomUnsplashPhoto()
    }

    const imageUrl = selectedPhoto ? getUnsplashImageUrl(selectedPhoto) : null
    if (!selectedPhoto?.id || !imageUrl || recentUnsplashPhotoIds.includes(selectedPhoto.id)) {
      continue
    }

    rememberUnsplashPhotoId(selectedPhoto.id)
    void trackUnsplashDownload(selectedPhoto)
    return fetchImageAsDataUrl(imageUrl)
  }

  throw new Error('Unsplash-Bild konnte nicht gefunden werden')
}
