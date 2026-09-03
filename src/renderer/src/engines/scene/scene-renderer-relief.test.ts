// @vitest-environment jsdom
import { Object3D } from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { PackedReliefChunk, ReliefSculpt } from '@shared/domain/relief'
import { DEFAULT_WORLD } from '@shared/domain/scene'
import type { ReliefSurface } from './reliefSurface'
import type { ReliefDiskStroke, ReliefSculptor } from './reliefSculptor'
import { SceneRenderer } from './SceneRenderer'

const SCULPT: ReliefSculpt = { chunks: [{ column: 0, row: 0, payload: 'AAAAAA==' }] }
const CHANGED: PackedReliefChunk[] = [{ column: 0, row: 0, payload: 'AQAAAA==' }]
const DISK = { x: 0.5, z: 0.25, radius: 0.2 }

function reliefStub(): ReliefSurface {
  return {
    object: new Object3D(),
    sync: vi.fn(),
    meshOf: vi.fn(),
    sculptSource: vi.fn(() => ({
      samples: { width: 2, height: 2, values: new Float32Array(4) },
      extent: { origin: { x: 0, z: 0 }, size: { x: 1, z: 1 }, elevation: { min: 0, max: 1 } },
      grain: 1,
      sculpt: SCULPT,
    })),
    pointAt: vi.fn(() => null),
    dispose: vi.fn(),
  }
}

function sculptorSpy() {
  const noted: (ReliefSculpt | undefined)[] = []
  const dispose = vi.fn()
  const sculptor: ReliefSculptor = {
    raiseDisk: async () => CHANGED,
    note: sculpt => {
      noted.push(sculpt)
    },
    dispose,
  }
  return { noted, dispose, sculptor }
}

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

  /**
   * 🛑 Read back on every stroke, the sculpt was one render BEHIND — the store lands only after
   * the command has been through React. The sculptor could not tell it from an undo, dropped its
   * chaining, and the next stroke rebased on the sculpt from before the last one.
   */
  it('tells the sculptor of an outside write when the world lands, never on a stroke', async () => {
    const spy = sculptorSpy()
    const renderer = new SceneRenderer({
      onSelect: vi.fn(),
      onTransform: vi.fn(),
      relief: reliefStub(),
      createReliefSculptor: () => spy.sculptor,
    })

    await renderer.raiseReliefDisk('terrain', 'hills', DISK, 0.1)
    await renderer.raiseReliefDisk('terrain', 'hills', DISK, 0.1)
    expect(spy.noted).toEqual([])

    renderer['applyWorld']({ ...DEFAULT_WORLD, layers: [] })

    expect(spy.noted).toEqual([SCULPT])
    renderer.dispose()
  })

  /**
   * 🛑 Without ends to the drag, `runCommand` had no gesture to merge into and every stroke of a
   * brush held down became its own history entry — a hundred of them flushed the shared stack.
   */
  it('seals a brush drag into one gesture, however many strokes it took', () => {
    const begun = vi.fn()
    const ended = vi.fn()
    const renderer = new SceneRenderer({
      onSelect: vi.fn(),
      onTransform: vi.fn(),
      relief: reliefStub(),
      onReliefSculptBegin: begun,
      onReliefSculptEnd: ended,
    })
    renderer.setReliefBrush({ terrainId: 'terrain', editId: 'hills', radius: 2, amount: 0.5 })

    renderer['reliefPointer'] = 7
    renderer['onPointerUp']({ button: 0, pointerId: 7 } as PointerEvent)

    expect(ended).toHaveBeenCalledOnce()
    // Released twice — a second up, or a brush change — seals nothing more.
    renderer['onPointerUp']({ button: 0, pointerId: 7 } as PointerEvent)
    renderer.setReliefBrush(null)
    expect(ended).toHaveBeenCalledOnce()
    expect(begun).not.toHaveBeenCalled()
    renderer.dispose()
  })

  /**
   * 🛑 A stroke is a worker round-trip, so at the release several are still out. Sealed there,
   * their commands landed outside the gesture and the drag ended in one entry per stroke.
   */
  it('seals the drag only once the strokes still out have landed', async () => {
    const settle: ((chunks: PackedReliefChunk[]) => void)[] = []
    const ended = vi.fn()
    const renderer = new SceneRenderer({
      onSelect: vi.fn(),
      onTransform: vi.fn(),
      relief: reliefStub(),
      onReliefSculptEnd: ended,
      createReliefSculptor: () => ({
        raiseDisk: () =>
          new Promise(resolve => {
            settle.push(resolve)
          }),
        note: vi.fn(),
        dispose: vi.fn(),
      }),
    })

    const pending = renderer.raiseReliefDisk('terrain', 'hills', DISK, 0.1)
    renderer['reliefPointer'] = 7
    renderer['onPointerUp']({ button: 0, pointerId: 7 } as PointerEvent)
    expect(ended).not.toHaveBeenCalled()

    settle.shift()?.(CHANGED)
    await pending

    expect(ended).toHaveBeenCalledOnce()
    renderer.dispose()
  })

  it('holds one sculptor at a time, so a second edit layer does not add a worker pool', async () => {
    const spies = [sculptorSpy(), sculptorSpy()]
    let next = 0
    const renderer = new SceneRenderer({
      onSelect: vi.fn(),
      onTransform: vi.fn(),
      relief: reliefStub(),
      createReliefSculptor: () => {
        const spy = spies[next]
        next += 1
        if (!spy) throw new Error('No sculptor left')
        return spy.sculptor
      },
    })

    await renderer.raiseReliefDisk('terrain', 'hills', DISK, 0.1)
    await renderer.raiseReliefDisk('terrain', 'hills', DISK, 0.1)
    expect(next).toBe(1)

    await renderer.raiseReliefDisk('terrain', 'detail', DISK, 0.1)

    expect(next).toBe(2)
    expect(spies[0]?.dispose).toHaveBeenCalledOnce()
    expect(spies[1]?.dispose).not.toHaveBeenCalled()
    renderer.dispose()
  })
})
