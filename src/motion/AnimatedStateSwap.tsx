import type { ReactNode } from 'react'
import AnimatedSwapPane from './AnimatedSwapPane.tsx'

interface AnimatedStateSwapProps {
  stateKey: string
  className?: string
  children: ReactNode
}

export default function AnimatedStateSwap({
  stateKey,
  className,
  children,
}: AnimatedStateSwapProps) {
  return (
    <AnimatedSwapPane
      swapKey={stateKey}
      className={className}
      initialPresence={false}
    >
      {children}
    </AnimatedSwapPane>
  )
}
