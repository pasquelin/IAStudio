// First, and before any other Pixi import: Electron's CSP forbids `unsafe-eval`, and Pixi builds
// its shaders with `new Function()`, so `Application.init` rejects inside a promise and the canvas
// stays blank with a clean console. Despite the name, this ships static polyfills instead.
//
// Here rather than in each engine: the timeline's monitor went without it, and its Pixi
// application never started at all — a blank monitor nothing in the test suite could see.
import 'pixi.js/unsafe-eval'
import { Application, type ApplicationOptions } from 'pixi.js'

/**
 * Starts a Pixi application for a host element, or nothing if the engine died while it was
 * starting.
 *
 * `Application.init` is asynchronous in Pixi v8 — it was not in v7 — and React mounts,
 * unmounts and remounts an effect on the very same element in development. Left unguarded,
 * the first instance resolves after the second has claimed the element and appends a second
 * canvas: a WebGL context leaked for the session, per engine, per tab. Every engine needs the
 * same guard, and two copies of it have already drifted apart.
 *
 * `cancelled` is read *after* the await, which is the whole point: it is the engine's own
 * `disposed` flag, and it can only have been set while `init` was in flight.
 */
export async function mountApplication(
  options: Partial<ApplicationOptions>,
  cancelled: () => boolean,
): Promise<Application | null> {
  const application = new Application()
  await application.init(options)

  if (!cancelled()) return application

  application.destroy({ removeView: true }, { children: true, texture: true, textureSource: true })
  return null
}
