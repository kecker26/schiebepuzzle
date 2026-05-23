import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import ContextMenuIcon, { type ContextMenuIconName } from './ContextMenuIcon.tsx'
import GlobalUiIcon, { type GlobalUiIconName } from './GlobalUiIcon.tsx'
import { addUiLayer, isTopUiLayer, removeUiLayer } from '../motion/uiLayerStack.ts'
import '../styles/components/context-menu.css'

interface ContextMenuPosition {
  x: number
  y: number
}

interface ContextMenuActionItem {
  label: string
  icon: ContextMenuIconName
  meta?: string
  onClick: () => void
  disabled?: boolean
  separator?: false
  groupTitle?: never
}

interface ContextMenuSeparatorItem {
  separator: true
  groupTitle?: never
}

interface ContextMenuGroupTitleItem {
  groupTitle: string
  groupIcon?: GlobalUiIconName
  separator?: false
}

type ContextMenuItem = ContextMenuActionItem | ContextMenuSeparatorItem | ContextMenuGroupTitleItem

interface CompactContextMenuProps {
  position: ContextMenuPosition
  items: ContextMenuItem[]
  onClose: () => void
  paletteStyle?: CSSProperties
}

export type { ContextMenuItem, ContextMenuPosition }

function isContextMenuGroupTitleItem(item: ContextMenuItem): item is ContextMenuGroupTitleItem {
  return 'groupTitle' in item && typeof item.groupTitle === 'string'
}

function isContextMenuActionItem(item: ContextMenuItem): item is ContextMenuActionItem {
  return !item.separator && !isContextMenuGroupTitleItem(item)
}

function getContextMenuGroupIcon(title: string, explicitIcon?: GlobalUiIconName): GlobalUiIconName {
  if (explicitIcon) return explicitIcon

  switch (title) {
    case 'Aktionen':
      return 'zap'
    case 'App':
      return 'command'
    case 'Navigation':
      return 'navigation'
    case 'Seite':
      return 'layout'
    case 'Bild':
      return 'image'
    case 'Zufallsbild':
      return 'refreshCw'
    case 'Bereiche':
      return 'grid'
    case 'Backups':
      return 'archive'
    case 'Zuege':
      return 'move'
    case 'Ansicht':
      return 'eye'
    case 'Verlauf':
      return 'refreshCw'
    case 'Hilfe':
      return 'helpCircle'
    default:
      return 'command'
  }
}

export default function CompactContextMenu({ position, items, onClose, paletteStyle }: CompactContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null)
  const layerIdRef = useRef(Symbol('context-menu'))
  const enabledActionIndices = useMemo(() => items.reduce<number[]>((indices, item, index) => {
    if (isContextMenuActionItem(item) && !item.disabled) {
      indices.push(index)
    }
    return indices
  }, []), [items])
  const [activeItemIndex, setActiveItemIndex] = useState<number>(() => enabledActionIndices[0] ?? -1)

  const focusIndex = useCallback((index: number) => {
    setActiveItemIndex(index)
    itemRefs.current[index]?.focus({ preventScroll: true })
  }, [])

  const moveActiveItem = useCallback((direction: 1 | -1) => {
    if (enabledActionIndices.length === 0) return

    const currentIndex = enabledActionIndices.includes(activeItemIndex) ? activeItemIndex : enabledActionIndices[0]
    const currentPosition = enabledActionIndices.indexOf(currentIndex)
    const nextPosition = (currentPosition + direction + enabledActionIndices.length) % enabledActionIndices.length
    focusIndex(enabledActionIndices[nextPosition])
  }, [activeItemIndex, enabledActionIndices, focusIndex])

  const handleItemClick = useCallback((action: () => void) => {
    try {
      action()
    } finally {
      onClose()
    }
  }, [onClose])

  useLayoutEffect(() => {
    previouslyFocusedElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null

    const layerId = layerIdRef.current
    addUiLayer(layerId, menuRef.current)

    return () => {
      removeUiLayer(layerId)

      const previousElement = previouslyFocusedElementRef.current
      if (previousElement?.isConnected) {
        previousElement.focus({ preventScroll: true })
      }
    }
  }, [])

  useLayoutEffect(() => {
    if (enabledActionIndices.length === 0) {
      setActiveItemIndex(-1)
      return
    }

    if (!enabledActionIndices.includes(activeItemIndex)) {
      setActiveItemIndex(enabledActionIndices[0])
    }
  }, [activeItemIndex, enabledActionIndices])

  useLayoutEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      if (activeItemIndex >= 0) {
        itemRefs.current[activeItemIndex]?.focus({ preventScroll: true })
        return
      }

      menuRef.current?.focus({ preventScroll: true })
    })

    return () => {
      window.cancelAnimationFrame(animationFrame)
    }
  }, [activeItemIndex])

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if (!isTopUiLayer(layerIdRef.current)) return

      switch (event.key) {
        case 'Escape':
          event.preventDefault()
          event.stopPropagation()
          onClose()
          return
        case 'ArrowDown':
          event.preventDefault()
          event.stopPropagation()
          moveActiveItem(1)
          return
        case 'ArrowUp':
          event.preventDefault()
          event.stopPropagation()
          moveActiveItem(-1)
          return
        case 'Home':
          if (enabledActionIndices.length === 0) return
          event.preventDefault()
          event.stopPropagation()
          focusIndex(enabledActionIndices[0])
          return
        case 'End':
          if (enabledActionIndices.length === 0) return
          event.preventDefault()
          event.stopPropagation()
          focusIndex(enabledActionIndices[enabledActionIndices.length - 1])
          return
        case 'Tab':
          event.preventDefault()
          event.stopPropagation()
          onClose()
          return
      }
    }

    const handleScroll = () => {
      onClose()
    }

    document.addEventListener('mousedown', handleOutsideClick, true)
    document.addEventListener('keydown', handleEscape, true)
    window.addEventListener('scroll', handleScroll, true)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick, true)
      document.removeEventListener('keydown', handleEscape, true)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [enabledActionIndices, focusIndex, moveActiveItem, onClose])

  const positionMenu = useCallback(() => {
    if (!menuRef.current) return

    const viewportLeft = window.visualViewport?.offsetLeft ?? 0
    const viewportTop = window.visualViewport?.offsetTop ?? 0
    const viewportWidth = window.visualViewport?.width ?? document.documentElement.clientWidth ?? window.innerWidth
    const viewportHeight = window.visualViewport?.height ?? document.documentElement.clientHeight ?? window.innerHeight
    const margin = 8
    const minX = viewportLeft + margin
    const minY = viewportTop + margin
    const maxMenuHeight = Math.max(0, viewportHeight - margin * 2)

    menuRef.current.style.maxHeight = `${maxMenuHeight}px`
    menuRef.current.style.left = `${position.x}px`
    menuRef.current.style.top = `${position.y}px`
    menuRef.current.style.right = 'auto'
    menuRef.current.style.bottom = 'auto'

    const measuredWidth = menuRef.current.offsetWidth
    const measuredHeight = menuRef.current.offsetHeight

    const maxX = Math.max(minX, viewportLeft + viewportWidth - measuredWidth - margin)
    const maxY = Math.max(minY, viewportTop + viewportHeight - measuredHeight - margin)
    const adjustedX = Math.min(Math.max(position.x, minX), maxX)
    const adjustedY = Math.min(Math.max(position.y, minY), maxY)

    menuRef.current.style.left = `${adjustedX}px`
    menuRef.current.style.top = `${adjustedY}px`
    menuRef.current.style.right = 'auto'
    menuRef.current.style.bottom = 'auto'
  }, [position])

  useLayoutEffect(() => {
    positionMenu()
    const animationFrame = window.requestAnimationFrame(positionMenu)

    const handleResize = () => {
      positionMenu()
    }

    window.addEventListener('resize', handleResize)
    window.visualViewport?.addEventListener('resize', handleResize)
    window.visualViewport?.addEventListener('scroll', handleResize)

    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined' && menuRef.current) {
      resizeObserver = new ResizeObserver(() => {
        positionMenu()
      })
      resizeObserver.observe(menuRef.current)
    }

    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', handleResize)
      window.visualViewport?.removeEventListener('resize', handleResize)
      window.visualViewport?.removeEventListener('scroll', handleResize)
      resizeObserver?.disconnect()
    }
  }, [positionMenu])

  const menu = (
    <div
      ref={menuRef}
      className="puzzle-context-menu"
      role="menu"
      aria-orientation="vertical"
      tabIndex={-1}
      style={{ ...paletteStyle, left: position.x, top: position.y }}
    >
      {items.map((item, index) => {
        if (item.separator) {
          return <div key={`sep-${index}`} className="puzzle-context-menu-separator" role="separator" />
        }

        if (isContextMenuGroupTitleItem(item)) {
          const groupIcon = getContextMenuGroupIcon(item.groupTitle, item.groupIcon)

          return (
            <div
              key={`group-${item.groupTitle}-${index}`}
              className="puzzle-context-menu-group-title"
              role="presentation"
            >
              <span className="puzzle-context-menu-group-icon-shell" aria-hidden="true">
                <GlobalUiIcon name={groupIcon} className="puzzle-context-menu-group-icon" />
              </span>
              <span className="puzzle-context-menu-group-label">{item.groupTitle}</span>
              <span className="puzzle-context-menu-group-line" aria-hidden="true" />
            </div>
          )
        }

        return (
          <button
            key={`${item.label}-${item.meta ?? index}`}
            type="button"
            role="menuitem"
            className="puzzle-context-menu-item"
            data-active={activeItemIndex === index ? 'true' : undefined}
            disabled={item.disabled}
            tabIndex={item.disabled ? -1 : activeItemIndex === index ? 0 : -1}
            ref={(element) => {
              itemRefs.current[index] = element
            }}
            onFocus={() => {
              if (!item.disabled) {
                setActiveItemIndex(index)
              }
            }}
            onMouseEnter={() => {
              if (!item.disabled) {
                setActiveItemIndex(index)
              }
            }}
            onClick={() => handleItemClick(item.onClick)}
          >
            <span className="puzzle-context-menu-content">
              <ContextMenuIcon name={item.icon} />
              <span className="puzzle-context-menu-label">{item.label}</span>
            </span>
            {item.meta ? <kbd className="puzzle-context-menu-hotkey">{item.meta}</kbd> : null}
          </button>
        )
      })}
    </div>
  )

  return createPortal(menu, document.body)
}
