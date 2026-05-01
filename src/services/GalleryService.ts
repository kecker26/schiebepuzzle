import {
  RecordSolvedGalleryEntryPayload,
  SolvedGallery,
} from '../types/index'
import { requestJson } from './api/apiClient.ts'

export async function loadSolvedGallery(): Promise<SolvedGallery> {
  return requestJson<SolvedGallery>('/api/gallery')
}

export async function addSolvedGalleryEntry(
  payload: RecordSolvedGalleryEntryPayload
): Promise<SolvedGallery> {
  return requestJson<SolvedGallery>('/api/gallery', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function resetSolvedGallery(): Promise<SolvedGallery> {
  return requestJson<SolvedGallery>('/api/gallery', {
    method: 'DELETE',
  })
}

export async function deleteSolvedGalleryEntries(entryIds: string[]): Promise<SolvedGallery> {
  return requestJson<SolvedGallery>('/api/gallery/entries', {
    method: 'DELETE',
    body: JSON.stringify({ ids: entryIds }),
  })
}
