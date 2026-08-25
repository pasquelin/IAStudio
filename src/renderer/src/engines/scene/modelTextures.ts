import { Mesh, MeshStandardMaterial, type Material, type Object3D, type Texture } from 'three'
import { TEXTURE_SLOTS, type ModelRef, type TextureSlot } from '@shared/domain/scene'
import { createSlotBindings } from './textureBinding'
import type { TextureCache } from './textureCache'
import { giveSecondUvSet } from './threeSync'

export type ModelTextures = {
  /** The overrides a node holds, or none. An empty set puts every map back to the file's own. */
  apply: (overrides: ModelRef['textures']) => void
  /** Gives every reference back. The materials go with the instance that wore them. */
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
 * Its materials are cloned, and that is the whole reason this is not `createMaterialTextures` with
 * another argument: `instanceOf` copies a model's tree but SHARES its materials, so writing a map
 * into one would repaint every other node built from the same file — the ones the user never
 * touched included.
 *
 * **Cloned the moment the file lands, never later**, and this is not an optimisation left on the
 * table. A display mode swaps `mesh.material` for a stand-in shared by the whole scene
 * (`pane-dress`): a clone taken while one is on would copy the CLAY, record its empty slots as the
 * file's own, and hand `PaneMemory` a material it takes for the model's — losing the real one for
 * the rest of the session. Taking the copy at build time, before anything dresses the scene, is
 * what makes the slots hold their own material like `createMaterialTextures` does.
 */
export function createModelTextures(
  cache: TextureCache,
  root: Object3D,
  onChange: () => void,
  /** Said when a model carries nothing a map can be written into — see `dressed` below. */
  onUndressable: () => void = () => {},
): ModelTextures {
  const dressed: Dressed[] = []

  root.traverse(object => {
    if (!(object instanceof Mesh)) return

    const clone = (one: Material): Material => {
      // A material of another class — `KHR_materials_unlit` brings `MeshBasicMaterial` — has no
      // slot to write into and is left shared: copying it would buy nothing.
      if (!(one instanceof MeshStandardMaterial)) return one

      const copy = one.clone()
      const fileMaps = new Map<TextureSlot, Texture | null>(
        TEXTURE_SLOTS.map(slot => [slot, copy[slot]]),
      )
      dressed.push({ mesh: object, material: copy, fileMaps })
      return copy
    }

    const worn = object.material
    object.material = Array.isArray(worn) ? worn.map(clone) : clone(worn)
  })

  // `from-image`, unlike every other holder of this cache: the glTF stores its UVs for an
  // unflipped picture, so the studio's own convention lands them upside down over the maps it
  // replaces.
  const slots = createSlotBindings(cache, 'from-image', (slot, texture) => {
    // Nothing to dress, and the inspector still offers five slots: said out loud rather than
    // letting every one of them do nothing in silence.
    if (dressed.length === 0) return onUndressable()

    for (const { mesh, material, fileMaps } of dressed) {
      const next = texture ?? fileMaps.get(slot) ?? null
      if (material[slot] === next) continue

      // Same reason as a mesh's own maps: occlusion reads the second UV set, and a generated
      // model rarely carries one — left alone, an AO map would do nothing at all.
      if (next && slot === 'aoMap') giveSecondUvSet(mesh.geometry)

      material[slot] = texture ? sampledLike(texture, fileMaps.get(slot)) : next
      material.needsUpdate = true
    }
    onChange()
  })

  return {
    apply: overrides => slots.apply(overrides ?? {}),
    dispose: () => {
      slots.clear()
      // Cloned copies only — SceneRenderer.release never sees them; file maps stay with the cache.
      for (const { material } of dressed) material.dispose()
    },
  }
}

/**
 * The override wearing the sampler of the map it replaces — repeat, offset, rotation and UV set.
 *
 * A CLONE, because the cache hands the same instance to every holder: written on it, one model's
 * tiling would reach every other slot pointing at that picture. It shares the `Source`, so the
 * GPU still holds one texture — and it is never disposed, the cache owning what it came from.
 */
function sampledLike(texture: Texture, file: Texture | null | undefined): Texture {
  if (!file) return texture

  const worn = texture.clone()
  worn.wrapS = file.wrapS
  worn.wrapT = file.wrapT
  worn.repeat.copy(file.repeat)
  worn.offset.copy(file.offset)
  worn.center.copy(file.center)
  worn.rotation = file.rotation
  // The UV set the glTF told this slot to read — a model carrying a second one dresses from it.
  worn.channel = file.channel
  return worn
}
