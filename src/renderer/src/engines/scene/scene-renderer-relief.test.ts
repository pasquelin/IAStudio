// @vitest-environment jsdom
import { Object3D } from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { PackedReliefChunk } from '@shared/domain/relief'
import type { ReliefSurface } from './reliefSurface'
import type { ReliefDiskStroke, ReliefSculptor } from './reliefSculptor'
import { SceneRenderer } from './SceneRenderer'

describe('relief sculpting through the scene renderer', () => {
  it('sends a loaded stroke to the sculpt worker and publishes its changed chunks', async () => {
    const source = {
      samples: { width: 2, height: 2, values: new Float32Array(4) },
      extent: {
        origin: { x: 0, z: 0 },
        size: { x: 1, z: 1 },
        elevation: { min: 0, max: 1 },
      },
      grain: 1,
      sculpt: undefined,
    }
    const changed: PackedReliefChunk[] = [{ column: 0, row: 0, payload: 'AAAAAA==' }]
    const strokes: ReliefDiskStroke[] = []
    const relief: ReliefSurface = {
      object: new Object3D(),
      sync: vi.fn(),
      meshOf: vi.fn(),
      sculptSource: vi.fn(() => source),
      dispose: vi.fn(),
    }
    const sculptor: ReliefSculptor = {
      raiseDisk: async stroke => {
        strokes.push(stroke)
        return changed
      },
      note: vi.fn(),
      dispose: vi.fn(),
    }
    const published = vi.fn()
    const renderer = new SceneRenderer({
      onSelect: vi.fn(),
      onTransform: vi.fn(),
      onReliefSculpt: published,
      relief,
      createReliefSculptor: () => sculptor,
    })
    const disk = { x: 0.5, z: 0.25, radius: 0.2 }

    await expect(renderer.raiseReliefDisk('terrain', 'hills', disk, 0.1)).resolves.toBe(true)

    expect(strokes).toEqual([{ ...source, disk, amount: 0.1 }])
    expect(published).toHaveBeenCalledWith('terrain', 'hills', changed)
    renderer.dispose()
  })
})
