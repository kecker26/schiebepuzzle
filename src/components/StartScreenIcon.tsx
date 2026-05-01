import {
  ArchiveRestore,
  ChartNoAxesColumn,
  CircleHelp,
  Crop,
  FolderOpen,
  Grid3X3,
  Image,
  ImagePlus,
  Music,
  RefreshCw,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react'

const startScreenIconAssets = {
  archiveRestore: ArchiveRestore,
  barChart2: ChartNoAxesColumn,
  crop: Crop,
  downloadCloud: ArchiveRestore,
  folder: FolderOpen,
  folderOpen: FolderOpen,
  grid: Grid3X3,
  helpCircle: CircleHelp,
  image: Image,
  imagePlus: ImagePlus,
  music: Music,
  refreshCw: RefreshCw,
  shuffle: Shuffle,
  sliders: SlidersHorizontal,
  sparkles: Sparkles,
  uploadCloud: UploadCloud,
  wandSparkles: WandSparkles,
} as const satisfies Record<string, LucideIcon>

type StartScreenIconName = keyof typeof startScreenIconAssets

interface StartScreenIconProps {
  name: StartScreenIconName
  className?: string
}

export type { StartScreenIconName }

export default function StartScreenIcon({ name, className }: StartScreenIconProps) {
  const Icon = startScreenIconAssets[name]

  return (
    <Icon
      aria-hidden="true"
      focusable="false"
      className={className ? `start-screen-icon ${className}` : 'start-screen-icon'}
      strokeWidth={2.15}
      absoluteStrokeWidth
    />
  )
}
