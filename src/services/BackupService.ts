import { PuzzleDataBackupFile, PuzzleDataImportResult } from '../types/index'
import { requestJson, requestOk } from './api/apiClient.ts'

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

