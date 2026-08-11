import { Light, Mesh, type Material, type Object3D } from 'three'
import type { PaneMaterials } from './pane-materials'
import { densityOf } from './scene-stats'
import {
  applyDisplayMode,
  EDGE_LAYER,
  hidesSceneLights,
  showsEdges,
  substituteFor,
  type DisplayMode,
} from './scene-view'

/**
 * What one view does to the scene just before it is drawn.
 *
 * A module of its own rather than a method: it runs from the render loop, which needs a GPU, and
 * a rule that only executes behind a context is a rule no test can reach. Here it is exercised on
 * plain objects — the layers, the materials and the visibility are all readable without drawing.
 */

/** A camera's layer mask, which is all this needs of a camera. */
export type PaneEye = {
  layers: { enable: (layer: number) => void; disable: (layer: number) => void }
}

/**
 * What a mesh was wearing before a view swapped it, and what a light's visibility was before the
 * material preview put it out. Held by the caller so it survives from one pass to the next.
 */
export type PaneMemory = {
  materials: WeakMap<Mesh, Material | Material[]>
  lights: WeakMap<Light, boolean>
}

export function createPaneMemory(): PaneMemory {
  return { materials: new WeakMap(), lights: new WeakMap() }
}

export function dressForPane(
  objects: Iterable<Object3D>,
  mode: DisplayMode,
  quads: boolean,
  materials: PaneMaterials,
  memory: PaneMemory,
  eye: PaneEye,
): void {
  const substitute = substituteFor(mode, quads)
  const dark = hidesSceneLights(mode)

  for (const object of objects) {
    // Density is per object, so the material is chosen once per object rather than per mesh:
    // what the colour answers is "which of these carries the triangles".
    const stand =
      substitute === 'none' ? null : materials.materialFor(substitute, densityOf(object))

    object.traverse(child => {
      if (child instanceof Light) return dimLight(child, dark, memory)
      if (!(child instanceof Mesh)) return

      // Remembered before it is replaced, and only when it is the model's own: a pass reading
      // back what the previous pass left would lose the real material for good.
      const worn = child.material
      if (!materials.owns(worn)) memory.materials.set(child, worn)
      child.material = stand ?? memory.materials.get(child) ?? worn
    })

    applyDisplayMode(object, mode)
  }

  // The edges hang on their own layer, so which views show them is a per-camera answer rather
  // than a second set of geometry.
  if (showsEdges(mode, quads)) eye.layers.enable(EDGE_LAYER)
  else eye.layers.disable(EDGE_LAYER)
}

/**
 * Puts a light out for the material preview, and gives it back exactly as it was afterwards.
 *
 * Remembered on the way down rather than assumed on the way up: a light the document itself
 * hides must stay hidden when the view goes back to a lit mode.
 */
function dimLight(light: Light, dark: boolean, memory: PaneMemory): void {
  if (dark) {
    if (!memory.lights.has(light)) memory.lights.set(light, light.visible)
    light.visible = false
    return
  }

  const held = memory.lights.get(light)
  if (held === undefined) return
  light.visible = held
  memory.lights.delete(light)
}
