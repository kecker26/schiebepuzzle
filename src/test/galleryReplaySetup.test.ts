import { describe, expect, it } from 'vitest'
import type { SolvedGalleryEntry } from '../types/index.ts'
import {
  createGalleryChallengeTarget,
  hasGalleryChallengeSetup,
  isGalleryChallengeTargetEligible,
  isGalleryReplaySetupCompatible,
} from '../utils/galleryReplaySetup.ts'

const config = { rows: 2, cols: 2 }
const replaySetup = {
  version: 1,
  startBoard: [1, 2, 0, 3],
  emptyIndex: 3,
  shuffleMoves: ['tile-2'],
  optimalStartMoveCount: 1,
  optimalStartMoveCountKind: 'exact',
} satisfies NonNullable<SolvedGalleryEntry['replaySetup']>

function createEntry(overrides: Partial<SolvedGalleryEntry> = {}): SolvedGalleryEntry {
  return {
    id: 'entry-a',
    completedAt: '2026-05-16T10:00:00.000Z',
    previewImage: 'preview',
    sourceImage: 'source',
    config,
    moves: 12,
    time: 31,
    actionMoves: 14,
    assistanceMode: 'clean',
    hasDetailedProfile: true,
    ...overrides,
  }
}

describe('galleryReplaySetup', () => {
  it('akzeptiert einen vollstaendigen Startzustand für die passende Puzzle-Groesse', () => {
    expect(isGalleryReplaySetupCompatible({
      version: 1,
      startBoard: [1, 2, 0, 3],
      emptyIndex: 3,
      shuffleMoves: ['tile-2', 'tile-3'],
      optimalStartMoveCount: 2,
      optimalStartMoveCountKind: 'exact',
    }, config)).toBe(true)
  })

  it('lehnt unpassende oder kaputte Startboards ab', () => {
    expect(isGalleryReplaySetupCompatible({
      version: 1,
      startBoard: [1, 2, 2, 3],
      emptyIndex: 3,
      shuffleMoves: [],
    }, config)).toBe(false)

    expect(isGalleryReplaySetupCompatible({
      version: 1,
      startBoard: [1, 2, 0, 3],
      emptyIndex: 2,
      shuffleMoves: [],
    }, config)).toBe(false)
  })

  it('erstellt Challenge-Zieldaten aus einem Galerieeintrag', () => {
    const entry = createEntry({
      replaySetup,
    })

    expect(hasGalleryChallengeSetup(entry)).toBe(true)
    expect(createGalleryChallengeTarget(entry)).toMatchObject({
      entryId: 'entry-a',
      time: 31,
      actionMoves: 14,
      optimalStartMoveCount: 1,
      optimalStartMoveCountKind: 'exact',
    })
  })

  it('erlaubt nur cleane Detailprofile als Medaillen-Vorlage', () => {
    expect(isGalleryChallengeTargetEligible(createEntry({ replaySetup }))).toBe(true)
    expect(isGalleryChallengeTargetEligible(createEntry({
      replaySetup,
      assistanceMode: 'auto-assisted',
    }))).toBe(false)
    expect(isGalleryChallengeTargetEligible(createEntry({
      replaySetup,
      assistanceMode: 'hinted',
    }))).toBe(false)
    expect(isGalleryChallengeTargetEligible(createEntry({
      replaySetup,
      hasDetailedProfile: false,
    }))).toBe(false)
    expect(isGalleryChallengeTargetEligible(createEntry())).toBe(false)
  })
})
