import {
  NoColorSpace,
  SRGBColorSpace,
  type ColorSpace,
  type Mesh,
  type MeshStandardMaterial,
  type Texture,
} from 'three'
import { TEXTURE_SLOTS, type MaterialDescriptor, type TextureSlot } from '@shared/domain/scene'
import type { TextureCache } from './texture-cache'
import { giveSecondUvSet } from './three-sync'

export type MaterialTextures = {
  apply: (descriptor: MaterialDescriptor) => void
  /** Gives every reference back. The mesh is gone, or the engine with it. */
  dispose: () => void
}

/**
 * The texture slots of one mesh, kept in line with its descriptor. Loading is asynchronous, so
 * a slot can change its mind while what it asked for is in flight: each holds exactly one
 * reference — on the asset it wants now, loaded or not — and drops any other arrival.
 */
/**
 * The base colour map is authored in sRGB; every other map carries data, not colour, and
 * decoding it would wash out the normals and lighten the roughness.
 */
function spaceOf(slot: TextureSlot): ColorSpace {
  return slot === 'map' ? SRGBColorSpace : NoColorSpace
}

export function createMaterialTextures(
  cache: TextureCache,
  mesh: Mesh,
  material: MeshStandardMaterial,
  onChange: () => void,
): MaterialTextures {
  /** Per slot, the asset this mesh currently holds a reference on. */
  const holding = new Map<TextureSlot, string>()

  const install = (slot: TextureSlot, texture: Texture): void => {
    // Ambient occlusion reads the second UV set, which no primitive of the studio carries: left
    // alone, ticking an AO map would do nothing at all.
    if (slot === 'aoMap') giveSecondUvSet(mesh.geometry)

    material[slot] = texture
    // A slot that goes from empty to filled changes the shader program itself.
    material.needsUpdate = true
    onChange()
  }

  const clear = (slot: TextureSlot): void => {
    const held = holding.get(slot)
    if (held !== undefined) cache.release(held, spaceOf(slot))
    holding.delete(slot)

    if (material[slot] === null) return
    material[slot] = null
    material.needsUpdate = true
  }

  return {
    apply: descriptor => {
      for (const slot of TEXTURE_SLOTS) {
        const wanted = descriptor[slot]?.assetId ?? null
        if ((holding.get(slot) ?? null) === wanted) continue

        clear(slot)
        onChange()
        if (!wanted) continue

        holding.set(slot, wanted)
        void cache.acquire(wanted, spaceOf(slot)).then(texture => {
          // Stale: the slot has moved on, and the reference it took went back with the move.
          if (holding.get(slot) !== wanted || !texture) return
          install(slot, texture)
        })
      }
    },

    dispose: () => {
      for (const slot of TEXTURE_SLOTS) clear(slot)
    },
  }
}
