import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import { motionTransitions } from './tokens.ts'
import { useReducedMotionPreference } from './useReducedMotionPreference.ts'

interface AnimatedCollapseProps {
  isOpen: boolean
  className?: string
  children: ReactNode
}

export default function AnimatedCollapse({ isOpen, className, children }: AnimatedCollapseProps) {
  const shouldReduceMotion = useReducedMotionPreference()

  return (
    <AnimatePresence initial={false}>
      {isOpen ? (
        <motion.div
          key="expanded"
          className={className}
          initial={shouldReduceMotion ? { opacity: 0, height: 0 } : { opacity: 0, height: 0, y: -3 }}
          animate={shouldReduceMotion ? { opacity: 1, height: 'auto' } : { opacity: 1, height: 'auto', y: 0 }}
          exit={shouldReduceMotion ? { opacity: 0, height: 0 } : { opacity: 0, height: 0, y: -3 }}
          transition={{
            height: shouldReduceMotion ? motionTransitions.default : motionTransitions.panelEnter,
            opacity: shouldReduceMotion ? motionTransitions.default : motionTransitions.default,
            y: shouldReduceMotion ? motionTransitions.default : motionTransitions.panelExit,
          }}
          style={{ overflow: 'hidden' }}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
