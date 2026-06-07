import { useMemo, type CSSProperties, type ComponentType } from 'react'
import {
  Activity,
  Aperture,
  Box,
  Building2,
  Car,
  Cherry,
  Cog,
  Droplet,
  Flower2,
  Gem,
  Heart,
  Leaf,
  Music2,
  Palette,
  PawPrint,
  Plane,
  Shapes,
  Shirt,
  Snowflake,
  Sparkles,
  Star,
  Sun,
  TreePine,
  Trophy,
  Type,
  UserRound,
  type LucideProps,
} from 'lucide-react'
import type { WinParticleIcon, WinParticlePreset, WinParticleSelection } from './winParticleEffects.ts'

interface WinParticleEffectProps {
  selection: WinParticleSelection
}

interface Particle {
  id: string
  icon: WinParticleIcon
  preset: WinParticlePreset
  style: CSSProperties
}

const ICONS: Record<WinParticleIcon, ComponentType<LucideProps>> = {
  activity: Activity,
  aperture: Aperture,
  box: Box,
  building: Building2,
  car: Car,
  cherry: Cherry,
  cog: Cog,
  droplet: Droplet,
  flower: Flower2,
  gem: Gem,
  heart: Heart,
  leaf: Leaf,
  music: Music2,
  palette: Palette,
  paw: PawPrint,
  plane: Plane,
  shapes: Shapes,
  shirt: Shirt,
  snowflake: Snowflake,
  sparkles: Sparkles,
  star: Star,
  sun: Sun,
  tree: TreePine,
  trophy: Trophy,
  type: Type,
  user: UserRound,
}

function hashSeed(value: string): number {
  return [...value].reduce((hash, character) => Math.imul(hash ^ character.charCodeAt(0), 16777619), 2166136261) >>> 0
}

function random(seed: number): () => number {
  let value = seed || 1
  return () => {
    value = Math.imul(value ^ (value >>> 15), 1 | value)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function createParticles(preset: WinParticlePreset, count: number, layer: 'primary' | 'accent'): Particle[] {
  const nextRandom = random(hashSeed(`${preset.id}-${layer}`))
  return Array.from({ length: count }, (_, index) => {
    const size = Math.round(12 + nextRandom() * 16)
    const x = Math.round(nextRandom() * 100)
    const y = Math.round(nextRandom() * 100)
    const travelX = Math.round((nextRandom() - 0.5) * 180)
    const travelY = Math.round(70 + nextRandom() * 170)
    const delay = Math.round(nextRandom() * 1800)
    const duration = Math.round(4600 + nextRandom() * 3400)
    const rotation = Math.round((nextRandom() - 0.5) * 520)
    const color = preset.colors[index % preset.colors.length]

    return {
      id: `${layer}-${preset.id}-${index}`,
      icon: preset.icons[index % preset.icons.length],
      preset,
      style: {
        '--particle-x': `${x}%`,
        '--particle-y': `${y}%`,
        '--particle-travel-x': `${travelX}px`,
        '--particle-travel-y': `${travelY}px`,
        '--particle-delay': `${delay}ms`,
        '--particle-duration': `${duration}ms`,
        '--particle-rotation': `${rotation}deg`,
        '--particle-color': color,
        '--particle-size': `${size}px`,
      } as CSSProperties,
    }
  })
}

export default function WinParticleEffect({ selection }: WinParticleEffectProps) {
  const particles = useMemo(() => [
    ...createParticles(selection.primary, selection.primary.density, 'primary'),
    ...(selection.accent ? createParticles(selection.accent, Math.min(8, Math.ceil(selection.accent.density / 3)), 'accent') : []),
  ], [selection])

  return (
    <div
      className="win-particle-field"
      data-testid="win-particle-effect"
      data-particle-preset={selection.primary.id}
      aria-hidden="true"
    >
      {particles.map((particle) => {
        const Icon = ICONS[particle.icon]
        return (
          <span
            key={particle.id}
            className={`win-particle win-particle-${particle.preset.motion}${particle.id.startsWith('accent-') ? ' is-accent' : ''}`}
            style={particle.style}
          >
            <Icon strokeWidth={2} absoluteStrokeWidth />
          </span>
        )
      })}
    </div>
  )
}
