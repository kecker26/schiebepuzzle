import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PuzzlePauseOverlay from '../screens/puzzle/PuzzlePauseOverlay.tsx'
import { createPersistedPuzzleProgress } from '../services/PuzzleStateService.ts'
import type { PuzzleState, Tile } from '../types/index.ts'

function createTile(
  id: string,
  correctIndex: number,
  row: number,
  col: number,
  isEmpty = false
): Tile {
  return {
    id,
    row,
    col,
    index: correctIndex,
    correctRow: Math.floor(correctIndex / 2),
    correctCol: correctIndex % 2,
    correctIndex,
    imageSliceRef: {
      sourceX: 0,
      sourceY: 0,
      sourceWidth: 1,
      sourceHeight: 1,
    },
    isEmpty,
  }
}

function createPuzzleState(): PuzzleState {
  return {
    tiles: [
      createTile('tile-0', 0, 0, 0),
      createTile('tile-1', 1, 0, 1),
      createTile('tile-2', 2, 1, 1),
      createTile('empty', 3, 1, 0, true),
    ],
    board: [0, 1, 3, 2],
    emptyIndex: 2,
    emptyRow: 1,
    emptyCol: 0,
    moveCount: 4,
    startTime: 0,
    isSolved: false,
    isAnimating: false,
    dragState: null,
  }
}

describe('puzzle pause', () => {
  it('focuses the resume action and resumes from the overlay', () => {
    const onResume = vi.fn()

    render(<PuzzlePauseOverlay elapsedTime={125} onResume={onResume} />)

    const resumeButton = screen.getByRole('button', { name: /Weiterspielen/ })
    expect(screen.getByText('2:05')).toBeTruthy()
    expect(document.activeElement).toBe(resumeButton)

    fireEvent.click(resumeButton)
    expect(onResume).toHaveBeenCalledTimes(1)
  })

  it('persists whether a saved puzzle is paused', () => {
    const state = createPuzzleState()
    const progress = createPersistedPuzzleProgress({
      state,
      config: { rows: 2, cols: 2 },
      moveCount: state.moveCount,
      elapsedTime: 125,
      isPaused: true,
      moveHistory: [],
      previewVisible: true,
      ghostPreviewVisible: false,
      ghostPreviewWeight: 35,
      ghostPreviewMode: 'image',
      ghostPreviewScope: 'focus',
      ghostPreviewMotion: 'pulse',
      ghostPreviewProgressive: true,
      ghostPreviewProgressPeak: 42,
      heatmapOverlayVisible: false,
      heatmapMode: 'arrows',
      heatmapIntensity: 64,
      heatmapDistancesVisible: true,
    })

    expect(progress.isPaused).toBe(true)
    expect(progress.elapsedTime).toBe(125)
    expect(progress.heatmapMode).toBe('arrows')
    expect(progress.heatmapIntensity).toBe(64)
    expect(progress.heatmapDistancesVisible).toBe(true)
    expect(progress.ghostPreviewScope).toBe('focus')
    expect(progress.ghostPreviewMotion).toBe('pulse')
    expect(progress.ghostPreviewProgressive).toBe(true)
    expect(progress.ghostPreviewProgressPeak).toBe(42)
  })
})
