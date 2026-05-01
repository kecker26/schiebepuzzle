export interface CropTransform {
  zoom: number
  rotationDeg: number
  offsetX: number
  offsetY: number
}

export interface CropRenderMetrics {
  baseScale: number
  appliedScale: number
  maxOffsetX: number
  maxOffsetY: number
  boundedWidth: number
  boundedHeight: number
}

export interface CropExportOptions {
  maxEdge?: number
  quality?: number
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp'
}

export interface CropSize {
  width: number
  height: number
}

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const DEFAULT_EXPORT_EDGE = 1800

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function normalizeAngle(deg: number): number {
  const normalized = deg % 360
  return normalized < 0 ? normalized + 360 : normalized
}

function computeRotatedBounds(imageWidth: number, imageHeight: number, rotationRad: number): CropSize {
  const cos = Math.cos(rotationRad)
  const sin = Math.sin(rotationRad)
  const boundedWidth = Math.abs(imageWidth * cos) + Math.abs(imageHeight * sin)
  const boundedHeight = Math.abs(imageWidth * sin) + Math.abs(imageHeight * cos)

  return {
    width: Math.max(1, boundedWidth),
    height: Math.max(1, boundedHeight),
  }
}

function computeBaseScale(
  imageWidth: number,
  imageHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  rotationRad: number
): number {
  const rotated = computeRotatedBounds(imageWidth, imageHeight, rotationRad)
  const scaleX = viewportWidth / rotated.width
  const scaleY = viewportHeight / rotated.height

  return Math.max(scaleX, scaleY)
}

export function getCropViewportSize(aspectRatio: number, maxEdge: number = 560): CropSize {
  const safeRatio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1
  if (safeRatio >= 1) {
    return {
      width: Math.round(maxEdge),
      height: Math.max(1, Math.round(maxEdge / safeRatio)),
    }
  }

  return {
    width: Math.max(1, Math.round(maxEdge * safeRatio)),
    height: Math.round(maxEdge),
  }
}

export function clampCropTransform(
  image: HTMLImageElement,
  viewportWidth: number,
  viewportHeight: number,
  transform: CropTransform
): { transform: CropTransform; metrics: CropRenderMetrics } {
  const zoom = clamp(transform.zoom, MIN_ZOOM, MAX_ZOOM)
  const rotationDeg = normalizeAngle(transform.rotationDeg)
  const rotationRad = toRadians(rotationDeg)
  const baseScale = computeBaseScale(image.width, image.height, viewportWidth, viewportHeight, rotationRad)
  const appliedScale = baseScale * zoom

  const rotatedBounds = computeRotatedBounds(image.width, image.height, rotationRad)
  const boundedWidth = rotatedBounds.width * appliedScale
  const boundedHeight = rotatedBounds.height * appliedScale

  const maxOffsetX = Math.max(0, (boundedWidth - viewportWidth) / 2)
  const maxOffsetY = Math.max(0, (boundedHeight - viewportHeight) / 2)

  const offsetX = clamp(transform.offsetX, -maxOffsetX, maxOffsetX)
  const offsetY = clamp(transform.offsetY, -maxOffsetY, maxOffsetY)

  return {
    transform: {
      zoom,
      rotationDeg,
      offsetX,
      offsetY,
    },
    metrics: {
      baseScale,
      appliedScale,
      maxOffsetX,
      maxOffsetY,
      boundedWidth,
      boundedHeight,
    },
  }
}

function drawCropFrame(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  viewportWidth: number,
  viewportHeight: number,
  transform: CropTransform,
  backgroundColor: string
): CropRenderMetrics {
  const bounded = clampCropTransform(image, viewportWidth, viewportHeight, transform)
  const safeTransform = bounded.transform
  const metrics = bounded.metrics

  ctx.clearRect(0, 0, viewportWidth, viewportHeight)
  ctx.fillStyle = backgroundColor
  ctx.fillRect(0, 0, viewportWidth, viewportHeight)

  ctx.save()
  ctx.translate(viewportWidth / 2 + safeTransform.offsetX, viewportHeight / 2 + safeTransform.offsetY)
  ctx.rotate(toRadians(safeTransform.rotationDeg))
  ctx.scale(metrics.appliedScale, metrics.appliedScale)
  ctx.drawImage(image, -image.width / 2, -image.height / 2)
  ctx.restore()

  return metrics
}

export function renderCropPreview(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  transform: CropTransform
): { transform: CropTransform; metrics: CropRenderMetrics } {
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas context not available')
  }

  const bounded = clampCropTransform(image, canvas.width, canvas.height, transform)
  drawCropFrame(context, image, canvas.width, canvas.height, bounded.transform, '#10131a')
  return bounded
}

export function exportCroppedImage(
  image: HTMLImageElement,
  aspectRatio: number,
  previewTransform: CropTransform,
  previewViewport: CropSize,
  options: CropExportOptions = {}
): string {
  const maxEdge = options.maxEdge ?? DEFAULT_EXPORT_EDGE
  const mimeType = options.mimeType ?? 'image/jpeg'
  const quality = options.quality ?? 0.9
  const exportSize = getCropViewportSize(aspectRatio, maxEdge)

  const exportCanvas = document.createElement('canvas')
  exportCanvas.width = exportSize.width
  exportCanvas.height = exportSize.height

  const exportCtx = exportCanvas.getContext('2d')
  if (!exportCtx) {
    throw new Error('Canvas context not available')
  }

  const offsetScaleX = exportSize.width / previewViewport.width
  const offsetScaleY = exportSize.height / previewViewport.height

  const scaledTransform: CropTransform = {
    zoom: previewTransform.zoom,
    rotationDeg: previewTransform.rotationDeg,
    offsetX: previewTransform.offsetX * offsetScaleX,
    offsetY: previewTransform.offsetY * offsetScaleY,
  }

  const bounded = clampCropTransform(image, exportSize.width, exportSize.height, scaledTransform)
  drawCropFrame(exportCtx, image, exportSize.width, exportSize.height, bounded.transform, '#ffffff')

  return exportCanvas.toDataURL(mimeType, quality)
}

export function createDefaultCropTransform(): CropTransform {
  return {
    zoom: 1,
    rotationDeg: 0,
    offsetX: 0,
    offsetY: 0,
  }
}

