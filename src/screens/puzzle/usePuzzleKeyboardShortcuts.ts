import { useEffect } from 'react'
import { PuzzleState } from '../../types/index'
import { isKeyboardShortcutBlockedTarget } from './puzzleScreenUtils.ts'

interface UsePuzzleKeyboardShortcutsOptions {
  isRestartConfirmOpen: boolean
  isHelpOpen: boolean
  isPaused: boolean
  puzzleState: PuzzleState | null
  isInteractionLocked: boolean
  onFocusBoard: () => void
  onTogglePause: () => void
  onQuit: () => void
  onTogglePreview: () => void
  onToggleGhostPreview: () => void
  onToggleHeatmapOverlay: () => void
  onShowTileNumbers: () => void
  onSuggestedMove: () => void
  onShowHint: () => void
  onRestart: () => void
  onUndo: () => void
  onRedo: () => void
}

export function usePuzzleKeyboardShortcuts({
  isRestartConfirmOpen,
  isHelpOpen,
  isPaused,
  puzzleState,
  isInteractionLocked,
  onFocusBoard,
  onTogglePause,
  onQuit,
  onTogglePreview,
  onToggleGhostPreview,
  onToggleHeatmapOverlay,
  onShowTileNumbers,
  onSuggestedMove,
  onShowHint,
  onRestart,
  onUndo,
  onRedo,
  }: UsePuzzleKeyboardShortcutsOptions): void {
  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()

      if (isHelpOpen) {
        return
      }

      if (isRestartConfirmOpen && !isPaused) return

      const hasCommandModifier = event.ctrlKey || event.metaKey

      if (!hasCommandModifier && !event.altKey && key === 'p') {
        if (!puzzleState || puzzleState.isSolved) return

        event.preventDefault()
        if (event.repeat) return

        onTogglePause()
        return
      }

      if (isPaused) {
        if (!hasCommandModifier && !event.altKey && key === 'escape') {
          event.preventDefault()
          onQuit()
        }
        return
      }

      if (!hasCommandModifier && !event.altKey && key === 'b') {
        if (!puzzleState || puzzleState.isSolved) return

        event.preventDefault()
        if (event.repeat) return

        onFocusBoard()
        return
      }

      if (isKeyboardShortcutBlockedTarget(event.target, { allowMarkedButtons: true, key: event.key })) return

      if (hasCommandModifier && !event.altKey) {
        if (!puzzleState || puzzleState.isSolved || isInteractionLocked) return

        if (key === 'z') {
          event.preventDefault()
          if (event.shiftKey) {
            onRedo()
            return
          }

          onUndo()
          return
        }

        if (key === 'y' && !event.shiftKey) {
          event.preventDefault()
          onRedo()
        }
        return
      }

      if (event.ctrlKey || event.metaKey || event.altKey) return

      if (key === 'escape') {
        event.preventDefault()
        onQuit()
        return
      }

      if (!puzzleState || puzzleState.isSolved) return

      if (key === ' ' || key === 'spacebar') {
        event.preventDefault()
        if (event.repeat) return

        onTogglePreview()
        return
      }

      if (key === 'g') {
        event.preventDefault()
        if (event.repeat) return

        onToggleGhostPreview()
        return
      }

      if (key === 'm') {
        event.preventDefault()
        if (event.repeat) return

        onToggleHeatmapOverlay()
        return
      }

      if (key === 'n') {
        event.preventDefault()
        onShowTileNumbers()
        return
      }

      if (isInteractionLocked) return

      if (key === 'enter' || key === 'numpadenter') {
        event.preventDefault()
        onSuggestedMove()
        return
      }

      if (key === 'h') {
        event.preventDefault()
        onShowHint()
        return
      }

      if (key === 'r') {
        event.preventDefault()
        onRestart()
      }
    }

    window.addEventListener('keydown', handleWindowKeyDown)

    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown)
    }
  }, [
    isHelpOpen,
    isInteractionLocked,
    isPaused,
    isRestartConfirmOpen,
    onFocusBoard,
    onQuit,
    onRedo,
    onRestart,
    onShowHint,
    onShowTileNumbers,
    onSuggestedMove,
    onToggleHeatmapOverlay,
    onToggleGhostPreview,
    onTogglePause,
    onTogglePreview,
    onUndo,
    puzzleState,
  ])
}
