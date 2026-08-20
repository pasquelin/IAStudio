/**
 * The ground a scene stands on — an object shadows land on, and NOT the viewport's grid.
 *
 * The two are separate on purpose: the grid is a ruler, hidden from every render and from the
 * montage, while this belongs to the document and is drawn wherever the scene is. Confusing them
 * is what makes a studio shot come out with graph paper under the subject.
 */
import { Mesh, MeshStandardMaterial, PlaneGeometry, type Object3D } from 'three'
import type { GroundDescriptor } from '@shared/domain/scene'

export type GroundPlane = {
  /** Hung beside the nodes, never inside one: it stands for no row of the outliner. */
  object: Object3D
  /** Reshapes it in place. The geometry is rebuilt only when the size actually moved. */
  apply: (ground: GroundDescriptor, fallbackColor: string) => void
  dispose: () => void
}

/**
 * Named for a reader of the scene graph, and for nothing else: the ground is part of the
 * DOCUMENT, so no pass drops it — a film and an export are both meant to have it.
 */
const GROUND_NAME = 'scene-ground'

export function createGroundPlane(): GroundPlane {
  const material = new MeshStandardMaterial({ roughness: 0.9, metalness: 0 })
  const mesh = new Mesh(new PlaneGeometry(1, 1), material)
  mesh.name = GROUND_NAME
  // Flat: a `PlaneGeometry` stands upright, and the ground is the one thing that must not.
  mesh.rotation.x = -Math.PI / 2
  mesh.castShadow = false
  // Never pickable. A plane the size of the scene sits under every click, and left in the ray it
  // would take every selection meant for what stands on it.
  mesh.raycast = () => {}

  let size = 0

  return {
    object: mesh,

    apply: (ground, fallbackColor) => {
      mesh.visible = ground.visible
      if (!ground.visible) return

      if (size !== ground.size) {
        mesh.geometry.dispose()
        mesh.geometry = new PlaneGeometry(ground.size, ground.size)
        size = ground.size
      }

      material.color.set(ground.color ?? fallbackColor)
      material.opacity = ground.opacity
      // Only when it has to be: a transparent material is sorted per frame and writes no depth.
      const clear = ground.opacity < 1
      // `transparent` is a shader define — `#define OPAQUE` forces the fragment's alpha to 1 —
      // and three only recompiles on a version bump. Without this the slider moved nothing.
      // At the CROSSING alone: bumping per frame would recompile on every pointermove.
      if (material.transparent !== clear) material.needsUpdate = true
      material.transparent = clear
      material.depthWrite = !clear
      mesh.receiveShadow = ground.receiveShadow
    },

    dispose: () => {
      mesh.geometry.dispose()
      material.dispose()
      mesh.removeFromParent()
    },
  }
}
