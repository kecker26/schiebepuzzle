export const motionEase = {
  standard: [0.24, 0.9, 0.28, 1] as const,
  gentle: [0.24, 0.92, 0.3, 1] as const,
  exit: [0.32, 0, 0.18, 1] as const,
}

export const motionDistance = {
  screen: 8,
  panel: 4,
  dialog: 6,
  listItem: 5,
  workspaceX: 4,
} as const

export const motionScale = {
  screenStart: 0.998,
  panelStart: 0.999,
  dialogStart: 0.996,
  workspaceStart: 0.997,
} as const

export const motionTransitions = {
  default: {
    duration: 0.62,
    ease: motionEase.gentle,
  },
  screenEnter: {
    duration: 0.78,
    ease: motionEase.gentle,
  },
  screenExit: {
    duration: 0.58,
    ease: motionEase.exit,
  },
  panelEnter: {
    duration: 0.56,
    ease: motionEase.gentle,
  },
  panelExit: {
    duration: 0.44,
    ease: motionEase.exit,
  },
  dialogEnter: {
    duration: 0.54,
    ease: motionEase.gentle,
  },
  dialogExit: {
    duration: 0.42,
    ease: motionEase.exit,
  },
  workspaceEnter: {
    duration: 0.68,
    ease: motionEase.gentle,
  },
  workspaceExit: {
    duration: 0.52,
    ease: motionEase.exit,
  },
  overlay: {
    duration: 0.46,
    ease: motionEase.gentle,
  },
  staggerChildren: 0.085,
  staggerDelay: 0.065,
} as const
