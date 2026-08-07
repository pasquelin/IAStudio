import type { ColorSpace, Texture } from 'three'
import { assetUrl } from '@shared/domain/asset'

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

type Entry = {
  references: number
  loading: Promise<Texture | null>
  texture: Texture | null
}

/**
 * One texture per asset AND colour space, however many materials point at it. The colour space
 * belongs to the key rather than to the holder: the same picture can dress one mesh as a base
 * map, read as sRGB, and another as roughness, read as data — and they are two different
 * textures on the GPU. Setting it on a shared instance would silently wash out the second.
 *
 * Reference counted rather than kept for the session: the GPU memory of a texture nobody
 * displays is memory the viewport lacks.
 */
export function createTextureCache(load: TextureSource): TextureCache {
  const entries = new Map<string, Entry>()

  const keyOf = (assetId: string, colorSpace: ColorSpace): string => `${colorSpace}:${assetId}`

  const free = (key: string, entry: Entry): void => {
    entries.delete(key)
    entry.texture?.dispose()
  }

  return {
    acquire: (assetId, colorSpace) => {
      const key = keyOf(assetId, colorSpace)
      const existing = entries.get(key)
      if (existing) {
        existing.references += 1
        return existing.loading
      }

      const loading = load(assetUrl(assetId)).then(
        texture => {
          texture.colorSpace = colorSpace
          // Released while it was in flight: freed here rather than kept for a holder that no
          // longer exists.
          if (entries.get(key) !== entry) {
            texture.dispose()
            return null
          }
          entry.texture = texture
          return texture
        },
        () => {
          // A texture that fails to load leaves the material untextured rather than the panel
          // broken — a missing file is an ordinary thing in a project that moved.
          entries.delete(key)
          return null
        },
      )

      const entry: Entry = { references: 1, loading, texture: null }
      entries.set(key, entry)
      return loading
    },

    release: (assetId, colorSpace) => {
      const key = keyOf(assetId, colorSpace)
      const entry = entries.get(key)
      if (!entry) return

      entry.references -= 1
      if (entry.references <= 0) free(key, entry)
    },

    dispose: () => {
      for (const [key, entry] of [...entries]) free(key, entry)
    },
  }
}
