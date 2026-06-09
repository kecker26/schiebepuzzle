import { describe, expect, it } from 'vitest'
import type { GalleryDisplayEntry } from '../screens/upload/UploadGalleryDisplayUtils.ts'
import { getGalleryReplayActions } from '../screens/upload/galleryReplayActions.ts'
import type { PuzzleConfig, SolvedGalleryEntry } from '../types/index.ts'

function createEntry(
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

function createDisplayEntry(
  representativeEntry: SolvedGalleryEntry,
  motifEntries: SolvedGalleryEntry[],
  difficultyVariants: PuzzleConfig[]
): GalleryDisplayEntry {
  return {
    id: `group-${representativeEntry.id}`,
    motifId: 'motif-a',
    allEntries: [representativeEntry],
    visibleEntries: [representativeEntry],
    representativeEntry,
    totalSolveCount: 1,
    visibleSolveCount: 1,
    latestCompletedAt: representativeEntry.completedAt,
    earliestVisibleCompletedAt: representativeEntry.completedAt,
    bestVisibleTime: representativeEntry.time,
    bestVisibleMoves: representativeEntry.moves,
    bestVisibleActionMoves: representativeEntry.actionMoves,
    bestVisibleDetours: representativeEntry.actionMoves - representativeEntry.moves,
    motifReplaySummary: {
      motifId: 'motif-a',
      allEntries: motifEntries,
      totalSolveCount: motifEntries.length,
      replayableSolveCount: motifEntries.filter((entry) => entry.sourceImage ?? entry.previewImage).length,
      difficultyVariants,
      latestCompletedAt: motifEntries[0]?.completedAt ?? null,
      lastReplayableEntry: motifEntries.find((entry) => entry.sourceImage ?? entry.previewImage) ?? null,
      bestTimeEntry: null,
      bestMovesEntry: null,
      bestCleanTimeEntry: null,
      bestChallengeMedal: null,
      challengeSolveCount: 0,
    },
  }
}

describe('galleryReplayActions', () => {
  it('liefert nur den primaeren Wiedereinstieg fuer die Motivkarte', () => {
    const current = createEntry('current', {
      completedAt: '2026-04-24T12:00:00.000Z',
      time: 120,
      moves: 42,
      cropTransform: {
        zoom: 1.2,
        rotationDeg: 0,
        offsetX: 10,
        offsetY: -4,
      },
    })
    const bestTime = createEntry('best-time', {
      completedAt: '2026-04-22T12:00:00.000Z',
      time: 98,
      moves: 43,
    })
    const bestClean = createEntry('best-clean', {
      completedAt: '2026-04-21T12:00:00.000Z',
      config: { rows: 5, cols: 5 },
      time: 180,
      moves: 70,
      assistanceMode: 'clean',
    })

    const displayEntry = createDisplayEntry(current, [current, bestTime, bestClean], [
      { rows: 4, cols: 4 },
      { rows: 5, cols: 5 },
    ])
    displayEntry.motifReplaySummary.bestTimeEntry = bestTime
    displayEntry.motifReplaySummary.bestMovesEntry = bestTime
    displayEntry.motifReplaySummary.bestCleanTimeEntry = bestClean

    expect(getGalleryReplayActions(displayEntry)).toMatchObject([
      { id: 'current', label: 'Spielen', entry: { id: 'current' } },
    ])
  })

  it('faellt auf den letzten spielbaren Lauf zurueck, wenn der angezeigte Eintrag kein Replay hat', () => {
    const archivedRepresentative = createEntry('archived', {
      previewImage: null,
      sourceImage: null,
      hasDetailedProfile: false,
    })
    const latestReplayable = createEntry('latest-replayable', {
      completedAt: '2026-04-23T12:00:00.000Z',
    })

    const displayEntry = createDisplayEntry(
      archivedRepresentative,
      [archivedRepresentative, latestReplayable],
      [{ rows: 4, cols: 4 }]
    )
    displayEntry.motifReplaySummary.lastReplayableEntry = latestReplayable
    displayEntry.motifReplaySummary.bestTimeEntry = latestReplayable
    displayEntry.motifReplaySummary.bestMovesEntry = latestReplayable

    expect(getGalleryReplayActions(displayEntry)).toMatchObject([
      { id: 'latest-replayable', label: 'Spielen', entry: { id: 'latest-replayable' } },
    ])
  })

  it('beschreibt echte Challenge-Starts als gespeicherten Startzustand', () => {
    const current = createEntry('current', {
      replaySetup: {
        version: 1,
        startBoard: [1, 2, 0, 3],
        emptyIndex: 3,
        shuffleMoves: ['tile-1'],
        optimalStartMoveCount: 1,
        optimalStartMoveCountKind: 'exact',
      },
      config: { rows: 2, cols: 2 },
    })

    const displayEntry = createDisplayEntry(current, [current], [{ rows: 2, cols: 2 }])

    expect(getGalleryReplayActions(displayEntry)).toMatchObject([
      {
        id: 'current',
        label: 'Spielen',
        entry: { id: 'current' },
        description: expect.stringContaining('gespeicherten Startzustand'),
      },
    ])
  })
})
