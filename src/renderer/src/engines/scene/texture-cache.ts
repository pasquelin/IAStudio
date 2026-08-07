import type { Texture } from 'three'
import { assetUrl } from '@shared/domain/asset'

/** A port rather than a hard-wired `TextureLoader`, like `SqliteDriver`: jsdom decodes no image. */
export type TextureSource = (url: string) => Promise<Texture>

export type TextureCache = {
  /**
   * Takes a reference on a texture, loading it if nobody holds it yet. Resolves to `null` when
   * the last holder let go before it arrived: a texture nobody wants any more must not come
   * back to life, and the loaded image is freed on the spot.
   */
  acquire: (assetId: string) => Promise<Texture | null>
  /** Gives a reference back. The texture is freed once the last one goes. */
  release: (assetId: string) => void
  /** Frees everything, whoever still holds it — the engine is going away. */
  dispose: () => void
}

type Entry = {
  references: number
  loading: Promise<Texture | null>
  texture: Texture | null
}

/**
 * One texture per asset, however many materials point at it. Reference counted rather than kept
 * for the session: the GPU memory of a texture nobody displays is memory the viewport lacks.
 */
export function createTextureCache(load: TextureSource): TextureCache {
  const entries = new Map<string, Entry>()

  const free = (assetId: string, entry: Entry): void => {
    entries.delete(assetId)
    entry.texture?.dispose()
  }

  return {
    acquire: assetId => {
      const existing = entries.get(assetId)
      if (existing) {
        existing.references += 1
        return existing.loading
      }

      const loading = load(assetUrl(assetId)).then(
        texture => {
          // Released while it was in flight: freed here rather than kept for a holder that no
          // longer exists.
          if (entries.get(assetId) !== entry) {
            texture.dispose()
            return null
          }
          entry.texture = texture
          return texture
        },
        () => {
          // A texture that fails to load leaves the material untextured rather than the panel
          // broken — a missing file is an ordinary thing in a project that moved.
          entries.delete(assetId)
          return null
        },
      )

      const entry: Entry = { references: 1, loading, texture: null }
      entries.set(assetId, entry)
      return loading
    },

    release: assetId => {
      const entry = entries.get(assetId)
      if (!entry) return

      entry.references -= 1
      if (entry.references <= 0) free(assetId, entry)
    },

    dispose: () => {
      for (const [assetId, entry] of [...entries]) free(assetId, entry)
    },
  }
}
