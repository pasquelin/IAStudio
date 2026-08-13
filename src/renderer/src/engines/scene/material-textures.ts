import {
  NoColorSpace,
  SRGBColorSpace,
  type ColorSpace,
  type Mesh,
  type MeshStandardMaterial,
  type SpriteMaterial,
} from 'three'
import {
  TEXTURE_SLOTS,
  type MaterialDescriptor,
  type SpriteDescriptor,
  type TextureSlot,
} from '@shared/domain/scene'
import { createTextureBinding } from './texture-binding'
import type { TextureCache } from './texture-cache'
import { giveSecondUvSet } from './three-sync'

export type MaterialTextures = {
  apply: (descriptor: MaterialDescriptor) => void
  /** Gives every reference back. The mesh is gone, or the engine with it. */
  dispose: () => void
}

/**
 * The base colour map is authored in sRGB; every other map carries data, not colour, and
 * decoding it would wash out the normals and lighten the roughness.
 */
export function spaceOf(slot: TextureSlot): ColorSpace {
  return slot === 'map' ? SRGBColorSpace : NoColorSpace
}

/** The texture slots of one mesh, kept in line with its descriptor. */
export function createMaterialTextures(
  cache: TextureCache,
  mesh: Mesh,
  material: MeshStandardMaterial,
  onChange: () => void,
): MaterialTextures {
  const slots = TEXTURE_SLOTS.map(slot => ({
    slot,
    bind: createTextureBinding(cache, spaceOf(slot), texture => {
      if (material[slot] === texture) return
      // Ambient occlusion reads the second UV set, which no primitive of the studio carries:
      // left alone, ticking an AO map would do nothing at all.
      if (texture && slot === 'aoMap') giveSecondUvSet(mesh.geometry)

      material[slot] = texture
      // A slot that goes from empty to filled changes the shader program itself.
      material.needsUpdate = true
      onChange()
    }),
  }))

  return {
    apply: descriptor => {
      for (const { slot, bind } of slots) bind(descriptor[slot]?.assetId ?? null)
    },
    // Emptied rather than only given back: a material left pointing at a freed texture is one
    // the next frame would still try to draw with.
    dispose: () => {
      for (const { bind } of slots) bind(null)
    },
  }
}

export type SpriteTexture = {
  apply: (descriptor: SpriteDescriptor) => void
  dispose: () => void
}

/** The one map a sprite wears. Read as colour, like a mesh's base map and for the same reason. */
export function createSpriteTexture(
  cache: TextureCache,
  material: SpriteMaterial,
  onChange: () => void,
): SpriteTexture {
  const slot = createTextureBinding(cache, SRGBColorSpace, texture => {
    if (material.map === texture) return
    material.map = texture
    material.needsUpdate = true
    onChange()
  })

  return {
    apply: descriptor => slot(descriptor.map?.assetId ?? null),
    dispose: () => slot(null),
  }
}
