import { PuzzleDataBackup, PuzzleDataBackupFile, PuzzleDataImportResult } from '../types/index'
import { requestJson, requestOk } from './api/apiClient.ts'

export const PUZZLE_BACKUP_FILE_EXTENSION = '.spbkp'

export async function exportPuzzleDataBackup(): Promise<PuzzleDataBackup> {
  return requestJson<PuzzleDataBackup>('/api/backup')
}

export async function importPuzzleDataBackup(payload: PuzzleDataBackup): Promise<PuzzleDataImportResult> {
  return requestJson<PuzzleDataImportResult>('/api/backup', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function listPuzzleDataBackupFiles(): Promise<PuzzleDataBackupFile[]> {
  return requestJson<PuzzleDataBackupFile[]>('/api/backup/files')
}

export async function createPuzzleDataBackupFile(): Promise<PuzzleDataBackupFile> {
  return requestJson<PuzzleDataBackupFile>('/api/backup/files', {
    method: 'POST',
  })
}

export async function importPuzzleDataBackupFile(fileName: string): Promise<PuzzleDataImportResult> {
  return requestJson<PuzzleDataImportResult>(`/api/backup/files/${encodeURIComponent(fileName)}/import`, {
    method: 'POST',
  })
}

export async function deletePuzzleDataBackupFile(fileName: string): Promise<void> {
  return requestOk(`/api/backup/files/${encodeURIComponent(fileName)}`, {
    method: 'DELETE',
  })
}

export function downloadPuzzleDataBackup(backup: PuzzleDataBackup): void {
  const stamp = backup.exportedAt
    ? backup.exportedAt.replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
    : 'backup'
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = objectUrl
  anchor.download = `schiebepuzzle-backup-${stamp}${PUZZLE_BACKUP_FILE_EXTENSION}`
  anchor.click()

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl)
  }, 0)
}
