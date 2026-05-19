import { describe, expect, it } from 'vitest'
import type { SolvedGalleryEntry } from '../types/index.ts'
import {
  buildGalleryDisplayEntries,
  getUniqueGalleryMotifEntryIds,
} from '../screens/upload/UploadGalleryDisplayUtils.ts'
import { galleryDisplayEntryMatchesAllTagKeys, getGalleryTagKey } from '../screens/upload/UploadGalleryPanel.tsx'

function createGalleryEntry(
  id: string,
  overrides: Partial<SolvedGalleryEntry> = {}
): SolvedGalleryEntry {
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

describe('UploadGalleryDisplayUtils', () => {
  it('verknuepft gleiche Motive ueber mehrere Schwierigkeitsstufen fuer Replay-Metadaten', () => {
    const entries = buildGalleryDisplayEntries(
      [
        createGalleryEntry('motif-a-4x4-latest', {
          completedAt: '2026-04-24T12:00:00.000Z',
          config: { rows: 4, cols: 4 },
          time: 132,
          moves: 44,
          assistanceMode: 'hinted',
        }),
        createGalleryEntry('motif-a-4x4-best', {
          completedAt: '2026-04-20T12:00:00.000Z',
          config: { rows: 4, cols: 4 },
          time: 110,
          moves: 38,
          assistanceMode: 'auto-assisted',
        }),
        createGalleryEntry('motif-a-5x5-clean', {
          completedAt: '2026-04-22T12:00:00.000Z',
          config: { rows: 5, cols: 5 },
          time: 205,
          moves: 70,
          assistanceMode: 'clean',
        }),
        createGalleryEntry('motif-b-4x4', {
          completedAt: '2026-04-23T12:00:00.000Z',
          previewImage: 'preview-b',
          sourceImage: 'source-b',
          config: { rows: 4, cols: 4 },
          time: 95,
          moves: 35,
          assistanceMode: 'clean',
        }),
      ],
      {
        difficultyFilter: 'all',
        assistanceFilter: 'all',
      }
    )

    const targetEntry = entries.find(
      (entry) =>
        entry.representativeEntry.id === 'motif-a-4x4-latest'
        && entry.representativeEntry.config.rows === 4
        && entry.representativeEntry.config.cols === 4
    )

    expect(targetEntry).toBeDefined()
    expect(targetEntry).toMatchObject({
      totalSolveCount: 3,
      visibleSolveCount: 3,
      motifReplaySummary: {
        totalSolveCount: 3,
        replayableSolveCount: 3,
        difficultyVariants: [
          { rows: 4, cols: 4 },
          { rows: 5, cols: 5 },
        ],
      },
    })
    expect(targetEntry?.motifReplaySummary.lastReplayableEntry?.id).toBe('motif-a-4x4-latest')
    expect(targetEntry?.motifReplaySummary.bestTimeEntry?.id).toBe('motif-a-4x4-best')
    expect(targetEntry?.motifReplaySummary.bestMovesEntry?.id).toBe('motif-a-4x4-best')
    expect(targetEntry?.motifReplaySummary.bestCleanTimeEntry?.id).toBe('motif-a-5x5-clean')
    expect(targetEntry?.motifReplaySummary.allEntries.map((entry) => entry.id)).toEqual([
      'motif-a-4x4-latest',
      'motif-a-5x5-clean',
      'motif-a-4x4-best',
    ])
  })

  it('behaelt motivweite Replay-Daten auch dann, wenn die sichtbare Karte gefiltert ist', () => {
    const entries = buildGalleryDisplayEntries(
      [
        createGalleryEntry('motif-a-4x4-hinted', {
          completedAt: '2026-04-24T12:00:00.000Z',
          config: { rows: 4, cols: 4 },
          assistanceMode: 'hinted',
        }),
        createGalleryEntry('motif-a-5x5-clean', {
          completedAt: '2026-04-22T12:00:00.000Z',
          config: { rows: 5, cols: 5 },
          assistanceMode: 'clean',
          time: 210,
        }),
      ],
      {
        difficultyFilter: 'all',
        assistanceFilter: 'clean',
      }
    )

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      totalSolveCount: 2,
      visibleSolveCount: 1,
      motifReplaySummary: {
        totalSolveCount: 2,
        replayableSolveCount: 2,
        difficultyVariants: [
          { rows: 4, cols: 4 },
          { rows: 5, cols: 5 },
        ],
      },
    })
  })

  it('markiert Motive ohne gespeichertes Bild defensiv als nicht replaybar', () => {
    const entries = buildGalleryDisplayEntries(
      [
        createGalleryEntry('missing-image', {
          previewImage: null,
          sourceImage: null,
          hasDetailedProfile: false,
        }),
      ],
      {
        difficultyFilter: 'all',
        assistanceFilter: 'all',
      }
    )

    expect(entries).toHaveLength(1)
    expect(entries[0].motifReplaySummary).toMatchObject({
      totalSolveCount: 1,
      replayableSolveCount: 0,
      lastReplayableEntry: null,
      bestTimeEntry: null,
      bestMovesEntry: null,
      bestCleanTimeEntry: null,
    })
  })

  it('dedupliziert Galerie-Eintraege motivweit fuer Sammlungen', () => {
    const ids = getUniqueGalleryMotifEntryIds([
      createGalleryEntry('motif-a-latest', {
        completedAt: '2026-04-24T12:00:00.000Z',
        previewImage: 'preview-a',
        sourceImage: 'source-a',
        config: { rows: 4, cols: 4 },
      }),
      createGalleryEntry('motif-a-other-run', {
        completedAt: '2026-04-23T12:00:00.000Z',
        previewImage: 'preview-a',
        sourceImage: 'source-a',
        config: { rows: 5, cols: 5 },
      }),
      createGalleryEntry('motif-b', {
        completedAt: '2026-04-22T12:00:00.000Z',
        previewImage: 'preview-b',
        sourceImage: 'source-b',
      }),
    ])

    expect(ids).toEqual(['motif-a-latest', 'motif-b'])
  })

  it('filtert Galerie-Karten nur, wenn alle ausgewaehlten Tags am Motiv vorhanden sind', () => {
    const entry = {
      visibleEntries: [
        createGalleryEntry('motif-a-latest', {
          tags: [
            { label: 'Wald', confidence: 0.92, source: 'gemini' },
            { label: 'See', confidence: 0.88, source: 'gemini' },
          ],
        }),
      ],
    }

    expect(galleryDisplayEntryMatchesAllTagKeys(entry, [getGalleryTagKey('wald'), getGalleryTagKey('see')])).toBe(true)
    expect(galleryDisplayEntryMatchesAllTagKeys(entry, [getGalleryTagKey('wald'), getGalleryTagKey('stadt')])).toBe(false)
  })
})
