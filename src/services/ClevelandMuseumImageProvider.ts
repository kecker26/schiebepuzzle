interface ClevelandArtworkImage {
  url?: string
}

interface ClevelandArtwork {
  id?: number
  images?: {
    web?: ClevelandArtworkImage
    print?: ClevelandArtworkImage
  }
}

interface ClevelandArtworksResponse {
  info?: {
    total?: number
  }
  data?: ClevelandArtwork[]
}

interface ImageProxyResponse {
  imageDataUrl: string
}

const CLEVELAND_API_BASE_URL = 'https://openaccess-api.clevelandart.org/api'
const CLEVELAND_MAX_ATTEMPTS = 5
const CLEVELAND_RESULT_WINDOW = 40
const CLEVELAND_MAX_OFFSET = 30000
const CLEVELAND_RECENT_IMAGE_MEMORY = 10

const recentClevelandArtworkIds: number[] = []

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function rememberClevelandArtworkId(artworkId: number): void {
  recentClevelandArtworkIds.unshift(artworkId)
  while (recentClevelandArtworkIds.length > CLEVELAND_RECENT_IMAGE_MEMORY) {
    recentClevelandArtworkIds.pop()
  }
}

function getClevelandImageUrl(artwork: ClevelandArtwork): string | null {
  return artwork.images?.web?.url ?? artwork.images?.print?.url ?? null
}

function pickRandomClevelandArtwork(artworks: ClevelandArtwork[]): ClevelandArtwork | null {
  const candidates = artworks.filter((artwork) => {
    return typeof artwork.id === 'number' && getClevelandImageUrl(artwork) !== null
  })

  if (candidates.length === 0) {
    return null
  }

  const recentIds = new Set(recentClevelandArtworkIds)
  const freshCandidates = candidates.filter((artwork) => !recentIds.has(artwork.id as number))
  const pool = freshCandidates.length > 0 ? freshCandidates : candidates
  return pool[Math.floor(Math.random() * pool.length)] ?? null
}

async function fetchImageAsDataUrl(imageUrl: string): Promise<string> {
  const response = await fetch('/api/image-proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: imageUrl }),
  })
  if (!response.ok) {
    throw new Error(`Cleveland-Museum-Bild konnte nicht geladen werden (${response.status})`)
  }

  const payload = (await response.json()) as ImageProxyResponse
  if (typeof payload.imageDataUrl !== 'string' || !payload.imageDataUrl.startsWith('data:image/')) {
    throw new Error('Cleveland-Museum-Bilddaten konnten nicht gelesen werden')
  }

  return payload.imageDataUrl
}

async function fetchClevelandArtworks(
  offset: number,
  query?: string
): Promise<ClevelandArtworksResponse> {
  const params = new URLSearchParams({
    has_image: '1',
    limit: String(CLEVELAND_RESULT_WINDOW),
    skip: String(offset),
    fields: 'id,images',
  })
  params.set('cc0', '')

  const searchQuery = query?.trim()
  if (searchQuery) {
    params.set('q', searchQuery)
  }

  const response = await fetch(
    `${CLEVELAND_API_BASE_URL}/artworks/?${params.toString()}`,
    { cache: 'no-store' }
  )

  if (!response.ok) {
    throw new Error(`Cleveland-Museum-Suche konnte nicht geladen werden (${response.status})`)
  }

  const payload = (await response.json()) as ClevelandArtworksResponse
  return {
    info: payload.info,
    data: Array.isArray(payload.data) ? payload.data : [],
  }
}

export async function fetchRandomClevelandMuseumImage(query?: string): Promise<string> {
  const searchQuery = query?.trim()
  let maxOffset = CLEVELAND_MAX_OFFSET

  for (let attempt = 0; attempt < CLEVELAND_MAX_ATTEMPTS; attempt += 1) {
    const offset = searchQuery && attempt === 0 ? 0 : randomInt(0, maxOffset)
    const response = await fetchClevelandArtworks(offset, searchQuery)
    const total = response.info?.total
    if (typeof total === 'number' && Number.isFinite(total) && total > 0) {
      maxOffset = Math.max(0, Math.min(CLEVELAND_MAX_OFFSET, total - CLEVELAND_RESULT_WINDOW))
    }

    const selectedArtwork = pickRandomClevelandArtwork(response.data ?? [])
    const imageUrl = selectedArtwork ? getClevelandImageUrl(selectedArtwork) : null

    if (typeof selectedArtwork?.id !== 'number' || !imageUrl) {
      continue
    }

    rememberClevelandArtworkId(selectedArtwork.id)
    return fetchImageAsDataUrl(imageUrl)
  }

  throw new Error('Cleveland-Museum-Bild konnte nicht gefunden werden')
}
