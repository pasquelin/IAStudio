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
  /**
   * Two, not one. `wanted` is what the document asks for and settles the races; `shown` is what
   * `scene.background` actually holds. Conflated, a call that lost the race had no way to name
   * its own reference apart from the picture on screen, and gave back whichever it could reach.
   */
  let wanted: string | null = null
  let shown: string | null = null

  const release = (): void => {
    if (shown) cache.release(shown, SRGBColorSpace)
    shown = null
    // Cleared too: a load still in flight reads this to know its sky is no longer asked for.
    wanted = null
  }

  return {
    // What is asked for, not what is on screen: a viewport whose sky is still decoding must not
    // repaint its backdrop underneath it. Unchanged by the two-field split, deliberately.
    showsSky: () => wanted !== null,
    release,

    apply: async (environment, asked) => {
      const assetId = asked.kind === 'skybox' ? asked.assetId : null
      if (assetId === wanted) return

      if (!assetId) {
        release()
        environment.setTexture(null)
        environment.setStudio()
        paintBackground()
        return
      }

      wanted = assetId
      const loaded = await cache.acquire(assetId, SRGBColorSpace)

      // Overtaken while decoding: gives back what it acquired, which it never put on screen.
      if (wanted !== assetId) {
        cache.release(assetId, SRGBColorSpace)
        return
      }

      if (!loaded) return

      environment.setTexture(loaded)
      environment.refresh()

      // After the swap, never before: the old texture is bound to the background until then.
      const previous = shown
      shown = assetId
      if (previous) cache.release(previous, SRGBColorSpace)
    },
  }
}
