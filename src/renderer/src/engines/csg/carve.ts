import { Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { csgPartOf, type CsgGraph, type CsgOperation, type CsgPart } from '@shared/domain/csg'
import type { Transform } from '@shared/domain/transform'
import type { SceneNode } from '../scene/sceneState'

/**
 * A node whose shape a cut can read. A light has none, a model's lives in a file this side
 * cannot describe, and a group is a transform — only these two carry a descriptor.
 */
export type CarvableNode = Extract<SceneNode, { type: 'mesh' } | { type: 'carved' }>

export function isCarvable(node: SceneNode): node is CarvableNode {
  return node.type === 'mesh' || node.type === 'carved'
}

/**
 * The recipe for cutting the tools out of the matter.
 *
 * The FIRST node is the matter and the rest are the tools — "pierce THIS with THAT", the order a
 * hand selects in. `null` when fewer than two nodes can be cut, which is what the toolbar leaves
 * a button inert for.
 *
 * Every tool is rewritten into the matter's own frame, so the solid can then be moved, turned
 * and scaled as one and its brushes follow.
 */
export function carveGraph(
  nodes: readonly SceneNode[],
  operation: CsgOperation,
  all: readonly SceneNode[],
): CsgGraph | null {
  const [matter, ...tools] = nodes.filter(isCarvable)
  if (!matter || tools.length === 0) return null

  const intoMatter = worldOf(matter, all).invert()

  return {
    base: partOf(matter, null),
    steps: tools.map(tool => ({
      operation,
      part: partOf(tool, intoMatter.clone().multiply(worldOf(tool, all))),
    })),
    // What a solid is born with. ADR-25 takes the field now and reads it later.
    collision: 'trimesh',
  }
}

/**
 * A node as one brush. A carved node contributes its BASE brush and nothing else: cutting a
 * solid out of a solid would need the whole recipe nested, which the flat list of steps cannot
 * hold — and a nested graph is a shape this toolbar has no gesture for.
 */
function partOf(node: CarvableNode, into: Matrix4 | null): CsgPart {
  const geometry = node.type === 'mesh' ? node.geometry : node.carved.base.geometry
  const part = csgPartOf(node.name, geometry)
  return into ? { ...part, transform: transformOf(into) } : part
}

/**
 * A brush put back where the solid had it standing — the solid's own placement, then the
 * brush's inside it. What `separateNode` gives each mesh it hands back.
 */
export function placedIn(outer: Transform, inner: Transform): Transform {
  return transformOf(matrixOf(outer).multiply(matrixOf(inner)))
}

/** Where a node stands in the scene, its parents composed in. */
function worldOf(node: SceneNode, all: readonly SceneNode[]): Matrix4 {
  const byId = new Map(all.map(candidate => [candidate.id, candidate]))
  const world = new Matrix4()

  let walker: SceneNode | undefined = node
  const seen = new Set<string>()
  while (walker && !seen.has(walker.id)) {
    seen.add(walker.id)
    world.premultiply(matrixOf(walker.transform))
    walker = walker.parentId === null ? undefined : byId.get(walker.parentId)
  }
  return world
}

function matrixOf(transform: Transform): Matrix4 {
  return new Matrix4().compose(
    new Vector3(transform.position.x, transform.position.y, transform.position.z),
    new Quaternion().setFromEuler(
      new Euler(transform.rotation.x, transform.rotation.y, transform.rotation.z),
    ),
    new Vector3(transform.scale.x, transform.scale.y, transform.scale.z),
  )
}

function transformOf(matrix: Matrix4): Transform {
  const position = new Vector3()
  const quaternion = new Quaternion()
  const scale = new Vector3()
  matrix.decompose(position, quaternion, scale)
  const rotation = new Euler().setFromQuaternion(quaternion)

  return {
    position: { x: position.x, y: position.y, z: position.z },
    rotation: { x: rotation.x, y: rotation.y, z: rotation.z },
    scale: { x: scale.x, y: scale.y, z: scale.z },
  }
}
