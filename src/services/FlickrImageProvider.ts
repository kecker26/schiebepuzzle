const FLICKR_API_BASE_URL = 'https://www.flickr.com/services/rest/'
const FLICKR_API_KEY = import.meta.env.VITE_FLICKR_API_KEY?.trim() ?? ''
const FLICKR_MAX_ATTEMPTS = 4
const FLICKR_PER_PAGE = 50
const FLICKR_RANDOM_PAGE_MAX = 40
const FLICKR_RECENT_IMAGE_MEMORY = 10
const FLICKR_USABLE_LICENSES = '4,5,7,8,9,10'

interface FlickrPhoto {
  id?: string
  url_l?: string
  url_c?: string
  url_z?: string
  url_o?: string
}

interface FlickrSearchResponse {
  photos?: {
    pages?: number
    photo?: FlickrPhoto[]
  }
}

interface ImageProxyResponse {
  imageDataUrl: string
}

const recentFlickrPhotoIds: string[] = []

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function rememberFlickrPhotoId(photoId: string): void {
  recentFlickrPhotoIds.unshift(photoId)
  while (recentFlickrPhotoIds.length > FLICKR_RECENT_IMAGE_MEMORY) {
    recentFlickrPhotoIds.pop()
  }
}

function getFlickrImageUrl(photo: FlickrPhoto): string | null {
  return photo.url_l ?? photo.url_c ?? photo.url_z ?? photo.url_o ?? null
}

function pickRandomFlickrPhoto(photos: FlickrPhoto[]): FlickrPhoto | null {
  const candidates = photos.filter((photo) => {
    return typeof photo.id === 'string'
      && photo.id.trim().length > 0
      && getFlickrImageUrl(photo) !== null
  })

  if (candidates.length === 0) {
    return null
  }

  const recentIds = new Set(recentFlickrPhotoIds)
  const freshCandidates = candidates.filter((photo) => !recentIds.has(photo.id as string))
  const pool = freshCandidates.length > 0 ? freshCandidates : candidates
  return pool[Math.floor(Math.random() * pool.length)] ?? null
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
    throw new Error(`Flickr-Bild konnte nicht geladen werden (${response.status})`)
  }

  const payload = (await response.json()) as ImageProxyResponse
  if (typeof payload.imageDataUrl !== 'string' || !payload.imageDataUrl.startsWith('data:image/')) {
    throw new Error('Flickr-Bilddaten konnten nicht gelesen werden')
  }

  return payload.imageDataUrl
}

async function fetchFlickrPhotos(page: number, query?: string): Promise<FlickrSearchResponse> {
  const params = new URLSearchParams({
    method: 'flickr.photos.search',
    api_key: FLICKR_API_KEY,
    format: 'json',
    nojsoncallback: '1',
    media: 'photos',
    content_type: '1',
    safe_search: '1',
    license: FLICKR_USABLE_LICENSES,
    sort: query?.trim() ? 'relevance' : 'interestingness-desc',
    extras: 'url_l,url_c,url_z,url_o,license,owner_name',
    page: String(page),
    per_page: String(FLICKR_PER_PAGE),
  })

  const searchQuery = query?.trim()
  if (searchQuery) {
    params.set('text', searchQuery)
  }

  const response = await fetch(`${FLICKR_API_BASE_URL}?${params.toString()}`, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Flickr-Suche konnte nicht geladen werden (${response.status})`)
  }

  return (await response.json()) as FlickrSearchResponse
}

export function isFlickrConfigured(): boolean {
  return FLICKR_API_KEY.length > 0
}

export async function fetchRandomFlickrImage(query?: string): Promise<string> {
  if (!isFlickrConfigured()) {
    throw new Error('Flickr-API-Key fehlt')
  }

  const searchQuery = query?.trim()
  let maxPage = FLICKR_RANDOM_PAGE_MAX

  for (let attempt = 0; attempt < FLICKR_MAX_ATTEMPTS; attempt += 1) {
    const page = searchQuery && attempt === 0 ? 1 : randomInt(1, maxPage)
    const searchResult = await fetchFlickrPhotos(page, searchQuery)
    const pages = searchResult.photos?.pages
    if (typeof pages === 'number' && Number.isFinite(pages) && pages > 0) {
      maxPage = Math.max(1, Math.min(FLICKR_RANDOM_PAGE_MAX, pages))
    }

    const selectedPhoto = pickRandomFlickrPhoto(searchResult.photos?.photo ?? [])
    const imageUrl = selectedPhoto ? getFlickrImageUrl(selectedPhoto) : null

    if (!selectedPhoto?.id || !imageUrl) {
      continue
    }

    rememberFlickrPhotoId(selectedPhoto.id)
    return fetchImageAsDataUrl(imageUrl)
  }

  throw new Error('Flickr-Bild konnte nicht gefunden werden')
}
