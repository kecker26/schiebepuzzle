import type { MusicTrackRequest, MusicTrackResponse } from './music/types.ts'
import { requestJson } from './api/apiClient.ts'

export async function requestNextMusicTrack(request: MusicTrackRequest): Promise<MusicTrackResponse> {
  const params = new URLSearchParams()
  params.set('style', request.styleId)

  request.excludeTrackIds.forEach((trackId) => {
    if (trackId) {
      params.append('exclude', trackId)
    }
  })

  if (request.allowFallback === false) {
    params.set('allowFallback', 'false')
  }

  if (request.failedTrackId) {
    params.set('failedTrackId', request.failedTrackId)
  }

  if (request.failedProvider) {
    params.set('failedProvider', request.failedProvider)
  }

  if (request.failureReason) {
    params.set('failureReason', request.failureReason)
  }

  return requestJson<MusicTrackResponse>(`/api/music/next?${params.toString()}`)
}
