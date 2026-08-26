import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, beforeAll, vi } from 'vitest'

vi.mock('three/addons/libs/meshopt_decoder.module.js', () => ({
  MeshoptDecoder: { supported: true, ready: Promise.resolve() },
}))
import {
  handleRequest,
  type AudioWorkerRequest,
  type AudioWorkerState,
} from '@/engines/audio/audioRender'
import { initI18n } from '@/i18n'
import { forgetRememberedAssets, useAssets } from '@/stores/assets'
// The rules that need no browser, shared with the `renderer-node` project — it says why there.
// Imports are hoisted, so the user agent it pins is in place before anything below reads it, and
// its `beforeEach` registers before the hooks written here.
import './testSetupStores'

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
 * jsdom ships no `Path2D` either, and the strip paints one per clip — the mark saying whether it
 * travels with its pair. Filled here rather than guarded in the painter: a `typeof` check in a
 * draw loop is a production branch no real renderer takes, and it would leave the one thing the
 * suite could not assert being that the mark is painted at all.
 *
 * A holder, not an implementation: nothing under test draws pixels — `getContext` above answers
 * null — so what a case reads back is which path object reached `fill`.
 */
function polyfillPath2D(): void {
  if ('Path2D' in globalThis) return

  class Path2DHolder {
    constructor(readonly d?: string) {}
  }

  // `as`: the real constructor also takes a `Path2D` and carries the drawing methods, none of
  // which a jsdom case can reach.
  globalThis.Path2D = Path2DHolder as unknown as typeof globalThis.Path2D
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

/**
 * How long an awaited query may wait. Testing Library's own default is one second.
 *
 * That second is a budget for the RUNNER, not for the studio, and the runner shares this machine
 * with whatever else builds on it. Measured on a suite waiting for a catalogue asked only once
 * the model's schema had named its family — two round trips: the case took 136 to 181 ms alone
 * on a quiet machine, and 1035 ms then 1270 ms inside full runs under six concurrent sessions.
 * Seven to nine times its own cost, against a ceiling of seven. Those readings are one machine's
 * on one afternoon; a review re-measuring under its own load read 186 to 525 ms, which points
 * the same way without reproducing them.
 *
 * **The suite those readings came from is gone** — it was `ModelNodeFields.test.tsx`, and by
 * 2026-08-16 no file of that name exists. The numbers stand as the reason this is 3000 and not
 * 1000; what no longer stands is the ability to rerun them there. Whoever revisits this measures
 * on a suite that still exists and says which.
 *
 * Three seconds is twice the worst reading. It buys tolerance, not speed: a satisfied wait
 * returns at once, so a green run should pay nothing — that mechanism is reasoned, not measured,
 * and no run at one second was ever timed against a run at three. What it costs is +2,00 s per
 * expiry, on **510 waiting sites across 77 files** — `waitFor`, `findBy*` and `findAllBy*`
 * counted over the renderer's suites on 2026-08-16. It read 462 across 63 four days earlier:
 * the cost of this default grows with the suite, which is the half of the trade-off that moves.
 *
 * Raised here rather than per call: two suites of THIS project had already bought their own
 * patience by hand, which is how a default nobody set becomes a rule nobody can see. The `node`
 * project keeps its own — `vi.waitFor` takes no global, and `main/project/folder.test.ts` still
 * writes its number where its neighbours name theirs.
 */
export const AWAITED_QUERY_MS = 3000

configure({ asyncUtilTimeout: AWAITED_QUERY_MS })

// At module scope, not in `beforeAll`: a component rendered while a test file is imported
// would already have asked for a context by then.
polyfillCanvas()
polyfillPath2D()
polyfillPointerAndDrag()
polyfillWorker()

const VIEWPORT_WIDTH = 640
const VIEWPORT_HEIGHT = 800

/**
 * A fake `IntersectionObserver`, and the handle to make it report.
 *
 * One definition rather than one per suite: the inert members below (`takeRecords`, `root`,
 * `rootMargin`, `scrollMargin`, `thresholds`) are conformance to `lib.dom`, not test intent, and
 * `scrollMargin` arriving in a TypeScript release is exactly how a second copy starts to rot.
 *
 * `eager` is the default because jsdom runs no layout: with nothing off screen, everything
 * observed is on it. A suite about DEFERRING installs the other one and calls `reveal`.
 */
export function installIntersectionObserver({ eager = true }: { eager?: boolean } = {}): {
  reveal: () => void
} {
  const watching: { observer: IntersectionObserver; watched: Element[] }[] = []

  function reported(observer: IntersectionObserver, watched: readonly Element[]): void {
    // `as`: an entry has eight fields, and a caller only ever reads `isIntersecting`.
    const entries = watched.map(
      target => ({ target, isIntersecting: true }) as IntersectionObserverEntry,
    )
    if (entries.length > 0) seen.get(observer)?.(entries, observer)
  }

  const seen = new Map<IntersectionObserver, IntersectionObserverCallback>()

  class Fake implements IntersectionObserver {
    private readonly watched: Element[] = []

    constructor(callback: IntersectionObserverCallback) {
      seen.set(this, callback)
      watching.push({ observer: this, watched: this.watched })
    }

    observe(target: Element): void {
      this.watched.push(target)
      if (eager) reported(this, [target])
    }

    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }

    readonly root = null
    readonly rootMargin = ''
    readonly scrollMargin = ''
    readonly thresholds: readonly number[] = []
  }

  globalThis.IntersectionObserver = Fake

  return {
    // Over a snapshot: a callback that mounts something registers another observer, and walking
    // the live list would never end.
    reveal: () => {
      for (const { observer, watched } of [...watching]) reported(observer, watched)
    },
  }
}

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

  // Same reading as the size stubs above: with no layout there is nothing off screen.
  if (!('IntersectionObserver' in globalThis)) installIntersectionObserver()

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

// Components translate on first render: without init, `t()` would return raw keys and every
// assertion on a label would test the key rather than the text. French, because expected values
// come from `fr.json` (CLAUDE.md).
beforeAll(async () => {
  polyfillDialog()
  polyfillLayout()
  await initI18n('fr')
})

afterEach(cleanup)

/**
 * A case must not leave a timer armed for the next one.
 *
 * `useAssets.invalidate` coalesces on a 200 ms timer held at MODULE scope, so it outlives the
 * case that armed it — and anything that ingests, generates or pulls ends by calling it. When it
 * fires inside a later case, `refresh()` re-reads the catalogue through whatever bridge THAT case
 * installed, and the shelf changes under an element already held: a band flips from "open" to
 * "fetch" between the query and the click. It cost half an hour of probing to find once
 * (`b982fdd2`), and the failure moves with how busy the machine is, which is what makes it read
 * as flakiness rather than as a bug.
 *
 * This narrows the window, it does not close it. The three callers — `stores/jobs`,
 * `stores/media`, `stores/cloud` — invalidate from bridge callbacks, so a promise settling AFTER
 * the hooks of a case can still arm one that nothing then cancels. A case that leaves work in
 * flight has to await it; no teardown can await it for them.
 */
afterEach(() => useAssets.getState().cancelInvalidate())

/**
 * Nor may it leave an asset behind. `assetsById` remembers every asset it has been shown, so that
 * a browsing facet cannot take the names off an open document — which also means an asset one
 * case puts in the catalogue would answer a lookup in the next.
 */
afterEach(forgetRememberedAssets)
