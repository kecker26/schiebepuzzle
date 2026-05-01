import type { CSSProperties } from 'react'
import cropIcon from '../assets/system/crop-screen-icons/crop.svg'
import gridIcon from '../assets/system/crop-screen-icons/grid.svg'
import maximizeIcon from '../assets/system/crop-screen-icons/maximize.svg'
import moveIcon from '../assets/system/crop-screen-icons/move.svg'
import refreshCwIcon from '../assets/system/crop-screen-icons/refresh-cw.svg'
import rotateCcwIcon from '../assets/system/crop-screen-icons/rotate-ccw.svg'
import rotateCwIcon from '../assets/system/crop-screen-icons/rotate-cw.svg'
import slidersIcon from '../assets/system/crop-screen-icons/sliders.svg'
import zoomInIcon from '../assets/system/crop-screen-icons/zoom-in.svg'

const cropScreenIconAssets = {
  crop: cropIcon,
  grid: gridIcon,
  maximize: maximizeIcon,
  move: moveIcon,
  refreshCw: refreshCwIcon,
  rotateCcw: rotateCcwIcon,
  rotateCw: rotateCwIcon,
  sliders: slidersIcon,
  zoomIn: zoomInIcon,
} as const

type CropScreenIconName = keyof typeof cropScreenIconAssets

interface CropScreenIconProps {
  name: CropScreenIconName
  className?: string
}

export type { CropScreenIconName }

export default function CropScreenIcon({ name, className }: CropScreenIconProps) {
  return (
    <span
      aria-hidden="true"
      className={className ? `crop-screen-icon ${className}` : 'crop-screen-icon'}
      style={{ '--crop-screen-icon-url': `url("${cropScreenIconAssets[name]}")` } as CSSProperties}
    />
  )
}
