import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PuzzleLeftPanel from '../screens/puzzle/PuzzleLeftPanel.tsx'
import { MEDAL_RUN_LOCK_MESSAGE } from '../screens/puzzle/puzzleScreenUtils.ts'

type PuzzleLeftPanelProps = Parameters<typeof PuzzleLeftPanel>[0]

function createActionButtonRefs(): PuzzleLeftPanelProps['actionButtonRefs'] {
  return {
    hint: createRef<HTMLButtonElement>(),
    suggestedMove: createRef<HTMLButtonElement>(),
    preview: createRef<HTMLButtonElement>(),
    ghostPreview: createRef<HTMLButtonElement>(),
    heatmap: createRef<HTMLButtonElement>(),
    tileNumbers: createRef<HTMLButtonElement>(),
    undo: createRef<HTMLButtonElement>(),
    redo: createRef<HTMLButtonElement>(),
    helpTrigger: createRef<HTMLButtonElement>(),
    quit: createRef<HTMLButtonElement>(),
    pause: createRef<HTMLButtonElement>(),
  }
}

function renderPuzzleLeftPanel(overrides: Partial<PuzzleLeftPanelProps> = {}) {
  const noop = vi.fn()

  return render(
    <PuzzleLeftPanel
      config={{ rows: 3, cols: 3 }}
      moveCount={0}
      actionMoves={0}
      optimalMoveSummary="Optimalweg wird berechnet"
      challengeTarget={{
        entryId: 'target-entry',
        completedAt: '2026-06-19T20:00:00.000Z',
        time: 120,
        moves: 80,
        actionMoves: 80,
        assistanceMode: 'clean',
      }}
      assistanceMode="clean"
      elapsedTime={0}
      progressMetrics={null}
      hintPreview={null}
      isComputingSuggestion={false}
      isInteractionLocked={false}
      isPaused={false}
      isPreviewVisible
      isGhostPreviewVisible={false}
      isHeatmapOverlayVisible={false}
      areTileNumbersVisible={false}
      ghostPreviewMode="image"
      ghostPreviewScope="misplaced"
      ghostPreviewMotion="static"
      isGhostPreviewProgressive={false}
      ghostPreviewWeight={56}
      ghostUsageCount={0}
      ghostUsageDurationMs={0}
      heatmapUsageCount={0}
      heatmapMode="classic"
      heatmapIntensity={100}
      areHeatmapDistancesVisible={false}
      heatmapMovePotential={null}
      heatmapTargetPath={null}
      isHeatmapTargetPathVisible={false}
      heatmapPathProgress={null}
      isHeatmapPathDeviationVisible={false}
      moveHistoryLength={1}
      redoHistoryLength={1}
      onShowHint={noop}
      onTogglePause={noop}
      onSuggestedMove={noop}
      onTogglePreview={noop}
      onToggleGhostPreview={noop}
      onToggleHeatmapOverlay={noop}
      onShowTileNumbers={noop}
      onGhostPreviewModeChange={noop}
      onGhostPreviewScopeChange={noop}
      onGhostPreviewMotionChange={noop}
      onToggleGhostPreviewProgressive={noop}
      onGhostPreviewWeightChange={noop}
      onHeatmapModeChange={noop}
      onHeatmapIntensityChange={noop}
      onToggleHeatmapDistances={noop}
      onToggleHeatmapTargetPath={noop}
      onUndo={noop}
      onRedo={noop}
      onQuit={noop}
      onOpenHelp={noop}
      actionButtonRefs={createActionButtonRefs()}
      {...overrides}
    />
  )
}

describe('puzzle medal run controls', () => {
  it('places the lock notice between hint and tools and greys out every game aid', () => {
    renderPuzzleLeftPanel()

    const hintPanel = document.querySelector('.puzzle-hint-panel')
    const lockNotice = screen.getByText(MEDAL_RUN_LOCK_MESSAGE).closest('.puzzle-medal-run-lock-note')
    const toolsPanel = document.querySelector('.puzzle-tools-shell')

    expect(hintPanel).toBeTruthy()
    expect(lockNotice).toBeTruthy()
    expect(toolsPanel).toBeTruthy()
    expect(hintPanel!.compareDocumentPosition(lockNotice!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(lockNotice!.compareDocumentPosition(toolsPanel!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(hintPanel?.classList.contains('is-game-aids-locked')).toBe(true)
    expect(toolsPanel?.classList.contains('is-game-aids-locked')).toBe(true)

    for (const name of [
      'Hinweis zeigen',
      'Zug spielen',
      'Vorschau aus',
      'Geisterbild ein',
      'Heatmap ein',
      'Nummern 5s',
      'Zug zurueck',
      'Zug vor',
    ]) {
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
    }
  })

  it('uses the actual live forecast for soft challenge copy instead of always naming Gold', () => {
    renderPuzzleLeftPanel({
      challengeMode: 'soft',
      moveCount: 224,
      actionMoves: 224,
      elapsedTime: 348,
      challengeTarget: {
        entryId: 'estimated-target',
        completedAt: '2026-06-29T20:00:00.000Z',
        time: 433,
        moves: 216,
        actionMoves: 216,
        assistanceMode: 'clean',
        synthetic: true,
      },
    })

    expect(screen.getByText('Prognose: Bronze')).toBeTruthy()
    expect(screen.getByText('Moegliche Einstufung: Bronze, wenn dieser Lauf clean bleibt.')).toBeTruthy()
    expect(screen.queryByText('Moegliche Einstufung: Gold, wenn dieser Lauf clean bleibt.')).toBeNull()
  })
})
