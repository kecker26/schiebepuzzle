import { describe, expect, it } from 'vitest'
import { buildCollectionDisplayEntries } from '../screens/upload/UploadCollectionDisplayUtils.ts'
import type { ImageCollection, SolvedGalleryEntry } from '../types/index.ts'

function createGalleryEntry(id: string, overrides: Partial<SolvedGalleryEntry> = {}): SolvedGalleryEntry {
  return {
    id,
    completedAt: '2026-04-24T12:00:00.000Z',
    previewImage: 'preview-a',
    sourceImage: 'source-a',
    config: { rows: 4, cols: 4 },
    moves: 40,
    time: 120,
    actionMoves: 46,
    assistanceMode: 'hinted',
    hasDetailedProfile: true,
    ...overrides,
  }
}

function createCollection(imageIds: string[]): ImageCollection {
  return {
    id: 'collection-a',
    name: 'Natur',
    createdAt: '2026-04-24T12:00:00.000Z',
    updatedAt: '2026-04-24T12:00:00.000Z',
    imageIds,
  }
}

describe('UploadCollectionDisplayUtils', () => {
  it('zeigt pro Sammlung jedes Motiv nur einmal an', () => {
    const [displayEntry] = buildCollectionDisplayEntries(
      [createCollection(['motif-a-old', 'motif-a-new', 'motif-b'])],
      [
        createGalleryEntry('motif-a-old', {
          completedAt: '2026-04-22T12:00:00.000Z',
          sourceImage: 'source-a',
          previewImage: 'preview-a',
        }),
        createGalleryEntry('motif-a-new', {
          completedAt: '2026-04-24T12:00:00.000Z',
          sourceImage: 'source-a',
          previewImage: 'preview-a',
          config: { rows: 5, cols: 5 },
        }),
        createGalleryEntry('motif-b', {
          completedAt: '2026-04-23T12:00:00.000Z',
          sourceImage: 'source-b',
          previewImage: 'preview-b',
        }),
      ]
    )

    expect(displayEntry.entries.map((entry) => entry.id)).toEqual(['motif-a-new', 'motif-b'])
  })
})
