import {
  Mesh,
  Vector3,
  type BufferGeometry,
  type Intersection,
  type Material,
  type Matrix4,
  type Object3D,
  type Sphere,
} from 'three'
import { cachedOn } from '../core/cachedOn'
import type { SceneNode } from './sceneState'

/**
 * The layer a mesh goes to once something else draws it in its place.
 *
 * TWO, and never one: `EDGE_LAYER` is one, and a view that shows edges enables it on the camera.
 * Sharing the number put every hidden mesh back on screen beside the instance drawing it —
 * measured, a tight view of 10 000 went from 3.7 ms and 40 calls to 12.6 ms and 9 605.
 *
 * The camera renders layer 0 alone, so nothing on this one costs a draw call — but the mesh stays
 * in the scene with its matrix up to date, which is what keeps picking, the gizmo and the
 * selection working untouched. A raycaster must enable it explicitly: `withEveryLayer` in `SceneRenderer` does.
 */
export const DRAWN_BY_INSTANCE = 2

/**
 * Past this many nodes of one group, drawing them one by one stops being free.
 *
 * Measured on this Mac at 1600×900, 10 000 bodies, group size the only variable: a group of 16
 * already gives back 90 % of the CPU a frame spends in `render` (8.62 ms against 0.86), and 4
 * gives back 59 %. The curve is flat well before the old floor of 64 — 95 % at 32, 96 % at 64.
 * The GPU never moves, 1.25 to 1.76 ms whatever the grouping.
 *
 * 🛑 The floor does NOT defend against a rebuild that grows as groups shrink: measured over three
 * series, that cost is 10 to 30 ms with no trend against group size at all. What it did instead
 * was pay the sweep and group nothing — below the old floor, the count of grouped nodes was zero.
 */
export const WORTH_INSTANCING = 16

/** What both strategies — one `InstancedMesh` per shape, one `BatchedMesh` per material — answer to. */
export type InstancedGroups = {
  /**
   * Recomposes the groups from what the scene now holds. Answers how many nodes are drawn by
   * something other than themselves — zero when nothing reached the floor, the ordinary scene.
   *
   * Call it after the world matrices are up to date: the matrices are copied from them.
   */
  rebuild: (nodes: readonly SceneNode[], objectOf: (id: string) => Object3D | undefined) => number
  /**
   * Writes the matrices of nodes that just moved, without rebuilding a thing — and says whether
   * any of them was drawn by something else.
   *
   * A gesture reports its move only when it ends, so between the two a grouped node would stand
   * where the last rebuild left it. Ten nodes cost 0.95 µs at 10 000 and 1.35 µs at 40 000,
   * against 7.2 and 47.5 ms to group again. Read the world matrices before calling: they are
   * what is copied.
   */
  moved: (ids: Iterable<string>, objectOf: (id: string) => Object3D | undefined) => boolean
  /**
   * The meshes it draws with, for the passes that dress the scene: a display mode REPLACES a
   * mesh's material, and one left out of that walk keeps the one it was built with.
   */
  drawn: () => readonly Mesh[]
  /**
   * What a ray must meet BESIDES the sources — which stay on `DRAWN_BY_INSTANCE` and answer by
   * their own name. Nothing on the instanced path; the lots on the batched one, which name a
   * hit by its slot through `nodeIdOf`. Built lazily: a click is rarer than a rebuild.
   */
  pickable: () => readonly Mesh[]
  /** The node a hit on one of `pickable` stands for, or nothing for a hit on anything else. */
  nodeIdOf: (hit: Intersection) => string | null
  /** The engine is going away, and so are the meshes it built. */
  dispose: () => void
}

/**
 * What a lot really draws, written on it by whoever built it and read by the density view.
 *
 * A `BatchedMesh` holds ONE copy of each distinct shape in a buffer sized for what was reserved,
 * so counting its triangles off that buffer answers neither what it draws nor what it holds.
 * Only the builder knows, and three keeps the per-instance shape private.
 */
export const DRAWN_TRIANGLES = 'drawnTriangles'

/** The meshes of one group and the nodes they stand for, index for index. */
export type Grouped = { ids: string[]; meshes: Mesh[]; material: Material }

/**
 * What both strategies share of a rebuild: which meshes are drawn at all, what a group is keyed
 * by, and which groups fall under the floor — those go straight back to the camera's layer.
 *
 * The shadow flags and the tool mark belong to every key: a group carries ONE of each, and the
 * shadow camera reads only the layer the sources have left, so a group that mixed them would
 * give its own answer to every node in it. The mark is louder still — a group draws the first
 * member's own material, so one negated brick among sixty-four would turn the whole wall red.
 */
export function sweep(
  nodes: readonly SceneNode[],
  objectOf: (id: string) => Object3D | undefined,
  host: Object3D,
  ownMaterialOf: (mesh: Mesh) => Material | Material[],
  keyOf: (node: SceneNode, mesh: Mesh) => string,
): Grouped[] {
  const groups = new Map<string, Grouped>()
  for (const node of nodes) {
    if (node.type !== 'mesh') continue
    const mesh = objectOf(node.id)
    // Read off the OBJECT, never the node: `visible` is the flag three.js draws through, so it
    // already carries what the viewport isolates on top of what the document hides.
    if (!(mesh instanceof Mesh) || !isDrawn(mesh, host)) continue
    const material = ownMaterialOf(mesh)
    // A group draws ONE material. A mesh wearing an array of them is left to be drawn alone.
    if (Array.isArray(material)) {
      mesh.layers.set(0)
      continue
    }

    const key = `${keyOf(node, mesh)}|${mesh.castShadow ? 1 : 0}${mesh.receiveShadow ? 1 : 0}${
      node.negative === true ? 1 : 0
    }`
    const held = groups.get(key)
    if (held) {
      held.ids.push(node.id)
      held.meshes.push(mesh)
    } else groups.set(key, { ids: [node.id], meshes: [mesh], material })
  }

  const worth: Grouped[] = []
  for (const group of groups.values()) {
    // Back to the camera's layer: a group that shrank below the floor since the last pass would
    // otherwise stay invisible with nothing drawing it.
    if (group.meshes.length < WORTH_INSTANCING) for (const mesh of group.meshes) mesh.layers.set(0)
    else worth.push(group)
  }
  return worth
}

/**
 * The spelling of a part of a node, held against the node itself.
 *
 * A rebuild runs on every change of content, and spelling 10 000 nodes again each time cost
 * 53.6 ms against 7.2 held. A node is replaced when it is edited and kept when it is not —
 * `syncNode` already leans on that — so a node still here is still spelled the same way.
 */
export function spellingOf(spell: (node: SceneNode) => string): (node: SceneNode) => string {
  const spelled = new WeakMap<SceneNode, string>()
  return node => cachedOn(spelled, node, () => spell(node))
}

const REACHED = new Vector3()

/**
 * Grows a group's bounds to hold a member that just moved.
 *
 * Only ever grows: a predicate that shrank under a moving object would cull geometry that is on
 * screen, and the next rebuild recomputes the bounds exactly anyway. Conservative is the only
 * safe direction here.
 */
export function widen(bounds: Sphere | null, geometry: BufferGeometry, placement: Matrix4): void {
  if (!bounds) return
  const reach =
    (geometry.boundingSphere?.radius ?? 0) * placement.getMaxScaleOnAxis() +
    bounds.center.distanceTo(REACHED.setFromMatrixPosition(placement))
  if (reach > bounds.radius) bounds.radius = reach
}

/** What three.js would draw: this object visible, and every one it hangs from up to the host. */
function isDrawn(mesh: Object3D, host: Object3D): boolean {
  for (let at: Object3D | null = mesh; at && at !== host; at = at.parent) {
    if (!at.visible) return false
  }
  return true
}
