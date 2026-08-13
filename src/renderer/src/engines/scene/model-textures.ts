import { Mesh, MeshStandardMaterial, type Material, type Object3D, type Texture } from 'three'
import { TEXTURE_SLOTS, type ModelRef, type TextureSlot } from '@shared/domain/scene'
import { spaceOf } from './material-textures'
import { createTextureBinding } from './texture-binding'
import type { TextureCache } from './texture-cache'
import { giveSecondUvSet } from './three-sync'

export type ModelTextures = {
  /** The overrides a node holds, or none. An empty set puts every map back to the file's own. */
  apply: (overrides: ModelRef['textures']) => void
  /** Gives every reference back and hands the instance its file's materials again. */
  dispose: () => void
}

/** One material of the instance, and the maps the file had put in it. */
type Dressed = {
  mesh: Mesh
  material: MeshStandardMaterial
  /** Read before anything is written over it: removing an override puts the file's map back. */
  fileMaps: Map<TextureSlot, Texture | null>
}

/**
 * The project's own maps over the ones a model's file carries, on every material of ONE instance.
 *
 * Its materials are cloned before the first map is written, and that is the whole reason this is
 * not `createMaterialTextures` with another argument: `instanceOf` clones a model's tree but
 * SHARES its materials, so writing a map into one would repaint every other node built from the
 * same file — including the ones the user never touched.
 *
 * Cloning is lazy, so a model with no override costs nothing at all: the overwhelming case is a
 * file shown exactly as it was generated.
 */
export function createModelTextures(
  cache: TextureCache,
  root: Object3D,
  onChange: () => void,
): ModelTextures {
  let dressed: Dressed[] | null = null

  const own = (): readonly Dressed[] => {
    if (dressed) return dressed

    const taken: Dressed[] = []
    root.traverse(object => {
      if (!(object instanceof Mesh)) return

      const before = object.material
      const clone = (one: Material): Material => {
        if (!(one instanceof MeshStandardMaterial)) return one

        const copy = one.clone()
        const fileMaps = new Map<TextureSlot, Texture | null>(
          TEXTURE_SLOTS.map(slot => [slot, copy[slot]]),
        )
        taken.push({ mesh: object, material: copy, fileMaps })
        return copy
      }

      object.material = Array.isArray(before) ? before.map(clone) : clone(before)
    })

    dressed = taken
    return dressed
  }

  const slots = TEXTURE_SLOTS.map(slot => ({
    slot,
    bind: createTextureBinding(cache, spaceOf(slot), texture => {
      for (const { mesh, material, fileMaps } of own()) {
        const next = texture ?? fileMaps.get(slot) ?? null
        if (material[slot] === next) continue

        // Same reason as a mesh's own maps: occlusion reads the second UV set, and a generated
        // model rarely carries one — left alone, an AO map would do nothing at all.
        if (next && slot === 'aoMap') giveSecondUvSet(mesh.geometry)

        material[slot] = next
        material.needsUpdate = true
      }
      onChange()
    }),
  }))

  return {
    apply: overrides => {
      for (const { slot, bind } of slots) bind(overrides?.[slot]?.assetId ?? null)
    },
    dispose: () => {
      // Emptied first: the bindings put the file's own maps back, so what is disposed below is a
      // clone holding nothing the file did not already hold.
      for (const { bind } of slots) bind(null)
      for (const { material } of dressed ?? []) material.dispose()
      dressed = null
    },
  }
}
