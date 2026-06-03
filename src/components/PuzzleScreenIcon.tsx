import {
  Activity,
  Brain,
  CircleHelp,
  Clock,
  Command,
  Crosshair,
  Eye,
  Hash,
  Image,
  Layers,
  Lightbulb,
  Move,
  Music,
  RotateCcw,
  Route,
  Timer,
  Undo2,
  Volume2,
  VolumeX,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react'

const puzzleScreenIconAssets = {
  activity: Activity,
  brain: Brain,
  clock: Clock,
  command: Command,
  crosshair: Crosshair,
  eye: Eye,
  hash: Hash,
  helpCircle: CircleHelp,
  image: Image,
  layers: Layers,
  lightbulb: Lightbulb,
  move: Move,
  music: Music,
  rotateCcw: RotateCcw,
  route: Route,
  timer: Timer,
  undo2: Undo2,
  volume2: Volume2,
  volumeX: VolumeX,
  wandSparkles: WandSparkles,
} as const satisfies Record<string, LucideIcon>

type PuzzleScreenIconName = keyof typeof puzzleScreenIconAssets

interface PuzzleScreenIconProps {
  name: PuzzleScreenIconName
  className?: string
}

export default function PuzzleScreenIcon({ name, className }: PuzzleScreenIconProps) {
  const Icon = puzzleScreenIconAssets[name]

  return (
    <Icon
      aria-hidden="true"
      focusable="false"
      className={className ? `puzzle-screen-icon ${className}` : 'puzzle-screen-icon'}
      strokeWidth={2.15}
      absoluteStrokeWidth
    />
  )
}
