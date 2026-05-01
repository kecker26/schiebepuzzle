import { requestJson } from './api/apiClient.ts'

interface ClipboardImageStatusResponse {
  hasImage: boolean
}

interface ClipboardImageResponse {
  imageDataUrl: string
}

export async function hasClipboardImage(): Promise<boolean> {
  const response = await requestJson<ClipboardImageStatusResponse>('/api/clipboard/image/status')
  return response.hasImage
}

export async function readClipboardImageDataUrl(): Promise<string> {
  const response = await requestJson<ClipboardImageResponse>('/api/clipboard/image')
  return response.imageDataUrl
}
