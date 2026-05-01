interface NasaCollectionLink {
  href?: string
  rel?: string
  render?: string
}

interface NasaCollectionItemData {
  nasa_id?: string
  media_type?: string
}

interface NasaCollectionItem {
  data?: NasaCollectionItemData[]
  links?: NasaCollectionLink[]
}

const NASA_API_BASE_URL = 'https://images-api.nasa.gov'
const NASA_SEARCH_PAGE_SIZE = 50
const NASA_RANDOM_PAGE_MAX = 12
const NASA_MAX_ATTEMPTS = 4
const NASA_RECENT_IMAGE_MEMORY = 10

const recentNasaIds: string[] = []

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

function rememberNasaId(nasaId: string): void {
  recentNasaIds.unshift(nasaId)
  while (recentNasaIds.length > NASA_RECENT_IMAGE_MEMORY) {
    recentNasaIds.pop()
  }
}

function getNasaItemId(item: NasaCollectionItem): string | null {
  return item.data?.find((entry) => typeof entry.nasa_id === 'string' && entry.nasa_id.trim().length > 0)?.nasa_id ?? null
}

function getNasaPreviewUrl(item: NasaCollectionItem): string | null {
  const preferredLink = item.links?.find(
    (link) => typeof link.href === 'string' && link.render === 'image' && link.rel === 'preview'
  )
  if (preferredLink?.href) {
    return preferredLink.href
  }

  return item.links?.find((link) => typeof link.href === 'string' && link.render === 'image')?.href ?? null
}

function pickRandomNasaItem(items: NasaCollectionItem[]): NasaCollectionItem | null {
  const candidates = items.filter((item) => {
    const nasaId = getNasaItemId(item)
    const mediaType = item.data?.find((entry) => typeof entry.media_type === 'string')?.media_type
    return nasaId !== null && mediaType === 'image' && getNasaPreviewUrl(item) !== null
  })

  if (candidates.length === 0) {
    return null
  }

  const recentIds = new Set(recentNasaIds)
  const freshCandidates = candidates.filter((item) => {
    const nasaId = getNasaItemId(item)
    return nasaId ? !recentIds.has(nasaId) : false
  })

  const pool = freshCandidates.length > 0 ? freshCandidates : candidates
  return pool[Math.floor(Math.random() * pool.length)] ?? null
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`NASA-Bild konnte nicht geladen werden (${response.status})`)
  }

  return readBlobAsDataUrl(await response.blob())
}

async function fetchNasaSearchItems(page: number): Promise<NasaCollectionItem[]> {
  const response = await fetch(
    `${NASA_API_BASE_URL}/search?media_type=image&page=${page}&page_size=${NASA_SEARCH_PAGE_SIZE}`,
    { cache: 'no-store' }
  )

  if (!response.ok) {
    throw new Error(`NASA-Suche konnte nicht geladen werden (${response.status})`)
  }

  const payload = (await response.json()) as {
    collection?: {
      items?: NasaCollectionItem[]
    }
  }

  return Array.isArray(payload.collection?.items) ? payload.collection.items : []
}

export async function fetchRandomNasaImage(): Promise<string> {
  for (let attempt = 0; attempt < NASA_MAX_ATTEMPTS; attempt += 1) {
    const page = randomInt(1, NASA_RANDOM_PAGE_MAX)
    const items = await fetchNasaSearchItems(page)
    const selectedItem = pickRandomNasaItem(items)

    if (!selectedItem) {
      continue
    }

    const nasaId = getNasaItemId(selectedItem)
    const previewUrl = getNasaPreviewUrl(selectedItem)
    if (!nasaId || !previewUrl) {
      continue
    }

    rememberNasaId(nasaId)
    return fetchImageAsDataUrl(previewUrl)
  }

  throw new Error('NASA-Bild konnte nicht gefunden werden')
}
