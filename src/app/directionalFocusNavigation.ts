import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { ensureElementVisible } from './focusVisibility.ts'
import { isEditableTarget } from './keyboardShortcutUtils.ts'

const DEFAULT_NAVIGABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]:not([aria-disabled="true"])',
  '[role="button"]:not([aria-disabled="true"]):not([tabindex="-1"])',
].join(', ')

type NavigationDirection = 'left' | 'right' | 'up' | 'down'

interface DirectionalFocusNavigationOptions {
  selector?: string
}

interface DirectionalFocusTargetOptions {
  requireCrossAxisOverlap?: boolean
}

function isVisibleNavigableElement(element: HTMLElement): boolean {
  if (!element.isConnected) {
    return false
  }

  if (element.matches('[disabled], [aria-hidden="true"], [inert]')) {
    return false
  }

  if (element.closest('[aria-hidden="true"], [inert]')) {
    return false
  }

  return element.getClientRects().length > 0
}

function getRectCenter(rect: DOMRect) {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  }
}

function getDirectionalScore(
  currentRect: DOMRect,
  candidateRect: DOMRect,
  direction: NavigationDirection
): number | null {
  const currentCenter = getRectCenter(currentRect)
  const candidateCenter = getRectCenter(candidateRect)
  let primaryDistance = 0
  let secondaryDistance = 0
  let crossAxisOverlap = 0

  switch (direction) {
    case 'left':
      primaryDistance = currentCenter.x - candidateCenter.x
      secondaryDistance = Math.abs(candidateCenter.y - currentCenter.y)
      crossAxisOverlap = Math.min(currentRect.bottom, candidateRect.bottom) - Math.max(currentRect.top, candidateRect.top)
      break
    case 'right':
      primaryDistance = candidateCenter.x - currentCenter.x
      secondaryDistance = Math.abs(candidateCenter.y - currentCenter.y)
      crossAxisOverlap = Math.min(currentRect.bottom, candidateRect.bottom) - Math.max(currentRect.top, candidateRect.top)
      break
    case 'up':
      primaryDistance = currentCenter.y - candidateCenter.y
      secondaryDistance = Math.abs(candidateCenter.x - currentCenter.x)
      crossAxisOverlap = Math.min(currentRect.right, candidateRect.right) - Math.max(currentRect.left, candidateRect.left)
      break
    case 'down':
      primaryDistance = candidateCenter.y - currentCenter.y
      secondaryDistance = Math.abs(candidateCenter.x - currentCenter.x)
      crossAxisOverlap = Math.min(currentRect.right, candidateRect.right) - Math.max(currentRect.left, candidateRect.left)
      break
  }

  if (primaryDistance <= 0) {
    return null
  }

  const alignmentPenalty = crossAxisOverlap > 0 ? 0 : 1000
  return primaryDistance * 100 + secondaryDistance + alignmentPenalty
}

function hasCrossAxisOverlap(
  currentRect: DOMRect,
  candidateRect: DOMRect,
  direction: 'left' | 'right' | 'up' | 'down'
): boolean {
  if (direction === 'left' || direction === 'right') {
    return Math.min(currentRect.bottom, candidateRect.bottom) - Math.max(currentRect.top, candidateRect.top) > 0
  }

  return Math.min(currentRect.right, candidateRect.right) - Math.max(currentRect.left, candidateRect.left) > 0
}

function focusNavigableElement(target: HTMLElement | null): void {
  if (!target) {
    return
  }

  target.focus({ preventScroll: true })
  ensureElementVisible(target)
}

export function getDirectionalFocusTarget<T extends HTMLElement>(
  currentElement: T,
  candidates: readonly T[],
  direction: 'left' | 'right' | 'up' | 'down',
  { requireCrossAxisOverlap = false }: DirectionalFocusTargetOptions = {}
): T | null {
  const visibleCandidates = candidates.filter(isVisibleNavigableElement)
  if (visibleCandidates.length === 0) {
    return null
  }

  const currentRect = currentElement.getBoundingClientRect()
  let nextTarget: T | null = null
  let nextScore = Number.POSITIVE_INFINITY

  visibleCandidates.forEach((candidate) => {
    if (candidate === currentElement) {
      return
    }

    const candidateRect = candidate.getBoundingClientRect()
    if (requireCrossAxisOverlap && !hasCrossAxisOverlap(currentRect, candidateRect, direction)) {
      return
    }

    const candidateScore = getDirectionalScore(currentRect, candidateRect, direction)
    if (candidateScore === null || candidateScore >= nextScore) {
      return
    }

    nextScore = candidateScore
    nextTarget = candidate
  })

  return nextTarget
}

function getDirectionFromKey(key: string): NavigationDirection | null {
  switch (key) {
    case 'ArrowLeft':
      return 'left'
    case 'ArrowRight':
      return 'right'
    case 'ArrowUp':
      return 'up'
    case 'ArrowDown':
      return 'down'
    default:
      return null
  }
}

export function handleDirectionalFocusNavigation(
  event: ReactKeyboardEvent<HTMLElement>,
  { selector = DEFAULT_NAVIGABLE_SELECTOR }: DirectionalFocusNavigationOptions = {}
): void {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
    return
  }

  if (isEditableTarget(event.target)) {
    return
  }

  const scope = event.currentTarget
  const origin = event.target instanceof HTMLElement ? event.target : null
  if (!origin || !scope.contains(origin)) {
    return
  }

  const navigableElements = Array.from(scope.querySelectorAll<HTMLElement>(selector)).filter(isVisibleNavigableElement)
  if (navigableElements.length === 0) {
    return
  }

  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : origin
  const currentElement =
    navigableElements.find((element) => element === activeElement)
    ?? navigableElements.find((element) => element.contains(activeElement))
    ?? null

  if (!currentElement) {
    return
  }

  if (event.key === 'Home') {
    event.preventDefault()
    focusNavigableElement(navigableElements[0] ?? null)
    return
  }

  if (event.key === 'End') {
    event.preventDefault()
    focusNavigableElement(navigableElements[navigableElements.length - 1] ?? null)
    return
  }

  const direction = getDirectionFromKey(event.key)
  if (!direction) {
    return
  }

  const nextTarget = getDirectionalFocusTarget(currentElement, navigableElements, direction)

  if (!nextTarget) {
    return
  }

  event.preventDefault()
  focusNavigableElement(nextTarget)
}
