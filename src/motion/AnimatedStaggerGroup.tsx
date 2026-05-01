import { motion } from 'motion/react'
import type { HTMLMotionProps } from 'motion/react'
import { getInteractionMotion, type InteractionPreset } from './interactionTokens.ts'
import type { RevealLevel } from './revealTokens.ts'
import { getRevealContainerVariants } from './variants.ts'
import { useReducedMotionPreference } from './useReducedMotionPreference.ts'

type AnimatedLayoutTag = 'div' | 'section' | 'article' | 'nav' | 'header' | 'aside' | 'ul'

interface AnimatedStaggerGroupProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  as?: AnimatedLayoutTag
  interaction?: InteractionPreset
  level?: RevealLevel
}

export default function AnimatedStaggerGroup({
  as = 'div',
  interaction,
  level = 'medium',
  children,
  ...props
}: AnimatedStaggerGroupProps) {
  const shouldReduceMotion = useReducedMotionPreference()
  const variants = getRevealContainerVariants(shouldReduceMotion, level)
  const interactionMotion = interaction
    ? getInteractionMotion(interaction, shouldReduceMotion, false)
    : undefined
  const sharedProps = {
    ...props,
    variants,
    initial: 'initial' as const,
    animate: 'animate' as const,
    exit: 'exit' as const,
    ...(interactionMotion && {
      whileHover: interactionMotion.whileHover,
      whileTap: interactionMotion.whileTap,
      transition: interactionMotion.transition,
    }),
  }

  switch (as) {
    case 'section':
      return <motion.section {...(sharedProps as HTMLMotionProps<'section'>)}>{children}</motion.section>
    case 'article':
      return <motion.article {...(sharedProps as HTMLMotionProps<'article'>)}>{children}</motion.article>
    case 'nav':
      return <motion.nav {...(sharedProps as HTMLMotionProps<'nav'>)}>{children}</motion.nav>
    case 'header':
      return <motion.header {...(sharedProps as HTMLMotionProps<'header'>)}>{children}</motion.header>
    case 'aside':
      return <motion.aside {...(sharedProps as HTMLMotionProps<'aside'>)}>{children}</motion.aside>
    case 'ul':
      return <motion.ul {...(sharedProps as HTMLMotionProps<'ul'>)}>{children}</motion.ul>
    default:
      return <motion.div {...sharedProps}>{children}</motion.div>
  }
}
