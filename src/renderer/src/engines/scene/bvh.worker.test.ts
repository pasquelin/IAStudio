import type { BufferGeometry } from 'three'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The build, made to fail on demand. three-mesh-bvh is remarkably hard to make raise — an empty
 * geometry and an index running past its vertices both build a tree — and what is under test is
 * not whether it raises but what the worker does when it does.
 */
const build = vi.hoisted(() => ({ fails: false }))

vi.mock('three-mesh-bvh', async importOriginal => {
  const real = await importOriginal<typeof import('three-mesh-bvh')>()
  return {
    ...real,
    MeshBVH: class extends real.MeshBVH {
      constructor(geometry: BufferGeometry) {
        if (build.fails) throw new Error('out of memory')
        super(geometry)
      }
    },
  }
})

const posted: unknown[] = []

// Imported once for the file: the module registers its listener on import, and a second import
// would leave two of them answering every request.
beforeAll(async () => {
  vi.spyOn(self, 'postMessage').mockImplementation(message => {
    posted.push(message)
  })
  await import('./bvh.worker')
})

beforeEach(() => {
  build.fails = false
  posted.length = 0
})

/** A request the way `bvh-builder` sends one: buffers, never a geometry. */
function ask(id: number): void {
  const position = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])
  self.dispatchEvent(new MessageEvent('message', { data: { id, position, index: null } }))
}

describe('the BVH worker', () => {
  it('answers a tree it built', () => {
    ask(3)

    expect(posted).toMatchObject([{ id: 3, ok: true }])
  })

  /**
   * The whole point of the failure channel: before it, a build that raised posted nothing, and the
   * builder's promise on that id stayed open for the life of the window — with the geometry stuck
   * in `building`, so no later mesh sharing it ever got a tree either.
   */
  it('answers a build that raised, rather than saying nothing', () => {
    build.fails = true

    ask(4)

    expect(posted).toEqual([{ id: 4, ok: false, error: 'out of memory' }])
  })
})
