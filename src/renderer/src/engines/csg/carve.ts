import { Matrix4 } from 'three'
import { csgPartOf, type CsgGraph, type CsgOperation, type CsgPart } from '@shared/domain/csg'
import type { Transform } from '@shared/domain/transform'
import { matrixOfTransform, transformOfMatrix } from './csgMatrix'
import { shapeVolume } from './shapeVolume'
import type { SceneNode } from '../scene/sceneState'

/**
 * A node whose shape a cut can read. A light has none, a model's lives in a file this side cannot
 * describe, and a group is a transform — only these two carry one.
 *
 * A SOLID is one: its recipe travels whole into the brush, so chaining booleans keeps every cut
 * already made. `CsgPart` is recursive for this.
 */
export type CarvableNode = Extract<SceneNode, { type: 'mesh' } | { type: 'carved' }>

export function isCarvable(node: SceneNode): node is CarvableNode {
  return node.type === 'mesh' || node.type === 'carved'
}

/** Marked as a tool. Absent is the common case and means matter — see `carvePlan`. */
export function isNegative(node: SceneNode): boolean {
  return isCarvable(node) && node.negative === true
}

/**
 * Whether a selection can be folded at all — two shapes at the very least.
 *
 * Read by the toolbar to leave its buttons inert AND by `carveNodes` to refuse: written once, so
 * a button that looks live can never be a click that does nothing.
 */
export function canCarve(picked: readonly SceneNode[]): picked is readonly CarvableNode[] {
  // EVERY node must carry a shape, not merely two of them. Filtering instead of refusing dropped
  // a selected solid without a word — and through the MCP door it silently promoted the SECOND
  // id to matter, cutting something nobody asked for.
  return picked.length >= 2 && picked.every(isCarvable)
}

/** Marking reaches one shape as readily as ten, unlike a fold, which needs two. */
export function canNegate(picked: readonly SceneNode[]): boolean {
  return picked.some(isCarvable)
}

/** One solid at a time: two would put back two sets of brushes with no way to tell them apart. */
export function canSeparate(picked: readonly SceneNode[]): boolean {
  return picked.length === 1 && picked[0]?.type === 'carved'
}

/** The same, and a solid of ONE brush has no other way to run — see `invertCarve`. */
export function canInvertCarve(picked: readonly SceneNode[]): boolean {
  const solid = picked.length === 1 ? picked[0] : undefined
  return solid?.type === 'carved' && solid.carved.steps.length > 0
}

/** One brush of a fold, and what it does to what came before it. */
export type CarveTool = { node: CarvableNode; operation: CsgOperation }

export type CarvePlan = { matter: CarvableNode; tools: readonly CarveTool[] }

const EMPTY_INDEX: ReadonlyMap<string, SceneNode> = new Map()

/**
 * What a fold needs to know of the scene, read ONCE: the shapes picked, in scene order, and the
 * index `worldOf` walks. The election and the recipe each swept the whole scene for themselves.
 */
export type CarveScene = { picked: readonly CarvableNode[]; byId: ReadonlyMap<string, SceneNode> }

export function carveScene(picked: readonly SceneNode[], all: readonly SceneNode[]): CarveScene {
  // Scene order, and it reaches the STEPS as much as the election: the recipe keeps them and
  // `separateNode` hands them back, so two hands picking the same shapes write the same document.
  // The `Set` also DEDUPES — two ids naming one node would otherwise fold a solid cutting nothing.
  const chosen = new Set<SceneNode>(picked)
  const inScene: CarvableNode[] = []
  let hangs = false
  for (const node of all) {
    if (!chosen.has(node) || !isCarvable(node)) continue
    inScene.push(node)
    hangs = hangs || node.parentId !== null
  }

  // Only when something hangs: `worldOf` walks parents, and a flat selection needs no index.
  return { picked: inScene, byId: hangs ? new Map(all.map(one => [one.id, one])) : EMPTY_INDEX }
}

/**
 * Which shape is the matter, which are the tools, and what each does — read off the shapes, never
 * off the order they were clicked in. `null` when `matterId` names nothing that could be one.
 *
 * A shape MARKED negative is always a tool, and always SUBTRACTED whatever the button says, so a
 * union holding one pierces. What is left is elected by VOLUME, the biggest being the matter.
 * Measured on a wall 4 × 3 × 0.2 and a unit cube inside it: the wall pierced is 68 triangles of
 * signed volume 2.20, the cube taken for the matter a 44-triangle chip of 0.80.
 */
export function carvePlan(
  scene: CarveScene,
  operation: CsgOperation,
  matterId?: string,
): CarvePlan | null {
  const inScene = scene.picked
  const plain = inScene.filter(node => !isNegative(node))
  // Everything marked leaves nobody to carve. The marks are dropped rather than folding to an
  // empty solid — Roblox refuses the gesture outright, and a refusal here would be a live-looking
  // button doing nothing.
  const candidates = plain.length > 0 ? plain : inScene
  const negatives = plain.length > 0 ? inScene.filter(isNegative) : []

  // Refused rather than quietly elected by volume: a client that names a matter outside the
  // selection means the OTHER cut, and the silent version of this is the defect the lot exists
  // for. Searched among ALL the picked shapes, marks included — saying it outright outranks them.
  const forced = matterId === undefined ? null : inScene.find(node => node.id === matterId)
  if (forced === undefined) return null

  const matter = forced ?? biggest(candidates, scene.byId)
  if (!matter) return null

  const tools = [
    ...candidates.filter(node => node !== matter).map(node => ({ node, operation })),
    ...negatives
      .filter(node => node !== matter)
      .map((node): CarveTool => ({ node, operation: 'subtract' })),
  ]
  // One shape left after the dedupe: a fold of one is a solid that cuts nothing, and the node it
  // replaced would go. `canCarve` cannot see it — it counts ids, and two of them may be one node.
  return tools.length === 0 ? null : { matter, tools }
}

/**
 * The matter when no mark says which: the biggest. Wrong where the tool outweighs what it pierces
 * — a cutter 1.2 × 1.6 × 2 makes 3.84 against a 4 × 3 × 0.3 wall's 3.6 — and KEPT so (Alban,
 * 2026-08-26). Do not swap it for another rule without asking again.
 */
function biggest(
  nodes: readonly CarvableNode[],
  byId: ReadonlyMap<string, SceneNode>,
): CarvableNode | undefined {
  // The election is a foregone conclusion below two, and measuring a shape costs a whole
  // geometry — which is exactly the Negate gesture's own case: one mark, one candidate left.
  if (nodes.length < 2) return nodes[0]

  let held: CarvableNode | undefined
  let most = -1

  for (const node of nodes) {
    const volume = worldVolume(node, byId)
    // Strictly greater, so two shapes of equal matter keep the FIRST — and the list reaching here
    // is in scene order, which is the whole point.
    if (volume > most) {
      held = node
      most = volume
    }
  }
  return held
}

/** What a shape holds once its own placement and every parent's are composed in. */
function worldVolume(node: CarvableNode, byId: ReadonlyMap<string, SceneNode>): number {
  const shape = node.type === 'mesh' ? node.geometry : node.carved
  return shapeVolume(shape) * Math.abs(worldOf(node, byId).determinant())
}

/**
 * The recipe for cutting the tools out of the matter — "pierce THIS with THAT". Which node is the
 * matter is `carvePlan`'s to decide, never the order a hand happened to click in.
 *
 * Every tool is rewritten into the matter's own frame, so the solid can then be moved, turned
 * and scaled as one and its brushes follow.
 */
export function carveGraph(
  matter: CarvableNode,
  tools: readonly CarveTool[],
  byId: ReadonlyMap<string, SceneNode>,
): CsgGraph {
  // The matter's PLACEMENT, without its scale — and that is what keeps every brush a clean TRS.
  // `Matrix4.decompose` only describes a matrix free of shear, and inverting a non-uniform scale
  // into a turned tool produces exactly that shear: measured at 2.09 units of drift on a wall
  // scaled (4, 3, 0.2) with a tool turned 30°. An isometry composed with any TRS stays a TRS, so
  // the scale travels in the base brush instead, where it is the matter's own and shears nothing.
  const intoMatter = placementOf(matter, byId).invert()

  return {
    base: partOf(matter, intoMatter.clone().multiply(worldOf(matter, byId))),
    steps: tools.map(tool => ({
      operation: tool.operation,
      part: partOf(tool.node, intoMatter.clone().multiply(worldOf(tool.node, byId))),
    })),
    // What a solid is born with. ADR-25 takes the field now and reads it later.
    collision: 'trimesh',
  }
}

function partOf(node: CarvableNode, into: Matrix4 | null): CsgPart {
  // A solid hands over its whole recipe, a mesh its shape — see `CsgPart.geometry`.
  const shape = node.type === 'mesh' ? node.geometry : node.carved
  const part = csgPartOf(node.name, shape, node.material)
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
