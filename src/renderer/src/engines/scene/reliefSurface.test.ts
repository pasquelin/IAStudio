import { BufferAttribute, Scene } from 'three'
import { describe, expect, it } from 'vitest'
import { combinedAt, raiseReliefDisk, withChunkDelta } from '@shared/domain/relief'
import { DEFAULT_WORLD, reliefLayer, type ReliefLayer } from '@shared/domain/scene'
import { createReliefSurface } from './reliefSurface'

const WIDTH = 66
const HEIGHT = 8

function samplesOf() {
  return {
    width: WIDTH,
    height: HEIGHT,
    values: Float32Array.from({ length: WIDTH * HEIGHT }, (_, at) => (at % WIDTH) * 0.01),
  }
}

function layerOf(sculpt?: ReliefLayer['sculpt']): ReliefLayer {
  return reliefLayer({ assetId: 'asset_height' }, sculpt ? { sculpt } : undefined)
}

function worldOf(sculpt?: ReliefLayer['sculpt']) {
  return { ...DEFAULT_WORLD, layers: [layerOf(sculpt)] }
}

function positionOf(surface: ReturnType<typeof createReliefSurface>, column: number, row: number) {
  const mesh = surface.meshOf(column, row)
  const position = mesh?.geometry.getAttribute('position')
  if (!(position instanceof BufferAttribute)) throw new Error('chunk has no position buffer')
  return position
}

describe('relief surface chunks', () => {
  it('builds one mesh per chunk and lifts a vertex by the combined height', () => {
    const scene = new Scene()
    const surface = createReliefSurface(scene)
    const samples = samplesOf()
    surface.sync(worldOf(), samples)

    expect(surface.meshOf(0, 0)).toBeDefined()
    expect(surface.meshOf(1, 0)).toBeDefined()
    expect(surface.object.children).toHaveLength(2)

    const y = positionOf(surface, 0, 0).array[1]
    expect(y).toBeCloseTo(0)
  })

  it('re-uploads only the dirtied chunk, leaving the other updateRanges empty', () => {
    const scene = new Scene()
    const surface = createReliefSurface(scene)
    const samples = samplesOf()
    surface.sync(worldOf(), samples)
    positionOf(surface, 0, 0).clearUpdateRanges()
    positionOf(surface, 1, 0).clearUpdateRanges()

    const sculpt = withChunkDelta(samples, undefined, {
      column: 0,
      row: 0,
      localX: 1,
      localZ: 0,
      delta: 4,
    })
    surface.sync(worldOf(sculpt), samples)

    expect(positionOf(surface, 0, 0).updateRanges.length).toBeGreaterThan(0)
    expect(positionOf(surface, 1, 0).updateRanges).toEqual([])
    expect(positionOf(surface, 0, 0).array[4]).toBeCloseTo(4.01)
  })

  it('keeps the shared edge continuous when a disk covers two chunks', () => {
    const scene = new Scene()
    const surface = createReliefSurface(scene)
    const samples = samplesOf()
    const layer = layerOf()
    const stepX = layer.size.x / (WIDTH - 1)
    const seamX = layer.origin.x + 64 * stepX
    const sculpt = raiseReliefDisk(
      samples,
      layer,
      undefined,
      { x: seamX, z: layer.origin.z, radius: stepX * 2 },
      1.5,
    )
    surface.sync(worldOf(sculpt), samples)

    const left = surface.meshOf(0, 0)
    const right = surface.meshOf(1, 0)
    const leftPos = left?.geometry.getAttribute('position')
    const rightPos = right?.geometry.getAttribute('position')
    if (!(leftPos instanceof BufferAttribute) || !(rightPos instanceof BufferAttribute)) {
      throw new Error('seam chunks missing')
    }
    const height = combinedAt(samples, sculpt, 64, 0)
    const leftY = leftPos.array[64 * 3 + 1]
    const rightY = rightPos.array[1]
    if (leftY === undefined || rightY === undefined) throw new Error('seam vertex missing')
    expect(height).toBeCloseTo(0.64 + 1.5)
    expect(leftY).toBeCloseTo(rightY)
    expect(leftY).toBeCloseTo(height)
  })

  it('clears the meshes when the world holds no relief', () => {
    const scene = new Scene()
    const surface = createReliefSurface(scene)
    surface.sync(worldOf(), samplesOf())
    surface.sync(DEFAULT_WORLD)

    expect(surface.object.children).toHaveLength(0)
    expect(surface.meshOf(0, 0)).toBeUndefined()
  })
})
