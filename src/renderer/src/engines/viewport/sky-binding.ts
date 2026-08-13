import { SRGBColorSpace } from 'three'
import type { EnvironmentRef } from '@shared/domain/scene'
import type { TextureCache } from '../scene/texture-cache'
import type { ViewportEnvironment } from './environment'

export type SkyBinding = {
  /** Shows what the document asks for, loading the sky if it is one. Safe to call on every apply. */
  apply: (environment: ViewportEnvironment, wanted: EnvironmentRef) => Promise<void>
  /**
   * Asks again for the sky it shows, and loads it afresh if the catalogue says the file was
   * rewritten since. Nothing at all otherwise, and nothing before the first `apply`.
   */
  refresh: () => Promise<void>
  /** Whether a sky owns the background — true from the moment one is asked for, not once it decodes. */
  showsSky: () => boolean
  /** Gives the reference back. The viewport is going away, or is being shown something else. */
  release: () => void
}

/**
 * The references a viewport holds on the sky it displays, and the two-step way a sky is shown:
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
   * A reference the cache is holding for us: the asset AND the version it was taken under, which
   * has to be given back exactly as it was asked for — the cache keys on both, so releasing a sky
   * under a stamp that has moved since would free an entry nobody holds and leak the one we do.
   *
   * Carried for the same reason a material slot carries it: a sky and a mesh's base map can be
   * the same file, and two spellings of the same reference would decode it twice.
   */
  type Held = { assetId: string; version: string | undefined }

  /** Settles the races. */
  let wanted: string | null = null
  /** The version `wanted` was asked for under, so a rewrite of the same file is a change. */
  let askedUnder: string | undefined
  /** What the last `apply` was given, so a refresh can play it again. */
  let last: { environment: ViewportEnvironment; asked: EnvironmentRef } | null = null
  /** What `scene.background` holds, which is not what was last asked for while one decodes. */
  let shown: Held | null = null
  /** Every reference a decode still carries: one name could hold only the last of them. */
  const inFlight = new Map<symbol, Held>()

  const give = (held: Held): void => cache.release(held.assetId, SRGBColorSpace, held.version)

  const release = (): void => {
    if (shown) give(shown)
    // Drained here rather than left to each continuation: the viewport may be going away, and a
    // reference handed back a decode later is one held too long.
    for (const held of inFlight.values()) give(held)
    inFlight.clear()
    shown = null
    wanted = null
    askedUnder = undefined
  }

  const apply = async (environment: ViewportEnvironment, asked: EnvironmentRef): Promise<void> => {
    last = { environment, asked }
    const assetId = asked.kind === 'skybox' ? asked.assetId : null
    const version = assetId === null ? undefined : cache.versionOf(assetId)
    // The version too, or a sky whose file was rewritten under the same id would be recognised
    // as « already shown » and the edit would never reach the backdrop.
    if (assetId === wanted && version === askedUnder) return

    if (!assetId) {
      release()
      environment.setTexture(null)
      environment.setStudio()
      paintBackground()
      return
    }

    wanted = assetId
    askedUnder = version
    const held: Held = { assetId, version }
    const token = Symbol(assetId)
    inFlight.set(token, held)
    const loaded = await cache.acquire(held.assetId, SRGBColorSpace, held.version)

    // Drained by `release` while this decoded: the reference is already back, and giving it
    // twice would take the count to zero under whoever else holds the same sky.
    if (!inFlight.delete(token)) return

    // Failure first, because it holds nothing to give back — `ref-cache` drops the entry. Asked
    // after the overtaken case, a sky that both failed and lost would hand back a reference it
    // never took. `wanted` stops claiming it so `release` does not either, and so the same sky
    // can be asked for again; only if it is still the one wanted, or a loser would clear the
    // winner's claim.
    if (!loaded) {
      if (wanted === assetId) {
        wanted = null
        askedUnder = undefined
      }
      return
    }

    // Overtaken while decoding: gives back what it acquired, which it never put on screen.
    if (wanted !== assetId) {
      give(held)
      return
    }

    environment.setTexture(loaded)
    environment.refresh()

    // After the swap, never before: the old texture is bound to the background until then.
    const previous = shown
    shown = held
    if (previous) give(previous)
  }

  return {
    // Either: a sky still decoding must not have its backdrop repainted underneath it, and one
    // already painted still owns the background even when the sky asked for after it failed.
    showsSky: () => wanted !== null || shown !== null,
    release,
    apply,
    // Played again rather than compared here: `apply` is what knows whether the version moved,
    // and a viewport that has shown nothing yet has nothing to ask for.
    refresh: () => (last ? apply(last.environment, last.asked) : Promise.resolve()),
  }
}
