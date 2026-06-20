import type { SolvedGalleryEntry } from '../../types/index'

export type GalleryReplayMode = 'run' | 'practice' | 'motif'

export type GalleryReplayRequestHandler = (
  entry: SolvedGalleryEntry,
  mode?: GalleryReplayMode
) => void | Promise<void>
