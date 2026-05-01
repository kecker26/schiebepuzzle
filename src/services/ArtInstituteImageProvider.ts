interface ArtInstituteArtwork {
  id?: number
  image_id?: string | null
}

interface ArtInstituteSearchResponse {
  data?: ArtInstituteArtwork[]
  config?: {
    iiif_url?: string
  }
}

const ARTIC_API_BASE_URL = 'https://api.artic.edu/api/v1'
const ARTIC_MAX_ATTEMPTS = 4
const ARTIC_RESULT_WINDOW = 40
const ARTIC_MAX_OFFSET = 4000
const ARTIC_RECENT_IMAGE_MEMORY = 10

const recentArticArtworkIds: number[] = []

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

function rememberArticArtworkId(artworkId: number): void {
  recentArticArtworkIds.unshift(artworkId)
  while (recentArticArtworkIds.length > ARTIC_RECENT_IMAGE_MEMORY) {
    recentArticArtworkIds.pop()
  }
}

function pickRandomArtwork(artworks: ArtInstituteArtwork[]): ArtInstituteArtwork | null {
  const candidates = artworks.filter(
    (artwork) => typeof artwork.id === 'number' && typeof artwork.image_id === 'string' && artwork.image_id.length > 0
  )
  if (candidates.length === 0) {
    return null
  }

  const recentIds = new Set(recentArticArtworkIds)
  const freshCandidates = candidates.filter((artwork) => !recentIds.has(artwork.id as number))
  const pool = freshCandidates.length > 0 ? freshCandidates : candidates
  return pool[Math.floor(Math.random() * pool.length)] ?? null
}

function buildArtInstituteImageUrl(iiifUrl: string, imageId: string): string {
  return `${iiifUrl}/${imageId}/full/843,/0/default.jpg`
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Art-Institute-Bild konnte nicht geladen werden (${response.status})`)
  }

  return readBlobAsDataUrl(await response.blob())
}

async function searchArtInstituteImages(offset: number): Promise<ArtInstituteSearchResponse> {
  const response = await fetch(
    `${ARTIC_API_BASE_URL}/artworks/search?query[term][is_public_domain]=true&fields=id,image_id&from=${offset}&size=${ARTIC_RESULT_WINDOW}`,
    { cache: 'no-store' }
  )

  if (!response.ok) {
    throw new Error(`Art-Institute-Suche konnte nicht geladen werden (${response.status})`)
  }

  return (await response.json()) as ArtInstituteSearchResponse
}

export async function fetchRandomArtInstituteImage(): Promise<string> {
  for (let attempt = 0; attempt < ARTIC_MAX_ATTEMPTS; attempt += 1) {
    const offset = randomInt(0, ARTIC_MAX_OFFSET)
    const searchResult = await searchArtInstituteImages(offset)
    const iiifUrl = searchResult.config?.iiif_url?.trim() ?? ''
    const artwork = pickRandomArtwork(Array.isArray(searchResult.data) ? searchResult.data : [])

    if (!iiifUrl || !artwork?.image_id || typeof artwork.id !== 'number') {
      continue
    }

    rememberArticArtworkId(artwork.id)
    return fetchImageAsDataUrl(buildArtInstituteImageUrl(iiifUrl, artwork.image_id))
  }

  throw new Error('Art-Institute-Bild konnte nicht gefunden werden')
}
