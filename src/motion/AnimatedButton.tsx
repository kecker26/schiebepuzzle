import { forwardRef } from 'react'
import { motion } from 'motion/react'
import type { HTMLMotionProps } from 'motion/react'
import { getInteractionMotion, type InteractionPreset } from './interactionTokens.ts'
import type { RevealLevel } from './revealTokens.ts'
import { getRevealItemVariants } from './variants.ts'
import { useReducedMotionPreference } from './useReducedMotionPreference.ts'

interface AnimatedButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  interaction?: InteractionPreset
  reveal?: boolean
  revealLevel?: RevealLevel
}

const AnimatedButton = forwardRef<HTMLButtonElement, AnimatedButtonProps>(function AnimatedButton(
  {
    interaction = 'button',
    reveal = false,
    revealLevel = 'subtle',
    children,
    disabled = false,
    type = 'button',
    ...props
  },
  ref
) {
  const shouldReduceMotion = useReducedMotionPreference()
  const interactionMotion = getInteractionMotion(interaction, shouldReduceMotion, disabled)

  return (
    <motion.button
      {...props}
      ref={ref}
      type={type}
      disabled={disabled}
      variants={reveal ? getRevealItemVariants(shouldReduceMotion, revealLevel) : undefined}
      whileHover={interactionMotion.whileHover}
      whileTap={interactionMotion.whileTap}
      transition={interactionMotion.transition}
    >
      {children}
    </motion.button>
  )
})

export default AnimatedButton
