import type { HelpContext } from './helpRegistry.ts'
import type { UploadWorkspaceWindow } from '../screens/upload/uploadUtils.ts'

const UPLOAD_PORTAL_SELECTOR = [
  '.workspace-window-overlay',
  '.backup-browser-overlay',
  '.delete-confirm-overlay',
  '.gallery-detail-overlay',
].join(', ')

const PUZZLE_PORTAL_SELECTOR = [
  '.puzzle-screen',
  '.puzzle-confirm-overlay',
  '.puzzle-context-menu',
].join(', ')

function toElement(target: EventTarget | null): HTMLElement | null {
  return target instanceof HTMLElement ? target : null
}

export function isUploadHelpTarget(target: EventTarget | null, screenRoot: HTMLElement | null): boolean {
  const element = toElement(target)
  return Boolean(element && (screenRoot?.contains(element) || element.closest(UPLOAD_PORTAL_SELECTOR)))
}

export function isPuzzleHelpTarget(target: EventTarget | null, puzzleRoot: HTMLElement | null): boolean {
  const element = toElement(target)
  return Boolean(element && (puzzleRoot?.contains(element) || element.closest(PUZZLE_PORTAL_SELECTOR)))
}

export function getUploadHelpContextForTarget(
  activeWindow: UploadWorkspaceWindow,
  _target: EventTarget | null // eslint-disable-line @typescript-eslint/no-unused-vars
): HelpContext {
  switch (activeWindow) {
    case 'start':
      return 'upload-start'
    case 'savedGames':
      return 'upload-savedGames'
    case 'stats':
      return 'upload-stats'
    default:
      return 'upload-gallery'
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getPuzzleHelpContextForTarget(_target: EventTarget | null): HelpContext {
  return 'playing'
}
