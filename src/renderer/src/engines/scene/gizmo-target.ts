import type { Object3D } from 'three'
import { canRotate, type SceneNodeType } from './scene-state'

/** `select` clicks without arming a gizmo — the mode you come back to. */
export type TransformMode = 'select' | 'translate' | 'rotate' | 'scale'

/** Which frame the gizmo's handles line up with: the world's axes, or the object's own. */
export type TransformSpace = 'world' | 'local'

/**
 * What a handle should aim at. Its own type because the decision is a rule of the studio, while
 * attaching is three.js plumbing — and a mounted renderer, which no test can build without WebGL.
 */
export type GizmoTarget =
  | { kind: 'none' }
  | { kind: 'object'; object: Object3D }
  | { kind: 'pivot'; objects: readonly Object3D[]; anchor: Object3D | undefined }

/**
 * Where the handles go for a selection, or nowhere.
 *
 * A rotate handle over a selection nothing would turn is refused: the studio does not offer a
 * control without an effect — the same reason a sprite is shown no shadow box. A mixed selection
 * keeps its handle, because turning it carries the sprite through space, and that does show.
 */
export function gizmoTargetFor(
  mode: TransformMode,
  space: TransformSpace,
  selected: readonly Object3D[],
  nodeOf: (object: Object3D) => { type: SceneNodeType } | undefined,
): GizmoTarget {
  if (mode === 'select') return { kind: 'none' }

  const [first] = selected
  if (!first) return { kind: 'none' }

  const turns = (object: Object3D): boolean => {
    const node = nodeOf(object)
    // An object the engine cannot name is not a reason to withhold the handle.
    return !node || canRotate(node)
  }
  if (mode === 'rotate' && !selected.some(turns)) return { kind: 'none' }

  // One node attaches straight to its object: routing a single move through the pivot would
  // round-trip its transform through two matrices for nothing.
  if (selected.length === 1) return { kind: 'object', object: first }

  // The anchor is the last node picked, and in the local frame it is what the handles line up
  // with — a group has no orientation of its own to offer.
  return {
    kind: 'pivot',
    objects: selected,
    anchor: space === 'local' ? selected.at(-1) : undefined,
  }
}
