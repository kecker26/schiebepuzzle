import {
  ArchiveRestore,
  BadgeCheck,
  ChartNoAxesColumn,
  CircleHelp,
  Clock,
  Database,
  FolderOpen,
  GalleryHorizontal,
  Home,
  Images,
  Layers,
  RefreshCw,
  Trophy,
  UploadCloud,
  type LucideIcon,
} from 'lucide-react'

const uploadScreenIconAssets = {
  archiveRestore: ArchiveRestore,
  award: Trophy,
  barChart2: ChartNoAxesColumn,
  checkCircle: BadgeCheck,
  clock: Clock,
  database: Database,
  downloadCloud: ArchiveRestore,
  folder: FolderOpen,
  gallery: GalleryHorizontal,
  helpCircle: CircleHelp,
  home: Home,
  image: Images,
  layers: Layers,
  refreshCw: RefreshCw,
  trophy: Trophy,
  uploadCloud: UploadCloud,
} as const satisfies Record<string, LucideIcon>

type UploadScreenIconName = keyof typeof uploadScreenIconAssets

interface UploadScreenIconProps {
  name: UploadScreenIconName
  className?: string
}

export type { UploadScreenIconName }

export default function UploadScreenIcon({ name, className }: UploadScreenIconProps) {
  const Icon = uploadScreenIconAssets[name]

  return (
    <Icon
      aria-hidden="true"
      focusable="false"
      className={className ? `upload-screen-icon ${className}` : 'upload-screen-icon'}
      strokeWidth={2.15}
      absoluteStrokeWidth
    />
  )
}
