import {
  AnalyzeSolvedGalleryEntryResult,
  AnalyzeWinEffectImagePayload,
  AnalyzeWinEffectImageResult,
  ClassifyTagCategoriesPayload,
  ClassifyTagCategoriesResult,
  CreateTagCategoryPayload,
  EditSolvedGalleryEntryTagsPayload,
  RecordSolvedGalleryEntryPayload,
  SolvedGallery,
  TagCategoryCatalog,
  UpdateSolvedGalleryTagsPayload,
  UpdateTagCategoryAssignmentsPayload,
  UpdateTagCategoryPayload,
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

export async function analyzeWinEffectImage(
  payload: AnalyzeWinEffectImagePayload
): Promise<AnalyzeWinEffectImageResult> {
  return requestJson<AnalyzeWinEffectImageResult>('/api/gallery/win-effect-tags', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateSolvedGalleryTags(payload: UpdateSolvedGalleryTagsPayload): Promise<SolvedGallery> {
  return requestJson<SolvedGallery>('/api/gallery/tags', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function editSolvedGalleryEntryTags(payload: EditSolvedGalleryEntryTagsPayload): Promise<SolvedGallery> {
  return requestJson<SolvedGallery>('/api/gallery/tags', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function loadTagCategoryCatalog(): Promise<TagCategoryCatalog> {
  return requestJson<TagCategoryCatalog>('/api/gallery/tag-categories')
}

export async function updateTagCategoryAssignments(
  payload: UpdateTagCategoryAssignmentsPayload
): Promise<TagCategoryCatalog> {
  return requestJson<TagCategoryCatalog>('/api/gallery/tag-categories/assignments', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function classifyTagCategories(
  payload: ClassifyTagCategoriesPayload
): Promise<ClassifyTagCategoriesResult> {
  return requestJson<ClassifyTagCategoriesResult>('/api/gallery/tag-categories/classify', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function createTagCategory(payload: CreateTagCategoryPayload): Promise<TagCategoryCatalog> {
  return requestJson<TagCategoryCatalog>('/api/gallery/tag-categories', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateTagCategory(
  categoryId: string,
  payload: UpdateTagCategoryPayload
): Promise<TagCategoryCatalog> {
  return requestJson<TagCategoryCatalog>(`/api/gallery/tag-categories/${encodeURIComponent(categoryId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteTagCategory(
  categoryId: string,
  replacementCategoryId: string | null = null
): Promise<TagCategoryCatalog> {
  return requestJson<TagCategoryCatalog>(`/api/gallery/tag-categories/${encodeURIComponent(categoryId)}`, {
    method: 'DELETE',
    body: JSON.stringify({ replacementCategoryId }),
  })
}
