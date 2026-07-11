import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

type TooltipPosition = 'bottom' | 'top' | 'left' | 'right'
type TooltipAlign = 'center' | 'start' | 'end'

interface ActiveTooltip {
  align: TooltipAlign
  content: string
  position: TooltipPosition
  trigger: HTMLElement
}

const VIEWPORT_GAP = 12
const TRIGGER_GAP = 8
const CURSOR_GAP = 14
const POINTER_SHOW_DELAY_MS = 420
const KEYBOARD_SHOW_DELAY_MS = 520

interface CursorPosition {
  x: number
  y: number
}

function getTooltipTrigger(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>('[data-app-tooltip]') : null
}

function readTooltip(trigger: HTMLElement): ActiveTooltip | null {
  const content = trigger.dataset.appTooltip?.trim()
  if (!content) return null

  const requestedPosition = trigger.dataset.appTooltipPosition
  const requestedAlign = trigger.dataset.appTooltipAlign

  return {
    trigger,
    content,
    position: requestedPosition === 'top' || requestedPosition === 'left' || requestedPosition === 'right'
      ? requestedPosition
      : 'bottom',
    align: requestedAlign === 'start' || requestedAlign === 'end' ? requestedAlign : 'center',
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

export default function AppTooltipLayer() {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const activeTriggerRef = useRef<HTMLElement | null>(null)
  const showTimeoutRef = useRef<number | null>(null)
  const lastInteractionWasKeyboardRef = useRef(false)
  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltip | null>(null)
  const [cursorPosition, setCursorPosition] = useState<CursorPosition | null>(null)
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>({ left: -9999, top: -9999 })

  const hideTooltip = useCallback((trigger?: HTMLElement | null) => {
    if (showTimeoutRef.current !== null) {
      window.clearTimeout(showTimeoutRef.current)
      showTimeoutRef.current = null
    }
    if (trigger && activeTriggerRef.current && activeTriggerRef.current !== trigger) return
    activeTriggerRef.current = null
    setCursorPosition(null)
    setActiveTooltip(null)
  }, [])

  const showTooltip = useCallback((trigger: HTMLElement, cursor?: CursorPosition) => {
    const nextTooltip = readTooltip(trigger)
    if (!nextTooltip) return

    activeTriggerRef.current = trigger
    setCursorPosition(cursor ?? null)
    setTooltipStyle({ left: -9999, top: -9999 })
    setActiveTooltip(nextTooltip)
  }, [])

  const scheduleTooltip = useCallback((
    trigger: HTMLElement,
    delayMs: number,
    cursor?: CursorPosition,
  ) => {
    if (showTimeoutRef.current !== null) {
      window.clearTimeout(showTimeoutRef.current)
    }
    showTimeoutRef.current = window.setTimeout(() => {
      showTimeoutRef.current = null
      if (!trigger.isConnected) return
      showTooltip(trigger, cursor)
    }, delayMs)
  }, [showTooltip])

  useEffect(() => {
    const handlePointerOver = (event: PointerEvent) => {
      const trigger = getTooltipTrigger(event.target)
      if (trigger && trigger !== activeTriggerRef.current) {
        scheduleTooltip(trigger, POINTER_SHOW_DELAY_MS, { x: event.clientX, y: event.clientY })
      }
    }

    const handlePointerDown = () => {
      lastInteractionWasKeyboardRef.current = false
      hideTooltip()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      lastInteractionWasKeyboardRef.current = true
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!activeTriggerRef.current) return
      setCursorPosition({ x: event.clientX, y: event.clientY })
    }

    const handlePointerOut = (event: PointerEvent) => {
      const trigger = getTooltipTrigger(event.target)
      if (!trigger || trigger !== activeTriggerRef.current) return

      const relatedTarget = event.relatedTarget
      if (relatedTarget instanceof Node && trigger.contains(relatedTarget)) return
      hideTooltip(trigger)
    }

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return

      window.requestAnimationFrame(() => {
        if (
          lastInteractionWasKeyboardRef.current
          && document.activeElement === target
          && target.matches(':focus-visible')
          && target.hasAttribute('data-app-tooltip')
        ) {
          scheduleTooltip(target, KEYBOARD_SHOW_DELAY_MS)
        }
      })
    }

    const handleFocusOut = (event: FocusEvent) => {
      const target = event.target
      if (target instanceof HTMLElement) {
        hideTooltip(target)
      }
    }

    const handleViewportChange = () => hideTooltip()

    document.addEventListener('pointerover', handlePointerOver, true)
    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('pointermove', handlePointerMove, true)
    document.addEventListener('pointerout', handlePointerOut, true)
    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('focusin', handleFocusIn, true)
    document.addEventListener('focusout', handleFocusOut, true)
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)

    return () => {
      document.removeEventListener('pointerover', handlePointerOver, true)
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('pointermove', handlePointerMove, true)
      document.removeEventListener('pointerout', handlePointerOut, true)
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('focusin', handleFocusIn, true)
      document.removeEventListener('focusout', handleFocusOut, true)
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [hideTooltip, scheduleTooltip])

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current
    if (!tooltip || !activeTooltip) return

    const triggerRect = activeTooltip.trigger.getBoundingClientRect()
    const tooltipRect = tooltip.getBoundingClientRect()
    if (cursorPosition) {
      let left = cursorPosition.x + CURSOR_GAP
      let top = cursorPosition.y + CURSOR_GAP

      if (left + tooltipRect.width > window.innerWidth - VIEWPORT_GAP) {
        left = cursorPosition.x - tooltipRect.width - CURSOR_GAP
      }
      if (top + tooltipRect.height > window.innerHeight - VIEWPORT_GAP) {
        top = cursorPosition.y - tooltipRect.height - CURSOR_GAP
      }

      left = clamp(left, VIEWPORT_GAP, window.innerWidth - tooltipRect.width - VIEWPORT_GAP)
      top = clamp(top, VIEWPORT_GAP, window.innerHeight - tooltipRect.height - VIEWPORT_GAP)
      setTooltipStyle({ left, top })
      return
    }

    let left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2
    let top = triggerRect.bottom + TRIGGER_GAP
    let resolvedPosition = activeTooltip.position

    if (
      resolvedPosition === 'bottom'
      && triggerRect.bottom + TRIGGER_GAP + tooltipRect.height > window.innerHeight - VIEWPORT_GAP
      && triggerRect.top - TRIGGER_GAP - tooltipRect.height >= VIEWPORT_GAP
    ) {
      resolvedPosition = 'top'
    } else if (
      resolvedPosition === 'top'
      && triggerRect.top - TRIGGER_GAP - tooltipRect.height < VIEWPORT_GAP
      && triggerRect.bottom + TRIGGER_GAP + tooltipRect.height <= window.innerHeight - VIEWPORT_GAP
    ) {
      resolvedPosition = 'bottom'
    } else if (
      resolvedPosition === 'right'
      && triggerRect.right + TRIGGER_GAP + tooltipRect.width > window.innerWidth - VIEWPORT_GAP
      && triggerRect.left - TRIGGER_GAP - tooltipRect.width >= VIEWPORT_GAP
    ) {
      resolvedPosition = 'left'
    } else if (
      resolvedPosition === 'left'
      && triggerRect.left - TRIGGER_GAP - tooltipRect.width < VIEWPORT_GAP
      && triggerRect.right + TRIGGER_GAP + tooltipRect.width <= window.innerWidth - VIEWPORT_GAP
    ) {
      resolvedPosition = 'right'
    }

    if (resolvedPosition === 'top') {
      top = triggerRect.top - tooltipRect.height - TRIGGER_GAP
    } else if (resolvedPosition === 'right') {
      left = triggerRect.right + TRIGGER_GAP
      top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2
    } else if (resolvedPosition === 'left') {
      left = triggerRect.left - tooltipRect.width - TRIGGER_GAP
      top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2
    } else if (activeTooltip.align === 'start') {
      left = triggerRect.left
    } else if (activeTooltip.align === 'end') {
      left = triggerRect.right - tooltipRect.width
    }

    left = clamp(left, VIEWPORT_GAP, window.innerWidth - tooltipRect.width - VIEWPORT_GAP)
    top = clamp(top, VIEWPORT_GAP, window.innerHeight - tooltipRect.height - VIEWPORT_GAP)
    setTooltipStyle({ left, top })
  }, [activeTooltip, cursorPosition])

  if (!activeTooltip) return null

  return createPortal(
    <div
      ref={tooltipRef}
      className="app-tooltip-layer"
      role="tooltip"
      style={tooltipStyle}
    >
      {activeTooltip.content}
    </div>,
    document.body
  )
}
