import type { CSSProperties } from 'react'
import barChart2Icon from '../assets/system/start-screen-icons/bar-chart-2.svg'
import cropIcon from '../assets/system/start-screen-icons/crop.svg'
import downloadCloudIcon from '../assets/system/start-screen-icons/download-cloud.svg'
import folderIcon from '../assets/system/start-screen-icons/folder.svg'
import gridIcon from '../assets/system/start-screen-icons/grid.svg'
import helpCircleIcon from '../assets/system/start-screen-icons/help-circle.svg'
import imageIcon from '../assets/system/start-screen-icons/image.svg'
import musicIcon from '../assets/system/start-screen-icons/music.svg'
import refreshCwIcon from '../assets/system/start-screen-icons/refresh-cw.svg'
import slidersIcon from '../assets/system/start-screen-icons/sliders.svg'
import uploadCloudIcon from '../assets/system/start-screen-icons/upload-cloud.svg'

const startScreenIconAssets = {
  barChart2: barChart2Icon,
  crop: cropIcon,
  downloadCloud: downloadCloudIcon,
  folder: folderIcon,
  grid: gridIcon,
  helpCircle: helpCircleIcon,
  image: imageIcon,
  music: musicIcon,
  refreshCw: refreshCwIcon,
  sliders: slidersIcon,
  uploadCloud: uploadCloudIcon,
} as const

type StartScreenIconName = keyof typeof startScreenIconAssets

interface StartScreenIconProps {
  name: StartScreenIconName
  className?: string
}

export type { StartScreenIconName }

export default function StartScreenIcon({ name, className }: StartScreenIconProps) {
  return (
    <span
      aria-hidden="true"
      className={className ? `start-screen-icon ${className}` : 'start-screen-icon'}
      style={{ '--start-screen-icon-url': `url("${startScreenIconAssets[name]}")` } as CSSProperties}
    />
  )
}
