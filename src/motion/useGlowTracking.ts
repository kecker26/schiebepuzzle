import { useCallback, useEffect, type RefObject } from 'react'
import { useReducedMotionPreference } from './useReducedMotionPreference.ts'

const DEFAULT_GLOW_SELECTOR = [
  'button',
  '.menu-card',
  '.saved-game-item',
  '.gallery-card',
  '.start-screen-resume-card',
  '.start-screen-button',
  '.crop-difficulty-card',
  '.puzzle-context-menu-item',
].join(',')

function setGlowPosition(element: HTMLElement, clientX: number, clientY: number) {
  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return

  const x = ((clientX - rect.left) / rect.width) * 100
  const y = ((clientY - rect.top) / rect.height) * 100

  element.style.setProperty('--glow-x', `${x}%`)
  element.style.setProperty('--glow-y', `${y}%`)
}

export function useGlowTracking(ref: RefObject<HTMLElement | null>) {
  const shouldReduce = useReducedMotionPreference()

  const handleMove = useCallback((event: MouseEvent) => {
    const element = ref.current
    if (!element) return

    setGlowPosition(element, event.clientX, event.clientY)
  }, [ref])

  useEffect(() => {
    if (shouldReduce) return

    const element = ref.current
    if (!element) return

    element.addEventListener('mousemove', handleMove, { passive: true })

    return () => {
      element.removeEventListener('mousemove', handleMove)
    }
  }, [handleMove, ref, shouldReduce])
}

export function useGlobalGlowTracking(selector = DEFAULT_GLOW_SELECTOR) {
  const shouldReduce = useReducedMotionPreference()

  useEffect(() => {
    if (shouldReduce) return

    const selectors = selector
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)

    const handleMove = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return

      const elements = new Set<HTMLElement>()
      for (const entry of selectors) {
        const element = target.closest<HTMLElement>(entry)
        if (element) {
          elements.add(element)
        }
      }

      for (const element of elements) {
        setGlowPosition(element, event.clientX, event.clientY)
      }
    }

    document.addEventListener('mousemove', handleMove, { passive: true })

    return () => {
      document.removeEventListener('mousemove', handleMove)
    }
  }, [selector, shouldReduce])
}
