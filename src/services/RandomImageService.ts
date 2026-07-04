import { fetchRandomArtInstituteImage } from './ArtInstituteImageProvider.ts'
import { fetchRandomClevelandMuseumImage } from './ClevelandMuseumImageProvider.ts'
import { fetchRandomFlickrImage, isFlickrConfigured } from './FlickrImageProvider.ts'
import { createGeneratedRandomImage } from './GeneratedImageProvider.ts'
import { fetchRandomLoremFlickrImage } from './LoremFlickrImageProvider.ts'
import { fetchRandomMetMuseumImage } from './MetMuseumImageProvider.ts'
import { fetchRandomNasaImage } from './NasaImageProvider.ts'
import { fetchRandomOpenverseImage } from './OpenverseImageProvider.ts'
import { fetchRandomPexelsImage, isPexelsConfigured } from './PexelsImageProvider.ts'
import { fetchRandomPicsumImage } from './PicsumImageProvider.ts'
import { fetchRandomPixabayImage, isPixabayConfigured } from './PixabayImageProvider.ts'
import { fetchRandomSmithsonianImage, isSmithsonianConfigured } from './SmithsonianImageProvider.ts'
import { fetchRandomUnsplashImage, isUnsplashConfigured } from './UnsplashImageProvider.ts'
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
  id: string
  source: RandomImageSourceInfo
  supportsSearch?: boolean
  weight?: number
  fetch: (query?: string) => Promise<string>
}

const RANDOM_IMAGE_PROVIDER_TIMEOUT_MS = 5000
const RANDOM_IMAGE_PROVIDER_COOLDOWN_MS = 45000
const RANDOM_IMAGE_RECENT_SUCCESS_MEMORY = 3
const RANDOM_IMAGE_RECENT_PROVIDER_WEIGHT_FACTOR = 0.35

function getBaseProviderWeight(provider: RandomImageProvider): number {
  return Math.max(0.1, provider.weight ?? 1)
}

function pickWeightedProviderIndex(
  providers: RandomImageProvider[],
  getWeight: (provider: RandomImageProvider) => number
): number {
  const totalWeight = providers.reduce((sum, provider) => sum + getWeight(provider), 0)
  if (totalWeight <= 0) {
    return Math.floor(Math.random() * providers.length)
  }

  let cursor = Math.random() * totalWeight
  for (let index = 0; index < providers.length; index += 1) {
    cursor -= getWeight(providers[index] as RandomImageProvider)
    if (cursor <= 0) {
      return index
    }
  }

  return providers.length - 1
}

function createWeightedRandomProviderOrder(
  providers: RandomImageProvider[],
  getWeight: (provider: RandomImageProvider) => number
): RandomImageProvider[] {
  const remainingProviders = [...providers]
  const orderedProviders: RandomImageProvider[] = []

  while (remainingProviders.length > 0) {
    const selectedIndex = pickWeightedProviderIndex(remainingProviders, getWeight)
    const [selectedProvider] = remainingProviders.splice(selectedIndex, 1)
    if (selectedProvider) {
      orderedProviders.push(selectedProvider)
    }
  }

  return orderedProviders
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

class RandomImageProviderCoordinator {
  private providerCooldownUntilById = new Map<string, number>()
  private recentSuccessfulProviderIdsByMode = new Map<string, string[]>()

  constructor(private readonly providers: RandomImageProvider[]) {}

  async fetch(query?: string): Promise<RandomPuzzleImageResult> {
    const searchQuery = query?.trim()
    const mode = searchQuery ? 'search' : 'random'
    const providers = searchQuery
      ? this.providers.filter((provider) => provider.supportsSearch)
      : this.providers
    const orderedProviders = this.getOrderedProviders(providers, mode)

    for (const provider of orderedProviders) {
      try {
        const imageSrc = await fetchProviderImageWithTimeout(provider, searchQuery)
        this.markProviderReady(provider, mode)
        return {
          imageSrc,
          source: provider.source,
        }
      } catch {
        this.markProviderFailure(provider)
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

  private getOrderedProviders(providers: RandomImageProvider[], mode: string): RandomImageProvider[] {
    const readyProviderIds = new Set(
      providers
        .filter((provider) => (this.providerCooldownUntilById.get(provider.id) ?? 0) <= Date.now())
        .map((provider) => provider.id)
    )
    const readyProviders = providers.filter((provider) => readyProviderIds.has(provider.id))
    const providerPool = readyProviders.length > 0 ? readyProviders : providers
    if (providerPool.length === 0) {
      return []
    }

    return createWeightedRandomProviderOrder(
      providerPool,
      (provider) => this.getProviderWeight(provider, mode)
    )
  }

  private getProviderWeight(provider: RandomImageProvider, mode: string): number {
    const recentProviderIds = this.recentSuccessfulProviderIdsByMode.get(mode) ?? []
    const recentIndex = recentProviderIds.indexOf(provider.id)
    if (recentIndex < 0) {
      return getBaseProviderWeight(provider)
    }

    const recencyFactor = RANDOM_IMAGE_RECENT_PROVIDER_WEIGHT_FACTOR + (recentIndex * 0.15)
    return getBaseProviderWeight(provider) * Math.min(1, recencyFactor)
  }

  private markProviderReady(provider: RandomImageProvider, mode: string): void {
    this.providerCooldownUntilById.delete(provider.id)
    this.rememberSuccessfulProvider(provider, mode)
  }

  private markProviderFailure(provider: RandomImageProvider): void {
    this.providerCooldownUntilById.set(provider.id, Date.now() + RANDOM_IMAGE_PROVIDER_COOLDOWN_MS)
  }

  private rememberSuccessfulProvider(provider: RandomImageProvider, mode: string): void {
    const currentProviderIds = this.recentSuccessfulProviderIdsByMode.get(mode) ?? []
    const nextProviderIds = [
      provider.id,
      ...currentProviderIds.filter((providerId) => providerId !== provider.id),
    ].slice(0, RANDOM_IMAGE_RECENT_SUCCESS_MEMORY)
    this.recentSuccessfulProviderIdsByMode.set(mode, nextProviderIds)
  }
}

function createRandomImageProviders(): RandomImageProvider[] {
  const providers: RandomImageProvider[] = [
    {
      id: 'art-institute',
      source: {
        label: 'Art Institute of Chicago',
        url: 'https://www.artic.edu/open-access/public-api',
      },
      weight: 2,
      fetch: () => fetchRandomArtInstituteImage(),
    },
    {
      id: 'cleveland-museum',
      source: {
        label: 'Cleveland Museum of Art',
        url: 'https://openaccess-api.clevelandart.org/',
      },
      supportsSearch: true,
      weight: 2,
      fetch: (providerQuery) => fetchRandomClevelandMuseumImage(providerQuery),
    },
    {
      id: 'picsum',
      source: {
        label: 'Lorem Picsum',
        url: 'https://picsum.photos/',
      },
      fetch: () => fetchRandomPicsumImage(),
    },
    {
      id: 'openverse',
      source: {
        label: 'Openverse',
        url: 'https://openverse.org/',
      },
      supportsSearch: true,
      fetch: (providerQuery) => fetchRandomOpenverseImage(providerQuery),
    },
    {
      id: 'flickr',
      source: {
        label: 'Flickr',
        url: 'https://www.flickr.com/services/api/flickr.photos.search.html',
      },
      supportsSearch: true,
      fetch: (providerQuery) => fetchRandomFlickrImage(providerQuery),
    },
    {
      id: 'unsplash',
      source: {
        label: 'Unsplash',
        url: 'https://unsplash.com/developers',
      },
      supportsSearch: true,
      fetch: (providerQuery) => fetchRandomUnsplashImage(providerQuery),
    },
    {
      id: 'lorem-flickr',
      source: {
        label: 'LoremFlickr',
        url: 'https://loremflickr.com/',
      },
      supportsSearch: true,
      fetch: (providerQuery) => fetchRandomLoremFlickrImage(providerQuery),
    },
    {
      id: 'pexels',
      source: {
        label: 'Pexels',
        url: 'https://www.pexels.com/api/',
      },
      supportsSearch: true,
      fetch: (providerQuery) => fetchRandomPexelsImage(providerQuery),
    },
    {
      id: 'pixabay',
      source: {
        label: 'Pixabay',
        url: 'https://pixabay.com/',
      },
      supportsSearch: true,
      fetch: (providerQuery) => fetchRandomPixabayImage(providerQuery),
    },
    {
      id: 'nasa',
      source: {
        label: 'NASA Image Library',
        url: 'https://images.nasa.gov/',
      },
      supportsSearch: true,
      fetch: (providerQuery) => fetchRandomNasaImage(providerQuery),
    },
    {
      id: 'met',
      source: {
        label: 'The Met Collection',
        url: 'https://www.metmuseum.org/art/collection',
      },
      weight: 2,
      fetch: () => fetchRandomMetMuseumImage(),
    },
    {
      id: 'wikimedia',
      source: {
        label: 'Wikimedia Commons',
        url: 'https://commons.wikimedia.org/',
      },
      fetch: () => fetchRandomWikimediaImage(),
    },
  ]

  if (!isFlickrConfigured()) {
    const flickrIndex = providers.findIndex((provider) => provider.id === 'flickr')
    if (flickrIndex >= 0) {
      providers.splice(flickrIndex, 1)
    }
  }

  if (!isUnsplashConfigured()) {
    const unsplashIndex = providers.findIndex((provider) => provider.id === 'unsplash')
    if (unsplashIndex >= 0) {
      providers.splice(unsplashIndex, 1)
    }
  }

  if (!isPexelsConfigured()) {
    const pexelsIndex = providers.findIndex((provider) => provider.id === 'pexels')
    if (pexelsIndex >= 0) {
      providers.splice(pexelsIndex, 1)
    }
  }

  if (!isPixabayConfigured()) {
    const pixabayIndex = providers.findIndex((provider) => provider.id === 'pixabay')
    if (pixabayIndex >= 0) {
      providers.splice(pixabayIndex, 1)
    }
  }

  if (isSmithsonianConfigured()) {
    providers.push({
      id: 'smithsonian',
      source: {
        label: 'Smithsonian Open Access',
        url: 'https://www.si.edu/openaccess',
      },
      supportsSearch: true,
      fetch: (providerQuery) => fetchRandomSmithsonianImage(providerQuery),
    })
  }

  return providers
}

const randomImageProviderCoordinator = new RandomImageProviderCoordinator(createRandomImageProviders())

export async function fetchRandomPuzzleImageResult(query?: string): Promise<RandomPuzzleImageResult> {
  return randomImageProviderCoordinator.fetch(query)
}

export async function fetchRandomPuzzleImage(query?: string): Promise<string> {
  const result = await fetchRandomPuzzleImageResult(query)
  return result.imageSrc
}
