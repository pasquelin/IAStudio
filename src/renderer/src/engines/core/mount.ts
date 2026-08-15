// Pixi builds its shaders with `new Function()`, which the CSP forbids: without this, `init`
// rejects inside a promise and the canvas stays absent with a clean console. It patches
// prototypes, so it must run before any `init` — which holding the only one guarantees.
import 'pixi.js/unsafe-eval'
// Without it Pixi knows none of the separable modes past `screen`: twelve of the sixteen the
// canvas offers fell back to `normal` silently, compositing wrongly with nothing to say so.
import 'pixi.js/advanced-blend-modes'
import { Application, Filter, type ApplicationOptions } from 'pixi.js'

// Global, and deliberately here rather than in the engine that needs it: the advanced modes are
// filters, and a filter renders at resolution 1 by default, so a blended layer came out clipped
// and half-scaled on a retina canvas.
Filter.defaultOptions.resolution = 'inherit'

/**
 * Starts a Pixi application, or nothing if the engine died while it was starting. The only
 * `new Application()` in the renderer.
 *
 * `init` is asynchronous in Pixi v8, and React remounts an effect on the very same element: the
 * first instance would resolve after the second claimed it and leave a canvas behind, holding a
 * WebGL context for the session.
 */
export async function mountApplication(
  options: Partial<ApplicationOptions>,
  cancelled: () => boolean,
): Promise<Application | null> {
  const application = new Application()
  await application.init(options)

  // Read after the await on purpose: the engine can only have died while `init` was in flight.
  if (!cancelled()) return application

  application.destroy({ removeView: true }, { children: true, texture: true, textureSource: true })
  return null
}

/**
 * Makes `resizeTo` tell the truth, and returns the way to stop.
 *
 * Pixi's `ResizePlugin` honours that option through ONE listener —
 * `globalThis.addEventListener('resize', …)` — so a canvas only ever follows the WINDOW. Every
 * surface of this studio lives in a Dockview panel instead, and dragging a splitter resizes the
 * panel without resizing the window: no event fires, the drawing buffer keeps the size it had at
 * mount, and the picture is laid out against a rectangle that no longer exists. That is what the
 * video monitors were doing — the panel grew, the image did not move by a pixel.
 *
 * `resize` and not `queueResize`, which was the first shape of this and was measured wrong twice
 * over. A `ResizeObserver` already delivers once per layout pass, before the paint — so deferring
 * to an animation frame coalesces nothing that the browser has not coalesced, and only puts the
 * drawing buffer one frame behind the box for the length of a drag. And an animation frame is
 * exactly what Chromium stops handing out to a window nobody is looking at: with the studio in
 * the background, `document.hidden` true, the queued resize never ran at all.
 */
export function followHostSize(application: Application, host: HTMLElement): () => void {
  const observer = new ResizeObserver(() => application.resize())
  observer.observe(host)
  return () => observer.disconnect()
}
