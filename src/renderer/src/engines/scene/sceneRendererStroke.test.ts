// @vitest-environment jsdom
import { Object3D } from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { PackedReliefChunk, ReliefSculpt } from '@shared/domain/relief'
import { DEFAULT_WORLD, reliefLayer, terrainEditLayer } from '@shared/domain/scene'
import type { ReliefSurface } from './reliefSurface'
import type { ReliefDiskStroke, ReliefSculptor } from './reliefSculptor'
import { SceneRenderer } from './SceneRenderer'
import { SCULPT_AMOUNT } from './reliefStroke'

const SCULPT: ReliefSculpt = { chunks: [{ column: 0, row: 0, payload: 'AAAAAA==' }] }
const CHANGED: PackedReliefChunk[] = [{ column: 0, row: 0, payload: 'AQAAAA==' }]

function reliefStub(): ReliefSurface {
  return {
    object: new Object3D(),
    sync: vi.fn(),
    heightmaps: () => new Map(),
    meshOf: vi.fn(),
    sculptSource: vi.fn(() => ({
      samples: { width: 2, height: 2, values: new Float32Array(4) },
      extent: { origin: { x: 0, z: 0 }, size: { x: 1, z: 1 }, elevation: { min: 0, max: 1 } },
      grain: 1,
      sculpt: SCULPT,
      maskWeights: undefined,
      overlayAlpha: 1,
      overlays: [],
    })),
    dispose: vi.fn(),
  }
}

function worldWithTerrain() {
  return {
    ...DEFAULT_WORLD,
    layers: [
      reliefLayer(
        { assetId: 'h' },
        { id: 'terrain', edits: [terrainEditLayer({ id: 'hills', name: 'Hills' })] },
      ),
    ],
  }
}

describe('a sculpt drag through the scene renderer', () => {
  it('paints interpolated dabs and wraps them in one history gesture', async () => {
    const strokes: ReliefDiskStroke[] = []
    const started = vi.fn()
    const ended = vi.fn()
    const published = vi.fn()
    const sculptor: ReliefSculptor = {
      raiseDisk: async stroke => {
        strokes.push(stroke)
        return CHANGED
      },
      note: vi.fn(),
      dispose: vi.fn(),
    }
    const renderer = new SceneRenderer({
      onSelect: vi.fn(),
      onTransform: vi.fn(),
      onReliefSculpt: published,
      onReliefStrokeStart: started,
      onReliefStrokeEnd: ended,
      relief: reliefStub(),
      createReliefSculptor: () => sculptor,
    })
    renderer['applyWorld'](worldWithTerrain())
    renderer.setArmedRelief({ terrainId: 'terrain', editId: 'hills' })
    renderer.setSculptBrush(1, 0.5)

    await renderer.startReliefStroke(0, 0)
    await renderer.moveReliefStroke(1, 0)
    renderer.endReliefStroke()

    expect(started).toHaveBeenCalledOnce()
    expect(ended).toHaveBeenCalledOnce()
    expect(started.mock.invocationCallOrder[0] ?? 0).toBeLessThan(
      published.mock.invocationCallOrder[0] ?? 0,
    )
    expect(strokes.length).toBeGreaterThan(1)
    expect(strokes[0]?.disk).toEqual({ x: 0, z: 0, radius: 1 })
    expect(strokes.at(-1)?.disk).toEqual({ x: 1, z: 0, radius: 1 })
    expect(strokes.every(stroke => stroke.amount === SCULPT_AMOUNT && stroke.falloff === 0.5)).toBe(
      true,
    )
    expect(published).toHaveBeenCalledTimes(strokes.length)
    renderer.dispose()
  })

  it('forwards a session amount other than the historical constant', async () => {
    const strokes: ReliefDiskStroke[] = []
    const sculptor: ReliefSculptor = {
      raiseDisk: async stroke => {
        strokes.push(stroke)
        return CHANGED
      },
      note: vi.fn(),
      dispose: vi.fn(),
    }
    const renderer = new SceneRenderer({
      onSelect: vi.fn(),
      onTransform: vi.fn(),
      relief: reliefStub(),
      createReliefSculptor: () => sculptor,
    })
    renderer['applyWorld'](worldWithTerrain())
    renderer.setArmedRelief({ terrainId: 'terrain', editId: 'hills' })
    renderer.setSculptBrush(1, 0, 0.3)

    await renderer.startReliefStroke(0, 0)
    renderer.endReliefStroke()

    expect(strokes[0]?.amount).toBe(0.3)
    expect(strokes[0]?.amount).not.toBe(SCULPT_AMOUNT)
    renderer.dispose()
  })

  it('forwards a flatten stroke with the combined height at pointerdown as the target', async () => {
    const strokes: ReliefDiskStroke[] = []
    const values = Float32Array.from([0.4, 0.8, 0.1, 0.9])
    const sculptor: ReliefSculptor = {
      raiseDisk: async stroke => {
        strokes.push(stroke)
        return CHANGED
      },
      note: vi.fn(),
      dispose: vi.fn(),
    }
    const renderer = new SceneRenderer({
      onSelect: vi.fn(),
      onTransform: vi.fn(),
      relief: {
        ...reliefStub(),
        sculptSource: vi.fn(() => ({
          samples: { width: 2, height: 2, values },
          extent: { origin: { x: 0, z: 0 }, size: { x: 1, z: 1 }, elevation: { min: 0, max: 1 } },
          grain: 1,
          sculpt: undefined,
          maskWeights: undefined,
          overlayAlpha: 1,
          overlays: [],
        })),
      },
      createReliefSculptor: () => sculptor,
    })
    renderer['applyWorld'](worldWithTerrain())
    renderer.setArmedRelief({ terrainId: 'terrain', editId: 'hills' })
    renderer.setSculptTool('flatten')
    renderer.setSculptBrush(1, 0, 1)

    await renderer.startReliefStroke(0, 0)
    await renderer.moveReliefStroke(1, 0)
    renderer.endReliefStroke()

    expect(strokes.length).toBeGreaterThan(0)
    expect(strokes.every(stroke => stroke.kind === 'flatten')).toBe(true)
    expect(strokes[0]?.target).toBeCloseTo(0.4)
    expect(strokes.every(stroke => stroke.target === strokes[0]?.target)).toBe(true)
    renderer.dispose()
  })
})
