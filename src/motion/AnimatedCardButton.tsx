import { forwardRef, type ComponentProps } from 'react'
import AnimatedButton from './AnimatedButton.tsx'

type AnimatedCardButtonProps = Omit<ComponentProps<typeof AnimatedButton>, 'interaction'>

const AnimatedCardButton = forwardRef<HTMLButtonElement, AnimatedCardButtonProps>(function AnimatedCardButton(
  props,
  ref
) {
  return <AnimatedButton ref={ref} interaction="card" {...props} />
})

export default AnimatedCardButton
