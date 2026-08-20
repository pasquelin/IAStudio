/**
 * The working aids a viewport draws over a scene without being part of it: the box around an
 * object, its own axes at its pivot, and the normals of its surfaces.
 *
 * They hang BESIDE the nodes, like the grid, and never inside one — anything under a node would
 * be walked by the exporter, counted by the statistics and met by the ray. What they cost is
 * bounded on purpose: a `BoxHelper` per object of a large scene is affordable, a
 * `VertexNormalsHelper` per mesh of an imported model is not, which is why the normals are drawn
 * on the selection alone.
 */
import { AxesHelper, Box3, BoxHelper, Color, Group, Mesh, Vector3, type Object3D } from 'three'
import { VertexNormalsHelper } from 'three/addons/helpers/VertexNormalsHelper.js'
import { showsAid, type HelperVisibility } from '@shared/domain/scene'

export type AidPalette = {
  /** What a bounding box is drawn in. */
  box: string
  origin: string
  normal: string
}

export type AidSettings = {
  boundingBoxes: HelperVisibility
  origins: boolean
  normals: boolean
  normalLength: number
}

export type ViewportAids = {
  /**
   * The one group they all hang from, so a render pass hides the lot with a single flag — a film
   * is the scene, never the tools it was built with. See `hideWorkshop`.
   */
  object: Object3D
  /** Whether nothing at all is drawn, so a caller on a hot path can skip `apply` outright. */
  idle: () => boolean
  /**
   * Rebuilds what should be drawn from what is on stage. Safe to call on every apply: a helper
   * whose object has not moved is left exactly where it is.
   */
  apply: (
    objects: ReadonlyMap<string, Object3D>,
    selectedIds: readonly string[],
    settings: AidSettings,
    palette: AidPalette,
  ) => void
  /** The boxes follow what moved. Cheap — a `BoxHelper` re-reads a bounding box, nothing else. */
  refreshBoxes: () => void
  dispose: () => void
}

/** How far an object's own axes reach, relative to the box around it. */
const ORIGIN_SCALE = 0.35

/** So a lone empty group still shows something to grab hold of. */
const MIN_ORIGIN = 0.25

export function createViewportAids(): ViewportAids {
  const host = new Group()
  const boxes = new Map<string, BoxHelper>()
  const origins = new Map<string, AxesHelper>()
  /** Keyed by node, though a node may be a whole model: see `normalsFor`, which picks one mesh. */
  const normals = new Map<string, VertexNormalsHelper>()

  const drop = <T extends Object3D & { dispose: () => void }>(held: Map<string, T>, id: string) => {
    const helper = held.get(id)
    if (!helper) return
    helper.removeFromParent()
    helper.dispose()
    held.delete(id)
  }

  const dropAll = <T extends Object3D & { dispose: () => void }>(held: Map<string, T>) => {
    for (const id of [...held.keys()]) drop(held, id)
  }

  return {
    object: host,

    idle: () => boxes.size === 0 && origins.size === 0 && normals.size === 0,

    apply: (objects, selectedIds, settings, palette) => {
      const selected = new Set(selectedIds)
      const wanted = (visibility: HelperVisibility, id: string): boolean =>
        showsAid(visibility, selected, id) && (objects.get(id)?.visible ?? false)

      // By IDENTITY and not by key: pointing a model at another asset releases the object and
      // rebuilds one under the SAME id, so a helper compared on presence alone goes on holding
      // the freed one — drawing a box around a dead object and keeping its buffers alive.
      for (const [id, helper] of [...boxes]) {
        if (helper.object !== objects.get(id) || !wanted(settings.boundingBoxes, id)) {
          drop(boxes, id)
        }
      }
      for (const [id, object] of objects) {
        if (!wanted(settings.boundingBoxes, id) || boxes.has(id)) continue
        const helper = new BoxHelper(object, new Color(palette.box))
        // A box is decoration: never picked, never in a shadow map, never exported.
        helper.raycast = () => {}
        boxes.set(id, helper)
        host.add(helper)
      }

      // Visibility on all three, not on the boxes alone: axes left drawing at an object somebody
      // hid are axes pointing at nothing, and they were repositioned on every apply.
      for (const id of [...origins.keys()]) {
        if (!settings.origins || !objects.get(id)?.visible) drop(origins, id)
      }
      if (settings.origins) {
        for (const [id, object] of objects) {
          if (origins.has(id) || !object.visible) continue
          const helper = new AxesHelper(originSize(object))
          helper.raycast = () => {}
          origins.set(id, helper)
          host.add(helper)
        }
      }

      // KEPT rather than rebuilt. The geometry is two vertices per normal of the mesh — 2,4 Mo
      // on a 100 000-vertex model — and `apply` runs on every state change, selection included:
      // dropping and rebuilding here re-uploaded that on each frame of any slider drag.
      for (const [id, helper] of [...normals]) {
        const shown = settings.normals && selected.has(id) && (objects.get(id)?.visible ?? false)
        if (!shown || helper.object !== meshOf(objects.get(id))) drop(normals, id)
        else if (helper.size !== settings.normalLength) drop(normals, id)
      }
      if (settings.normals) {
        for (const id of selected) {
          const object = objects.get(id)
          if (normals.has(id) || !object?.visible) continue
          const helper = normalsFor(object, settings.normalLength, palette.normal)
          if (!helper) continue
          normals.set(id, helper)
          host.add(helper)
        }
      }

      for (const [id, helper] of origins) {
        const object = objects.get(id)
        if (object) helper.position.setFromMatrixPosition(object.matrixWorld)
      }
      for (const helper of boxes.values()) helper.update()
      for (const helper of normals.values()) helper.update()
    },

    // The boxes ALONE, and that is the point: `BoxHelper.update` re-reads a bounding box, while
    // `VertexNormalsHelper.update` walks every vertex and re-uploads its buffer. One belongs on
    // every frame of a drag; the other does not.
    refreshBoxes: () => {
      for (const helper of boxes.values()) helper.update()
    },

    dispose: () => {
      host.removeFromParent()
      dropAll(boxes)
      dropAll(origins)
      dropAll(normals)
    },
  }
}

/**
 * The normals of the first mesh found under a node, or nothing.
 *
 * `VertexNormalsHelper` reads `geometry.attributes.normal.count` in its constructor and throws
 * without one — and a generated model routinely arrives with a mesh that has no normals at all.
 * The check is what keeps a toggle from taking the viewport down on somebody's asset.
 *
 * One mesh and not all of them: a helper per mesh of an imported tree is thousands of line
 * segments, and what this answers — « which way is this surface facing » — is answered by one.
 */
function normalsFor(object: Object3D, size: number, color: string): VertexNormalsHelper | null {
  const found = meshOf(object)
  if (!found) return null

  const helper = new VertexNormalsHelper(found, size, new Color(color).getHex())
  helper.raycast = () => {}
  return helper
}

/**
 * The first mesh under a node that carries normals, or nothing.
 *
 * Walked with an explicit stack rather than `traverse`, which visits a whole imported tree even
 * once the answer is in hand — thousands of nodes for a question one of them settles.
 */
function meshOf(object: Object3D | undefined): Mesh | null {
  const stack: Object3D[] = object ? [object] : []

  while (stack.length > 0) {
    const child = stack.pop()
    if (!child) break
    if (child instanceof Mesh && child.geometry.getAttribute('normal')) return child
    stack.push(...child.children)
  }
  return null
}

/** Axes proportional to what they stand at the centre of, so a cube and a car both read. */
function originSize(object: Object3D): number {
  const size = new Box3().setFromObject(object).getSize(new Vector3())
  return Math.max(MIN_ORIGIN, Math.max(size.x, size.y, size.z) * ORIGIN_SCALE)
}
