import CompactContextMenu, { type ContextMenuItem, type ContextMenuPosition } from '../../components/CompactContextMenu.tsx'

interface PuzzleContextMenuProps {
  position: ContextMenuPosition
  isSolved: boolean
  isInteractionLocked: boolean
  areGameAidsLocked: boolean
  isPreviewVisible: boolean
  isGhostPreviewVisible: boolean
  isHeatmapOverlayVisible: boolean
  onShowHint: () => void
  onSuggestedMove: () => void
  onTogglePreview: () => void
  onToggleGhostPreview: () => void
  onToggleHeatmapOverlay: () => void
  onShowTileNumbers: () => void
  onUndo: () => void
  onRedo: () => void
  onOpenHelp: () => void
  onGoToSelectionScreen: () => void
  onGoToStartScreen: () => void
  onClose: () => void
  canUndo: boolean
  canRedo: boolean
}

export type { ContextMenuPosition }

export default function PuzzleContextMenu({
  position,
  isSolved,
  isInteractionLocked,
  areGameAidsLocked,
  isPreviewVisible,
  isGhostPreviewVisible,
  isHeatmapOverlayVisible,
  onShowHint,
  onSuggestedMove,
  onTogglePreview,
  onToggleGhostPreview,
  onToggleHeatmapOverlay,
  onShowTileNumbers,
  onUndo,
  onRedo,
  onOpenHelp,
  onGoToSelectionScreen,
  onGoToStartScreen,
  onClose,
  canUndo,
  canRedo,
}: PuzzleContextMenuProps) {
  const canInteract = !isSolved && !isInteractionLocked

  const items: ContextMenuItem[] = [
    { groupTitle: 'Zuege' },
    { label: 'Hinweis zeigen', icon: 'helpCircle', meta: 'H', onClick: onShowHint, disabled: areGameAidsLocked || !canInteract },
    { label: 'Zug spielen', icon: 'skipForward', meta: 'Enter', onClick: onSuggestedMove, disabled: areGameAidsLocked || !canInteract },
    { groupTitle: 'Ansicht' },
    { label: isPreviewVisible ? 'Vorschau aus' : 'Vorschau ein', icon: 'eye', meta: 'Leertaste', onClick: onTogglePreview, disabled: areGameAidsLocked || isSolved },
    { label: isGhostPreviewVisible ? 'Geisterbild aus' : 'Geisterbild ein', icon: 'layers', meta: 'G', onClick: onToggleGhostPreview, disabled: areGameAidsLocked || isSolved },
    { label: isHeatmapOverlayVisible ? 'Heatmap aus' : 'Heatmap ein', icon: 'activity', meta: 'M', onClick: onToggleHeatmapOverlay, disabled: areGameAidsLocked || isSolved },
    { label: 'Nummern zeigen', icon: 'hash', meta: 'N', onClick: onShowTileNumbers, disabled: areGameAidsLocked || isSolved },
    { groupTitle: 'Verlauf' },
    { label: 'Zug zurueck', icon: 'cornerUpLeft', meta: 'Strg+Z', onClick: onUndo, disabled: areGameAidsLocked || !canUndo || isInteractionLocked },
    { label: 'Zug vor', icon: 'cornerUpRight', meta: 'Strg+Y', onClick: onRedo, disabled: areGameAidsLocked || !canRedo || isInteractionLocked },
    { groupTitle: 'Hilfe' },
    { label: 'Shortcuts und Bedienung', icon: 'command', meta: 'F1', onClick: onOpenHelp },
    { groupTitle: 'Navigation' },
    { label: 'Zur Auswahl', icon: 'grid', meta: 'Auswahl', onClick: onGoToSelectionScreen },
    { label: 'Zur Startseite', icon: 'home', meta: 'Start', onClick: onGoToStartScreen },
  ]

  return <CompactContextMenu position={position} items={items} onClose={onClose} />
}
