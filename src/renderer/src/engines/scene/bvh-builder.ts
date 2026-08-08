import type { BufferGeometry, Mesh } from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import type { BvhIndex, BvhRequest, BvhResponse } from './bvh-message'

export type BvhBuilder = {
  /**
   * Gives a mesh the tree that makes a click on it cheap. Resolves once it is in place, or
   * straight away for a geometry that already has one or is too light to be worth a build.
   */
  accelerate: (mesh: Mesh) => Promise<void>
  /** The engine is going away: the worker with it, and whatever it had not answered yet. */
  dispose: () => void
}

/**
 * Below this, walking the triangles is already faster than the tree would be to build. Measured
 * in `scene-picking.bench.ts`: three models of 32k triangles cost 1.9 ms a click, which is a
 * frame; a studio primitive is thirty triangles and costs nothing.
 */
export const WORTH_A_TREE = 20_000

/**
 * One worker, not a pool. CLAUDE.md invariant 6 bounds a pool at `hardwareConcurrency − 2`, and
 * one is within it: what the invariant is about is that the build leaves the UI thread, and a
 * second worker only helps a scene importing several dense models at the very same moment.
 */
export function createBvhBuilder(spawn: () => Worker): BvhBuilder {
  let worker: Worker | null = null
  let nextId = 0
  const pending = new Map<number, (response: BvhResponse | null) => void>()
  /** Builds already asked for. Two nodes of one model share their geometry — and their tree. */
  const building = new Map<BufferGeometry, Promise<void>>()

  const workerOf = (): Worker => {
    if (worker) return worker

    const started = spawn()
    started.addEventListener('message', (event: MessageEvent<BvhResponse>) => {
      const resolve = pending.get(event.data.id)
      pending.delete(event.data.id)
      resolve?.(event.data)
    })
    worker = started
    return started
  }

  const build = async (mesh: Mesh, geometry: BufferGeometry): Promise<void> => {
    const id = (nextId += 1)
    const request: BvhRequest = {
      id,
      // Copies: the buffers are transferred, and the live geometry has to keep drawing while the
      // build runs. What comes back replaces the index anyway.
      position: positionsOf(geometry),
      index: indexOf(geometry),
    }

    const response = await new Promise<BvhResponse | null>(resolve => {
      pending.set(id, resolve)
      workerOf().postMessage(request, transferablesOf(request))
    })

    // The mesh may have been thrown away while the tree was being built — the same race a
    // texture runs, and the same answer: what nobody wants any more is dropped. `null` is the
    // engine going: an awaited promise nobody answers never ends.
    if (!response || mesh.geometry !== geometry) return
    // A variable, not a literal: the library's own type omits the `version` its code reads.
    geometry.boundsTree = MeshBVH.deserialize(response.bvh, geometry)
  }

  return {
    accelerate: mesh => {
      const geometry = mesh.geometry
      if (geometry.boundsTree || triangleCount(geometry) < WORTH_A_TREE) return Promise.resolve()

      // Asked for once per geometry: duplicating a model gives two nodes one geometry, and both
      // would otherwise send the same megabytes across for the same tree.
      const started = building.get(geometry)
      if (started) return started

      const running = build(mesh, geometry).finally(() => building.delete(geometry))
      building.set(geometry, running)
      return running
    },

    dispose: () => {
      worker?.terminate()
      worker = null
      for (const resolve of pending.values()) resolve(null)
      pending.clear()
      building.clear()
    },
  }
}

function triangleCount(geometry: BufferGeometry): number {
  const index = geometry.getIndex()
  return (index ? index.count : (geometry.getAttribute('position')?.count ?? 0)) / 3
}

/**
 * The positions as three tight floats each, read attribute-wise rather than off the underlying
 * array. `GLTFLoader` interleaves whenever a file's byte stride says to, and an interleaved
 * attribute's `array` is the *whole* buffer — normals and uvs among the coordinates. Handed over
 * as positions it builds a tree of a mesh that does not exist, and clicks then miss what they hit.
 */
function positionsOf(geometry: BufferGeometry): Float32Array {
  const position = geometry.getAttribute('position')
  const { array } = position
  // Already three floats each and nothing between them: the copy is a memcpy.
  if (array instanceof Float32Array && array.length === position.count * 3) return array.slice()

  const tight = new Float32Array(position.count * 3)
  for (let at = 0; at < position.count; at += 1) {
    tight[at * 3] = position.getX(at)
    tight[at * 3 + 1] = position.getY(at)
    tight[at * 3 + 2] = position.getZ(at)
  }
  return tight
}

/**
 * The index as 32-bit values, whatever width it was written in. Widened rather than refused: an
 * index of any other type made the worker take the geometry for a non-indexed one, build a tree
 * of a different mesh, and hand back an index of another length — which `deserialize` then writes
 * over the live one for as far as it reaches, silently, leaving the rest of the triangles as they
 * were. A `SHORT` accessor is all it takes, and glTF allows one.
 */
function indexOf(geometry: BufferGeometry): BvhIndex | null {
  const index = geometry.getIndex()
  if (!index) return null

  const { array } = index
  if (array instanceof Uint32Array || array instanceof Uint16Array) return array.slice()

  const widened = new Uint32Array(index.count)
  for (let at = 0; at < index.count; at += 1) widened[at] = index.getX(at)
  return widened
}

function transferablesOf(request: BvhRequest): Transferable[] {
  const buffers: Transferable[] = [request.position.buffer]
  if (request.index) buffers.push(request.index.buffer)
  return buffers
}
