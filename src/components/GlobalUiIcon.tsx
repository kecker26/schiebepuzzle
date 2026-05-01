import type { CSSProperties } from 'react'
import archiveIcon from '../assets/system/global-ui-icons/archive.svg'
import commandIcon from '../assets/system/global-ui-icons/command.svg'
import eyeIcon from '../assets/system/global-ui-icons/eye.svg'
import gridIcon from '../assets/system/global-ui-icons/grid.svg'
import helpCircleIcon from '../assets/system/global-ui-icons/help-circle.svg'
import imageIcon from '../assets/system/global-ui-icons/image.svg'
import layoutIcon from '../assets/system/global-ui-icons/layout.svg'
import moveIcon from '../assets/system/global-ui-icons/move.svg'
import navigationIcon from '../assets/system/global-ui-icons/navigation.svg'
import refreshCwIcon from '../assets/system/global-ui-icons/refresh-cw.svg'
import zapIcon from '../assets/system/global-ui-icons/zap.svg'

const globalUiIconAssets = {
  archive: archiveIcon,
  command: commandIcon,
  eye: eyeIcon,
  grid: gridIcon,
  helpCircle: helpCircleIcon,
  image: imageIcon,
  layout: layoutIcon,
  move: moveIcon,
  navigation: navigationIcon,
  refreshCw: refreshCwIcon,
  zap: zapIcon,
} as const

type GlobalUiIconName = keyof typeof globalUiIconAssets

interface GlobalUiIconProps {
  name: GlobalUiIconName
  className?: string
}

export type { GlobalUiIconName }

export default function GlobalUiIcon({ name, className }: GlobalUiIconProps) {
  return (
    <span
      aria-hidden="true"
      className={className ? `global-ui-icon ${className}` : 'global-ui-icon'}
      style={{ '--global-ui-icon-url': `url("${globalUiIconAssets[name]}")` } as CSSProperties}
    />
  )
}
