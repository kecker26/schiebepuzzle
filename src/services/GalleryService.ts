import {
  AnalyzeSolvedGalleryEntryResult,
  RecordSolvedGalleryEntryPayload,
  SolvedGallery,
  UpdateSolvedGalleryTagsPayload,
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

export async function analyzeSolvedGalleryEntry(entryId: string): Promise<AnalyzeSolvedGalleryEntryResult> {
  return requestJson<AnalyzeSolvedGalleryEntryResult>(
    `/api/gallery/${encodeURIComponent(entryId)}/analyze`,
    { method: 'POST' }
  )
}

export async function updateSolvedGalleryTags(payload: UpdateSolvedGalleryTagsPayload): Promise<SolvedGallery> {
  return requestJson<SolvedGallery>('/api/gallery/tags', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}
