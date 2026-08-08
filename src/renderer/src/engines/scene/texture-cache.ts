import type { ColorSpace, Texture } from 'three'
import { assetUrl } from '@shared/domain/asset'
import { createRefCache } from '../core/ref-cache'

/** A port rather than a hard-wired `TextureLoader`, like `SqliteDriver`: jsdom decodes no image. */
export type TextureSource = (url: string) => Promise<Texture>

export type TextureCache = {
  /**
   * Takes a reference on an asset read in a given colour space, loading it if nobody holds it
   * yet. Resolves to `null` when the last holder let go before it arrived: a texture nobody
   * wants any more must not come back to life, and the loaded image is freed on the spot.
   */
  acquire: (assetId: string, colorSpace: ColorSpace) => Promise<Texture | null>
  /** Gives a reference back. The texture is freed once the last one goes. */
  release: (assetId: string, colorSpace: ColorSpace) => void
  /** Frees everything, whoever still holds it — the engine is going away. */
  dispose: () => void
}

const SEPARATOR = ':'

/**
 * One texture per asset AND colour space, however many materials point at it. The colour space
 * belongs to the key rather than to the holder: the same picture can dress one mesh as a base
 * map, read as sRGB, and another as roughness, read as data — and they are two different
 * textures on the GPU. Setting it on a shared instance would silently wash out the second.
 */
export function createTextureCache(load: TextureSource): TextureCache {
  const cache = createRefCache<Texture>({
    load: async key => {
      const [colorSpace, assetId] = splitKey(key)
      const texture = await load(assetUrl(assetId))
      texture.colorSpace = colorSpace
      return texture
    },
    free: texture => texture.dispose(),
  })

  const keyOf = (assetId: string, colorSpace: ColorSpace): string =>
    `${colorSpace}${SEPARATOR}${assetId}`

  return {
    acquire: (assetId, colorSpace) => cache.acquire(keyOf(assetId, colorSpace)),
    release: (assetId, colorSpace) => cache.release(keyOf(assetId, colorSpace)),
    dispose: cache.dispose,
  }
}

/** An asset id may hold a separator; a colour space never does, so only the first one splits. */
function splitKey(key: string): [ColorSpace, string] {
  const at = key.indexOf(SEPARATOR)
  // `as`: the key was built by `keyOf` from a `ColorSpace`, and nothing else reaches this.
  return [key.slice(0, at) as ColorSpace, key.slice(at + 1)]
}
