import {
  PersistedPuzzleProgress,
  PuzzleConfig,
  SavedGameData,
  SavedGameSummary,
} from '../types/index'
import { requestJson, requestOk } from './api/apiClient.ts'

interface CreateSavePayload {
  image: string
  croppedImage: string
  previewImage: string
  config: PuzzleConfig
  progress: PersistedPuzzleProgress
}

interface UpdateSavePayload {
  progress: PersistedPuzzleProgress
}

interface SaveRequestOptions {
  keepalive?: boolean
}

export async function listSavedGames(): Promise<SavedGameSummary[]> {
  return requestJson<SavedGameSummary[]>('/api/saves')
}

export async function loadSavedGame(id: string): Promise<SavedGameData> {
  return requestJson<SavedGameData>(`/api/saves/${encodeURIComponent(id)}`)
}

export async function createSavedGame(
  payload: CreateSavePayload,
  options?: SaveRequestOptions
): Promise<SavedGameSummary> {
  return requestJson<SavedGameSummary>('/api/saves', {
    method: 'POST',
    body: JSON.stringify(payload),
    keepalive: options?.keepalive,
  })
}

export async function updateSavedGame(
  id: string,
  payload: UpdateSavePayload,
  options?: SaveRequestOptions
): Promise<SavedGameSummary> {
  return requestJson<SavedGameSummary>(`/api/saves/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
    keepalive: options?.keepalive,
  })
}

export async function deleteSavedGame(id: string): Promise<void> {
  await requestOk(`/api/saves/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export async function deleteAllSavedGames(): Promise<void> {
  await requestOk('/api/saves', {
    method: 'DELETE',
  })
}

