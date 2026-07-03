import type { HistoryFilter, UploadWorkspaceWindow } from './uploadUtils.ts'
import type { GalleryMedalFilter } from './UploadGalleryDisplayUtils.ts'

export type UploadCommandRequestAction =
  | 'focus-start'
  | 'open-saved-games'
  | 'open-stats'
  | 'open-gallery'
  | 'open-medal-stats'
  | 'open-medal-hunt'
  | 'open-collections'
  | 'export-backup'
  | 'import-backup'
  | 'restore-session'

export interface UploadCommandRequest {
  id: number
  action: UploadCommandRequestAction
  window?: UploadWorkspaceWindow
  historyFilter?: HistoryFilter
  medalFilter?: GalleryMedalFilter
}
