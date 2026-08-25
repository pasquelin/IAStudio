import { Light, Mesh, type Material, type Object3D } from 'three'
import type { PaneMaterials } from './paneMaterials'
import { densityOf } from './sceneStats'
import {
  applyDisplayMode,
  EDGE_LAYER,
  hidesSceneEnvironment,
  hidesSceneLights,
  showsEdges,
  substituteFor,
} from './sceneView'
import { type DisplayMode } from '@shared/domain/scene'

/**
 * What one view does to the scene just before it is drawn, and whether it changed anything.
 *
 * The answer is what tells the frame its shadow maps are worth drawing again: a pane that puts
 * the scene's lights out for a material preview draws different shadows from the one beside it.
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
  /**
   * What the scene is currently wearing.
   *
   * The scene holds ONE state at a time — the materials and the light switches are on the
   * objects themselves — so a pass asking for what is already on has nothing to walk. Without
   * this the traversal ran per pane and per frame, which on a still viewport in the plainest
   * mode is a walk over every mesh sixty times a second to change nothing at all.
   */
  worn: { mode: DisplayMode; quads: boolean } | null
}

export function createPaneMemory(): PaneMemory {
  return { materials: new WeakMap(), lights: new WeakMap(), worn: null }
}

export function dressForPane(
  objects: Iterable<Object3D>,
  mode: DisplayMode,
  quads: boolean,
  materials: PaneMaterials,
  memory: PaneMemory,
  eye: PaneEye,
  /**
   * Swaps what lights the scene for this pass, or puts the document's own back. Per PANE and not
   * per document: `scene.environment` is one reference, but it is read at draw time, so a studio
   * view and a rendered view can stand side by side in a quad layout.
   */
  light: (studio: boolean) => void = () => {},
): boolean {
  // The layers are the camera's own and have to be set every pass; the scene's dress does not.
  if (showsEdges(mode, quads)) eye.layers.enable(EDGE_LAYER)
  else eye.layers.disable(EDGE_LAYER)

  // Every pass, like the layers: what the previous pane left is not what this one wants.
  light(hidesSceneEnvironment(mode))

  if (memory.worn?.mode === mode && memory.worn.quads === quads) return false
  memory.worn = { mode, quads }

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
  return true
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
