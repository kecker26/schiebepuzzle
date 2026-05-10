import type { RandomImageSourceInfo } from './RandomImageService.ts'
import { requestJson } from './api/apiClient.ts'

export interface GeneratedPromptImageResult {
  imageSrc: string
  source: RandomImageSourceInfo
}

export async function generatePromptImage(prompt: string): Promise<GeneratedPromptImageResult> {
  return requestJson<GeneratedPromptImageResult>('/api/generated-image', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  })
}
