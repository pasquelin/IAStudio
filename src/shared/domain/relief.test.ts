import { describe, expect, it } from 'vitest'
import {
  worldY,
  RELIEF_CHUNK_TEXELS,
  applyReliefSculpt,
  chunkCountAlong,
  chunkLayout,
  chunkMemoryBytes,
  chunkVerticesPerSide,
  chunksHoldingSample,
  combinedAt,
  packDeltas,
  raiseReliefDisk,
  regionUploadBytes,
  unpackDeltas,
  withChunkDelta,
} from './relief'
import { DEFAULT_RELIEF_ELEVATION, DEFAULT_RELIEF_ORIGIN, DEFAULT_RELIEF_SIZE } from './scene'

describe('relief chunk grain', () => {
  it('is 64 texels, the candidate whose full-chunk fallback is four times lighter', () => {
    expect(RELIEF_CHUNK_TEXELS).toBe(64)
    expect(chunkMemoryBytes(64).total).toBe(184_352)
    expect(chunkMemoryBytes(128).total / chunkMemoryBytes(64).total).toBeCloseTo(4, 0)
  })

  it('counts the shared border vertex, so 64 quads are 65 vertices on a side', () => {
    expect(chunkVerticesPerSide(64)).toBe(65)
    expect(chunkCountAlong(512, 64)).toBe(8)
    expect(chunkCountAlong(512, 128)).toBe(4)
  })

  it('uploads a 16-texel brush as a region, not a chunk', () => {
    const brush = regionUploadBytes(32, 32)
    expect(brush.total).toBeLessThan(chunkMemoryBytes(64).position)
    expect(brush.total).toBeLessThan(chunkMemoryBytes(128).position / 4)
  })
})

describe('relief chunk deltas', () => {
  const samples = {
    width: 8,
    height: 8,
    values: Float32Array.from({ length: 64 }, (_, at) => at * 0.1),
  }

  it('adds a delta to the combined height at that sample, leaving the base alone', () => {
    const sculpt = withChunkDelta(samples, undefined, {
      column: 0,
      row: 0,
      localX: 2,
      localZ: 1,
      delta: 3,
    })

    expect(combinedAt(samples, sculpt, 2, 1)).toBeCloseTo(4)
    expect(samples.values[1 * 8 + 2]).toBeCloseTo(1.0)
    expect(combinedAt(samples, undefined, 2, 1)).toBeCloseTo(1.0)
  })

  it('packs a sparse overlay as base64, not a JSON array of floats', () => {
    const sculpt = withChunkDelta(samples, undefined, {
      column: 0,
      row: 0,
      localX: 0,
      localZ: 0,
      delta: 1.5,
    })
    const json = JSON.stringify(sculpt)

    expect(sculpt.chunks[0]?.payload).toMatch(/^[A-Za-z0-9+/]+=*$/)
    expect(json).not.toMatch(/1\.5/)
    expect(JSON.parse(json)).toEqual(sculpt)
  })

  it('packs a fully dirtied chunk as dense binary, still not JSON floats', () => {
    const layout = chunkLayout(0, 0, 8, 8, RELIEF_CHUNK_TEXELS)
    const deltas = new Float32Array(layout.width * layout.height)
    deltas.fill(0.25)
    const payload = packDeltas(deltas)
    const json = JSON.stringify({ payload })

    expect(unpackDeltas(payload, deltas.length)).toEqual(deltas)
    expect(json).not.toMatch(/0\.25/)
    expect(atob(payload).charCodeAt(0)).toBe(1)
  })
})

describe('worldY', () => {
  it('maps sample 0 and 1 onto elevation.min and elevation.max', () => {
    expect(worldY(0, { min: -8, max: 32 })).toBe(-8)
    expect(worldY(1, { min: -8, max: 32 })).toBe(32)
    expect(worldY(0.5, { min: 0, max: 1 })).toBe(0.5)
  })
})

describe('raiseReliefDisk', () => {
  const samples = {
    width: 66,
    height: 8,
    values: new Float32Array(66 * 8),
  }
  const extent = {
    origin: DEFAULT_RELIEF_ORIGIN,
    size: DEFAULT_RELIEF_SIZE,
    elevation: DEFAULT_RELIEF_ELEVATION,
  }
  const stepX = extent.size.x / (samples.width - 1)
  const seamX = extent.origin.x + 64 * stepX

  it('raises a sample inside the disk and leaves one outside', () => {
    const sculpt = raiseReliefDisk(
      samples,
      extent,
      undefined,
      { x: seamX, z: extent.origin.z, radius: stepX * 2 },
      3,
    )
    expect(combinedAt(samples, sculpt, 64, 0)).toBe(3)
    expect(combinedAt(samples, sculpt, 0, 0)).toBe(0)
  })

  it('writes the same delta on both chunks that share the seam sample', () => {
    const sculpt = raiseReliefDisk(
      samples,
      extent,
      undefined,
      { x: seamX, z: extent.origin.z, radius: stepX },
      2,
    )
    expect(chunksHoldingSample(64, 0, 66, 8, RELIEF_CHUNK_TEXELS)).toEqual([
      { column: 1, row: 0 },
      { column: 0, row: 0 },
    ])
    expect(combinedAt(samples, sculpt, 64, 0)).toBe(2)
    expect(sculpt.chunks).toHaveLength(2)
  })

  it('is the same arithmetic a worker calls, with no scene or renderer to mount', () => {
    const disk = { x: seamX, z: extent.origin.z, radius: stepX * 2 }
    expect(
      applyReliefSculpt(samples, extent, undefined, { kind: 'raiseDisk', disk, amount: 3 }),
    ).toEqual(raiseReliefDisk(samples, extent, undefined, disk, 3))
  })
})
