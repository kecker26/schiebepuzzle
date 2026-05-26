import {
  ArchiveRestore,
  BadgeCheck,
  ChartNoAxesColumn,
  CircleHelp,
  Clock,
  Database,
  Dice5,
  FolderHeart,
  FolderOpen,
  GalleryHorizontal,
  Home,
  ImagePlus,
  Images,
  Info,
  Layers,
  ListRestart,
  MousePointerClick,
  PlayCircle,
  RefreshCw,
  Search,
  Sparkles,
  Timer,
  Trophy,
  Trash2,
  UploadCloud,
  X,
  type LucideIcon,
} from 'lucide-react'

const uploadScreenIconAssets = {
  archiveRestore: ArchiveRestore,
  award: Trophy,
  barChart2: ChartNoAxesColumn,
  checkCircle: BadgeCheck,
  clock: Clock,
  database: Database,
  dice: Dice5,
  downloadCloud: ArchiveRestore,
  folderHeart: FolderHeart,
  folder: FolderOpen,
  gallery: GalleryHorizontal,
  helpCircle: CircleHelp,
  home: Home,
  image: Images,
  imagePlus: ImagePlus,
  info: Info,
  layers: Layers,
  listRestart: ListRestart,
  mousePointerClick: MousePointerClick,
  playCircle: PlayCircle,
  refreshCw: RefreshCw,
  search: Search,
  sparkles: Sparkles,
  timer: Timer,
  trophy: Trophy,
  trash: Trash2,
  uploadCloud: UploadCloud,
  x: X,
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
