/// <reference lib="webworker" />
import {
  ADDITION,
  Brush,
  Evaluator,
  INTERSECTION,
  SUBTRACTION,
  type CSGOperation,
} from 'three-bvh-csg'
import type { BufferGeometry } from 'three'
import { messageOf } from '@shared/guards'
import type { CsgOperation, CsgPart } from '@shared/domain/csg'
import { geometryFor } from '../scene/threeFactory'
import type { CsgMesh, CsgRequest, CsgResponse } from './csgMessage'

declare const self: DedicatedWorkerGlobalScope

const OPERATIONS: Record<CsgOperation, CSGOperation> = {
  subtract: SUBTRACTION,
  unite: ADDITION,
  intersect: INTERSECTION,
}

/**
 * Cuts solids out of solids, off the UI thread — CLAUDE.md invariant 6, and ADR-25 for why the
 * evaluation happens on release of a gesture rather than during it.
 *
 * One evaluator for the life of the worker: it holds pooled triangles and half-edge maps that a
 * fresh one would rebuild on every cut.
 */
const evaluator = new Evaluator()
// One coherent piece, one material. Groups would hand back a material array and a draw call per
// group, where a carved node wears exactly one `MaterialDescriptor`.
evaluator.useGroups = false
evaluator.attributes = ['position', 'normal', 'uv']

self.addEventListener('message', (event: MessageEvent<CsgRequest>) => {
  const { id, graph } = event.data

  try {
    let result = brushOf(graph.base)
    for (const step of graph.steps) {
      result = evaluator.evaluate(result, brushOf(step.part), OPERATIONS[step.operation])
    }

    const mesh = meshOf(result.geometry)
    const response: CsgResponse = { id, ok: true, mesh }
    // Transferred rather than copied: a dense cut is megabytes, and copying it back would spend
    // on the UI thread exactly what the worker was there to save.
    self.postMessage(response, transferablesOf(mesh))
  } catch (error) {
    // An evaluation that raises — a degenerate brush, memory the result could not have — must
    // answer all the same: the other side holds a promise on this id and nothing else settles it.
    const failed: CsgResponse = { id, ok: false, error: messageOf(error) }
    self.postMessage(failed)
  }
})

/**
 * `prepareGeometry` builds the half-edge map the cut walks. Called here rather than left to the
 * evaluator so a brush that cannot be prepared fails on its own line, where the message says
 * which one.
 */
function brushOf(part: CsgPart): Brush {
  const brush = new Brush(geometryFor(part.geometry))
  const { position, rotation, scale } = part.transform
  brush.position.set(position.x, position.y, position.z)
  brush.rotation.set(rotation.x, rotation.y, rotation.z)
  brush.scale.set(scale.x, scale.y, scale.z)
  // The evaluator reads world matrices, and nothing in a worker ever renders to update them.
  brush.updateMatrixWorld(true)
  brush.prepareGeometry()
  return brush
}

function meshOf(geometry: BufferGeometry): CsgMesh {
  const position = floatsOf(geometry, 'position', 3)
  const index = geometry.getIndex()
  const widened = index ? Uint32Array.from(index.array) : null

  return {
    position,
    normal: floatsOf(geometry, 'normal', 3),
    uv: floatsOf(geometry, 'uv', 2),
    index: widened,
    triangles: (widened ? widened.length : position.length / 3) / 3,
  }
}

/**
 * One attribute as tight floats. `slice()` rather than the array itself: the buffers are
 * transferred, and an attribute the evaluator still owns would be detached under it — the next
 * cut on the same worker would then read a zero-length array and hand back an empty solid,
 * silently.
 */
function floatsOf(geometry: BufferGeometry, name: string, size: number): Float32Array {
  const attribute = geometry.getAttribute(name)
  if (!attribute) return new Float32Array(0)

  const tight = new Float32Array(attribute.count * size)
  for (let at = 0; at < attribute.count; at += 1) {
    tight[at * size] = attribute.getX(at)
    tight[at * size + 1] = attribute.getY(at)
    if (size > 2) tight[at * size + 2] = attribute.getZ(at)
  }
  return tight
}

function transferablesOf(mesh: CsgMesh): Transferable[] {
  const buffers: Transferable[] = [mesh.position.buffer, mesh.normal.buffer, mesh.uv.buffer]
  if (mesh.index) buffers.push(mesh.index.buffer)
  return buffers
}
