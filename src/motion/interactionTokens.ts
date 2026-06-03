import type { TargetAndTransition, Transition } from 'motion/react'
import { motionEase } from './tokens.ts'

export type InteractionPreset = 'button' | 'chip' | 'card' | 'surface'

interface InteractionMotion {
  whileHover?: TargetAndTransition
  whileTap?: TargetAndTransition
  transition?: Transition
}

const interactionTransitions = {
  hover: {
    duration: 0.34,
    ease: motionEase.gentle,
  } satisfies Transition,
  tap: {
    duration: 0.18,
    ease: motionEase.standard,
  } satisfies Transition,
} as const

const interactionTargets: Record<
  InteractionPreset,
  {
    hover: TargetAndTransition
    tap: TargetAndTransition
  }
> = {
  button: {
    hover: { y: -3, scale: 1.024 },
    tap: { y: 0, scale: 0.972 },
  },
  chip: {
    hover: { y: -2, scale: 1.032 },
    tap: { y: 0, scale: 0.968 },
  },
  card: {
    hover: { y: -5, scale: 1.016 },
    tap: { y: -1, scale: 0.988 },
  },
  surface: {
    hover: { y: -3, scale: 1.01 },
    tap: { y: 0, scale: 0.989 },
  },
}

export function getInteractionMotion(
  preset: InteractionPreset,
  shouldReduceMotion: boolean,
  disabled: boolean
): InteractionMotion {
  if (shouldReduceMotion || disabled) {
    return {}
  }

  const target = interactionTargets[preset]

  return {
    whileHover: target.hover,
    whileTap: target.tap,
    transition: interactionTransitions.hover,
  }
}

