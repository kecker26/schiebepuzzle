import type { ReactNode } from 'react'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

vi.mock('motion/react', async () => {
  const React = await import('react')

  const motion = new Proxy(
    {},
    {
      get: (_target, tagName: string) =>
        React.forwardRef<HTMLElement, Record<string, unknown> & { children?: ReactNode }>(function MockMotionComponent(
          props,
          ref
        ) {
          const { children, ...restProps } = props
          return React.createElement(tagName, { ...restProps, ref }, children as ReactNode)
        }),
    }
  )

  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useReducedMotion: () => false,
  }
})

afterEach(() => {
  cleanup()
})

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

Object.defineProperty(window, 'scrollTo', {
  configurable: true,
  writable: true,
  value: vi.fn(),
})

Object.defineProperty(window, 'requestAnimationFrame', {
  configurable: true,
  writable: true,
  value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0),
})

Object.defineProperty(window, 'cancelAnimationFrame', {
  configurable: true,
  writable: true,
  value: (handle: number) => window.clearTimeout(handle),
})

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  writable: true,
  value: vi.fn(),
})

Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
  configurable: true,
  writable: true,
  value(this: HTMLElement, options?: ScrollToOptions | number, y?: number) {
    if (typeof options === 'number') {
      this.scrollLeft = options
      this.scrollTop = y ?? 0
      return
    }

    this.scrollLeft = options?.left ?? this.scrollLeft
    this.scrollTop = options?.top ?? this.scrollTop
  },
})

Object.defineProperty(HTMLElement.prototype, 'getClientRects', {
  configurable: true,
  writable: true,
  value() {
    return {
      length: 1,
      item: () => null,
      0: {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 1,
        bottom: 1,
        width: 1,
        height: 1,
        toJSON: () => ({}),
      },
    } as unknown as DOMRectList
  },
})
