import { animated, useSpring } from '@react-spring/web'
import { useMemo } from 'react'
import { useReducedMotionPreference } from './useReducedMotionPreference.ts'

interface SpringNumberProps {
  value: number | null | undefined
  formatter?: (value: number) => string
  fallback?: string
  from?: number
  durationMs?: number
  className?: string
}

const defaultFormatter = (value: number): string => Math.round(value).toLocaleString('de-DE')

export default function SpringNumber({
  value,
  formatter = defaultFormatter,
  fallback = '--',
  from,
  durationMs,
  className,
}: SpringNumberProps) {
  const shouldReduceMotion = useReducedMotionPreference()
  const targetValue = typeof value === 'number' && Number.isFinite(value) ? value : null
  const startValue = useMemo(() => {
    if (targetValue === null) return 0
    return typeof from === 'number' && Number.isFinite(from) ? from : targetValue
  }, [from, targetValue])
  const resolvedDurationMs = durationMs ?? (typeof from === 'number' ? 1500 : null)
  const springs = useSpring({
    from: { number: startValue },
    number: targetValue ?? 0,
    immediate: shouldReduceMotion || targetValue === null,
    config: resolvedDurationMs === null
      ? { tension: 180, friction: 24, precision: 0.01 }
      : { duration: resolvedDurationMs, precision: 0.01 },
  })

  if (targetValue === null) {
    return <span className={className}>{fallback}</span>
  }

  return (
    <animated.span className={className}>
      {springs.number.to((currentValue) => formatter(currentValue))}
    </animated.span>
  )
}
