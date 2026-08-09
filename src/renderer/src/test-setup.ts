import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll } from 'vitest'
import {
  handleRequest,
  type AudioWorkerRequest,
  type AudioWorkerState,
} from '@/engines/audio/audio-render'
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

/**
 * jsdom ships no `Worker`, and the audio editor replays its chain in one. Rather than mock the
 * editor's own module — which would leave the protocol between the two sides untested — the
 * audio worker runs in process here, through the same `handleRequest` the real one wires to
 * `self`. It is the only worker in the app; a second one would need a router in front of this.
 */
function polyfillWorker(): void {
  if ('Worker' in globalThis) return

  class InProcessWorker extends EventTarget {
    private readonly state: AudioWorkerState = { source: null }

    postMessage(message: AudioWorkerRequest): void {
      const answer = handleRequest(this.state, message)
      if (!answer) return
      // Answered on a later tick like the real one, so a component that waits for a render
      // has to do it from an effect rather than from the call that asked for it.
      queueMicrotask(() =>
        this.dispatchEvent(new MessageEvent('message', { data: answer.response })),
      )
    }

    terminate(): void {}
  }

  // `as`: the real constructor also carries `onmessage`, `onerror` and `postMessage` overloads
  // that nothing in the studio reaches for.
  globalThis.Worker = InProcessWorker as unknown as typeof Worker
}

// At module scope, not in `beforeAll`: a component rendered while a test file is imported
// would already have asked for a context by then.
polyfillCanvas()
polyfillPointerAndDrag()
polyfillWorker()

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

  /**
   * React Flow re-measures its nodes off the viewport's CSS transform, read through a
   * `DOMMatrixReadOnly` jsdom does not carry — so a node arriving AFTER the mount threw where
   * one present at mount never did. Identity is the honest answer where nothing is laid out,
   * and `m22` — the zoom — is the only field it reads.
   */
  if (!('DOMMatrixReadOnly' in globalThis)) {
    class IdentityMatrix {
      readonly m22 = 1
    }

    Object.defineProperty(globalThis, 'DOMMatrixReadOnly', {
      configurable: true,
      value: IdentityMatrix,
    })
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
