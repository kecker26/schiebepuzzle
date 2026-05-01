import { motion } from 'motion/react'
import type { HTMLMotionProps } from 'motion/react'
import { getInteractionMotion, type InteractionPreset } from './interactionTokens.ts'
import type { RevealLevel } from './revealTokens.ts'
import { getRevealItemVariants } from './variants.ts'
import { useReducedMotionPreference } from './useReducedMotionPreference.ts'

type AnimatedRevealTag = 'div' | 'section' | 'article' | 'aside' | 'header' | 'ul' | 'li'

interface AnimatedRevealProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  as?: AnimatedRevealTag
  interaction?: InteractionPreset
  level?: RevealLevel
}

export default function AnimatedReveal({
  as = 'div',
  interaction,
  level = 'medium',
  children,
  ...props
}: AnimatedRevealProps) {
  const shouldReduceMotion = useReducedMotionPreference()
  const interactionMotion = interaction
    ? getInteractionMotion(interaction, shouldReduceMotion, false)
    : {}
  const sharedProps = {
    ...props,
    variants: getRevealItemVariants(shouldReduceMotion, level),
    whileHover: interactionMotion.whileHover,
    whileTap: interactionMotion.whileTap,
    transition: interactionMotion.transition,
  }

  switch (as) {
    case 'section':
      return <motion.section {...(sharedProps as HTMLMotionProps<'section'>)}>{children}</motion.section>
    case 'article':
      return <motion.article {...(sharedProps as HTMLMotionProps<'article'>)}>{children}</motion.article>
    case 'aside':
      return <motion.aside {...(sharedProps as HTMLMotionProps<'aside'>)}>{children}</motion.aside>
    case 'header':
      return <motion.header {...(sharedProps as HTMLMotionProps<'header'>)}>{children}</motion.header>
    case 'ul':
      return <motion.ul {...(sharedProps as HTMLMotionProps<'ul'>)}>{children}</motion.ul>
    case 'li':
      return <motion.li {...(sharedProps as HTMLMotionProps<'li'>)}>{children}</motion.li>
    default:
      return <motion.div {...sharedProps}>{children}</motion.div>
  }
}
