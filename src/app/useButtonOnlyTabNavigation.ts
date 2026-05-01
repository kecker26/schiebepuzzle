import { useEffect, type RefObject } from 'react'
import { getTopUiLayerElement } from '../motion/uiLayerStack.ts'
import { ensureElementVisible } from './focusVisibility.ts'

const ACTIONABLE_SELECTOR = [
  'button:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"]):not([type="file"])',
  '[data-tab-actionable="true"]',
].join(', ')

const FOCUS_NAVIGATION_KEYS = new Set([
  'Tab',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
])

function isVisibleActionElement(element: HTMLElement): boolean {
  if (!element.isConnected) {
    return false
  }

  if (element.matches('[aria-hidden="true"], [inert]')) {
    return false
  }

  if (element.closest('[aria-hidden="true"], [inert]')) {
    return false
  }

  return element.getClientRects().length > 0
}

function getActionElements(scope: ParentNode): HTMLElement[] {
  return Array.from(scope.querySelectorAll<HTMLElement>(ACTIONABLE_SELECTOR)).filter(isVisibleActionElement)
}

function isFocusNavigationKey(key: string): boolean {
  return FOCUS_NAVIGATION_KEYS.has(key)
}

function findRelativeButton(
  buttons: HTMLElement[],
  activeElement: Element | null,
  backwards: boolean
): HTMLElement | null {
  if (!activeElement) {
    return null
  }

  let previousButton: HTMLElement | null = null

  for (const button of buttons) {
    const position = activeElement.compareDocumentPosition(button)
    const isFollowing = (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    const isPreceding = (position & Node.DOCUMENT_POSITION_PRECEDING) !== 0

    if (!backwards && isFollowing) {
      return button
    }

    if (backwards && isPreceding) {
      previousButton = button
    }
  }

  return backwards ? previousButton : null
}

export function useButtonOnlyTabNavigation(scopeRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    let isKeyboardFocusNavigationActive = false

    const handlePointerDown = () => {
      isKeyboardFocusNavigationActive = false
    }

    const handleFocusIn = (event: FocusEvent) => {
      if (!isKeyboardFocusNavigationActive) {
        return
      }

      const target = event.target
      if (!(target instanceof HTMLElement)) {
        return
      }

      const scope = getTopUiLayerElement() ?? scopeRef.current
      if (!scope?.contains(target)) {
        return
      }

      ensureElementVisible(target)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if (!event.altKey && !event.ctrlKey && !event.metaKey) {
        isKeyboardFocusNavigationActive = isFocusNavigationKey(event.key)
      }
      if (event.key !== 'Tab') return
      if (event.altKey || event.ctrlKey || event.metaKey) return

      const scope = getTopUiLayerElement() ?? scopeRef.current
      if (!scope) {
        return
      }

      if (scope.getAttribute('role') === 'menu') {
        return
      }

      const buttons = getActionElements(scope)
      event.preventDefault()
      event.stopPropagation()

      if (buttons.length === 0) {
        return
      }

      const activeElement = document.activeElement
      const activeButton = activeElement instanceof HTMLElement ? activeElement : null
      const currentIndex = activeButton ? buttons.indexOf(activeButton) : -1

      const nextButton = currentIndex >= 0
        ? buttons[(currentIndex + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]
        : findRelativeButton(buttons, activeElement, event.shiftKey)
          ?? (event.shiftKey ? buttons[buttons.length - 1] : buttons[0])

      nextButton.focus({ preventScroll: true })
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('mousedown', handlePointerDown, true)
    window.addEventListener('touchstart', handlePointerDown, true)
    window.addEventListener('focusin', handleFocusIn, true)
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('mousedown', handlePointerDown, true)
      window.removeEventListener('touchstart', handlePointerDown, true)
      window.removeEventListener('focusin', handleFocusIn, true)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [scopeRef])
}
