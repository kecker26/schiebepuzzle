import { pickRandomImageDimensions } from './RandomImageDimensions.ts'

const LOREM_FLICKR_BASE_URL = 'https://loremflickr.com'
const LOREM_FLICKR_MAX_ATTEMPTS = 3

const LOREM_FLICKR_FALLBACK_KEYWORDS = [
  'landscape',
  'nature',
  'city',
  'architecture',
  'forest',
  'mountain',
  'ocean',
  'flowers',
  'travel',
  'night',
]

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

function pickFallbackKeyword(): string {
  return LOREM_FLICKR_FALLBACK_KEYWORDS[
    Math.floor(Math.random() * LOREM_FLICKR_FALLBACK_KEYWORDS.length)
  ] ?? LOREM_FLICKR_FALLBACK_KEYWORDS[0]
}

function normalizeKeywordPath(query?: string): string {
  const keywordParts = query
    ?.trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))

  return keywordParts && keywordParts.length > 0
    ? keywordParts.join(',')
    : encodeURIComponent(pickFallbackKeyword())
}

function buildLoremFlickrImageUrl(query?: string): string {
  const dimensions = pickRandomImageDimensions()
  const cacheBust = `${Date.now()}-${Math.round(Math.random() * 1_000_000_000)}`
  return `${LOREM_FLICKR_BASE_URL}/${dimensions.width}/${dimensions.height}/${normalizeKeywordPath(query)}?random=${cacheBust}`
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`LoremFlickr-Bild konnte nicht geladen werden (${response.status})`)
  }

  return readBlobAsDataUrl(await response.blob())
}

export async function fetchRandomLoremFlickrImage(query?: string): Promise<string> {
  for (let attempt = 0; attempt < LOREM_FLICKR_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fetchImageAsDataUrl(buildLoremFlickrImageUrl(query))
    } catch {
      // Try another random URL before failing over to the next provider.
    }
  }

  throw new Error('LoremFlickr-Bild konnte nicht gefunden werden')
}
