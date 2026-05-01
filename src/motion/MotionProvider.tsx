import { MotionConfig } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { motionTransitions } from './tokens.ts'
import { useReducedMotionPreference } from './useReducedMotionPreference.ts'

interface MotionProviderProps {
  children: ReactNode
}

function MotionPreferenceBridge({ children }: MotionProviderProps) {
  const shouldReduceMotion = useReducedMotionPreference()

  useEffect(() => {
    document.documentElement.setAttribute('data-motion', shouldReduceMotion ? 'reduced' : 'full')
  }, [shouldReduceMotion])

  return <>{children}</>
}

export default function MotionProvider({ children }: MotionProviderProps) {
  return (
    <MotionConfig reducedMotion="user" transition={motionTransitions.default}>
      <MotionPreferenceBridge>{children}</MotionPreferenceBridge>
    </MotionConfig>
  )
}
