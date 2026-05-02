import {
  AlertTriangle,
  Crop,
  Grid3X3,
  Image,
  Maximize,
  Move,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Scan,
  SlidersHorizontal,
  ZoomIn,
  type LucideIcon,
} from 'lucide-react'

const cropScreenIconAssets = {
  alertTriangle: AlertTriangle,
  crop: Crop,
  grid: Grid3X3,
  image: Image,
  maximize: Maximize,
  move: Move,
  play: Play,
  refreshCw: RefreshCw,
  rotateCcw: RotateCcw,
  rotateCw: RotateCw,
  scan: Scan,
  sliders: SlidersHorizontal,
  zoomIn: ZoomIn,
} as const satisfies Record<string, LucideIcon>

type CropScreenIconName = keyof typeof cropScreenIconAssets

interface CropScreenIconProps {
  name: CropScreenIconName
  className?: string
}

export type { CropScreenIconName }

export default function CropScreenIcon({ name, className }: CropScreenIconProps) {
  const Icon = cropScreenIconAssets[name]

  return (
    <Icon
      aria-hidden="true"
      focusable="false"
      className={className ? `crop-screen-icon ${className}` : 'crop-screen-icon'}
      strokeWidth={2.15}
      absoluteStrokeWidth
    />
  )
}
