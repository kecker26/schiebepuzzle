import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { getScreenVariants } from './variants.ts'
import { useReducedMotionPreference } from './useReducedMotionPreference.ts'

interface AnimatedScreenProps {
  children: ReactNode
}

export default function AnimatedScreen({ children }: AnimatedScreenProps) {
  const shouldReduceMotion = useReducedMotionPreference()

  return (
    <motion.div
      className="motion-screen"
      variants={getScreenVariants(shouldReduceMotion)}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {children}
    </motion.div>
  )
}
