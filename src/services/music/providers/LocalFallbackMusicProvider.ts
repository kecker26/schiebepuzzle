import type { MusicStyleId } from '../../musicStyles.ts'
import { getLocalFallbackTracksForStyle, LOCAL_FALLBACK_TRACKS } from '../localFallbackTracks.ts'
import type { MusicProvider, MusicTrackDescriptor } from '../types.ts'

export default class LocalFallbackMusicProvider implements MusicProvider {
  readonly id = 'local-fallback' as const
  readonly label = 'Lokaler Fallback'

  isConfigured(): boolean {
    return LOCAL_FALLBACK_TRACKS.length > 0
  }

  clearCache(styleId?: MusicStyleId): void {
    void styleId
    // Local fallback tracks are static.
  }

  async pickTrack(styleId: MusicStyleId, excludedTrackIds: string[]): Promise<MusicTrackDescriptor | null> {
    if (LOCAL_FALLBACK_TRACKS.length === 0) {
      return null
    }

    const excludedTrackSet = new Set(excludedTrackIds)
    const preferredTracks = getLocalFallbackTracksForStyle(styleId)
    const candidates = preferredTracks.filter((track) => !excludedTrackSet.has(track.id))
    const pool = candidates.length > 0 ? candidates : preferredTracks
    return pool[Math.floor(Math.random() * pool.length)] ?? null
  }
}
