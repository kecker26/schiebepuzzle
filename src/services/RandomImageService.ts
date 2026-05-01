import { fetchRandomArtInstituteImage } from './ArtInstituteImageProvider.ts'
import { createGeneratedRandomImage } from './GeneratedImageProvider.ts'
import { fetchRandomMetMuseumImage } from './MetMuseumImageProvider.ts'
import { fetchRandomNasaImage } from './NasaImageProvider.ts'
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
  fetch: () => Promise<string>
}

function shuffleProviders<T>(providers: T[]): T[] {
  const result = [...providers]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

export async function fetchRandomPuzzleImageResult(): Promise<RandomPuzzleImageResult> {
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
        label: 'Pexels',
        url: 'https://www.pexels.com/api/',
      },
      fetch: () => fetchRandomPexelsImage(),
    },
    {
      source: {
        label: 'Pixabay',
        url: 'https://pixabay.com/',
      },
      fetch: () => fetchRandomPixabayImage(),
    },
    {
      source: {
        label: 'NASA Image Library',
        url: 'https://images.nasa.gov/',
      },
      fetch: () => fetchRandomNasaImage(),
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
      fetch: () => fetchRandomSmithsonianImage(),
    })
  }

  const shuffledProviders = shuffleProviders(providers)

  for (const provider of shuffledProviders) {
    try {
      return {
        imageSrc: await provider.fetch(),
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

export async function fetchRandomPuzzleImage(): Promise<string> {
  const result = await fetchRandomPuzzleImageResult()
  return result.imageSrc
}
