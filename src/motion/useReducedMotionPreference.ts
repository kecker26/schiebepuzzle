import { useReducedMotion } from 'motion/react'

export function useReducedMotionPreference(): boolean {
  return useReducedMotion() ?? false
}
