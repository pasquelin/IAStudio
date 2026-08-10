import {
  Box3,
  LineSegments,
  Mesh,
  Vector3,
  WireframeGeometry,
  type Material,
  type Object3D,
} from 'three'
import { centreOf } from './pivot'

/**
 * How a scene is being looked at, and drawn. Session state, like an image document's zoom: it is
 * never saved with the document and ⌘Z never touches it — the scene did not change, the view did.
 */

/** The six sides of the box a set is judged from. */
export type ViewDirection = 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right'

export const VIEW_DIRECTIONS: readonly ViewDirection[] = [
  'front',
  'back',
  'left',
  'right',
  'top',
  'bottom',
]

/** A toolbar row carries a plain string: this is what turns it back into a direction. */
export function isViewDirection(value: string): value is ViewDirection {
  return VIEW_DIRECTIONS.some(direction => direction === value)
}

/** Unit vectors, in the studio's Y-up right-handed frame: front looks down −Z, from +Z. */
const AXES: Record<ViewDirection, [number, number, number]> = {
  front: [0, 0, 1],
  back: [0, 0, -1],
  left: [-1, 0, 0],
  right: [1, 0, 0],
  top: [0, 1, 0],
  bottom: [0, -1, 0],
}

/**
 * Where the camera goes to look at `target` from a given side, keeping the distance it had.
 *
 * Straight up and straight down are nudged off the axis on purpose: orbit controls read the
 * camera's placement as spherical coordinates around the target, and a polar angle of exactly
 * zero has no azimuth — the very next drag would snap the view to an arbitrary side.
 */
export function viewPosition(
  direction: ViewDirection,
  target: Vector3,
  distance: number,
): { x: number; y: number; z: number } {
  const [x, y, z] = AXES[direction]
  const nudge = y === 0 ? 0 : distance * 0.0001

  return {
    x: target.x + x * distance,
    y: target.y + y * distance,
    z: target.z + z * distance + nudge,
  }
}

/** How square a direction has to be on an axis to count as that side. Cosine, so this is ~2.5°. */
const ALIGNED = 0.999

/**
 * The side a direction names, or `null` when it points between two — the inverse of `AXES`.
 *
 * What the trihedron's click is read through: the helper works out where it would send the
 * camera, and this turns that back into one of the six sides the studio already knows how to go
 * to, so the move itself goes through `viewFrom` rather than around it.
 */
export function directionOf(offset: Vector3): ViewDirection | null {
  const length = Math.hypot(offset.x, offset.y, offset.z)
  if (length === 0) return null

  return (
    VIEW_DIRECTIONS.find(direction => {
      const [x, y, z] = AXES[direction]
      return (offset.x * x + offset.y * y + offset.z * z) / length > ALIGNED
    }) ?? null
  )
}

/** What the viewport draws: the surfaces, their edges, or both. */
export type DisplayMode = 'shaded' | 'wireframe' | 'both'

export const DISPLAY_MODES: readonly DisplayMode[] = ['shaded', 'wireframe', 'both']

/** The next mode in the list, wrapping — what one key does when three modes share it. */
export function nextDisplayMode(mode: DisplayMode): DisplayMode {
  const at = DISPLAY_MODES.indexOf(mode)
  return DISPLAY_MODES[(at + 1) % DISPLAY_MODES.length] ?? 'shaded'
}

export function isDisplayMode(value: string): value is DisplayMode {
  return DISPLAY_MODES.some(mode => mode === value)
}

/**
 * Wireframe on the materials themselves, never as a second pass over the scene: a pass would
 * redraw every triangle a second time, and this is a flag the shader already reads.
 *
 * `both` is the one mode a material cannot express — a wireframe material draws no surface — so
 * it is left to the overlay the renderer hangs under each mesh.
 */
export function applyDisplayMode(object: Object3D, mode: DisplayMode): void {
  object.traverse(child => {
    if (!(child instanceof Mesh)) return
    for (const material of materialsOf(child)) {
      // Structural: `Material` itself declares no `wireframe`, though every mesh material has one.
      if ('wireframe' in material) material.wireframe = mode === 'wireframe'
    }
  })
}

function materialsOf(mesh: Mesh): readonly Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material]
}

/**
 * Names the edges the renderer hangs under a mesh, so removing them is a test rather than a map —
 * what marks an overlay as decoration rather than content.
 *
 * Exported because the exporter has to strip them and was naming them itself: a rename here would
 * have left wireframes baked into every delivered GLB, and nothing would have failed to compile.
 *
 * The NAME is shared, never the removal. This module owns the geometry and disposes it; the
 * exporter works on a `cloneSkinned` that shares the buffers, so disposing there would free
 * what the scene on screen is still drawing with.
 */
export const OVERLAY_NAME = 'wireframe-overlay'

/**
 * The edges drawn over a shaded mesh, for the one mode a material cannot express.
 *
 * Built on demand and thrown away with the mode: a `WireframeGeometry` is its own buffer, and
 * keeping one alive per mesh of an imported model would cost the scene twice its geometry for a
 * mode nobody left on.
 */
export function applyWireOverlay(object: Object3D, on: boolean, material: Material): void {
  // Collected first: `traverse` walks what it is given, and adding a child mid-walk would visit
  // the overlay just added, then the one added to it.
  const meshes: Mesh[] = []
  const overlays: Object3D[] = []
  object.traverse(child => {
    if (child.name === OVERLAY_NAME) overlays.push(child)
    else if (child instanceof Mesh) meshes.push(child)
  })

  for (const overlay of overlays) {
    if (overlay instanceof LineSegments) overlay.geometry.dispose()
    overlay.removeFromParent()
  }
  if (!on) return

  for (const mesh of meshes) {
    const edges = new LineSegments(new WireframeGeometry(mesh.geometry), material)
    edges.name = OVERLAY_NAME
    // Decoration, and kept out of everything that reads the scene as content. The ray above all:
    // a line is met within a whole world unit of itself, so left pickable the overlay wraps every
    // edge in a halo that size, and a click into the void beside a cube would select the cube.
    edges.castShadow = false
    edges.receiveShadow = false
    edges.raycast = () => {}
    mesh.add(edges)
  }
}

/**
 * How far a camera has to stand for something that size to fill its view, plus a margin so the
 * edges are not flush against the frame.
 *
 * A constant step framed a studio primitive and stood *inside* a fifty-unit model. That went
 * unseen while an orthographic frustum ignored the move altogether — and became the whole of what
 * framing does the moment it stopped ignoring it.
 */
export function framingDistance(halfSize: number, fieldOfView: number): number {
  return (
    (Math.max(halfSize, MIN_FRAMED_HALF) / Math.tan((fieldOfView * Math.PI) / 360)) * FRAME_MARGIN
  )
}

/** A point light and an empty group have no size at all, and would otherwise ask for distance nil. */
const MIN_FRAMED_HALF = 0.5

const FRAME_MARGIN = 1.2

/** Where to stand, and what to look at, so a selection fills the view. */
export type Framing = { target: Vector3; position: Vector3 }

/**
 * The whole of what framing decides. Its own function because `frameSelection` needs mounted orbit
 * controls, which jsdom cannot give — leaving the decision inside it left it measured by nothing.
 */
export function framingPlacement(objects: readonly Object3D[], fieldOfView: number): Framing {
  const bounds = new Box3()
  for (const object of objects) bounds.expandByObject(object)

  // A selection of lights and empty groups encloses no box at all, and their placements still
  // average to somewhere worth looking at.
  const empty = bounds.isEmpty()
  const target = empty ? centreOf(objects, new Vector3()) : bounds.getCenter(new Vector3())
  const size = empty ? new Vector3() : bounds.getSize(new Vector3())
  const distance = framingDistance(Math.max(size.x, size.y, size.z) / 2, fieldOfView)

  return { target, position: target.clone().addScaledVector(FRAME_FROM, distance) }
}

/** Where framing stands from what it frames — the studio's three-quarter view, distance apart. */
const FRAME_FROM = new Vector3(4, 4, 4).normalize()
