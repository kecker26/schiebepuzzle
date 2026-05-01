import type { CSSProperties } from 'react'
import activityIcon from '../assets/system/context-menu-icons/activity.svg'
import arrowLeftIcon from '../assets/system/context-menu-icons/arrow-left.svg'
import barChart2Icon from '../assets/system/context-menu-icons/bar-chart-2.svg'
import clipboardIcon from '../assets/system/context-menu-icons/clipboard.svg'
import commandIcon from '../assets/system/context-menu-icons/command.svg'
import cornerUpLeftIcon from '../assets/system/context-menu-icons/corner-up-left.svg'
import cornerUpRightIcon from '../assets/system/context-menu-icons/corner-up-right.svg'
import cropIcon from '../assets/system/context-menu-icons/crop.svg'
import downloadCloudIcon from '../assets/system/context-menu-icons/download-cloud.svg'
import eyeIcon from '../assets/system/context-menu-icons/eye.svg'
import folderIcon from '../assets/system/context-menu-icons/folder.svg'
import gridIcon from '../assets/system/context-menu-icons/grid.svg'
import hashIcon from '../assets/system/context-menu-icons/hash.svg'
import helpCircleIcon from '../assets/system/context-menu-icons/help-circle.svg'
import homeIcon from '../assets/system/context-menu-icons/home.svg'
import imageIcon from '../assets/system/context-menu-icons/image.svg'
import layersIcon from '../assets/system/context-menu-icons/layers.svg'
import maximizeIcon from '../assets/system/context-menu-icons/maximize.svg'
import playIcon from '../assets/system/context-menu-icons/play.svg'
import powerIcon from '../assets/system/context-menu-icons/power.svg'
import refreshCwIcon from '../assets/system/context-menu-icons/refresh-cw.svg'
import rotateCcwIcon from '../assets/system/context-menu-icons/rotate-ccw.svg'
import shuffleIcon from '../assets/system/context-menu-icons/shuffle.svg'
import skipForwardIcon from '../assets/system/context-menu-icons/skip-forward.svg'
import uploadCloudIcon from '../assets/system/context-menu-icons/upload-cloud.svg'
import uploadIcon from '../assets/system/context-menu-icons/upload.svg'

const contextMenuIconAssets = {
  activity: activityIcon,
  arrowLeft: arrowLeftIcon,
  barChart2: barChart2Icon,
  clipboard: clipboardIcon,
  command: commandIcon,
  cornerUpLeft: cornerUpLeftIcon,
  cornerUpRight: cornerUpRightIcon,
  crop: cropIcon,
  downloadCloud: downloadCloudIcon,
  eye: eyeIcon,
  folder: folderIcon,
  grid: gridIcon,
  hash: hashIcon,
  helpCircle: helpCircleIcon,
  home: homeIcon,
  image: imageIcon,
  layers: layersIcon,
  maximize: maximizeIcon,
  play: playIcon,
  power: powerIcon,
  refreshCw: refreshCwIcon,
  rotateCcw: rotateCcwIcon,
  shuffle: shuffleIcon,
  skipForward: skipForwardIcon,
  upload: uploadIcon,
  uploadCloud: uploadCloudIcon,
} as const

type ContextMenuIconName = keyof typeof contextMenuIconAssets

interface ContextMenuIconProps {
  name: ContextMenuIconName
}

export type { ContextMenuIconName }

export default function ContextMenuIcon({ name }: ContextMenuIconProps) {
  return (
    <span
      aria-hidden="true"
      className="puzzle-context-menu-icon"
      style={{ '--context-menu-icon-url': `url("${contextMenuIconAssets[name]}")` } as CSSProperties}
    />
  )
}
