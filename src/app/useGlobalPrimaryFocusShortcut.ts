import { useEffect, type RefObject } from 'react'
import { getTopUiLayerElement } from '../motion/uiLayerStack.ts'
import { alignFocusRootToStart, ensureElementVisible, PAGE_FOCUS_ROOT_SELECTOR } from './focusVisibility.ts'
import { isEditableTarget } from './keyboardShortcutUtils.ts'

const ACTIONABLE_SELECTOR = [
  'button:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"]):not([type="file"])',
  '[data-tab-actionable="true"]',
].join(', ')

const PAGE_PRIMARY_FOCUS_SELECTOR = '[data-page-primary-focus="true"]'
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

function getPrimaryFocusTarget(scope: ParentNode): HTMLElement | null {
  const preferredTarget = Array.from(scope.querySelectorAll<HTMLElement>(PAGE_PRIMARY_FOCUS_SELECTOR)).find(isVisibleActionElement)
  if (preferredTarget) {
    return preferredTarget
  }

  const focusTargets = Array.from(scope.querySelectorAll<HTMLElement>(ACTIONABLE_SELECTOR)).filter(isVisibleActionElement)
  return focusTargets[0] ?? null
}

interface UseGlobalPrimaryFocusShortcutOptions {
  scopeRef: RefObject<HTMLElement | null>
}

export function useGlobalPrimaryFocusShortcut({
  scopeRef,
}: UseGlobalPrimaryFocusShortcutOptions): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== 'Home' || !(event.ctrlKey || event.metaKey)) {
        return
      }

      if (event.altKey || event.shiftKey || isEditableTarget(event.target)) {
        return
      }

      const scope = getTopUiLayerElement() ?? scopeRef.current
      if (!scope) {
        return
      }

      const target = getPrimaryFocusTarget(scope)
      if (!target) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const focusRoot = target.closest<HTMLElement>(PAGE_FOCUS_ROOT_SELECTOR)
      alignFocusRootToStart(focusRoot)
      target.focus({ preventScroll: true })
      ensureElementVisible(target)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [scopeRef])
}
