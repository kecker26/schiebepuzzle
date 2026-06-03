import { animated, to, useSpring } from '@react-spring/web'
import { forwardRef, type ComponentProps } from 'react'
import AnimatedButton from './AnimatedButton.tsx'
import { useReducedMotionPreference } from './useReducedMotionPreference.ts'

type AnimatedCardButtonProps = Omit<ComponentProps<typeof AnimatedButton>, 'interaction'>
const SpringAnimatedButton = animated(AnimatedButton) as unknown as typeof AnimatedButton

const AnimatedCardButton = forwardRef<HTMLButtonElement, AnimatedCardButtonProps>(function AnimatedCardButton(
  {
    disabled = false,
    onPointerDown,
    onPointerEnter,
    onPointerLeave,
    onPointerUp,
    style,
    ...props
  },
  ref
) {
  const shouldReduceMotion = useReducedMotionPreference()
  const [springs, api] = useSpring(() => ({
    scale: 1,
    y: 0,
    config: { tension: 240, friction: 18, precision: 0.001 },
  }))
  const canAnimate = !shouldReduceMotion && !disabled
  const springStyle = {
    ...style,
    ...(canAnimate
      ? { transform: to([springs.y, springs.scale], (y, scale) => `translate3d(0, ${y}px, 0) scale(${scale})`) }
      : {}),
  }

  return (
    <SpringAnimatedButton
      {...props}
      ref={ref}
      interaction="none"
      disabled={disabled}
      style={springStyle as never}
      onPointerEnter={(event) => {
        if (canAnimate) void api.start({ scale: 1.016, y: -5 })
        onPointerEnter?.(event)
      }}
      onPointerDown={(event) => {
        if (canAnimate) void api.start({ scale: 0.988, y: -1 })
        onPointerDown?.(event)
      }}
      onPointerUp={(event) => {
        if (canAnimate) void api.start({ scale: 1.016, y: -5 })
        onPointerUp?.(event)
      }}
      onPointerLeave={(event) => {
        if (canAnimate) void api.start({ scale: 1, y: 0 })
        onPointerLeave?.(event)
      }}
    />
  )
})

export default AnimatedCardButton
