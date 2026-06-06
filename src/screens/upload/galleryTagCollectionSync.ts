import type { ImageCollection, SolvedGalleryEntry } from '../../types/index.ts'

export interface TagCollectionImageRemoval {
  collectionId: string
  imageIds: string[]
}

export interface TagCollectionSuggestion {
  collection: ImageCollection
  tagLabel: string
  isManual: boolean
}

function getTagCollectionKey(label: string): string {
  return label.trim().toLocaleLowerCase('de-DE')
}

export function getTagCollectionSuggestions(
  collections: ImageCollection[],
  motifEntries: Array<Pick<SolvedGalleryEntry, 'id' | 'tags'>>
): TagCollectionSuggestion[] {
  const motifEntryIds = new Set(motifEntries.map((entry) => entry.id))
  const tagsByKey = new Map<string, { label: string; isManual: boolean }>()

  for (const entry of motifEntries) {
    for (const tag of entry.tags ?? []) {
      const tagKey = getTagCollectionKey(tag.label)
      if (!tagKey) continue

      const current = tagsByKey.get(tagKey)
      if (!current || tag.source === 'manual') {
        tagsByKey.set(tagKey, {
          label: tag.label,
          isManual: tag.source === 'manual',
        })
      }
    }
  }

  return collections
    .flatMap((collection) => {
      if (collection.imageIds.some((imageId) => motifEntryIds.has(imageId))) {
        return []
      }

      const matchingTag = tagsByKey.get(getTagCollectionKey(collection.name))
      return matchingTag
        ? [{
            collection,
            tagLabel: matchingTag.label,
            isManual: matchingTag.isManual,
          }]
        : []
    })
    .sort((a, b) => Number(b.isManual) - Number(a.isManual))
}

export function getTagCollectionImageRemovals(
  collections: ImageCollection[],
  motifEntryIds: string[],
  removedTagLabels: string[]
): TagCollectionImageRemoval[] {
  const removedTagKeys = new Set(
    removedTagLabels.map(getTagCollectionKey).filter(Boolean)
  )
  const motifEntryIdSet = new Set(motifEntryIds)

  if (removedTagKeys.size === 0 || motifEntryIdSet.size === 0) {
    return []
  }

  return collections.flatMap((collection) => {
    if (!removedTagKeys.has(getTagCollectionKey(collection.name))) {
      return []
    }

    const imageIds = collection.imageIds.filter((imageId) => motifEntryIdSet.has(imageId))
    return imageIds.length > 0 ? [{ collectionId: collection.id, imageIds }] : []
  })
}
