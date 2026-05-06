import {
  CreateImageCollectionPayload,
  ImageCollections,
  UpdateImageCollectionImagesPayload,
  UpdateImageCollectionPayload,
} from '../types/index'
import { requestJson } from './api/apiClient.ts'

export async function loadImageCollections(): Promise<ImageCollections> {
  return requestJson<ImageCollections>('/api/collections')
}

export async function createImageCollection(
  payload: CreateImageCollectionPayload
): Promise<ImageCollections> {
  return requestJson<ImageCollections>('/api/collections', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateImageCollection(
  collectionId: string,
  payload: UpdateImageCollectionPayload
): Promise<ImageCollections> {
  return requestJson<ImageCollections>(`/api/collections/${encodeURIComponent(collectionId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteImageCollection(collectionId: string): Promise<ImageCollections> {
  return requestJson<ImageCollections>(`/api/collections/${encodeURIComponent(collectionId)}`, {
    method: 'DELETE',
  })
}

export async function addImageCollectionImages(
  collectionId: string,
  payload: UpdateImageCollectionImagesPayload
): Promise<ImageCollections> {
  return requestJson<ImageCollections>(`/api/collections/${encodeURIComponent(collectionId)}/images`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function removeImageCollectionImages(
  collectionId: string,
  payload: UpdateImageCollectionImagesPayload
): Promise<ImageCollections> {
  return requestJson<ImageCollections>(`/api/collections/${encodeURIComponent(collectionId)}/images`, {
    method: 'DELETE',
    body: JSON.stringify(payload),
  })
}
