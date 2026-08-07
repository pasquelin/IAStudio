// Pixi builds its shaders with `new Function()`, which the CSP forbids: without this, `init`
// rejects inside a promise and the canvas stays absent with a clean console. It patches
// prototypes, so it must run before any `init` — which holding the only one guarantees.
import 'pixi.js/unsafe-eval'
import { Application, type ApplicationOptions } from 'pixi.js'

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
