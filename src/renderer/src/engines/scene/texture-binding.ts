import type { ColorSpace, Texture } from 'three'
import type { TextureCache } from './texture-cache'

/**
 * Points the slot at an asset, or at none — `null` is how a slot is emptied and its reference
 * given back. Asking for what it already holds does nothing.
 */
export type TextureBinding = (assetId: string | null) => void

/**
 * One slot of one material, holding one reference on one texture.
 *
 * Loading is asynchronous, so a slot can change its mind while what it asked for is in flight:
 * it holds exactly one reference — on the asset it wants now, loaded or not — and drops any
 * other arrival. That race is the whole reason this is a thing of its own rather than a few
 * lines at each call site.
 *
 * What it holds is the asset AND the version the catalogue gave it: an id does not move when ⌘S
 * overwrites the picture behind it, so comparing ids alone left every scene showing the image the
 * edit replaced until the engine was rebuilt.
 */
export function createTextureBinding(
  cache: TextureCache,
  colorSpace: ColorSpace,
  install: (texture: Texture | null) => void,
): TextureBinding {
  let held: { assetId: string; version: string | undefined } | null = null

  const release = (): void => {
    if (held) cache.release(held.assetId, colorSpace, held.version)
    held = null
  }

  return assetId => {
    const version = assetId === null ? undefined : cache.versionOf(assetId)
    if (held?.assetId === assetId && held.version === version) return
    if (held === null && assetId === null) return

    release()
    install(null)
    if (assetId === null) return

    const wanted = { assetId, version }
    held = wanted
    void cache.acquire(assetId, colorSpace, version).then(texture => {
      // Stale: the slot has moved on, and the reference it took went back with the move.
      if (held !== wanted || !texture) return
      install(texture)
    })
  }
}
