import { describe, expect, it } from 'vitest'
import type { SolvedGalleryEntry } from '../types/index.ts'
import {
  createCropKey,
  createSyntheticChallengeTargetId,
  estimateGalleryChallengeTarget,
  getPuzzleEstimateFloor,
  hasGallerySeriesForEstimatedTarget,
  isCleanGalleryRunBeatingEstimatedTarget,
  isCleanRunBeatingEstimatedTarget,
} from '../utils/puzzleEstimates.ts'

const replaySetup: NonNullable<SolvedGalleryEntry['replaySetup']> = {
  version: 1,
  startBoard: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 0, 15],
  emptyIndex: 15,
  shuffleMoves: ['tile-15'],
}

function createEntry(
  id: string,
  moves: number,
  time: number,
  overrides: Partial<SolvedGalleryEntry> = {}
): SolvedGalleryEntry {
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
    ...overrides,
  }
}

describe('puzzleEstimates', () => {
  it('nutzt feste Floors je Raster', () => {
    expect(getPuzzleEstimateFloor({ rows: 3, cols: 3 })).toEqual({ moves: 66, time: 99 })
    expect(getPuzzleEstimateFloor({ rows: 4, cols: 4 })).toEqual({ moves: 132, time: 220 })
    expect(getPuzzleEstimateFloor({ rows: 5, cols: 5 })).toEqual({ moves: 234, time: 434 })
    expect(getPuzzleEstimateFloor({ rows: 6, cols: 6 })).toEqual({ moves: 391, time: 720 })
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

  it('wendet persoenliche Mediane erst ab fuenf cleanen Läufen mit 25-Prozent-Cap an', () => {
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

  it('nutzt den festen synthetischen Rasterwert unabhaengig vom Startbrett', () => {
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

    expect(target.moves).toBe(66)
    expect(target.time).toBe(99)

    expect(estimateGalleryChallengeTarget({
      config: { rows: 5, cols: 5 },
      motifKey: 'source',
      cropKey: 'crop',
      replaySetup: {
        version: 1,
        startBoard: Array.from({ length: 25 }, (_, index) => index).reverse(),
        emptyIndex: 24,
        shuffleMoves: ['tile-1'],
      },
      createdAt: '2026-06-01T10:00:00.000Z',
    })).toMatchObject({ moves: 234, time: 434 })
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

  it('wertet passende frühere cleane Läufe nur dann als vorhandene synthetische Serie, wenn Zeit und Züge die Schätzung schlagen', () => {
    const target = estimateGalleryChallengeTarget({
      config: { rows: 4, cols: 4 },
      motifKey: 'source',
      cropKey: 'crop:no-transform',
      replaySetup,
      createdAt: '2026-06-01T10:00:00.000Z',
    })
    const slowerCleanRun = createEntry('slower-clean-run', target.moves + 1, target.time + 1, {
      replaySetup,
      cropTransform: null,
      useFullImage: false,
    })
    const partialBeatingCleanRun = createEntry('partial-beating-clean-run', target.moves - 1, target.time + 1, {
      replaySetup,
      cropTransform: null,
      useFullImage: false,
    })
    const beatingCleanRun = createEntry('beating-clean-run', target.moves - 1, target.time - 1, {
      replaySetup,
      cropTransform: null,
      useFullImage: false,
    })

    expect(isCleanGalleryRunBeatingEstimatedTarget(slowerCleanRun, target)).toBe(false)
    expect(hasGallerySeriesForEstimatedTarget([slowerCleanRun], target)).toBe(false)
    expect(isCleanGalleryRunBeatingEstimatedTarget(partialBeatingCleanRun, target)).toBe(false)
    expect(hasGallerySeriesForEstimatedTarget([partialBeatingCleanRun], target)).toBe(false)
    expect(isCleanGalleryRunBeatingEstimatedTarget(beatingCleanRun, target)).toBe(true)
    expect(hasGallerySeriesForEstimatedTarget([beatingCleanRun], target)).toBe(true)
    expect(isCleanRunBeatingEstimatedTarget({
      moves: target.moves - 1,
      time: target.time,
      assistanceMode: 'clean',
    }, target)).toBe(false)
  })
})
