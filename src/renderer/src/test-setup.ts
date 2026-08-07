import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll } from 'vitest'
import { initI18n } from '@/i18n'

/**
 * jsdom renders `<dialog>` but implements none of its modal API. Chromium does, and it is
 * what gives the account dialog its focus trap and its Escape handling — so the gap is
 * filled here rather than avoided in the component.
 */
function polyfillDialog(): void {
  const dialog = HTMLDialogElement.prototype
  if (typeof dialog.showModal !== 'function') {
    dialog.showModal = function showModal(this: HTMLDialogElement): void {
      this.open = true
    }
  }
  if (typeof dialog.close !== 'function') {
    dialog.close = function close(this: HTMLDialogElement): void {
      this.open = false
      this.dispatchEvent(new Event('close'))
    }
  }
}

/**
 * jsdom implements no canvas context and logs a "Not implemented" line on every call. Null is
 * already what it ends up returning, and it is what the timeline checks for before painting —
 * so this changes no behaviour, it only stops the noise.
 */
function polyfillCanvas(): void {
  // `as`: the real method is overloaded per context id, and none of them accepts "always null".
  HTMLCanvasElement.prototype.getContext = (() =>
    null) as unknown as HTMLCanvasElement['getContext']
}

/**
 * jsdom implements neither pointer capture nor `DragEvent`; Chromium does, and the timeline
 * needs both — capture to keep a drag alive when the pointer leaves the canvas, `DragEvent` to
 * carry the asset dropped on it. Filled here rather than worked around in the component.
 */
function polyfillPointerAndDrag(): void {
  const element = HTMLElement.prototype
  if (typeof element.setPointerCapture !== 'function') {
    element.setPointerCapture = () => undefined
    element.releasePointerCapture = () => undefined
    element.hasPointerCapture = () => false
  }

  if ('DragEvent' in globalThis) return

  class DragEventPolyfill extends MouseEvent {
    readonly dataTransfer: DataTransfer | null

    constructor(type: string, init: MouseEventInit & { dataTransfer?: DataTransfer } = {}) {
      super(type, init)
      this.dataTransfer = init.dataTransfer ?? null
    }
  }

  // `as`: the real constructor is wider than the two members any of our handlers reads.
  globalThis.DragEvent = DragEventPolyfill as unknown as typeof globalThis.DragEvent
}

// At module scope, not in `beforeAll`: a component rendered while a test file is imported
// would already have asked for a context by then.
polyfillCanvas()
polyfillPointerAndDrag()

const VIEWPORT_WIDTH = 640
const VIEWPORT_HEIGHT = 800

/**
 * jsdom runs no layout: every element measures zero, and a virtualized collection asked to
 * fill zero pixels renders no row at all. Stubbed here rather than worked around in the
 * components, which must keep measuring the real surface in Chromium.
 */
function polyfillLayout(): void {
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      constructor(private readonly callback: ResizeObserverCallback) {}

      // The real one reports the current size on `observe`, which is how a component gets its
      // first measurement without asking for one.
      observe(target: Element): void {
        const box = { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT }
        // `as`: an entry has twelve fields, and a component may only read `contentRect`.
        this.callback([{ target, contentRect: box } as ResizeObserverEntry], this)
      }

      unobserve(): void {}
      disconnect(): void {}
    }
  }

  const sizes: [string, number][] = [
    ['clientWidth', VIEWPORT_WIDTH],
    ['offsetWidth', VIEWPORT_WIDTH],
    ['clientHeight', VIEWPORT_HEIGHT],
    ['offsetHeight', VIEWPORT_HEIGHT],
  ]

  for (const [property, value] of sizes) {
    Object.defineProperty(HTMLElement.prototype, property, { configurable: true, value })
  }
}

/**
 * The language setting defaults to `system`, which reads `navigator.language` — jsdom answers
 * `en-US`, so every window would render in English while the assertions expect the French
 * bundle (CLAUDE.md: expected values come from `fr.json`). Pinned rather than worked around in
 * each test.
 */
function pinLocale(): void {
  Object.defineProperty(navigator, 'language', { configurable: true, value: 'fr-FR' })
}

// Components translate on first render: without init, `t()` would return raw keys and every
// assertion on a label would test the key rather than the text.
beforeAll(async () => {
  pinLocale()
  polyfillDialog()
  polyfillLayout()
  await initI18n('fr')
})

afterEach(cleanup)
