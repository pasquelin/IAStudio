import { describe, expect, it } from 'vitest'
import {
  RELIEF_CHUNK_TEXELS,
  chunkCountAlong,
  chunkMemoryBytes,
  chunkVerticesPerSide,
  regionUploadBytes,
} from './relief'

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
