export const PAGE_FOCUS_ROOT_SELECTOR = '[data-page-focus-root="true"]'
export const FOCUS_VISIBILITY_ANCHOR_ATTRIBUTE = 'data-focus-visibility-anchor'

type ScrollAxis = 'vertical' | 'horizontal'
type ScrollSide = 'Top' | 'Bottom' | 'Left' | 'Right'

function getFocusScrollBehavior(): ScrollBehavior {
  if (typeof document !== 'undefined' && document.documentElement.dataset.motion === 'reduced') {
    return 'auto'
  }

  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return 'auto'
  }

  return 'smooth'
}

function hasScrollRange(element: HTMLElement, axis: ScrollAxis): boolean {
  if (axis === 'vertical') {
    return element.scrollHeight > element.clientHeight + 1
  }

  return element.scrollWidth > element.clientWidth + 1
}

function getOverflowBehavior(element: HTMLElement, axis: ScrollAxis): string {
  const computedStyle = window.getComputedStyle(element)
  return axis === 'vertical'
    ? (computedStyle.overflowY || computedStyle.overflow)
    : (computedStyle.overflowX || computedStyle.overflow)
}

function isScrollableContainer(element: HTMLElement, axis: ScrollAxis): boolean {
  const overflowBehavior = getOverflowBehavior(element, axis)
  const allowsScroll = /(auto|scroll|overlay)/.test(overflowBehavior)
  return allowsScroll && hasScrollRange(element, axis)
}

function getScrollPadding(element: HTMLElement, side: ScrollSide): number {
  const computedStyle = window.getComputedStyle(element)
  const paddingValue = Number.parseFloat(
    computedStyle[`padding${side}` as 'paddingTop' | 'paddingBottom' | 'paddingLeft' | 'paddingRight']
  ) || 0
  const scrollPaddingValue = Number.parseFloat(
    computedStyle[
      `scrollPadding${side}` as 'scrollPaddingTop' | 'scrollPaddingBottom' | 'scrollPaddingLeft' | 'scrollPaddingRight'
    ]
  ) || 0

  return Math.max(paddingValue, scrollPaddingValue)
}

function getViewportExtent(axis: ScrollAxis): number {
  const visualViewportExtent = axis === 'vertical'
    ? window.visualViewport?.height
    : window.visualViewport?.width

  if (typeof visualViewportExtent === 'number' && visualViewportExtent > 0) {
    return visualViewportExtent
  }

  const windowExtent = axis === 'vertical' ? window.innerHeight : window.innerWidth
  if (typeof windowExtent === 'number' && windowExtent > 0) {
    return windowExtent
  }

  const documentExtent = axis === 'vertical'
    ? document.documentElement.clientHeight
    : document.documentElement.clientWidth
  if (typeof documentExtent === 'number' && documentExtent > 0) {
    return documentExtent
  }

  return Number.POSITIVE_INFINITY
}

function isRectFullyVisibleInViewport(targetRect: DOMRect): boolean {
  const viewportHeight = getViewportExtent('vertical')
  const viewportWidth = getViewportExtent('horizontal')

  return (
    targetRect.top >= 0
    && targetRect.bottom <= viewportHeight
    && targetRect.left >= 0
    && targetRect.right <= viewportWidth
  )
}

function getNearestScrollableContainer(target: HTMLElement, axis: ScrollAxis): HTMLElement | null {
  const pageRoot = target.closest<HTMLElement>(PAGE_FOCUS_ROOT_SELECTOR)
  let current: HTMLElement | null = target.parentElement

  while (current) {
    if (isScrollableContainer(current, axis)) {
      return current
    }

    if (current === pageRoot) {
      break
    }

    current = current.parentElement
  }

  return pageRoot && isScrollableContainer(pageRoot, axis) ? pageRoot : null
}

function resolveFocusVisibilityTarget(target: HTMLElement): HTMLElement {
  const anchorSelector = target.getAttribute(FOCUS_VISIBILITY_ANCHOR_ATTRIBUTE)
  if (!anchorSelector) {
    return target
  }

  return target.closest<HTMLElement>(anchorSelector) ?? target
}

export function alignFocusRootToStart(root: HTMLElement | null): void {
  if (!root) {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    return
  }

  if (isScrollableContainer(root, 'vertical')) {
    root.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    return
  }

  root.scrollIntoView({
    block: 'start',
    inline: 'nearest',
    behavior: 'auto',
  })
}

export function ensureElementVisible(target: HTMLElement): void {
  const visibilityTarget = resolveFocusVisibilityTarget(target)
  const scrollBehavior = getFocusScrollBehavior()
  const verticalScrollRoot = getNearestScrollableContainer(visibilityTarget, 'vertical')
  const horizontalScrollRoot = getNearestScrollableContainer(visibilityTarget, 'horizontal')
  const hasVerticalScrollRoot = verticalScrollRoot instanceof HTMLElement
  const hasHorizontalScrollRoot = horizontalScrollRoot instanceof HTMLElement
  const targetRect = visibilityTarget.getBoundingClientRect()

  if (!hasVerticalScrollRoot && !hasHorizontalScrollRoot) {
    if (!isRectFullyVisibleInViewport(targetRect)) {
      visibilityTarget.scrollIntoView({
        block: 'start',
        inline: 'nearest',
        behavior: scrollBehavior,
      })
    }

    return
  }

  if (hasVerticalScrollRoot && hasHorizontalScrollRoot && verticalScrollRoot === horizontalScrollRoot) {
    const sharedRoot = verticalScrollRoot
    const rootRect = sharedRoot.getBoundingClientRect()
    const paddingTop = getScrollPadding(sharedRoot, 'Top')
    const paddingBottom = getScrollPadding(sharedRoot, 'Bottom')
    const paddingLeft = getScrollPadding(sharedRoot, 'Left')
    const paddingRight = getScrollPadding(sharedRoot, 'Right')
    const targetTop = targetRect.top - rootRect.top
    const targetBottom = targetRect.bottom - rootRect.top
    const targetLeft = targetRect.left - rootRect.left
    const targetRight = targetRect.right - rootRect.left
    const visibleTop = paddingTop
    const visibleBottom = sharedRoot.clientHeight - paddingBottom
    const visibleLeft = paddingLeft
    const visibleRight = sharedRoot.clientWidth - paddingRight
    const nextTop = targetTop < visibleTop || targetBottom > visibleBottom
      ? Math.max(0, sharedRoot.scrollTop + targetTop - paddingTop)
      : sharedRoot.scrollTop
    const nextLeft = targetLeft < visibleLeft || targetRight > visibleRight
      ? Math.max(0, sharedRoot.scrollLeft + targetLeft - paddingLeft)
      : sharedRoot.scrollLeft

    if (nextTop !== sharedRoot.scrollTop || nextLeft !== sharedRoot.scrollLeft) {
      sharedRoot.scrollTo({
        top: nextTop,
        left: nextLeft,
        behavior: scrollBehavior,
      })
    }

    return
  }

  if (hasVerticalScrollRoot) {
    const rootRect = verticalScrollRoot.getBoundingClientRect()
    const paddingTop = getScrollPadding(verticalScrollRoot, 'Top')
    const paddingBottom = getScrollPadding(verticalScrollRoot, 'Bottom')
    const targetTop = targetRect.top - rootRect.top
    const targetBottom = targetRect.bottom - rootRect.top
    const visibleTop = paddingTop
    const visibleBottom = verticalScrollRoot.clientHeight - paddingBottom

    if (targetTop < visibleTop || targetBottom > visibleBottom) {
      const nextTop = verticalScrollRoot.scrollTop + targetTop - paddingTop
      verticalScrollRoot.scrollTo({
        top: Math.max(0, nextTop),
        left: verticalScrollRoot.scrollLeft,
        behavior: scrollBehavior,
      })
    }
  }

  if (hasHorizontalScrollRoot) {
    const rootRect = horizontalScrollRoot.getBoundingClientRect()
    const paddingLeft = getScrollPadding(horizontalScrollRoot, 'Left')
    const paddingRight = getScrollPadding(horizontalScrollRoot, 'Right')
    const targetLeft = targetRect.left - rootRect.left
    const targetRight = targetRect.right - rootRect.left
    const visibleLeft = paddingLeft
    const visibleRight = horizontalScrollRoot.clientWidth - paddingRight

    if (targetLeft < visibleLeft || targetRight > visibleRight) {
      const nextLeft = horizontalScrollRoot.scrollLeft + targetLeft - paddingLeft
      horizontalScrollRoot.scrollTo({
        top: horizontalScrollRoot.scrollTop,
        left: Math.max(0, nextLeft),
        behavior: scrollBehavior,
      })
    }
  }
}
