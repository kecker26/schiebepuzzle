import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

interface CursorTooltipPortalProps {
  active: boolean
  children: ReactNode
}

const VIEWPORT_GAP = 12
const CURSOR_GAP = 14
let latestCursor = { x: -9999, y: -9999 }

if (typeof document !== 'undefined') {
  document.addEventListener('pointermove', (event) => {
    latestCursor = { x: event.clientX, y: event.clientY }
  }, true)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

export default function CursorTooltipPortal({ active, children }: CursorTooltipPortalProps) {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [cursor, setCursor] = useState(latestCursor)
  const [style, setStyle] = useState<CSSProperties>({ left: -9999, top: -9999 })

  useEffect(() => {
    if (!active) return

    const handlePointerMove = (event: PointerEvent) => {
      setCursor({ x: event.clientX, y: event.clientY })
    }

    document.addEventListener('pointermove', handlePointerMove, true)
    return () => document.removeEventListener('pointermove', handlePointerMove, true)
  }, [active])

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current
    if (!active || !tooltip || cursor.x < 0 || cursor.y < 0) return

    const rect = tooltip.getBoundingClientRect()
    let left = cursor.x + CURSOR_GAP
    let top = cursor.y + CURSOR_GAP

    if (left + rect.width > window.innerWidth - VIEWPORT_GAP) {
      left = cursor.x - rect.width - CURSOR_GAP
    }
    if (top + rect.height > window.innerHeight - VIEWPORT_GAP) {
      top = cursor.y - rect.height - CURSOR_GAP
    }

    setStyle({
      left: clamp(left, VIEWPORT_GAP, window.innerWidth - rect.width - VIEWPORT_GAP),
      top: clamp(top, VIEWPORT_GAP, window.innerHeight - rect.height - VIEWPORT_GAP),
    })
  }, [active, cursor, children])

  if (!active) return null

  return createPortal(
    <div ref={tooltipRef} className="cursor-tooltip-portal" role="tooltip" style={style}>
      {children}
    </div>,
    document.body
  )
}
