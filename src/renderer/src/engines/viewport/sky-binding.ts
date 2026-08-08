import { SRGBColorSpace } from 'three'
import type { EnvironmentRef } from '@shared/domain/scene'
import type { TextureCache } from '../scene/texture-cache'
import type { ViewportEnvironment } from './environment'

export type SkyBinding = {
  /** Shows what the document asks for, loading the sky if it is one. Safe to call on every apply. */
  apply: (environment: ViewportEnvironment, wanted: EnvironmentRef) => Promise<void>
  /** Whether a sky is currently shown — which is to say, whether it owns the background. */
  showsSky: () => boolean
  /** Gives the reference back. The viewport is going away, or is being shown something else. */
  release: () => void
}

/**
 * The reference a viewport holds on the sky it displays, and the two-step way a sky is shown:
 * the picture at once, the prefiltered reflections when it has decoded.
 *
 * Written once for the two viewports that light themselves this way. The order of operations is
 * the whole subtlety — a sky released before its replacement is in place is disposed while still
 * bound to `scene.background`, and three.js re-uploads it on the next frame with nothing left to
 * free it. Two copies of that would be one copy too many.
 *
 * `paintBackground` is what a viewport does when no sky is shown: `setStudio` lights the scene
 * but hangs nothing behind it, so without this the backdrop stays whatever was there — black.
 */
export function createSkyBinding(cache: TextureCache, paintBackground: () => void): SkyBinding {
  let held: string | null = null

  const release = (): void => {
    if (held) cache.release(held, SRGBColorSpace)
    held = null
  }

  return {
    showsSky: () => held !== null,
    release,

    apply: async (environment, wanted) => {
      const assetId = wanted.kind === 'skybox' ? wanted.assetId : null
      if (assetId === held) return

      if (!assetId) {
        release()
        environment.setTexture(null)
        environment.setStudio()
        paintBackground()
        return
      }

      const previous = held
      held = assetId
      const loaded = await cache.acquire(assetId, SRGBColorSpace)
      // Another sky was chosen while this one was decoding.
      if (held !== assetId) return

      if (loaded) {
        environment.setTexture(loaded)
        environment.refresh()
      }
      // After the swap, never before: the old texture is bound to the background until then.
      if (previous) cache.release(previous, SRGBColorSpace)
    },
  }
}
