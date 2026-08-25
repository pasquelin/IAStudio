import type { BufferGeometry } from 'three'
import {
  ADDITION,
  Brush,
  Evaluator,
  INTERSECTION,
  SUBTRACTION,
  type CSGOperation,
} from 'three-bvh-csg'
import { isCsgGraph, type CsgGraph, type CsgOperation, type CsgPart } from '@shared/domain/csg'
import { geometryFor } from '../scene/threeFactory'
import { matrixOfTransform } from './csgMatrix'
import type { CsgMesh } from './csgMessage'

const OPERATIONS: Record<CsgOperation, CSGOperation> = {
  subtract: SUBTRACTION,
  unite: ADDITION,
  intersect: INTERSECTION,
}

/** One evaluator for the life of the module: it pools triangles and half-edge maps a fresh one
 * would rebuild on every cut. */
const evaluator = new Evaluator()
// One coherent piece, one material. Groups would hand back a material array and a draw call per
// group, where a carved node wears exactly one `MaterialDescriptor`.
evaluator.useGroups = false
evaluator.attributes = ['position', 'normal', 'uv']

/**
 * Cuts solids out of solids. Apart from the worker that calls it so the arithmetic can be
 * measured in Node — the worker is a message adapter and nothing else, and this is where the one
 * defect a Worker hides was found: a brush scaled by its matrix came out unscaled.
 */
export function evaluateGraph(graph: CsgGraph): CsgMesh {
  return meshOf(geometryOfGraph(graph))
}

/** The recipe as one geometry. Recursive: a brush may itself be a solid — see `CsgPart`. */
function geometryOfGraph(graph: CsgGraph): BufferGeometry {
  let result = brushOf(graph.base)
  for (const step of graph.steps) {
    result = evaluator.evaluate(result, brushOf(step.part), OPERATIONS[step.operation])
  }
  return result.geometry
}

/**
 * 🛑 The placement is BAKED into the geometry, never left on the brush's matrix.
 *
 * `three-bvh-csg` reads the position but NOT the scale off a brush: measured, a pillar scaled
 * (1, 6, 1) evaluated one unit tall instead of six, and every gate was green on it.
 */
function brushOf(part: CsgPart): Brush {
  const geometry = isCsgGraph(part.geometry)
    ? geometryOfGraph(part.geometry)
    : geometryFor(part.geometry)
  geometry.applyMatrix4(matrixOfTransform(part.transform))

  const brush = new Brush(geometry)
  brush.updateMatrixWorld(true)
  // Prepared here rather than inside the evaluator, so a brush that cannot be fails on its own
  // line — where the message names which one.
  brush.prepareGeometry()
  return brush
}

function meshOf(geometry: BufferGeometry): CsgMesh {
  const index = geometry.getIndex()?.array

  return {
    position: floatsOf(geometry, 'position', 3),
    normal: floatsOf(geometry, 'normal', 3),
    uv: floatsOf(geometry, 'uv', 2),
    // `slice` on the width it already has: the evaluator always writes 32-bit, and `from` would
    // walk it through an iterator where a memcpy does.
    index: index ? (index instanceof Uint32Array ? index.slice() : Uint32Array.from(index)) : null,
  }
}

/**
 * One attribute as tight floats — a COPY always: the buffers are transferred, and an attribute
 * the evaluator still owns would be detached under it, leaving the next cut to read a
 * zero-length array and hand back an empty solid, silently.
 */
function floatsOf(geometry: BufferGeometry, name: string, size: number): Float32Array {
  const attribute = geometry.getAttribute(name)
  if (!attribute) return new Float32Array(0)

  const { array } = attribute
  // The evaluator writes tight `Float32Array`s, so this is the path taken — and it is a memcpy
  // against three accessor calls a vertex. Same fast path `bvhBuilder.positionsOf` holds.
  if (array instanceof Float32Array && array.length === attribute.count * size) return array.slice()

  const tight = new Float32Array(attribute.count * size)
  for (let at = 0; at < attribute.count; at += 1) {
    tight[at * size] = attribute.getX(at)
    tight[at * size + 1] = attribute.getY(at)
    if (size > 2) tight[at * size + 2] = attribute.getZ(at)
  }
  return tight
}

export function transferablesOf(mesh: CsgMesh): Transferable[] {
  const buffers: Transferable[] = [mesh.position.buffer, mesh.normal.buffer, mesh.uv.buffer]
  if (mesh.index) buffers.push(mesh.index.buffer)
  return buffers
}
