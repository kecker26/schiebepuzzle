import { ImageCollection, SolvedGalleryEntry } from '../../types/index'

export interface CollectionDisplayEntry {
  collection: ImageCollection
  entries: SolvedGalleryEntry[]
  previewEntry: SolvedGalleryEntry | null
  missingImageCount: number
}

function parseTimestamp(timestamp: string | null | undefined): number {
  if (!timestamp) return Number.NEGATIVE_INFINITY
  const parsed = Date.parse(timestamp)
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed
}

export function buildGalleryEntryMap(entries: SolvedGalleryEntry[]): Map<string, SolvedGalleryEntry> {
  return new Map(entries.map((entry) => [entry.id, entry]))
}

export function buildCollectionDisplayEntries(
  collections: ImageCollection[],
  galleryEntries: SolvedGalleryEntry[]
): CollectionDisplayEntry[] {
  const galleryEntryMap = buildGalleryEntryMap(galleryEntries)

  return collections.map((collection) => {
    const entries = collection.imageIds
      .map((imageId) => galleryEntryMap.get(imageId) ?? null)
      .filter((entry): entry is SolvedGalleryEntry => entry !== null)
      .sort((a, b) => parseTimestamp(b.completedAt) - parseTimestamp(a.completedAt))

    return {
      collection,
      entries,
      previewEntry: entries[0] ?? null,
      missingImageCount: Math.max(0, collection.imageIds.length - entries.length),
    }
  })
}

export function formatCollectionImageCount(count: number): string {
  return `${count} ${count === 1 ? 'Motiv' : 'Motive'}`
}
