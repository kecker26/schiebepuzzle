import {
  Archive,
  CircleHelp,
  Command,
  Eye,
  Grid3X3,
  Image,
  LayoutDashboard,
  Medal,
  Move,
  Navigation,
  RefreshCw,
  Zap,
  type LucideIcon,
} from 'lucide-react'

const globalUiIconAssets = {
  archive: Archive,
  command: Command,
  eye: Eye,
  grid: Grid3X3,
  helpCircle: CircleHelp,
  image: Image,
  layout: LayoutDashboard,
  medal: Medal,
  move: Move,
  navigation: Navigation,
  refreshCw: RefreshCw,
  zap: Zap,
} as const satisfies Record<string, LucideIcon>

type GlobalUiIconName = keyof typeof globalUiIconAssets

interface GlobalUiIconProps {
  name: GlobalUiIconName
  className?: string
}

export type { GlobalUiIconName }

export default function GlobalUiIcon({ name, className }: GlobalUiIconProps) {
  const Icon = globalUiIconAssets[name]

  return (
    <Icon
      aria-hidden="true"
      focusable="false"
      className={className ? `global-ui-icon ${className}` : 'global-ui-icon'}
      strokeWidth={2.2}
      absoluteStrokeWidth
    />
  )
}
