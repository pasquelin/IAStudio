/**
 * The LUT tables a grade samples, held between frames and kept in step with the catalogue.
 *
 * Its own module, and not a Map inside `PostComposer`, because what is subtle here has nothing to
 * do with the GPU: an asset id NEVER moves, so a cache keyed on the id alone hands back the first
 * table for good — and ⌘S over a LUT then shows nothing, for the life of the scene. The stamp is
 * what the catalogue says the asset is worth right now.
 */
import type { Data3DTexture } from 'three'

/** Reads a LUT asset into the 3D texture the grade samples. */
export type LutSource = (assetId: string) => Promise<Data3DTexture | null>

export type LutCacheOptions = {
  load: LutSource
  /** What the asset is worth right now — `textureCache.versionOf`. Read on every ask. */
  stampOf?: (assetId: string) => string | undefined
  /** Asked for a frame once something that was loading has arrived. */
  onReady?: () => void
}

export type LutCache = {
  /** The table if it is here; asks for it and answers nothing while it is not. */
  get: (assetId: string) => Data3DTexture | null
  dispose: () => void
}

/** An asset and what it was worth, in one string. A space cannot appear in an asset id. */
function keyOf(assetId: string, stamp: string | undefined): string {
  return `${assetId} ${stamp ?? ''}`
}

export function createLutCache(options: LutCacheOptions): LutCache {
  const held = new Map<string, Data3DTexture | null>()
  const loading = new Set<string>()

  /**
   * Frees what this asset was worth BEFORE, now that a newer table stands. Without it a save over
   * a LUT leaves one 3D texture on the GPU per save, and nothing ever asks for them again.
   */
  const forgetOlder = (assetId: string, kept: string): void => {
    for (const [key, texture] of held) {
      if (key === kept || !key.startsWith(`${assetId} `)) continue
      texture?.dispose()
      held.delete(key)
    }
  }

  const fetch = async (assetId: string, key: string): Promise<void> => {
    try {
      held.set(key, await options.load(assetId))
    } catch {
      // Remembered as absent rather than retried: a file that failed to parse fails every time,
      // and asking again would do it once per frame.
      held.set(key, null)
    } finally {
      loading.delete(key)
      forgetOlder(assetId, key)
      options.onReady?.()
    }
  }

  return {
    get: assetId => {
      const key = keyOf(assetId, options.stampOf?.(assetId))
      const found = held.get(key)
      if (found !== undefined) return found

      if (!loading.has(key)) {
        loading.add(key)
        void fetch(assetId, key)
      }
      return null
    },

    dispose: () => {
      for (const texture of held.values()) texture?.dispose()
      held.clear()
      loading.clear()
    },
  }
}
