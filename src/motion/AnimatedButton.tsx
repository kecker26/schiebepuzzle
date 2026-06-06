import { forwardRef } from 'react'
import { motion } from 'motion/react'
import type { HTMLMotionProps } from 'motion/react'
import { getInteractionMotion, type InteractionPreset } from './interactionTokens.ts'
import type { RevealLevel } from './revealTokens.ts'
import { getRevealItemVariants } from './variants.ts'
import { useReducedMotionPreference } from './useReducedMotionPreference.ts'
import BusyIndicator from './BusyIndicator.tsx'
import useDelayedBusy from './useDelayedBusy.ts'

interface AnimatedButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  interaction?: InteractionPreset | 'none'
  reveal?: boolean
  revealLevel?: RevealLevel
  busy?: boolean
  busyLabel?: string
  busyDelayMs?: number
}

const AnimatedButton = forwardRef<HTMLButtonElement, AnimatedButtonProps>(function AnimatedButton(
  {
    interaction = 'button',
    reveal = false,
    revealLevel = 'subtle',
    busy = false,
    busyLabel,
    busyDelayMs = 350,
    children,
    disabled = false,
    type = 'button',
    ...props
  },
  ref
) {
  const shouldReduceMotion = useReducedMotionPreference()
  const showBusyIndicator = useDelayedBusy(busy, busyDelayMs)
  const interactionMotion = interaction === 'none'
    ? {}
    : getInteractionMotion(interaction, shouldReduceMotion, disabled || busy)

  return (
    <motion.button
      {...props}
      ref={ref}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      variants={reveal ? getRevealItemVariants(shouldReduceMotion, revealLevel) : undefined}
      whileHover={interactionMotion.whileHover}
      whileTap={interactionMotion.whileTap}
      transition={interactionMotion.transition}
    >
      {showBusyIndicator ? (
        <BusyIndicator label={busyLabel} />
      ) : busy && busyLabel ? (
        busyLabel
      ) : (
        children
      )}
    </motion.button>
  )
})

export default AnimatedButton
