import { fetchRandomArtInstituteImage } from './ArtInstituteImageProvider.ts'
import { createGeneratedRandomImage } from './GeneratedImageProvider.ts'
import { fetchRandomLoremFlickrImage } from './LoremFlickrImageProvider.ts'
import { fetchRandomMetMuseumImage } from './MetMuseumImageProvider.ts'
import { fetchRandomNasaImage } from './NasaImageProvider.ts'
import { fetchRandomOpenverseImage } from './OpenverseImageProvider.ts'
import { fetchRandomPexelsImage, isPexelsConfigured } from './PexelsImageProvider.ts'
import { fetchRandomPicsumImage } from './PicsumImageProvider.ts'
import { fetchRandomPixabayImage, isPixabayConfigured } from './PixabayImageProvider.ts'
import { fetchRandomSmithsonianImage, isSmithsonianConfigured } from './SmithsonianImageProvider.ts'
import { fetchRandomWikimediaImage } from './WikimediaImageProvider.ts'

export interface RandomImageSourceInfo {
  label: string
  url?: string | null
}

export interface RandomPuzzleImageResult {
  imageSrc: string
  source: RandomImageSourceInfo | null
}

interface RandomImageProvider {
  source: RandomImageSourceInfo
  supportsSearch?: boolean
  fetch: (query?: string) => Promise<string>
}

const RANDOM_IMAGE_PROVIDER_TIMEOUT_MS = 5000

function shuffleProviders<T>(providers: T[]): T[] {
  const result = [...providers]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

async function fetchProviderImageWithTimeout(
  provider: RandomImageProvider,
  query?: string
): Promise<string> {
  let timeoutId: number | null = null

  try {
    return await Promise.race([
      provider.fetch(query),
      new Promise<string>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new Error(`${provider.source.label} hat zu lange gebraucht`))
        }, RANDOM_IMAGE_PROVIDER_TIMEOUT_MS)
      }),
    ])
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId)
    }
  }
}

export async function fetchRandomPuzzleImageResult(query?: string): Promise<RandomPuzzleImageResult> {
  const searchQuery = query?.trim()
  const providers: RandomImageProvider[] = [
    {
      source: {
        label: 'Art Institute of Chicago',
        url: 'https://www.artic.edu/open-access/public-api',
      },
      fetch: () => fetchRandomArtInstituteImage(),
    },
    {
      source: {
        label: 'Lorem Picsum',
        url: 'https://picsum.photos/',
      },
      fetch: () => fetchRandomPicsumImage(),
    },
    {
      source: {
        label: 'Openverse',
        url: 'https://openverse.org/',
      },
      supportsSearch: true,
      fetch: (providerQuery) => fetchRandomOpenverseImage(providerQuery),
    },
    {
      source: {
        label: 'LoremFlickr',
        url: 'https://loremflickr.com/',
      },
      supportsSearch: true,
      fetch: (providerQuery) => fetchRandomLoremFlickrImage(providerQuery),
    },
    {
      source: {
        label: 'Pexels',
        url: 'https://www.pexels.com/api/',
      },
      supportsSearch: true,
      fetch: (providerQuery) => fetchRandomPexelsImage(providerQuery),
    },
    {
      source: {
        label: 'Pixabay',
        url: 'https://pixabay.com/',
      },
      supportsSearch: true,
      fetch: (providerQuery) => fetchRandomPixabayImage(providerQuery),
    },
    {
      source: {
        label: 'NASA Image Library',
        url: 'https://images.nasa.gov/',
      },
      supportsSearch: true,
      fetch: (providerQuery) => fetchRandomNasaImage(providerQuery),
    },
    {
      source: {
        label: 'The Met Collection',
        url: 'https://www.metmuseum.org/art/collection',
      },
      fetch: () => fetchRandomMetMuseumImage(),
    },
    {
      source: {
        label: 'Wikimedia Commons',
        url: 'https://commons.wikimedia.org/',
      },
      fetch: () => fetchRandomWikimediaImage(),
    },
  ]

  if (!isPexelsConfigured()) {
    const pexelsIndex = providers.findIndex((provider) => provider.source.label === 'Pexels')
    if (pexelsIndex >= 0) {
      providers.splice(pexelsIndex, 1)
    }
  }

  if (!isPixabayConfigured()) {
    const pixabayIndex = providers.findIndex((provider) => provider.source.label === 'Pixabay')
    if (pixabayIndex >= 0) {
      providers.splice(pixabayIndex, 1)
    }
  }

  if (isSmithsonianConfigured()) {
    providers.push({
      source: {
        label: 'Smithsonian Open Access',
        url: 'https://www.si.edu/openaccess',
      },
      supportsSearch: true,
      fetch: (providerQuery) => fetchRandomSmithsonianImage(providerQuery),
    })
  }

  const providerPool = searchQuery
    ? providers.filter((provider) => provider.supportsSearch)
    : providers
  const shuffledProviders = shuffleProviders(providerPool)

  for (const provider of shuffledProviders) {
    try {
      return {
        imageSrc: await fetchProviderImageWithTimeout(provider, searchQuery),
        source: provider.source,
      }
    } catch {
      // Try the next provider before falling back to a generated image.
    }
  }

  return {
    imageSrc: createGeneratedRandomImage(),
    source: {
      label: 'Lokaler Bildgenerator',
      url: null,
    },
  }
}

export async function fetchRandomPuzzleImage(query?: string): Promise<string> {
  const result = await fetchRandomPuzzleImageResult(query)
  return result.imageSrc
}
