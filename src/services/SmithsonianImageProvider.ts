const SMITHSONIAN_API_BASE_URL = 'https://api.si.edu/openaccess/api/v1.0'
const SMITHSONIAN_API_KEY = import.meta.env.VITE_SMITHSONIAN_API_KEY?.trim() ?? ''
const SMITHSONIAN_MAX_ATTEMPTS = 4
const SMITHSONIAN_ROWS = 40
const SMITHSONIAN_RECENT_IMAGE_MEMORY = 10
const SMITHSONIAN_IMAGE_QUERY = 'online_media_type:Images'

const recentSmithsonianIds: string[] = []

interface SmithsonianMediaEntry {
  content?: string
  thumbnail?: string
  type?: string
}

interface SmithsonianRow {
  id?: string
  content?: {
    descriptiveNonRepeating?: {
      online_media?: {
        media?: SmithsonianMediaEntry[]
        content?: string
        thumbnail?: string
      }
    }
  }
}

interface SmithsonianSearchResponse {
  response?: {
    rows?: SmithsonianRow[]
  }
}

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

function rememberSmithsonianId(id: string): void {
  recentSmithsonianIds.unshift(id)
  while (recentSmithsonianIds.length > SMITHSONIAN_RECENT_IMAGE_MEMORY) {
    recentSmithsonianIds.pop()
  }
}

function extractSmithsonianImageUrl(row: SmithsonianRow): string | null {
  const onlineMedia = row.content?.descriptiveNonRepeating?.online_media
  const mediaEntries = Array.isArray(onlineMedia?.media) ? onlineMedia.media : []

  for (const mediaEntry of mediaEntries) {
    if (typeof mediaEntry.content === 'string' && mediaEntry.content.trim().length > 0) {
      return mediaEntry.content
    }
    if (typeof mediaEntry.thumbnail === 'string' && mediaEntry.thumbnail.trim().length > 0) {
      return mediaEntry.thumbnail
    }
  }

  if (typeof onlineMedia?.content === 'string' && onlineMedia.content.trim().length > 0) {
    return onlineMedia.content
  }

  if (typeof onlineMedia?.thumbnail === 'string' && onlineMedia.thumbnail.trim().length > 0) {
    return onlineMedia.thumbnail
  }

  return null
}

function pickRandomSmithsonianRow(rows: SmithsonianRow[]): SmithsonianRow | null {
  const candidates = rows.filter((row) => typeof row.id === 'string' && extractSmithsonianImageUrl(row) !== null)
  if (candidates.length === 0) {
    return null
  }

  const recentIds = new Set(recentSmithsonianIds)
  const freshCandidates = candidates.filter((row) => !recentIds.has(row.id as string))
  const pool = freshCandidates.length > 0 ? freshCandidates : candidates
  return pool[Math.floor(Math.random() * pool.length)] ?? null
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Smithsonian-Bild konnte nicht geladen werden (${response.status})`)
  }

  return readBlobAsDataUrl(await response.blob())
}

async function searchSmithsonianImages(query: string): Promise<SmithsonianRow[]> {
  const response = await fetch(
    `${SMITHSONIAN_API_BASE_URL}/search?api_key=${encodeURIComponent(SMITHSONIAN_API_KEY)}&q=${encodeURIComponent(query)}&start=0&rows=${SMITHSONIAN_ROWS}&sort=random`,
    { cache: 'no-store' }
  )

  if (!response.ok) {
    throw new Error(`Smithsonian-Suche konnte nicht geladen werden (${response.status})`)
  }

  const payload = (await response.json()) as SmithsonianSearchResponse
  return Array.isArray(payload.response?.rows) ? payload.response.rows : []
}

export function isSmithsonianConfigured(): boolean {
  return SMITHSONIAN_API_KEY.length > 0
}

export async function fetchRandomSmithsonianImage(): Promise<string> {
  if (!isSmithsonianConfigured()) {
    throw new Error('Smithsonian-API-Key fehlt')
  }

  for (let attempt = 0; attempt < SMITHSONIAN_MAX_ATTEMPTS; attempt += 1) {
    const rows = await searchSmithsonianImages(SMITHSONIAN_IMAGE_QUERY)
    const selectedRow = pickRandomSmithsonianRow(rows)
    const imageUrl = selectedRow ? extractSmithsonianImageUrl(selectedRow) : null

    if (!selectedRow?.id || !imageUrl) {
      continue
    }

    rememberSmithsonianId(selectedRow.id)
    return fetchImageAsDataUrl(imageUrl)
  }

  throw new Error('Smithsonian-Bild konnte nicht gefunden werden')
}
