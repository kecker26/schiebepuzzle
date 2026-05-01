export function upsertSummary<T extends { id: string }>(current: T[], incoming: T): T[] {
  return [incoming, ...current.filter((entry) => entry.id !== incoming.id)]
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Unbekannter Fehler'
}

interface PreviewImageOptions {
  maxEdge?: number
  quality?: number
}

const DEFAULT_PREVIEW_MAX_EDGE = 180
const DEFAULT_PREVIEW_QUALITY = 0.8
const COMPLETION_PREVIEW_MAX_EDGE = 72
const COMPLETION_PREVIEW_QUALITY = 0.72
const GALLERY_PREVIEW_MAX_EDGE = 240
const GALLERY_PREVIEW_QUALITY = 0.82

export function createPreviewImage(source: string, options: PreviewImageOptions = {}): Promise<string> {
  const {
    maxEdge = DEFAULT_PREVIEW_MAX_EDGE,
    quality = DEFAULT_PREVIEW_QUALITY,
  } = options

  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      const scale = Math.min(maxEdge / image.width, maxEdge / image.height, 1)
      const targetWidth = Math.max(1, Math.round(image.width * scale))
      const targetHeight = Math.max(1, Math.round(image.height * scale))

      const canvas = document.createElement('canvas')
      canvas.width = targetWidth
      canvas.height = targetHeight

      const context = canvas.getContext('2d')
      if (!context) {
        resolve(source)
        return
      }

      context.drawImage(image, 0, 0, targetWidth, targetHeight)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }

    image.onerror = () => {
      resolve(source)
    }

    image.src = source
  })
}

export function createCompletionPreviewImage(source: string): Promise<string> {
  return createPreviewImage(source, {
    maxEdge: COMPLETION_PREVIEW_MAX_EDGE,
    quality: COMPLETION_PREVIEW_QUALITY,
  })
}

export function createGalleryPreviewImage(source: string): Promise<string> {
  return createPreviewImage(source, {
    maxEdge: GALLERY_PREVIEW_MAX_EDGE,
    quality: GALLERY_PREVIEW_QUALITY,
  })
}

export function scrollViewportToTop(): void {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
}
