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
 */
export function createTextureBinding(
  cache: TextureCache,
  colorSpace: ColorSpace,
  install: (texture: Texture | null) => void,
): TextureBinding {
  let held: string | null = null

  const release = (): void => {
    if (held !== null) cache.release(held, colorSpace)
    held = null
  }

  return assetId => {
    if (held === assetId) return
    release()
    install(null)
    if (assetId === null) return

    held = assetId
    void cache.acquire(assetId, colorSpace).then(texture => {
      // Stale: the slot has moved on, and the reference it took went back with the move.
      if (held !== assetId || !texture) return
      install(texture)
    })
  }
}
