import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { getContentSwapVariants, getMatchedInitialContentSwapVariants } from './variants.ts'
import { useReducedMotionPreference } from './useReducedMotionPreference.ts'

interface AnimatedSwapPaneProps {
  swapKey: string
  className?: string
  children: ReactNode
  initialTiming?: 'standard' | 'matched'
  presenceMode?: 'wait' | 'sync'
  initialPresence?: boolean
}

export default function AnimatedSwapPane({
  swapKey,
  className,
  children,
  initialTiming = 'standard',
  presenceMode = 'wait',
  initialPresence = true,
}: AnimatedSwapPaneProps) {
  const shouldReduceMotion = useReducedMotionPreference()
  const isFirstMountRef = useRef(true)
  const variants =
    initialTiming === 'matched' && isFirstMountRef.current
      ? getMatchedInitialContentSwapVariants(shouldReduceMotion)
      : getContentSwapVariants(shouldReduceMotion)

  useEffect(() => {
    isFirstMountRef.current = false
  }, [])

  return (
    <AnimatePresence mode={presenceMode} initial={initialPresence}>
      <motion.div
        key={swapKey}
        className={className}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
