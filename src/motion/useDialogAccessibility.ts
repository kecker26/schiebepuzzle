import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { addUiLayer, isTopUiLayer, removeUiLayer } from './uiLayerStack.ts'

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

let bodyScrollLockDepth = 0
let previousBodyOverflow = ''
let previousBodyPaddingRight = ''

interface UseDialogAccessibilityOptions {
  dialogRef: RefObject<HTMLElement | null>
  initialFocusRef?: RefObject<HTMLElement | null>
  restoreFocus?: boolean
  restoreFocusFallbackRef?: RefObject<HTMLElement | null>
  trapFocus?: boolean
  closeOnEscape?: boolean
  lockScroll?: boolean
  onRequestClose?: () => void
}

function isVisibleFocusableElement(element: HTMLElement): boolean {
  if (element.matches('[disabled], [aria-hidden="true"], [inert]')) {
    return false
  }

  if (element.tabIndex < 0) {
    return false
  }

  return element.getClientRects().length > 0
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isVisibleFocusableElement)
}

function focusElement(target: HTMLElement | null): void {
  target?.focus({ preventScroll: true })
}

function lockBodyScroll(): () => void {
  if (typeof document === 'undefined') {
    return () => {}
  }

  const { body, documentElement } = document

  if (bodyScrollLockDepth === 0) {
    const scrollY = window.scrollY
    const scrollbarWidth = Math.max(0, window.innerWidth - documentElement.clientWidth)

    previousBodyOverflow = body.style.overflow
    previousBodyPaddingRight = body.style.paddingRight

    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`
    }

    body.dataset.scrollLockY = String(scrollY)
  }

  bodyScrollLockDepth += 1

  return () => {
    bodyScrollLockDepth = Math.max(0, bodyScrollLockDepth - 1)
    if (bodyScrollLockDepth !== 0) {
      return
    }

    const savedScrollY = Number(body.dataset.scrollLockY ?? '0')
    delete body.dataset.scrollLockY

    body.style.position = ''
    body.style.top = ''
    body.style.left = ''
    body.style.right = ''
    body.style.overflow = previousBodyOverflow
    body.style.paddingRight = previousBodyPaddingRight

    // Restore scroll after the browser completes the reflow from removing
    // position:fixed AND after any focus-restoration has settled. A single
    // rAF fires before the next paint, and the nested rAF after the paint,
    // ensuring the browser has fully re-laid-out the page.
    window.scrollTo(0, savedScrollY)
    requestAnimationFrame(() => {
      window.scrollTo(0, savedScrollY)
    })
  }
}

export function useDialogAccessibility({
  dialogRef,
  initialFocusRef,
  restoreFocus = false,
  restoreFocusFallbackRef,
  trapFocus = false,
  closeOnEscape = false,
  lockScroll = false,
  onRequestClose,
}: UseDialogAccessibilityOptions): void {
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null)
  const dialogLayerIdRef = useRef(Symbol('dialog-layer'))
  const shouldManageFocus = trapFocus || restoreFocus || Boolean(initialFocusRef)
  const shouldRegisterLayer = shouldManageFocus || closeOnEscape || lockScroll

  useLayoutEffect(() => {
    if (!shouldRegisterLayer) {
      return
    }

    const dialogLayerId = dialogLayerIdRef.current
    addUiLayer(dialogLayerId, dialogRef.current)

    return () => {
      removeUiLayer(dialogLayerId)
    }
  }, [dialogRef, shouldRegisterLayer])

  useLayoutEffect(() => {
    if (!shouldManageFocus) {
      return
    }

    const dialogElement = dialogRef.current
    if (!dialogElement || typeof document === 'undefined') {
      return
    }

    previouslyFocusedElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null

    const focusTarget = initialFocusRef?.current ?? getFocusableElements(dialogElement)[0] ?? dialogElement
    const fallbackFocusElement = restoreFocusFallbackRef?.current ?? null
    const animationFrame = window.requestAnimationFrame(() => {
      focusElement(focusTarget)
    })

    return () => {
      window.cancelAnimationFrame(animationFrame)

      if (!restoreFocus) {
        return
      }

      const previousElement = previouslyFocusedElementRef.current
      if (previousElement?.isConnected) {
        focusElement(previousElement)
        return
      }

      if (fallbackFocusElement?.isConnected) {
        focusElement(fallbackFocusElement)
      }
    }
  }, [dialogRef, initialFocusRef, restoreFocus, restoreFocusFallbackRef, shouldManageFocus])

  useLayoutEffect(() => {
    if (!lockScroll) {
      return
    }

    return lockBodyScroll()
  }, [lockScroll])

  useEffect(() => {
    if (!trapFocus && !closeOnEscape) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return
      }

      const dialogElement = dialogRef.current
      if (!dialogElement) {
        return
      }

      if (!isTopUiLayer(dialogLayerIdRef.current)) {
        return
      }

      if (event.key === 'Tab' && trapFocus) {
        const focusableElements = getFocusableElements(dialogElement)
        if (focusableElements.length === 0) {
          event.preventDefault()
          focusElement(dialogElement)
          return
        }

        const firstFocusableElement = focusableElements[0]
        const lastFocusableElement = focusableElements[focusableElements.length - 1]
        const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
        const isFocusInsideDialog = activeElement ? dialogElement.contains(activeElement) : false

        if (event.shiftKey) {
          if (!isFocusInsideDialog || activeElement === firstFocusableElement || activeElement === dialogElement) {
            event.preventDefault()
            focusElement(lastFocusableElement)
          }
          return
        }

        if (!isFocusInsideDialog || activeElement === lastFocusableElement) {
          event.preventDefault()
          focusElement(firstFocusableElement)
        }
        return
      }

      if (event.key !== 'Escape') {
        return
      }

      event.stopPropagation()

      if (!closeOnEscape || !onRequestClose) {
        event.preventDefault()
        return
      }

      event.preventDefault()
      onRequestClose()
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [closeOnEscape, dialogRef, onRequestClose, trapFocus])
}
