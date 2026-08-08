import { BufferAttribute, BufferGeometry, Mesh, SphereGeometry } from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import { describe, expect, it, vi } from 'vitest'
import { createBvhBuilder, WORTH_A_TREE } from './bvh-builder'
import type { BvhRequest, BvhResponse } from './bvh-message'

/**
 * A worker standing in for the real one, building the tree in place. jsdom spawns no worker, and
 * what these tests are about is the exchange around it: what is sent, what is kept, what is
 * dropped — the build itself is three-mesh-bvh's business.
 */
function scriptedWorker() {
  const sent: BvhRequest[] = []
  let reply: ((response: BvhResponse) => void) | null = null

  const worker = {
    addEventListener: (_type: string, listener: (event: MessageEvent<BvhResponse>) => void) => {
      reply = response => listener(new MessageEvent('message', { data: response }))
    },
    postMessage: (request: BvhRequest) => sent.push(request),
    terminate: vi.fn(),
  }

  // `as`: the builder calls exactly these three members of a `Worker`, and jsdom has no other.
  const spawn = vi.fn(() => worker as unknown as Worker)

  return {
    spawn,
    sent,
    terminated: worker.terminate,
    /** Answers the last request the way the real worker would, tree included. */
    settle: async () => {
      const request = sent.at(-1)
      if (!request || !reply) return

      const geometry = new BufferGeometry()
      geometry.setAttribute('position', new BufferAttribute(request.position, 3))
      if (request.index) geometry.setIndex(new BufferAttribute(request.index, 1))

      const serialized = MeshBVH.serialize(new MeshBVH(geometry))
      reply({
        id: request.id,
        bvh: {
          version: 1,
          roots: serialized.roots,
          index:
            serialized.index instanceof Uint32Array || serialized.index instanceof Uint16Array
              ? serialized.index
              : null,
          indirectBuffer: null,
        },
      })
      await Promise.resolve()
    },
  }
}

/** Dense enough to be worth a tree — a studio primitive never is. */
const dense = () => new Mesh(new SphereGeometry(1, 256, 128))
const light = () => new Mesh(new SphereGeometry(1, 8, 8))

describe('createBvhBuilder', () => {
  it('gives a dense mesh a tree', async () => {
    const scripted = scriptedWorker()
    const builder = createBvhBuilder(scripted.spawn)
    const mesh = dense()

    const done = builder.accelerate(mesh)
    await scripted.settle()
    await done

    expect(mesh.geometry.boundsTree).toBeDefined()
  })

  /**
   * The reason the whole thing exists: a tree turns a walk over every triangle into a descent.
   * Measured in `scene-picking.bench.ts`, checked here on the count three.js actually reads.
   */
  it('leaves the geometry able to answer a ray', async () => {
    const scripted = scriptedWorker()
    const builder = createBvhBuilder(scripted.spawn)
    const mesh = dense()

    const done = builder.accelerate(mesh)
    await scripted.settle()
    await done

    expect(mesh.geometry.boundsTree?.geometry).toBe(mesh.geometry)
  })

  // Thirty triangles are walked faster than a tree is built, let alone sent twice over a boundary.
  it('leaves a light mesh alone, tree unbuilt', async () => {
    const scripted = scriptedWorker()

    await createBvhBuilder(scripted.spawn).accelerate(light())

    expect(scripted.sent).toEqual([])
  })

  it('never builds a second tree for a geometry that has one', async () => {
    const scripted = scriptedWorker()
    const builder = createBvhBuilder(scripted.spawn)
    const mesh = dense()

    const done = builder.accelerate(mesh)
    await scripted.settle()
    await done
    await builder.accelerate(mesh)

    expect(scripted.sent).toHaveLength(1)
  })

  // The same race a texture runs: what nobody wants any more must not come back to life.
  it('drops a tree whose mesh changed shape while it was being built', async () => {
    const scripted = scriptedWorker()
    const builder = createBvhBuilder(scripted.spawn)
    const mesh = dense()

    const done = builder.accelerate(mesh)
    const replaced = new SphereGeometry(2, 8, 8)
    mesh.geometry = replaced
    await scripted.settle()
    await done

    expect(replaced.boundsTree).toBeUndefined()
  })

  it('sends the buffers, never the geometry', async () => {
    const scripted = scriptedWorker()

    void createBvhBuilder(scripted.spawn).accelerate(dense())

    expect(scripted.sent[0]?.position).toBeInstanceOf(Float32Array)
    expect(scripted.sent[0]).not.toHaveProperty('geometry')
  })

  it('shuts the worker down with the engine', () => {
    const scripted = scriptedWorker()
    const builder = createBvhBuilder(scripted.spawn)

    void builder.accelerate(dense())
    builder.dispose()

    expect(scripted.terminated).toHaveBeenCalled()
  })

  // A promise nobody will ever answer keeps its whole closure alive — the mesh included.
  it('lets go of a build in flight when the engine goes', async () => {
    const scripted = scriptedWorker()
    const builder = createBvhBuilder(scripted.spawn)
    const mesh = dense()

    const done = builder.accelerate(mesh)
    builder.dispose()

    await expect(done).resolves.toBeUndefined()
    expect(mesh.geometry.boundsTree).toBeUndefined()
  })

  // Duplicating a model gives two nodes one geometry: the tree is asked for once, not twice.
  it('asks for one tree when two meshes share a geometry', async () => {
    const scripted = scriptedWorker()
    const builder = createBvhBuilder(scripted.spawn)
    const first = dense()
    const second = new Mesh(first.geometry)

    const done = Promise.all([builder.accelerate(first), builder.accelerate(second)])
    await scripted.settle()
    await done

    expect(scripted.sent).toHaveLength(1)
    expect(second.geometry.boundsTree).toBeDefined()
  })

  // Nothing dense has been seen yet: a worker started at mount would cost a thread for nothing.
  it('starts no worker until something is worth accelerating', async () => {
    const spawn = vi.fn(() => scriptedWorker().spawn())

    await createBvhBuilder(spawn).accelerate(light())

    expect(spawn).not.toHaveBeenCalled()
  })
})

/**
 * A mesh worth a tree, built the way a GLB arrives: raw positions, and an index only when the
 * file carried one. Sized from the threshold itself, so raising it cannot leave these tests
 * quietly asserting the too-light path.
 */
function worthATree(positions: Float32ArrayConstructor | Float64ArrayConstructor, indexed = false) {
  const triangles = WORTH_A_TREE + 1
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new positions(triangles * 9), 3))
  if (indexed) geometry.setIndex(new BufferAttribute(new Uint8Array(triangles * 3), 1))
  return new Mesh(geometry)
}

describe('what the builder sends across', () => {
  // The build itself is irrelevant here, and a real one costs 150 ms a piece.
  it('spawns one worker however many trees it builds', () => {
    const scripted = scriptedWorker()
    const builder = createBvhBuilder(scripted.spawn)

    void builder.accelerate(dense())
    void builder.accelerate(dense())

    expect(scripted.spawn).toHaveBeenCalledTimes(1)
  })

  // The worker reads a `Float32Array` and nothing else; a wider buffer would be read as garbage.
  it('refuses a position buffer of another width', async () => {
    const scripted = scriptedWorker()

    await createBvhBuilder(scripted.spawn).accelerate(worthATree(Float64Array))

    expect(scripted.sent).toEqual([])
  })

  it('sends no index for a geometry that has none', async () => {
    const scripted = scriptedWorker()

    void createBvhBuilder(scripted.spawn).accelerate(worthATree(Float32Array))

    expect(scripted.sent[0]?.index).toBeNull()
  })

  // Only the two widths the tree is written back in travel; anything else is rebuilt from the
  // positions rather than sent as an index the worker would misread.
  it('drops an index of a width the tree cannot carry', async () => {
    const scripted = scriptedWorker()

    void createBvhBuilder(scripted.spawn).accelerate(worthATree(Float32Array, true))

    expect(scripted.sent[0]?.index).toBeNull()
  })
})
