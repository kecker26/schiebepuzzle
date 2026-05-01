import type { Variants } from 'motion/react'
import { revealContainerTokens, revealItemTokens, type RevealLevel } from './revealTokens.ts'
import { motionDistance, motionScale, motionTransitions } from './tokens.ts'

export function getScreenVariants(shouldReduceMotion: boolean): Variants {
  if (shouldReduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: motionTransitions.default },
      exit: { opacity: 0, transition: motionTransitions.panelExit },
    }
  }

  return {
    initial: {
      opacity: 0,
      y: motionDistance.screen,
      scale: motionScale.screenStart,
    },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: motionTransitions.screenEnter,
    },
    exit: {
      opacity: 0,
      y: -2,
      scale: 0.9995,
      transition: motionTransitions.screenExit,
    },
  }
}

export function getPanelVariants(shouldReduceMotion: boolean): Variants {
  if (shouldReduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: motionTransitions.default },
      exit: { opacity: 0, transition: motionTransitions.panelExit },
    }
  }

  return {
    initial: {
      opacity: 0,
      y: motionDistance.panel,
      scale: motionScale.panelStart,
    },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: motionTransitions.panelEnter,
    },
    exit: {
      opacity: 0,
      y: -1,
      scale: 0.9995,
      transition: motionTransitions.panelExit,
    },
  }
}

export function getDialogOverlayVariants(shouldReduceMotion: boolean): Variants {
  return {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: shouldReduceMotion ? motionTransitions.default : motionTransitions.overlay,
    },
    exit: {
      opacity: 0,
      transition: motionTransitions.dialogExit,
    },
  }
}

export function getDialogVariants(shouldReduceMotion: boolean): Variants {
  if (shouldReduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: motionTransitions.default },
      exit: { opacity: 0, transition: motionTransitions.dialogExit },
    }
  }

  return {
    initial: {
      opacity: 0,
      y: motionDistance.dialog,
      scale: motionScale.dialogStart,
    },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: motionTransitions.dialogEnter,
    },
    exit: {
      opacity: 0,
      y: 2,
      scale: 0.9985,
      transition: motionTransitions.dialogExit,
    },
  }
}

export function getWorkspaceOverlayVariants(shouldReduceMotion: boolean): Variants {
  return {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: shouldReduceMotion ? motionTransitions.default : motionTransitions.overlay,
    },
    exit: {
      opacity: 0,
      transition: motionTransitions.workspaceExit,
    },
  }
}

export function getWorkspaceShellVariants(shouldReduceMotion: boolean): Variants {
  if (shouldReduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: {
        opacity: 1,
        transition: motionTransitions.default,
      },
      exit: {
        opacity: 0,
        transition: motionTransitions.workspaceExit,
      },
    }
  }

  return {
    initial: {
      opacity: 0,
      x: motionDistance.workspaceX,
      y: motionDistance.panel,
      scale: motionScale.workspaceStart,
    },
    animate: {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      transition: {
        ...motionTransitions.workspaceEnter,
        delayChildren: motionTransitions.staggerDelay,
        staggerChildren: motionTransitions.staggerChildren,
      },
    },
    exit: {
      opacity: 0,
      x: -2,
      y: -1,
      scale: 0.9995,
      transition: motionTransitions.workspaceExit,
    },
  }
}

export function getContentSwapVariants(shouldReduceMotion: boolean): Variants {
  if (shouldReduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: {
        opacity: 1,
        transition: motionTransitions.default,
      },
      exit: {
        opacity: 0,
        transition: motionTransitions.panelExit,
      },
    }
  }

  return {
    initial: {
      opacity: 0,
      y: 4,
      scale: 0.999,
    },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: motionTransitions.default,
    },
    exit: {
      opacity: 0,
      y: -2,
      scale: 0.9995,
      transition: motionTransitions.panelExit,
    },
  }
}

export function getMatchedInitialContentSwapVariants(shouldReduceMotion: boolean): Variants {
  if (shouldReduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: {
        opacity: 1,
        transition: motionTransitions.default,
      },
      exit: {
        opacity: 0,
        transition: motionTransitions.panelExit,
      },
    }
  }

  return {
    initial: {
      opacity: 0,
      y: 4,
      scale: 0.999,
    },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        ...motionTransitions.default,
        delay: motionTransitions.panelExit.duration * 0.8,
      },
    },
    exit: {
      opacity: 0,
      y: -2,
      scale: 0.9995,
      transition: motionTransitions.panelExit,
    },
  }
}

export function getStaggerContainerVariants(shouldReduceMotion: boolean): Variants {
  return {
    initial: {},
    animate: {
      transition: shouldReduceMotion
        ? {}
        : {
            delayChildren: motionTransitions.staggerDelay,
            staggerChildren: motionTransitions.staggerChildren,
          },
    },
    exit: {},
  }
}

export function getRevealContainerVariants(shouldReduceMotion: boolean, level: RevealLevel): Variants {
  const preset = revealContainerTokens[level]

  return {
    initial: {},
    animate: {
      transition: shouldReduceMotion
        ? {}
        : {
            delayChildren: preset.delayChildren,
            staggerChildren: preset.staggerChildren,
          },
    },
    exit: {},
  }
}

export function getRevealItemVariants(shouldReduceMotion: boolean, level: RevealLevel): Variants {
  if (shouldReduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: motionTransitions.default },
      exit: { opacity: 0, transition: motionTransitions.panelExit },
    }
  }

  const preset = revealItemTokens[level]

  return {
    initial: {
      opacity: 0,
      y: preset.enterY,
      scale: preset.enterScale,
    },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: preset.enterDuration,
        ease: motionTransitions.default.ease,
      },
    },
    exit: {
      opacity: 0,
      y: preset.exitY,
      scale: preset.exitScale,
      transition: {
        duration: preset.exitDuration,
        ease: motionTransitions.panelExit.ease,
      },
    },
  }
}

export function getStaggerItemVariants(shouldReduceMotion: boolean): Variants {
  if (shouldReduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: motionTransitions.default },
      exit: { opacity: 0, transition: motionTransitions.panelExit },
    }
  }

  return {
    initial: {
      opacity: 0,
      y: motionDistance.listItem,
    },
    animate: {
      opacity: 1,
      y: 0,
      transition: motionTransitions.panelEnter,
    },
    exit: {
      opacity: 0,
      y: 1,
      transition: motionTransitions.panelExit,
    },
  }
}
