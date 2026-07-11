import { describe, expect, it } from 'vitest'
import {
  getTagCollectionImageRemovals,
  getTagCollectionSuggestions,
} from '../screens/upload/galleryTagCollectionSync.ts'
import type { GalleryImageTag, ImageCollection } from '../types/index.ts'

function createCollection(id: string, name: string, imageIds: string[]): ImageCollection {
  return {
    id,
    name,
    imageIds,
    createdAt: '2026-06-06T12:00:00.000Z',
    updatedAt: '2026-06-06T12:00:00.000Z',
  }
}

function createMotifEntry(id: string, tags: GalleryImageTag[]) {
  return { id, tags }
}

describe('galleryTagCollectionSync', () => {
  it('schlaegt namensgleiche Sammlungen für aktuelle Motiv-Tags vor', () => {
    const suggestions = getTagCollectionSuggestions(
      [
        createCollection('nature', 'Natur', []),
        createCollection('favorites', 'Favoriten', []),
      ],
      [createMotifEntry('motif', [
        { label: ' natur ', confidence: 1, source: 'manual' },
      ])]
    )

    expect(suggestions).toEqual([{
      collection: createCollection('nature', 'Natur', []),
      tagLabel: ' natur ',
      isManual: true,
    }])
  })

  it('priorisiert manuelle Tags vor anderen Tag-Sammlungsvorschlaegen', () => {
    const suggestions = getTagCollectionSuggestions(
      [
        createCollection('art', 'Kunst', []),
        createCollection('nature', 'Natur', []),
      ],
      [createMotifEntry('motif', [
        { label: 'Kunst', confidence: 0.9, source: 'gemini' },
        { label: 'Natur', confidence: 1, source: 'manual' },
      ])]
    )

    expect(suggestions.map(({ collection }) => collection.id)).toEqual(['nature', 'art'])
  })

  it('schlaegt keine Sammlung vor, die das Motiv bereits über einen anderen Lauf enthaelt', () => {
    expect(getTagCollectionSuggestions(
      [createCollection('nature', 'Natur', ['motif-old'])],
      [
        createMotifEntry('motif-new', [{ label: 'Natur', confidence: 1, source: 'manual' }]),
        createMotifEntry('motif-old', [{ label: 'Natur', confidence: 0.9, source: 'gemini' }]),
      ]
    )).toEqual([])
  })

  it('entfernt ein Motiv nur aus der namensgleichen Tag-Sammlung', () => {
    const removals = getTagCollectionImageRemovals(
      [
        createCollection('nature', 'Natur', ['motif-old', 'other']),
        createCollection('favorites', 'Favoriten', ['motif-old']),
      ],
      ['motif-old', 'motif-new'],
      [' natur ']
    )

    expect(removals).toEqual([{
      collectionId: 'nature',
      imageIds: ['motif-old'],
    }])
  })

  it('liefert keine Entfernung für nicht enthaltene Motive', () => {
    expect(getTagCollectionImageRemovals(
      [createCollection('art', 'Kunst', ['other'])],
      ['motif'],
      ['Kunst']
    )).toEqual([])
  })
})
