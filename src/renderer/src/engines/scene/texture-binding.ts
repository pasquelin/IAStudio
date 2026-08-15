import { NoColorSpace, SRGBColorSpace, type ColorSpace, type Texture } from 'three'
import { TEXTURE_SLOTS, type TextureRef, type TextureSlot } from '@shared/domain/scene'
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
  type Wanted = { assetId: string; version: string | undefined }
  let held: Wanted | null = null

  const release = (given: Wanted | null): void => {
    if (given) cache.release(given.assetId, colorSpace, given.version)
  }

  return assetId => {
    const wanted = assetId === null ? null : { assetId, version: cache.versionOf(assetId) }
    // Compared through the optional chain so an empty slot asked to stay empty also stops here:
    // falling through would write `null` into the material on every apply, and recompile its
    // shader for it.
    if (held?.assetId === wanted?.assetId && held?.version === wanted?.version) return

    /**
     * The catalogue says nothing about a picture this slot already holds — the shelf is scoped by
     * type, so it legitimately holds rows a slot can name without it (see `usePosterUrl`), and it
     * is also empty until its first read lands. Kept as it is rather than reloaded: the bare URL
     * is exactly where the stale bitmap sits in the browser's cache, so re-asking would trade a
     * fresh texture for the one it replaced.
     */
    if (wanted && held?.assetId === wanted.assetId && wanted.version === undefined) return

    const previous = held
    held = wanted
    /**
     * The same picture in a newer version: what is on screen stays until the replacement has
     * decoded, and only then is the old reference given back — emptied first, a ⌘S over a texture
     * would flash the model bare, and freeing it first would leave the frames in between drawing
     * a texture the cache has already disposed. Same order, same reason as `sky-binding`.
     */
    const swapping = previous !== null && wanted !== null && previous.assetId === wanted.assetId
    if (!swapping) {
      release(previous)
      install(null)
    }
    if (!wanted) return

    void cache.acquire(wanted.assetId, colorSpace, wanted.version).then(texture => {
      if (swapping) release(previous)
      // Stale: the slot has moved on, and the reference it took went back with the move.
      if (held !== wanted || !texture) return
      install(texture)
    })
  }
}

/**
 * The base colour map is authored in sRGB; every other map carries data, not colour, and
 * decoding it would wash out the normals and lighten the roughness.
 */
export function spaceOf(slot: TextureSlot): ColorSpace {
  return slot === 'map' ? SRGBColorSpace : NoColorSpace
}

export type SlotBindings = {
  /** Points every slot at what the maps say, and empties the ones they say nothing about. */
  apply: (maps: Partial<Record<TextureSlot, TextureRef | null>>) => void
  /** Empties them all and gives every reference back. */
  clear: () => void
}

/**
 * The five slots of a standard material, each holding one reference, driven as one.
 *
 * What differs between a mesh's own material and a model's overrides is where the texture is
 * WRITTEN, which is the callback — everything around it, down to which colour space each slot
 * reads in, is the same rule twice. Written here so a sixth slot reaches both.
 */
export function createSlotBindings(
  cache: TextureCache,
  install: (slot: TextureSlot, texture: Texture | null) => void,
): SlotBindings {
  const slots = TEXTURE_SLOTS.map(slot => ({
    slot,
    bind: createTextureBinding(cache, spaceOf(slot), texture => install(slot, texture)),
  }))

  return {
    apply: maps => {
      for (const { slot, bind } of slots) bind(maps[slot]?.assetId ?? null)
    },
    clear: () => {
      for (const { bind } of slots) bind(null)
    },
  }
}
