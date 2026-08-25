import { Matrix4 } from 'three'
import { csgPartOf, type CsgGraph, type CsgOperation, type CsgPart } from '@shared/domain/csg'
import type { Transform } from '@shared/domain/transform'
import { matrixOfTransform, transformOfMatrix } from './csgMatrix'
import type { SceneNode } from '../scene/sceneState'

/**
 * A node whose shape a cut can read. A light has none, a model's lives in a file this side cannot
 * describe, and a group is a transform.
 *
 * A SOLID is not one either, and that is a refusal rather than an omission: the flat list of
 * steps holds no nested recipe, so folding one in would silently keep its base brush and drop
 * every cut already made in it. Separate it first, or weld the pieces.
 */
export type CarvableNode = Extract<SceneNode, { type: 'mesh' }>

export function isCarvable(node: SceneNode): node is CarvableNode {
  return node.type === 'mesh'
}

/**
 * Whether a selection can be folded at all — two shapes at the very least.
 *
 * Read by the toolbar to leave its buttons inert AND by `carveNodes` to refuse: written once, so
 * a button that looks live can never be a click that does nothing.
 */
export function canCarve(picked: readonly SceneNode[]): boolean {
  // EVERY node must carry a shape, not merely two of them. Filtering instead of refusing dropped
  // a selected solid without a word — and through the MCP door it silently promoted the SECOND
  // id to matter, cutting something nobody asked for.
  return picked.length >= 2 && picked.every(isCarvable)
}

/** One solid at a time: two would put back two sets of brushes with no way to tell them apart. */
export function canSeparate(picked: readonly SceneNode[]): boolean {
  return picked.length === 1 && picked[0]?.type === 'carved'
}

/**
 * The recipe for cutting the tools out of the matter — "pierce THIS with THAT", the order a hand
 * selects in. Which node is the matter is the CALLER's to decide, and the signature says so.
 *
 * Every tool is rewritten into the matter's own frame, so the solid can then be moved, turned
 * and scaled as one and its brushes follow.
 */
export function carveGraph(
  matter: CarvableNode,
  tools: readonly CarvableNode[],
  operation: CsgOperation,
  all: readonly SceneNode[],
): CsgGraph {
  // Built once and passed down: `worldOf` walks it per node, and rebuilding it there cost a
  // full sweep of the scene per tool.
  const byId = new Map(all.map(node => [node.id, node]))
  // The matter's PLACEMENT, without its scale — and that is what keeps every brush a clean TRS.
  // `Matrix4.decompose` only describes a matrix free of shear, and inverting a non-uniform scale
  // into a turned tool produces exactly that shear: measured at 2.09 units of drift on a wall
  // scaled (4, 3, 0.2) with a tool turned 30°. An isometry composed with any TRS stays a TRS, so
  // the scale travels in the base brush instead, where it is the matter's own and shears nothing.
  const intoMatter = placementOf(matter, byId).invert()

  return {
    base: partOf(matter, intoMatter.clone().multiply(worldOf(matter, byId))),
    steps: tools.map(tool => ({
      operation,
      part: partOf(tool, intoMatter.clone().multiply(worldOf(tool, byId))),
    })),
    // What a solid is born with. ADR-25 takes the field now and reads it later.
    collision: 'trimesh',
  }
}

function partOf(node: CarvableNode, into: Matrix4 | null): CsgPart {
  const part = csgPartOf(node.name, node.geometry, node.material)
  return into ? { ...part, transform: transformOfMatrix(into) } : part
}

/**
 * A brush put back where the solid had it standing — the solid's own placement, then the
 * brush's inside it. What `separateNode` gives each mesh it hands back.
 */
export function placedIn(outer: Transform, inner: Transform): Transform {
  return transformOfMatrix(matrixOfTransform(outer).multiply(matrixOfTransform(inner)))
}

/**
 * Where a node stands, its own scale left out — the frame a solid is given. Its parents' scales
 * are still composed in: a matter hanging under a non-uniformly scaled group is the one case
 * this does not straighten, and it is written in ADR-25 rather than silently wrong.
 */
function placementOf(node: SceneNode, byId: ReadonlyMap<string, SceneNode>): Matrix4 {
  return worldOf(node, byId).multiply(
    new Matrix4().makeScale(
      1 / node.transform.scale.x,
      1 / node.transform.scale.y,
      1 / node.transform.scale.z,
    ),
  )
}

/** Where a node stands in the scene, its parents composed in. */
function worldOf(node: SceneNode, byId: ReadonlyMap<string, SceneNode>): Matrix4 {
  const world = new Matrix4()

  // No visited set: `canReparent` refuses a circular parent, and the studio's other walk of this
  // same chain does without one too.
  let walker: SceneNode | undefined = node
  while (walker) {
    world.premultiply(matrixOfTransform(walker.transform))
    walker = walker.parentId === null ? undefined : byId.get(walker.parentId)
  }
  return world
}
