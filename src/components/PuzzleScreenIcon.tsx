import type { CSSProperties } from 'react'
import activityIcon from '../assets/system/puzzle-screen-icons/activity.svg'
import clockIcon from '../assets/system/puzzle-screen-icons/clock.svg'
import commandIcon from '../assets/system/puzzle-screen-icons/command.svg'
import crosshairIcon from '../assets/system/puzzle-screen-icons/crosshair.svg'
import helpCircleIcon from '../assets/system/puzzle-screen-icons/help-circle.svg'
import imageIcon from '../assets/system/puzzle-screen-icons/image.svg'
import layersIcon from '../assets/system/puzzle-screen-icons/layers.svg'
import moveIcon from '../assets/system/puzzle-screen-icons/move.svg'
import musicIcon from '../assets/system/puzzle-screen-icons/music.svg'
import rotateCcwIcon from '../assets/system/puzzle-screen-icons/rotate-ccw.svg'
import volume2Icon from '../assets/system/puzzle-screen-icons/volume-2.svg'
import volumeXIcon from '../assets/system/puzzle-screen-icons/volume-x.svg'

const puzzleScreenIconAssets = {
  activity: activityIcon,
  clock: clockIcon,
  command: commandIcon,
  crosshair: crosshairIcon,
  helpCircle: helpCircleIcon,
  image: imageIcon,
  layers: layersIcon,
  move: moveIcon,
  music: musicIcon,
  rotateCcw: rotateCcwIcon,
  volume2: volume2Icon,
  volumeX: volumeXIcon,
} as const

type PuzzleScreenIconName = keyof typeof puzzleScreenIconAssets

interface PuzzleScreenIconProps {
  name: PuzzleScreenIconName
  className?: string
}

export type { PuzzleScreenIconName }

export default function PuzzleScreenIcon({ name, className }: PuzzleScreenIconProps) {
  return (
    <span
      aria-hidden="true"
      className={className ? `puzzle-screen-icon ${className}` : 'puzzle-screen-icon'}
      style={{ '--puzzle-screen-icon-url': `url("${puzzleScreenIconAssets[name]}")` } as CSSProperties}
    />
  )
}
