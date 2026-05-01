export type RevealLevel = 'subtle' | 'medium' | 'strong'

export const revealContainerTokens = {
  subtle: {
    delayChildren: 0.04,
    staggerChildren: 0.08,
  },
  medium: {
    delayChildren: 0.075,
    staggerChildren: 0.115,
  },
  strong: {
    delayChildren: 0.11,
    staggerChildren: 0.15,
  },
} as const

export const revealItemTokens = {
  subtle: {
    enterY: 10,
    enterScale: 0.99,
    enterBlur: 5,
    exitY: 5,
    exitScale: 0.993,
    exitBlur: 2,
    enterDuration: 0.46,
    exitDuration: 0.28,
  },
  medium: {
    enterY: 18,
    enterScale: 0.982,
    enterBlur: 8,
    exitY: 8,
    exitScale: 0.988,
    exitBlur: 4,
    enterDuration: 0.58,
    exitDuration: 0.34,
  },
  strong: {
    enterY: 26,
    enterScale: 0.972,
    enterBlur: 11,
    exitY: 11,
    exitScale: 0.984,
    exitBlur: 6,
    enterDuration: 0.68,
    exitDuration: 0.4,
  },
} as const
