import { describe, expect, it } from 'vitest'
import type { SolvedGalleryEntry } from '../types/index.ts'
import {
  createCropKey,
  createSyntheticChallengeTargetId,
  estimateGalleryChallengeTarget,
  getPuzzleEstimateFloor,
  hasGallerySeriesForEstimatedTarget,
} from '../utils/puzzleEstimates.ts'

const replaySetup: NonNullable<SolvedGalleryEntry['replaySetup']> = {
  version: 1,
  startBoard: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 0, 15],
  emptyIndex: 15,
  shuffleMoves: ['tile-15'],
}

function createEntry(id: string, moves: number, time: number): SolvedGalleryEntry {
  return {
    id,
    completedAt: '2026-06-01T10:00:00.000Z',
    previewImage: 'preview',
    sourceImage: 'source',
    config: { rows: 4, cols: 4 },
    moves,
    time,
    actionMoves: moves,
    assistanceMode: 'clean',
    hasDetailedProfile: true,
  }
}

describe('puzzleEstimates', () => {
  it('nutzt feste Floors je Raster', () => {
    expect(getPuzzleEstimateFloor({ rows: 3, cols: 3 })).toEqual({ moves: 60, time: 90 })
    expect(getPuzzleEstimateFloor({ rows: 4, cols: 4 })).toEqual({ moves: 180, time: 360 })
    expect(getPuzzleEstimateFloor({ rows: 5, cols: 5 })).toEqual({ moves: 360, time: 900 })
    expect(getPuzzleEstimateFloor({ rows: 6, cols: 6 })).toEqual({ moves: 600, time: 1800 })
  })

  it('erstellt stabile synthetische IDs aus Motiv, Raster, Crop und Startboard', () => {
    const cropKey = createCropKey({
      cropTransform: { zoom: 1, rotationDeg: 0, offsetX: 0.2, offsetY: -0.1 },
      useFullImage: false,
    })
    const first = createSyntheticChallengeTargetId({
      motifKey: 'source',
      config: { rows: 4, cols: 4 },
      cropKey,
      replaySetup,
    })
    const second = createSyntheticChallengeTargetId({
      motifKey: 'source',
      config: { rows: 4, cols: 4 },
      cropKey,
      replaySetup,
    })

    expect(first).toBe(second)
    expect(first).toContain('synthetic:source:4x4')
  })

  it('wendet persoenliche Mediane erst ab fuenf cleanen Laeufen mit 25-Prozent-Cap an', () => {
    const withoutMedian = estimateGalleryChallengeTarget({
      config: { rows: 4, cols: 4 },
      motifKey: 'source',
      cropKey: 'crop',
      replaySetup,
      galleryEntries: [createEntry('a', 20, 20), createEntry('b', 20, 20)],
      createdAt: '2026-06-01T10:00:00.000Z',
    })
    const withMedian = estimateGalleryChallengeTarget({
      config: { rows: 4, cols: 4 },
      motifKey: 'source',
      cropKey: 'crop',
      replaySetup,
      galleryEntries: [
        createEntry('a', 20, 20),
        createEntry('b', 20, 20),
        createEntry('c', 20, 20),
        createEntry('d', 20, 20),
        createEntry('e', 20, 20),
      ],
      createdAt: '2026-06-01T10:00:00.000Z',
    })

    expect(withoutMedian.estimate?.personalMedianApplied).toBe(false)
    expect(withMedian.estimate?.personalMedianApplied).toBe(true)
    expect(withMedian.moves).toBeGreaterThanOrEqual(Math.round(withoutMedian.moves * 0.75))
    expect(withMedian.time).toBeGreaterThanOrEqual(Math.round(withoutMedian.time * 0.75))
  })

  it('haelt 3x3-Schaetzungen auch bei hohem Heuristikscore nah am Floor', () => {
    const target = estimateGalleryChallengeTarget({
      config: { rows: 3, cols: 3 },
      motifKey: 'source',
      cropKey: 'crop',
      replaySetup: {
        version: 1,
        startBoard: [7, 6, 5, 4, 3, 2, 1, 0, 8],
        emptyIndex: 8,
        shuffleMoves: ['tile-8'],
      },
      createdAt: '2026-06-01T10:00:00.000Z',
    })

    expect(target.moves).toBeGreaterThanOrEqual(60)
    expect(target.time).toBeGreaterThanOrEqual(90)
    expect(target.moves).toBeLessThanOrEqual(75)
    expect(target.time).toBeLessThanOrEqual(113)
  })

  it('erkennt vorhandene synthetische Serien', () => {
    const target = estimateGalleryChallengeTarget({
      config: { rows: 4, cols: 4 },
      motifKey: 'source',
      cropKey: 'crop',
      replaySetup,
      createdAt: '2026-06-01T10:00:00.000Z',
    })

    expect(hasGallerySeriesForEstimatedTarget([], target.entryId)).toBe(false)
    expect(hasGallerySeriesForEstimatedTarget([
      {
        ...createEntry('soft-run', 200, 400),
        challengeTargetId: target.entryId,
        estimatedChallengeTarget: target,
      },
    ], target.entryId)).toBe(true)
  })
})
