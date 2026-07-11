import { AnimatePresence } from 'motion/react'
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { type AppContextMenuHandler, type AppContextMenuRequest } from '../app/appContextMenu.ts'
import { handleDirectionalFocusNavigation } from '../app/directionalFocusNavigation.ts'
import { handleSelectEnterKeyDown } from '../app/formControlUtils.ts'
import { isEditableTarget } from '../app/keyboardShortcutUtils.ts'
import CropScreenIcon, { type CropScreenIconName } from '../components/CropScreenIcon.tsx'
import CompactContextMenu, { type ContextMenuItem, type ContextMenuPosition } from '../components/CompactContextMenu.tsx'
import AnimatedButton from '../motion/AnimatedButton.tsx'
import AnimatedReveal from '../motion/AnimatedReveal.tsx'
import AnimatedStaggerGroup from '../motion/AnimatedStaggerGroup.tsx'
import AsyncStatusPanel from '../motion/AsyncStatusPanel.tsx'
import {
  clampCropTransform,
  createDefaultCropTransform,
  CropTransform,
  exportCroppedImage,
  exportFullImage,
  getCropViewportSize,
  renderCropPreview,
} from '../services/CropService.ts'
import { type RandomImageSourceInfo } from '../services/RandomImageService.ts'
import ErrorToast from '../components/ErrorToast.tsx'
import '../styles/screens/crop.css'
import { PuzzleConfig } from '../types/index'
import { shouldPreserveNativeContextMenu } from '../utils/contextWindow.ts'
import { DIFFICULTY_OPTIONS, getDifficultyOption } from '../utils/puzzleDifficulty.ts'

interface CropScreenProps {
  image: string
  config: PuzzleConfig
  onOpenHelp: () => void
  registerAppContextMenuHandler: (handler: AppContextMenuHandler | null) => void
  isRandomImage?: boolean
  isFetchingRandom?: boolean
  randomImageError?: string | null
  randomImageSource?: RandomImageSourceInfo | null
  randomImageQuery?: string
  onRandomImageQueryChange?: (query: string) => void
  onFetchNewRandomImage?: (query?: string) => void
  initialTransform?: CropTransform | null
  initialUseFullImage?: boolean
  replayCropTransform?: CropTransform | null
  onSessionDraftChange?: (draft: {
    transform: CropTransform
    useFullImage: boolean
  }) => void
  onConfigChange: (rows: number, cols: number) => void
  onCropConfirmed: (croppedImageSrc: string, cropDraft: {
    transform: CropTransform
    useFullImage: boolean
  }) => void
  onBack: () => void
  onGoToStartScreen: () => void
}

export default function CropScreen({
  image,
  config,
  onOpenHelp,
  registerAppContextMenuHandler,
  isRandomImage,
  isFetchingRandom,
  randomImageError,
  randomImageSource,
  randomImageQuery = '',
  onRandomImageQueryChange,
  onFetchNewRandomImage,
  initialTransform = null,
  initialUseFullImage = false,
  replayCropTransform = null,
  onSessionDraftChange,
  onConfigChange,
  onCropConfirmed,
  onBack,
  onGoToStartScreen,
}: CropScreenProps) {
  const KEYBOARD_MOVE_STEP = 24
  const KEYBOARD_MOVE_STEP_LARGE = 72
  const KEYBOARD_ZOOM_STEP = 0.1
  const KEYBOARD_ZOOM_STEP_LARGE = 0.25
  const screenRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewStageRef = useRef<HTMLDivElement>(null)
  const activeDifficultyButtonRef = useRef<HTMLButtonElement>(null)
  const dragRef = useRef<{ pointerId: number; lastX: number; lastY: number } | null>(null)
  const initialTransformRef = useRef<CropTransform | null>(initialTransform)
  const initialUseFullImageRef = useRef(initialUseFullImage)
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null)
  const [transform, setTransform] = useState<CropTransform>(() => initialTransform ?? createDefaultCropTransform())
  const [useFullImage, setUseFullImage] = useState(initialUseFullImage)
  const transformRef = useRef(transform)
  const useFullImageRef = useRef(useFullImage)
  const replayCropTransformRef = useRef<CropTransform | null>(replayCropTransform)
  const replayUseFullImageRef = useRef(initialUseFullImage)
  const [isUsingOriginalCrop, setIsUsingOriginalCrop] = useState(Boolean(replayCropTransform))
  const [isDragging, setIsDragging] = useState(false)
  const [imageLoadError, setImageLoadError] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] = useState<ContextMenuPosition | null>(null)
  const [cropPreviewDisplaySize, setCropPreviewDisplaySize] = useState(320)

  const zoomPercent = Math.round((transform.zoom - 1) * 100)
  const cropAspectRatio = 1
  const viewportSize = useMemo(() => getCropViewportSize(cropAspectRatio), [])
  const modeIconName: CropScreenIconName = useFullImage ? 'maximize' : 'crop'
  const hintIconName: CropScreenIconName = useFullImage ? 'maximize' : 'move'
  const selectedDifficulty = getDifficultyOption(config)
  const selectedDifficultyLabel = selectedDifficulty
    ? `${selectedDifficulty.label} ${selectedDifficulty.description}`
    : `${config.rows}x${config.cols}`
  const previewTileCount = config.rows * config.cols
  const fullImageRotationDeg = ((transform.rotationDeg % 360) + 360) % 360
  const hasReplayCrop = replayCropTransform !== null
  const trimmedRandomImageQuery = randomImageQuery.trim()

  useEffect(() => {
    initialTransformRef.current = initialTransform
    initialUseFullImageRef.current = initialUseFullImage
  }, [initialTransform, initialUseFullImage])

  useEffect(() => {
    if (replayCropTransformRef.current !== replayCropTransform) {
      replayCropTransformRef.current = replayCropTransform
      replayUseFullImageRef.current = initialUseFullImage
    }

    setIsUsingOriginalCrop(Boolean(replayCropTransform))
  }, [initialUseFullImage, replayCropTransform])

  useEffect(() => {
    transformRef.current = transform
  }, [transform])

  useEffect(() => {
    useFullImageRef.current = useFullImage
  }, [useFullImage])

  useEffect(() => {
    let isCancelled = false

    const loadedImage = new Image()
    loadedImage.onload = () => {
      if (isCancelled) return
      setSourceImage(loadedImage)
      setImageLoadError(false)
      const nextTransform = initialTransformRef.current ?? createDefaultCropTransform()
      transformRef.current = nextTransform
      useFullImageRef.current = initialUseFullImageRef.current
      setTransform(nextTransform)
      setUseFullImage(initialUseFullImageRef.current)
      dragRef.current = null
      setIsDragging(false)
    }
    loadedImage.onerror = () => {
      if (isCancelled) return
      setSourceImage(null)
      setImageLoadError(true)
    }
    loadedImage.src = image

    return () => {
      isCancelled = true
    }
  }, [image])

  useEffect(() => {
    onSessionDraftChange?.({
      transform,
      useFullImage,
    })
  }, [onSessionDraftChange, transform, useFullImage])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      activeDifficultyButtonRef.current?.focus({ preventScroll: true })
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [])

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented
        || event.altKey
        || event.ctrlKey
        || event.metaKey
      ) {
        return
      }

      const activeElement = document.activeElement
      if (
        !(activeElement instanceof HTMLElement)
        || !screenRef.current?.contains(activeElement)
      ) {
        return
      }

      if (isEditableTarget(event.target)) {
        return
      }

      if (event.key.toLowerCase() === 'b') {
        event.preventDefault()
        if (event.repeat) return

        previewStageRef.current?.focus({ preventScroll: true })
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        onBack()
      }
    }

    window.addEventListener('keydown', handleWindowKeyDown)
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown)
    }
  }, [onBack])

  useEffect(() => {
    if (useFullImage) return
    if (!canvasRef.current || !sourceImage) return
    const canvas = canvasRef.current
    canvas.width = viewportSize.width
    canvas.height = viewportSize.height

    try {
      const bounded = renderCropPreview(canvas, sourceImage, transform)
      const next = bounded.transform
      const hasChanged =
        Math.abs(next.zoom - transform.zoom) > 0.0001 ||
        Math.abs(next.rotationDeg - transform.rotationDeg) > 0.0001 ||
        Math.abs(next.offsetX - transform.offsetX) > 0.0001 ||
        Math.abs(next.offsetY - transform.offsetY) > 0.0001

      if (hasChanged) {
        transformRef.current = next
        setTransform(next)
      }
    } catch {
      // noop
    }
  }, [sourceImage, transform, viewportSize.width, viewportSize.height, useFullImage])

  useEffect(() => {
    if (useFullImage || !sourceImage) return

    const wrapper = previewStageRef.current?.parentElement
    if (!wrapper) return

    const updatePreviewSize = () => {
      const computed = window.getComputedStyle(wrapper)
      const horizontalPadding = parseFloat(computed.paddingLeft) + parseFloat(computed.paddingRight)
      const verticalPadding = parseFloat(computed.paddingTop) + parseFloat(computed.paddingBottom)
      const availableWidth = wrapper.clientWidth - horizontalPadding
      const availableHeight = wrapper.clientHeight - verticalPadding
      const nextSize = Math.round(Math.max(220, Math.min(560, availableWidth, availableHeight)))

      setCropPreviewDisplaySize((previousSize) => (
        Math.abs(previousSize - nextSize) > 1 ? nextSize : previousSize
      ))
    }

    updatePreviewSize()

    const observer = new ResizeObserver(updatePreviewSize)
    observer.observe(wrapper)
    window.addEventListener('resize', updatePreviewSize)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updatePreviewSize)
    }
  }, [sourceImage, useFullImage])

  const handleConfirm = () => {
    if (!sourceImage) return
    const confirmedTransform = transformRef.current
    const confirmedUseFullImage = useFullImageRef.current

    if (confirmedUseFullImage) {
      const fullImageTransform = {
        ...confirmedTransform,
        rotationDeg: fullImageRotationDeg,
      }
      if (fullImageRotationDeg === 0) {
        onCropConfirmed(image, {
          transform: fullImageTransform,
          useFullImage: true,
        })
        return
      }

      try {
        const rotated = exportFullImage(sourceImage, fullImageRotationDeg, {
          maxEdge: 1800,
          quality: 0.9,
          mimeType: 'image/jpeg',
        })
        onCropConfirmed(rotated, {
          transform: fullImageTransform,
          useFullImage: true,
        })
      } catch {
        onCropConfirmed(image, {
          transform: fullImageTransform,
          useFullImage: true,
        })
      }
      return
    }

    const bounded = clampCropTransform(
      sourceImage,
      viewportSize.width,
      viewportSize.height,
      confirmedTransform
    ).transform

    try {
      const cropped = exportCroppedImage(sourceImage, cropAspectRatio, bounded, viewportSize, {
        maxEdge: 1800,
        quality: 0.9,
        mimeType: 'image/jpeg',
      })
      onCropConfirmed(cropped, {
        transform: bounded,
        useFullImage: false,
      })
    } catch {
      onCropConfirmed(image, {
        transform: bounded,
        useFullImage: false,
      })
    }
  }

  const applyClampedTransform = (nextTransform: CropTransform): CropTransform => {
    if (!sourceImage) {
      return nextTransform
    }

    return clampCropTransform(
      sourceImage,
      viewportSize.width,
      viewportSize.height,
      nextTransform
    ).transform
  }

  const updateTransform = (updater: (prev: CropTransform) => CropTransform) => {
    setIsUsingOriginalCrop(false)
    const nextTransform = applyClampedTransform(updater(transformRef.current))
    transformRef.current = nextTransform
    setTransform(nextTransform)
  }

  const setCropMode = (nextUseFullImage: boolean) => {
    setIsUsingOriginalCrop(false)
    useFullImageRef.current = nextUseFullImage
    setUseFullImage(nextUseFullImage)
    dragRef.current = null
    setIsDragging(false)
  }

  const handleToggleImageMode = () => {
    setCropMode(!useFullImage)
  }

  const handleResetCrop = () => {
    dragRef.current = null
    setIsDragging(false)
    setIsUsingOriginalCrop(false)
    const nextTransform = applyClampedTransform(createDefaultCropTransform())
    transformRef.current = nextTransform
    setTransform(nextTransform)
  }

  const handleUseReplayCrop = () => {
    if (!replayCropTransform) return

    dragRef.current = null
    setIsDragging(false)
    useFullImageRef.current = replayUseFullImageRef.current
    setUseFullImage(replayUseFullImageRef.current)
    const nextTransform = applyClampedTransform(replayCropTransform)
    transformRef.current = nextTransform
    setTransform(nextTransform)
    setIsUsingOriginalCrop(true)
  }

  const handleRecropReplayImage = () => {
    dragRef.current = null
    setIsDragging(false)
    useFullImageRef.current = false
    setUseFullImage(false)
    const nextTransform = applyClampedTransform(createDefaultCropTransform())
    transformRef.current = nextTransform
    setTransform(nextTransform)
    setIsUsingOriginalCrop(false)
  }

  const handleRotateCrop = (deltaDeg: number) => {
    updateTransform((prev) => ({
      ...prev,
      rotationDeg: prev.rotationDeg + deltaDeg,
    }))
  }

  const handleNudgeCrop = (deltaX: number, deltaY: number) => {
    updateTransform((prev) => ({
      ...prev,
      offsetX: prev.offsetX + deltaX,
      offsetY: prev.offsetY + deltaY,
    }))
  }

  const openContextWindow = useMemo(() => ((request: AppContextMenuRequest) => {
    if (shouldPreserveNativeContextMenu(request.target)) return

    request.preventDefault?.()
    setContextMenuPosition({ x: request.clientX, y: request.clientY })
  }), [])

  useEffect(() => {
    registerAppContextMenuHandler(openContextWindow)
    return () => registerAppContextMenuHandler(null)
  }, [openContextWindow, registerAppContextMenuHandler])

  const handleOpenContextWindow = (event: React.MouseEvent<HTMLDivElement>) => {
    openContextWindow({
      clientX: event.clientX,
      clientY: event.clientY,
      target: event.target,
      preventDefault: () => event.preventDefault(),
    })
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (useFullImage) return
    if (!sourceImage || !canvasRef.current) return
    if (event.pointerType === 'mouse' && event.button !== 0) return

    previewStageRef.current?.focus({ preventScroll: true })
    const canvas = canvasRef.current
    canvas.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
    }
    setIsDragging(true)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current || !canvasRef.current) return
    if (dragRef.current.pointerId !== event.pointerId) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return

    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const deltaX = (event.clientX - dragRef.current.lastX) * scaleX
    const deltaY = (event.clientY - dragRef.current.lastY) * scaleY

    dragRef.current.lastX = event.clientX
    dragRef.current.lastY = event.clientY

    setIsUsingOriginalCrop(false)
    const nextTransform = {
      ...transformRef.current,
      offsetX: transformRef.current.offsetX + deltaX,
      offsetY: transformRef.current.offsetY + deltaY,
    }
    transformRef.current = nextTransform
    setTransform(nextTransform)
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return
    if (dragRef.current?.pointerId !== event.pointerId) return
    canvasRef.current.releasePointerCapture(event.pointerId)
    dragRef.current = null
    setIsDragging(false)
  }

  const handleZoomChange = (nextZoom: number) => {
    updateTransform((prev) => ({
      ...prev,
      zoom: nextZoom,
    }))
  }

  const handleZoomPercentChange = (percentValue: number) => {
    const factor = Math.max(1, 1 + percentValue / 100)
    handleZoomChange(factor)
  }

  const handlePreviewKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      handleConfirm()
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      onBack()
      return
    }

    if (!sourceImage) {
      return
    }

    const moveStep = event.shiftKey ? KEYBOARD_MOVE_STEP_LARGE : KEYBOARD_MOVE_STEP
    const zoomStep = event.shiftKey ? KEYBOARD_ZOOM_STEP_LARGE : KEYBOARD_ZOOM_STEP

    switch (event.key) {
      case 'ArrowLeft':
        if (useFullImage) return
        event.preventDefault()
        handleNudgeCrop(-moveStep, 0)
        return
      case 'ArrowRight':
        if (useFullImage) return
        event.preventDefault()
        handleNudgeCrop(moveStep, 0)
        return
      case 'ArrowUp':
        if (useFullImage) return
        event.preventDefault()
        handleNudgeCrop(0, -moveStep)
        return
      case 'ArrowDown':
        if (useFullImage) return
        event.preventDefault()
        handleNudgeCrop(0, moveStep)
        return
      case '+':
      case '=':
        if (useFullImage) return
        event.preventDefault()
        handleZoomChange(transform.zoom + zoomStep)
        return
      case '-':
      case '_':
        if (useFullImage) return
        event.preventDefault()
        handleZoomChange(transform.zoom - zoomStep)
        return
      case 'PageUp':
        if (useFullImage) return
        event.preventDefault()
        handleZoomChange(transform.zoom + KEYBOARD_ZOOM_STEP_LARGE)
        return
      case 'PageDown':
        if (useFullImage) return
        event.preventDefault()
        handleZoomChange(transform.zoom - KEYBOARD_ZOOM_STEP_LARGE)
        return
      case 'q':
      case 'Q':
        event.preventDefault()
        handleRotateCrop(-90)
        return
      case 'e':
      case 'E':
        event.preventDefault()
        handleRotateCrop(90)
        return
      case 'r':
      case 'R':
        event.preventDefault()
        handleResetCrop()
        return
      default:
        return
    }
  }

  const handleFetchRandomWithCurrentQuery = () => {
    if (!onFetchNewRandomImage) return

    if (trimmedRandomImageQuery) {
      onFetchNewRandomImage(trimmedRandomImageQuery)
      return
    }

    onFetchNewRandomImage()
  }

  const handleRandomSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    handleFetchRandomWithCurrentQuery()
  }

  const cropActions: ContextMenuItem[] = [
    {
      groupTitle: 'Navigation',
    },
    {
      label: 'Spiel starten',
      icon: 'play',
      meta: `${config.rows}x${config.cols}`,
      onClick: handleConfirm,
      disabled: !sourceImage || Boolean(isFetchingRandom),
    },
    {
      label: 'Zurück',
      icon: 'arrowLeft',
      meta: 'Upload',
      onClick: onBack,
    },
    {
      label: 'Zur Startseite',
      icon: 'home',
      meta: 'Start',
      onClick: onGoToStartScreen,
    },
    {
      groupTitle: 'Hilfe',
    },
    {
      label: 'Shortcuts und Bedienung',
      icon: 'command',
      meta: 'F1',
      onClick: onOpenHelp,
    },
    {
      groupTitle: 'Bild',
    },
    {
      label: useFullImage ? 'Ausschnitt bearbeiten' : 'Komplettes Bild verwenden',
      icon: useFullImage ? 'crop' : 'maximize',
      meta: 'Modus',
      onClick: handleToggleImageMode,
      disabled: !sourceImage,
    },
    {
      label: useFullImage ? 'Rotation resetten' : 'Ausschnitt resetten',
      icon: 'rotateCcw',
      meta: 'Zurücksetzen',
      onClick: handleResetCrop,
      disabled: !sourceImage,
    },
    ...(isRandomImage && onFetchNewRandomImage
      ? [
          {
            groupTitle: 'Zufallsbild',
          } satisfies ContextMenuItem,
          {
            label: 'Anderes Bild laden',
            icon: 'refreshCw',
            meta: isFetchingRandom ? 'Lädt ...' : 'Zufall',
            onClick: handleFetchRandomWithCurrentQuery,
            disabled: Boolean(isFetchingRandom),
          } satisfies ContextMenuItem,
        ]
      : []),
  ]

  return (
    <div ref={screenRef} className="crop-screen" data-page-focus-root="true" onContextMenu={handleOpenContextWindow}>
      <AnimatedStaggerGroup className="crop-container" level="medium">
        <AnimatedReveal as="header" level="medium">
          <div className="crop-header">
            <div className="crop-header-title">
              <span className="crop-title-icon-shell" aria-hidden="true">
                <CropScreenIcon name="scan" className="crop-title-icon" />
              </span>
              <div>
                <span className="crop-kicker">Puzzle vorbereiten</span>
                <h2>Einstellungen</h2>
              </div>
            </div>
            {isRandomImage && randomImageSource?.label && (
              <div className="crop-source-row">
                <p className="crop-random-source">
                  Quelle:{' '}
                  {randomImageSource.url ? (
                    <a href={randomImageSource.url} target="_blank" rel="noreferrer" tabIndex={-1}>
                      {randomImageSource.label}
                    </a>
                  ) : (
                    randomImageSource.label
                  )}
                </p>
              </div>
            )}
            <div className="crop-header-summary" aria-label="Aktuelle Auswahl">
              <span>{selectedDifficultyLabel}</span>
              <span>{useFullImage ? 'Komplettes Bild' : 'Ausschnitt aktiv'}</span>
            </div>
          </div>
        </AnimatedReveal>

        <ErrorToast message={randomImageError || null} />

        {hasReplayCrop && (
          <AnimatedReveal className="crop-replay-banner" level="medium">
            <div className="crop-replay-banner-content">
              <span className="crop-replay-banner-icon-shell" aria-hidden="true">
                <CropScreenIcon name="refreshCw" className="crop-replay-banner-icon" />
              </span>
              <span className="crop-replay-banner-text">Replay</span>
            </div>
            <div className="crop-replay-banner-actions">
              <button
                type="button"
                className={`crop-replay-banner-button${isUsingOriginalCrop ? ' is-active' : ''}`}
                onClick={handleUseReplayCrop}
                disabled={!sourceImage}
                data-app-tooltip="Originalen Zuschnitt dieses Galerie-Laufs wiederverwenden."
                data-app-tooltip-align="start"
              >
                Original
              </button>
              <button
                type="button"
                className={`crop-replay-banner-button${!isUsingOriginalCrop ? ' is-active' : ''}`}
                onClick={handleRecropReplayImage}
                disabled={!sourceImage}
                data-app-tooltip="Motiv neu zuschneiden und Schwierigkeit frei anpassen."
                data-app-tooltip-align="end"
              >
                Neu
              </button>
            </div>
          </AnimatedReveal>
        )}

        <div className="crop-side-panel">
          <AnimatedStaggerGroup className="crop-controls" level="medium">
            <AnimatedReveal className="config-selector crop-control-block" level="medium">
            <div id="puzzle-size-label" className="crop-control-label">
              <span className="crop-control-label-head">
                <span className="crop-control-label-icon-shell" aria-hidden="true">
                  <CropScreenIcon name="grid" className="crop-control-label-icon" />
                </span>
                <span>Schwierigkeitsgrad</span>
              </span>
            </div>
            <AnimatedStaggerGroup
              className="crop-difficulty-grid"
              role="radiogroup"
              aria-labelledby="puzzle-size-label"
              level="subtle"
              onKeyDown={handleDirectionalFocusNavigation}
            >
              {DIFFICULTY_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  ref={option.rows === config.rows && option.cols === config.cols ? activeDifficultyButtonRef : undefined}
                  type="button"
                  className={`crop-difficulty-card${option.rows === config.rows && option.cols === config.cols ? ' is-active' : ''}`}
                  role="radio"
                  aria-checked={option.rows === config.rows && option.cols === config.cols}
                  data-page-primary-focus={option.rows === config.rows && option.cols === config.cols ? 'true' : undefined}
                  onClick={() => onConfigChange(option.rows, option.cols)}
                  data-app-tooltip={`${option.label}: ${option.description}, ${option.tileCount - 1} bewegliche Teile und ein Leerfeld.`}
                  data-app-tooltip-align="start"
                >
                  <span className="crop-difficulty-card-top">
                    <span className="crop-difficulty-card-label">{option.label}</span>
                    <span className="crop-difficulty-card-size">{option.description}</span>
                  </span>
                  <span
                    className="crop-difficulty-mini-grid"
                    style={{
                      '--difficulty-grid-rows': option.rows,
                      '--difficulty-grid-cols': option.cols,
                    } as CSSProperties}
                    aria-hidden="true"
                  >
                    {Array.from({ length: option.tileCount }, (_, index) => (
                      <span key={index} />
                    ))}
                  </span>
                  <span className="crop-difficulty-card-meta">
                    <span>{option.tileCount - 1} Teile</span>
                    <span>+ Leerfeld</span>
                  </span>
                </button>
              ))}
            </AnimatedStaggerGroup>
          </AnimatedReveal>

          <AnimatedReveal className="crop-control-block" level="medium">
            <label htmlFor="crop-mode" className="crop-control-label">
              <span className="crop-control-label-head">
                <span className="crop-control-label-icon-shell" aria-hidden="true">
                  <CropScreenIcon name={modeIconName} className="crop-control-label-icon" />
                </span>
                <span>Bildmodus:</span>
              </span>
            </label>
            <select
              id="crop-mode"
              value={useFullImage ? 'full' : 'crop'}
              onKeyDown={handleSelectEnterKeyDown}
              onChange={(event) => {
                setCropMode(event.target.value === 'full')
              }}
              disabled={!sourceImage}
              data-app-tooltip="Ausschnitt frei positionieren oder das komplette Bild als Puzzle verwenden."
              data-app-tooltip-align="start"
            >
              <option value="crop">Ausschnitt (frei positionieren)</option>
              <option value="full">Komplettes Bild verwenden</option>
            </select>
          </AnimatedReveal>

          </AnimatedStaggerGroup>

          <AnimatedReveal className="crop-hint-row" level="medium">
            <p id="crop-hint" className="crop-hint">
              <span className="crop-hint-icon-shell" aria-hidden="true">
                <CropScreenIcon name={hintIconName} className="crop-hint-icon" />
              </span>
              <span className="crop-hint-copy">
              {useFullImage
                ? 'B fokussiert die Vorschau. Mit Q/E drehen, mit R zurücksetzen und mit Enter starten.'
                : 'B fokussiert die Vorschau. Ziehen verschiebt, Plus/Minus zoomt, Q/E dreht und R setzt zurück.'}
              </span>
            </p>
          </AnimatedReveal>
        </div>

        <AnimatedReveal className="crop-preview-wrapper" interaction="surface" level="medium">
          {sourceImage ? (
            <div
              ref={previewStageRef}
              className={`crop-preview-stage${useFullImage ? ' is-full-image' : ' is-croppable'}`}
              style={!useFullImage ? {
                '--crop-preview-size': `${cropPreviewDisplaySize}px`,
              } as CSSProperties : undefined}
              tabIndex={0}
              data-tab-actionable="true"
              role="group"
              aria-describedby="crop-hint"
              aria-label={
                useFullImage
                  ? 'Bildvorschau. B fokussiert diese Vorschau, Enter startet das Spiel, Escape geht zurück.'
                  : 'Bildzuschnitt. B fokussiert diese Vorschau, Pfeiltasten verschieben den Ausschnitt, Plus und Minus zoomen, Q und E drehen, R setzt zurück, Enter startet das Spiel.'
              }
              onKeyDown={handlePreviewKeyDown}
              data-app-tooltip={useFullImage
                ? 'Fokussieren mit B. Q/E drehen, R setzt zurück, Enter startet.'
                : 'Fokussieren mit B. Ziehen, Pfeile, Shift+Pfeile, Plus/Minus, Q/E und R steuern den Zuschnitt.'}
              data-app-tooltip-align="start"
            >
              {useFullImage ? (
                <div className="crop-full-image-stage">
                  <div
                    className="crop-full-image-frame"
                    style={{
                      '--full-image-rotation': `${fullImageRotationDeg}deg`,
                      '--crop-grid-rows': config.rows,
                      '--crop-grid-cols': config.cols,
                    } as CSSProperties}
                  >
                    <img src={image} alt="Volles Bild" className="crop-full-image-preview" />
                    <div className="crop-tile-preview-grid crop-tile-preview-grid-full" aria-hidden="true">
                      {Array.from({ length: previewTileCount }, (_, index) => (
                        <span key={index} />
                      ))}
                    </div>
                    <span className="crop-full-image-badge" aria-hidden="true">
                      <CropScreenIcon name="image" className="crop-full-image-badge-icon" />
                      Komplett
                    </span>
                  </div>
                </div>
              ) : (
                <div className="crop-canvas-stage">
                  <div
                    className="crop-tile-preview-grid"
                    style={{
                      '--crop-grid-rows': config.rows,
                      '--crop-grid-cols': config.cols,
                    } as CSSProperties}
                    aria-hidden="true"
                  >
                    {Array.from({ length: previewTileCount }, (_, index) => (
                      <span key={index} />
                    ))}
                  </div>
                  <canvas
                    ref={canvasRef}
                    className={`crop-canvas${isDragging ? ' is-dragging' : ''}`}
                    width={viewportSize.width}
                    height={viewportSize.height}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                  />
                  <div className="crop-frame-handles" aria-hidden="true">
                    <span className="is-top-left" />
                    <span className="is-top-right" />
                    <span className="is-bottom-left" />
                    <span className="is-bottom-right" />
                  </div>
                  <span className="crop-canvas-badge" aria-hidden="true">
                    {selectedDifficultyLabel}
                  </span>
                </div>
              )}
            </div>
          ) : imageLoadError ? (
            <div className="crop-load-error">
              <span className="crop-load-error-icon" aria-hidden="true">⚠️</span>
              <strong>Das Bild konnte nicht geladen werden.</strong>
              <p>Bitte gehe zurück und wähle ein anderes Bild.</p>
              <AnimatedButton
                onClick={onBack}
                className="secondary"
                data-app-tooltip="Zur Bildauswahl zurückkehren."
                data-app-tooltip-position="top"
                reveal
                revealLevel="subtle"
              >
                Zurück
              </AnimatedButton>
            </div>
          ) : (
            <AsyncStatusPanel
              className="crop-loading"
              title="Bild wird geladen"
              detail="Das Motiv wird dekodiert und für den Zuschnitt vorbereitet."
            />
          )}
        </AnimatedReveal>

        {sourceImage && (
          <AnimatedReveal className="crop-image-toolbar" level="medium">
            {!useFullImage && (
              <label
                htmlFor="crop-zoom"
                className="crop-toolbar-zoom"
                data-app-tooltip={`Zoom im Zuschnitt: ${zoomPercent > 0 ? `+${zoomPercent}` : zoomPercent}%.`}
                data-app-tooltip-position="top"
              >
                <span className="crop-toolbar-label">
                  <CropScreenIcon name="zoomIn" className="crop-toolbar-icon" />
                  <span>{zoomPercent > 0 ? `+${zoomPercent}%` : `${zoomPercent}%`}</span>
                </span>
                <input
                  id="crop-zoom"
                  type="range"
                  min={0}
                  max={300}
                  step={1}
                  value={zoomPercent}
                  onChange={(event) => handleZoomPercentChange(Number(event.target.value))}
                  disabled={!sourceImage}
                />
              </label>
            )}
            <div className="crop-toolbar-rotate" onKeyDown={handleDirectionalFocusNavigation}>
              <AnimatedButton
                className="secondary crop-toolbar-btn"
                onClick={() => handleRotateCrop(-90)}
                disabled={!sourceImage}
                data-app-tooltip="Bild oder Ausschnitt um 90 Grad gegen den Uhrzeigersinn drehen."
                data-app-tooltip-position="top"
                reveal
                revealLevel="subtle"
              >
                <CropScreenIcon name="rotateCcw" className="crop-toolbar-icon" />
                <span>-90°</span>
              </AnimatedButton>
              <AnimatedButton
                className="secondary crop-toolbar-btn"
                onClick={() => handleRotateCrop(90)}
                disabled={!sourceImage}
                data-app-tooltip="Bild oder Ausschnitt um 90 Grad im Uhrzeigersinn drehen."
                data-app-tooltip-position="top"
                reveal
                revealLevel="subtle"
              >
                <CropScreenIcon name="rotateCw" className="crop-toolbar-icon" />
                <span>+90°</span>
              </AnimatedButton>
              <AnimatedButton
                className="secondary crop-toolbar-btn"
                onClick={handleResetCrop}
                disabled={!sourceImage}
                data-app-tooltip="Zoom, Position und Rotation auf den Ausgangszustand setzen."
                data-app-tooltip-position="top"
                reveal
                revealLevel="subtle"
              >
                <CropScreenIcon name="refreshCw" className="crop-toolbar-icon" />
                <span>Zurücksetzen</span>
              </AnimatedButton>
            </div>
          </AnimatedReveal>
        )}

        <AnimatedStaggerGroup className="crop-actions" level="subtle" onKeyDown={handleDirectionalFocusNavigation}>
          {isRandomImage && onFetchNewRandomImage && (
            <div className="crop-random-refresh-group">
              <AnimatedButton
                onClick={handleFetchRandomWithCurrentQuery}
                className="secondary random-refresh-btn"
                busy={Boolean(isFetchingRandom)}
                busyLabel="Suche anderes Bild ..."
                data-app-tooltip="Neues Online-Motiv mit den aktuellen Suchbegriffen laden."
                data-app-tooltip-align="start"
                reveal
                revealLevel="subtle"
              >
                <span className="crop-inline-button-content">
                  <CropScreenIcon name="refreshCw" className="crop-inline-button-icon" />
                  <span>Anderes Bild laden</span>
                </span>
              </AnimatedButton>
              <form className="crop-random-search" onSubmit={handleRandomSearchSubmit}>
                <label
                  className="crop-random-search-label"
                  htmlFor="crop-random-query-input"
                  data-app-tooltip="Suchbegriffe für das nächste Online-Motiv."
                  data-app-tooltip-position="top"
                >
                  Suchbegriffe
                </label>
                <span className="crop-random-search-row">
                  <span className="crop-random-search-field">
                    <input
                      id="crop-random-query-input"
                      className="crop-random-search-input"
                      type="search"
                      value={randomImageQuery}
                      onChange={(event) => onRandomImageQueryChange?.(event.target.value)}
                      placeholder="Leer = echter Zufall"
                      disabled={Boolean(isFetchingRandom)}
                      data-app-tooltip="Suchbegriffe für das nächste Online-Motiv."
                      data-app-tooltip-position="top"
                    />
                    <button
                      type="button"
                      className="crop-random-search-clear"
                      aria-label="Suchbegriffe löschen"
                      onClick={() => onRandomImageQueryChange?.('')}
                      disabled={!trimmedRandomImageQuery || Boolean(isFetchingRandom)}
                      data-app-tooltip="Suchbegriffe löschen."
                      data-app-tooltip-position="top"
                    >
                      <CropScreenIcon name="x" className="crop-random-search-icon" />
                    </button>
                  </span>
                  <button
                    type="submit"
                    className="crop-random-search-submit"
                    aria-label="Anderes Bild mit diesen Suchbegriffen laden"
                    disabled={Boolean(isFetchingRandom)}
                    data-app-tooltip="Neues Bild zu diesen Suchbegriffen suchen."
                    data-app-tooltip-position="top"
                  >
                    <CropScreenIcon name="search" className="crop-random-search-icon" />
                  </button>
                </span>
              </form>
            </div>
          )}
          <AnimatedButton
            onClick={onBack}
            className="secondary"
            data-app-tooltip="Zur Bildauswahl zurückkehren."
            data-app-tooltip-position="top"
            reveal
            revealLevel="subtle"
          >
            Zurück
          </AnimatedButton>
          <AnimatedButton
            onClick={handleConfirm}
            disabled={!sourceImage || imageLoadError || isFetchingRandom}
            data-app-tooltip="Aktuellen Zuschnitt übernehmen und Puzzle starten."
            data-app-tooltip-position="top"
            reveal
            revealLevel="subtle"
          >
            <span className="crop-inline-button-content">
              <CropScreenIcon name="play" className="crop-inline-button-icon" />
              <span>Spiel starten</span>
            </span>
          </AnimatedButton>
        </AnimatedStaggerGroup>
      </AnimatedStaggerGroup>

      <AnimatePresence initial={false}>
        {contextMenuPosition && (
          <CompactContextMenu
            position={contextMenuPosition}
            items={cropActions}
            onClose={() => setContextMenuPosition(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
