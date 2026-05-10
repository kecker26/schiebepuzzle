import {
  PuzzleStatsExportFile,
  PuzzleStats,
  RecordPuzzleCompletionPayload,
  RecordPuzzleCompletionResult,
} from '../types/index'
import { requestJson } from './api/apiClient.ts'

export async function loadPuzzleStats(): Promise<PuzzleStats> {
  return requestJson<PuzzleStats>('/api/stats')
}

export async function recordPuzzleCompletion(
  payload: RecordPuzzleCompletionPayload
): Promise<RecordPuzzleCompletionResult> {
  return requestJson<RecordPuzzleCompletionResult>('/api/stats/completions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function resetPuzzleStats(): Promise<PuzzleStats> {
  return requestJson<PuzzleStats>('/api/stats', {
    method: 'DELETE',
  })
}

export async function savePuzzleStatsExportFile(payload: {
  fileName: string
  contents: string
  mimeType: string
}): Promise<PuzzleStatsExportFile> {
  return requestJson<PuzzleStatsExportFile>('/api/stats/exports', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
