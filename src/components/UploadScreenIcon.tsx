import type { CSSProperties } from 'react'
import awardIcon from '../assets/system/upload-screen-icons/award.svg'
import barChart2Icon from '../assets/system/upload-screen-icons/bar-chart-2.svg'
import checkCircleIcon from '../assets/system/upload-screen-icons/check-circle.svg'
import clockIcon from '../assets/system/upload-screen-icons/clock.svg'
import downloadCloudIcon from '../assets/system/upload-screen-icons/download-cloud.svg'
import folderIcon from '../assets/system/upload-screen-icons/folder.svg'
import helpCircleIcon from '../assets/system/upload-screen-icons/help-circle.svg'
import homeIcon from '../assets/system/upload-screen-icons/home.svg'
import imageIcon from '../assets/system/upload-screen-icons/image.svg'
import layersIcon from '../assets/system/upload-screen-icons/layers.svg'
import refreshCwIcon from '../assets/system/upload-screen-icons/refresh-cw.svg'
import uploadCloudIcon from '../assets/system/upload-screen-icons/upload-cloud.svg'

const uploadScreenIconAssets = {
  award: awardIcon,
  barChart2: barChart2Icon,
  checkCircle: checkCircleIcon,
  clock: clockIcon,
  downloadCloud: downloadCloudIcon,
  folder: folderIcon,
  helpCircle: helpCircleIcon,
  home: homeIcon,
  image: imageIcon,
  layers: layersIcon,
  refreshCw: refreshCwIcon,
  uploadCloud: uploadCloudIcon,
} as const

type UploadScreenIconName = keyof typeof uploadScreenIconAssets

interface UploadScreenIconProps {
  name: UploadScreenIconName
  className?: string
}

export type { UploadScreenIconName }

export default function UploadScreenIcon({ name, className }: UploadScreenIconProps) {
  return (
    <span
      aria-hidden="true"
      className={className ? `upload-screen-icon ${className}` : 'upload-screen-icon'}
      style={{ '--upload-screen-icon-url': `url("${uploadScreenIconAssets[name]}")` } as CSSProperties}
    />
  )
}
