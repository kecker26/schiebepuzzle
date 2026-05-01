import type { HistoryFilter, UploadWorkspaceWindow } from './uploadUtils.ts'

export type UploadCommandRequestAction =
  | 'focus-start'
  | 'open-saved-games'
  | 'open-stats'
  | 'open-gallery'
  | 'export-backup'
  | 'import-backup'
  | 'restore-session'

export interface UploadCommandRequest {
  id: number
  action: UploadCommandRequestAction
  window?: UploadWorkspaceWindow
  historyFilter?: HistoryFilter
}
