import { Mesh, MeshStandardMaterial, RepeatWrapping, type Object3D, type Texture } from 'three'
import { TEXTURE_SLOTS, type MaterialDescriptor, type TextureSlot } from '@shared/domain/scene'
import type { AssetPort } from '@game/ports/assetPort'
import { loadTexture } from '@/engines/scene/textureCache'
import { spaceOf } from '@/engines/scene/textureBinding'
import { applyMaterial, giveSecondUvSet } from '@/engines/scene/threeSync'

/**
 * A game reads no CSS token, so the studio's own mesh colour cannot be resolved: this is the
 * value `--color-mesh` settles on in the shipped theme.
 */
export const MESH_COLOUR = '#868a91'

export type Dress = (material: MeshStandardMaterial, slot: TextureSlot, assetId: string) => void

export function createDress(assets: AssetPort, textures: Map<string, Promise<Texture>>): Dress {
  return (material, slot, assetId) => {
    const url = assets.urlOf({ kind: 'asset', id: assetId })
    if (url !== null) void wearTexture(material, slot, assetId, url, textures)
  }
}

async function wearTexture(
  material: MeshStandardMaterial,
  slot: TextureSlot,
  assetId: string,
  url: string,
  textures: Map<string, Promise<Texture>>,
): Promise<void> {
  try {
    const held = textures.get(assetId) ?? loadTexture(url)
    textures.set(assetId, held)
    const texture = await held
    texture.colorSpace = spaceOf(slot)
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    material[slot] = texture
    material.needsUpdate = true
  } catch {
    return
  }
}

export function materialOf(descriptor: MaterialDescriptor, dress: Dress): MeshStandardMaterial {
  const material = new MeshStandardMaterial()
  applyMaterial(material, descriptor, MESH_COLOUR)
  for (const slot of TEXTURE_SLOTS) {
    const ref = descriptor[slot]
    if (ref) dress(material, slot, ref.assetId)
  }
  return material
}

export function wearOcclusionUvs(object: Object3D): void {
  object.traverse(child => {
    if (child instanceof Mesh) giveSecondUvSet(child.geometry)
  })
}
