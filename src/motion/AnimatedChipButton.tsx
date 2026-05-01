import type { ComponentProps } from 'react'
import AnimatedButton from './AnimatedButton.tsx'

type AnimatedChipButtonProps = Omit<ComponentProps<typeof AnimatedButton>, 'interaction'>

export default function AnimatedChipButton(props: AnimatedChipButtonProps) {
  return <AnimatedButton interaction="chip" {...props} />
}
