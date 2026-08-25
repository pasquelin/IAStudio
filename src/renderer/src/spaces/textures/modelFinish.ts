import type { ModelMaterial } from '@shared/domain/scene'
import type { MaterialSettings } from '@shared/domain/texture'

/**
 * What a material of the Textures space is worth to a MODEL — the eight dials a plain
 * `MeshStandardMaterial` carries, and the three that ride on its maps.
 *
 * The other four of `MaterialSettings` are dropped on purpose: the two ranges, the green flip
 * and the cavity are read in the texture engine's `onBeforeCompile`, and a scene draws its models
 * with no such shader. Carried across, they would promise a look the viewport cannot draw —
 * `ModelMaterial` says the same thing from the other side.
 */
export function modelFinishOf(material: MaterialSettings): ModelMaterial {
  return {
    color: material.color,
    roughness: material.roughness,
    metalness: material.metalness,
    normalScale: material.normalScale,
    aoIntensity: material.aoIntensity,
    emissive: material.emissive,
    emissiveIntensity: material.emissiveIntensity,
    tiling: { x: material.tiling.x, y: material.tiling.y },
    offset: { x: material.offset.x, y: material.offset.y },
    rotation: material.rotation,
  }
}
