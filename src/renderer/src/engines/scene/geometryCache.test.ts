import { describe, expect, it, vi } from 'vitest'
import type { GeometryDescriptor } from '@shared/domain/geometry'
import { createGeometryCache } from './geometryCache'

const BOX: GeometryDescriptor = { kind: 'box', width: 1, height: 1, depth: 1 }

describe('createGeometryCache', () => {
  it('lends one shape to every node wearing it', () => {
    const cache = createGeometryCache()

    // Ten thousand copies of one shape were ten thousand uploads: 226 MB for a 32×16 sphere.
    expect(cache.acquire(BOX, 1)).toBe(cache.acquire(BOX, 1))
  })

  it('reads the tiling as part of the shape, since the repeat lives in the UVs', () => {
    const cache = createGeometryCache()

    expect(cache.acquire(BOX, 1)).not.toBe(cache.acquire(BOX, 4))
  })

  it('keeps a shape a second holder still wears', () => {
    const cache = createGeometryCache()
    const geometry = cache.acquire(BOX, 1)
    cache.acquire(BOX, 1)
    const dispose = vi.spyOn(geometry, 'dispose')

    cache.release(geometry)

    // The defect this guards: freeing under a neighbour empties its screen with every gate green.
    expect(dispose).not.toHaveBeenCalled()
    expect(cache.acquire(BOX, 1)).toBe(geometry)
  })

  it('frees a shape the last holder lets go of', () => {
    const cache = createGeometryCache()
    const geometry = cache.acquire(BOX, 1)
    const dispose = vi.spyOn(geometry, 'dispose')

    cache.release(geometry)

    expect(dispose).toHaveBeenCalled()
    expect(cache.acquire(BOX, 1)).not.toBe(geometry)
  })

  it('ignores a release of a shape it has already dropped', () => {
    const cache = createGeometryCache()
    const gone = cache.acquire(BOX, 1)
    cache.release(gone)
    const rebuilt = cache.acquire(BOX, 1)
    const dispose = vi.spyOn(rebuilt, 'dispose')

    cache.release(gone)

    // The key of a dropped shape used to outlive it, so a second release landed its decrement on
    // the entry since built for the same descriptor — freeing it under the meshes wearing it.
    expect(dispose).not.toHaveBeenCalled()
    expect(cache.owns(gone)).toBe(false)
  })

  it('answers for what it lends, and for nothing else', () => {
    const cache = createGeometryCache()
    const lent = cache.acquire(BOX, 1)
    const stranger = createGeometryCache().acquire(BOX, 1)

    expect(cache.owns(lent)).toBe(true)
    expect(cache.owns(stranger)).toBe(false)
  })

  it('frees every shape it still lends when the engine goes', () => {
    const cache = createGeometryCache()
    const geometry = cache.acquire(BOX, 1)
    const dispose = vi.spyOn(geometry, 'dispose')

    cache.dispose()

    expect(dispose).toHaveBeenCalled()
  })
})
