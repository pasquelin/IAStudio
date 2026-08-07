// Electron's CSP forbids `unsafe-eval`, and Pixi builds its shaders with `new Function()`:
// without this, `Application.init` rejects inside a promise and the canvas stays absent with a
// clean console. Despite its name, this module ships static polyfills instead.
//
// It patches Pixi's prototypes, so what matters is that it runs before any `init` — not before
// any import. Here, that is structural: `mountApplication` is the only way an engine starts one.
// The timeline's monitor went without it entirely, and never had a Pixi application at all.
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
