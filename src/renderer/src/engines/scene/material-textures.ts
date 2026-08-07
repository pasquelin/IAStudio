import { SRGBColorSpace, type Mesh, type MeshStandardMaterial, type Texture } from 'three'
import { TEXTURE_SLOTS, type MaterialDescriptor, type TextureSlot } from '@shared/domain/scene'
import type { TextureCache } from './texture-cache'

export type MaterialTextures = {
  apply: (descriptor: MaterialDescriptor) => void
  /** Gives every reference back. The mesh is gone, or the engine with it. */
  dispose: () => void
}

/**
 * The texture slots of one mesh, kept in line with its descriptor.
 *
 * Loading is asynchronous, so what a slot wants can change while what it asked for is still in
 * flight: three textures picked in a row must not leave the first one overwriting the third.
 * Each slot therefore holds exactly one reference — on the asset it currently wants, loaded or
 * not — and an arrival for anything else is dropped rather than installed.
 */
export function createMaterialTextures(
  cache: TextureCache,
  mesh: Mesh,
  material: MeshStandardMaterial,
  onChange: () => void,
): MaterialTextures {
  /** Per slot, the asset this mesh currently holds a reference on. */
  const holding = new Map<TextureSlot, string>()

  const install = (slot: TextureSlot, texture: Texture): void => {
    // The base colour map is authored in sRGB; every other map carries data, not colour, and
    // converting it would wash out the normals and lighten the roughness.
    if (slot === 'map') texture.colorSpace = SRGBColorSpace
    if (slot === 'aoMap') giveSecondUvSet(mesh)

    material[slot] = texture
    // A slot that goes from empty to filled changes the shader program itself.
    material.needsUpdate = true
    onChange()
  }

  const clear = (slot: TextureSlot): void => {
    const held = holding.get(slot)
    if (held !== undefined) cache.release(held)
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
        void cache.acquire(wanted).then(texture => {
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

/**
 * Ambient occlusion reads the second UV set, which none of the studio's primitives carry: left
 * alone, ticking an AO map would do nothing at all. The first set is what a generated texture
 * is authored against anyway.
 */
function giveSecondUvSet(mesh: Mesh): void {
  const { attributes } = mesh.geometry
  const uv = attributes.uv
  if (uv && !attributes.uv1) mesh.geometry.setAttribute('uv1', uv)
}
