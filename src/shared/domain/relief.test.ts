import { describe, expect, it } from 'vitest'
import {
  worldY,
  sampleOfWorldY,
  RELIEF_CHUNK_TEXELS,
  applyReliefSculpt,
  chunkCountAlong,
  chunkLayout,
  chunkMemoryBytes,
  chunkVerticesPerSide,
  combinedAt,
  containsXZ,
  flattenReliefDisk,
  getHeightAt,
  packDeltas,
  raiseReliefDisk,
  regionUploadBytes,
  smoothReliefDisk,
  unpackDeltas,
  withChunkDelta,
  type ReliefHeightLayer,
  type ReliefOverlay,
  type ReliefSculpt,
} from './relief'
import {
  DEFAULT_RELIEF_ELEVATION,
  DEFAULT_RELIEF_ORIGIN,
  DEFAULT_RELIEF_SIZE,
  reliefLayer,
} from './scene'

function heightAt(
  samples: { width: number; height: number; values: Float32Array },
  sculpt: ReliefSculpt | undefined,
  sx: number,
  sz: number,
): number {
  return combinedAt(
    samples,
    RELIEF_CHUNK_TEXELS,
    sculpt ? [{ enabled: true, alpha: 1, sculpt }] : [],
    sx,
    sz,
  )
}

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

    expect(heightAt(samples, sculpt, 2, 1)).toBeCloseTo(4)
    expect(samples.values[1 * 8 + 2]).toBeCloseTo(1.0)
    expect(heightAt(samples, undefined, 2, 1)).toBeCloseTo(1.0)
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

  it('inverts through sampleOfWorldY', () => {
    const elevation = { min: -8, max: 32 }
    expect(sampleOfWorldY(worldY(0.25, elevation), elevation)).toBeCloseTo(0.25)
    expect(sampleOfWorldY(10, { min: 10, max: 10 })).toBe(0)
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
    expect(heightAt(samples, sculpt, 64, 0)).toBe(3)
    expect(heightAt(samples, sculpt, 0, 0)).toBe(0)
  })

  it('writes the same delta on both chunks that share the seam sample', () => {
    const sculpt = raiseReliefDisk(
      samples,
      extent,
      undefined,
      { x: seamX, z: extent.origin.z, radius: stepX },
      2,
    )
    expect(heightAt(samples, sculpt, 64, 0)).toBe(2)
    expect(sculpt.chunks).toHaveLength(2)
  })

  it('keeps an existing chunk outside the disk unchanged', () => {
    const before = withChunkDelta(samples, undefined, {
      column: 0,
      row: 0,
      localX: 0,
      localZ: 0,
      delta: 7,
    })
    const x = extent.origin.x + extent.size.x
    const after = raiseReliefDisk(
      samples,
      extent,
      before,
      { x, z: extent.origin.z, radius: stepX },
      2,
    )

    expect(heightAt(samples, after, 0, 0)).toBe(7)
    expect(heightAt(samples, after, 65, 0)).toBe(2)
  })

  it('is the same arithmetic a worker calls, with no scene or renderer to mount', () => {
    const disk = { x: seamX, z: extent.origin.z, radius: stepX * 2 }
    expect(
      applyReliefSculpt(samples, extent, undefined, { kind: 'raiseDisk', disk, amount: 3 }),
    ).toEqual(raiseReliefDisk(samples, extent, undefined, disk, 3))
  })

  it('keeps a hard edge when falloff is 0, matching the disk without a falloff', () => {
    const disk = { x: seamX, z: extent.origin.z, radius: stepX * 2 }
    expect(raiseReliefDisk(samples, extent, undefined, disk, 3, 0)).toEqual(
      raiseReliefDisk(samples, extent, undefined, disk, 3),
    )
    expect(
      applyReliefSculpt(samples, extent, undefined, {
        kind: 'raiseDisk',
        disk,
        amount: 3,
        falloff: 0,
      }),
    ).toEqual(raiseReliefDisk(samples, extent, undefined, disk, 3))
  })

  it('tapers the delta toward the rim when falloff is greater than 0', () => {
    const disk = { x: extent.origin.x, z: extent.origin.z, radius: stepX * 4 }
    const sculpt = raiseReliefDisk(samples, extent, undefined, disk, 4, 1)

    expect(heightAt(samples, sculpt, 0, 0)).toBeCloseTo(4)
    expect(heightAt(samples, sculpt, 2, 0)).toBeCloseTo(2)
  })

  it('scales the written delta with the amount, so 0.2 raises twice 0.1', () => {
    const disk = { x: extent.origin.x, z: extent.origin.z, radius: stepX }
    const mild = raiseReliefDisk(samples, extent, undefined, disk, 0.1)
    const strong = raiseReliefDisk(samples, extent, undefined, disk, 0.2)

    expect(heightAt(samples, strong, 0, 0)).toBeCloseTo(2 * heightAt(samples, mild, 0, 0))
    expect(heightAt(samples, mild, 0, 0)).toBeCloseTo(0.1)
  })

  /**
   * 🛑 A map of 2ⁿ+1 samples, which is what every classic heightmap is. Its last sample sits on a
   * border whose two chunks are the SAME one, the index being clamped to the last — so the amount
   * was added twice down the far edge and four times in the corner.
   */
  describe('at the far edge of a 129-sample map', () => {
    const wide = { width: 129, height: 129, values: new Float32Array(129 * 129) }
    const step = extent.size.x / (wide.width - 1)
    const corner = { x: extent.origin.x + 128 * step, z: extent.origin.z + 128 * step }

    it('raises the far corner by the amount asked for, not four times it', () => {
      const sculpt = raiseReliefDisk(wide, extent, undefined, { ...corner, radius: step }, 3)

      expect(heightAt(wide, sculpt, 128, 128)).toBe(3)
      expect(heightAt(wide, sculpt, 128, 127)).toBe(3)
    })
  })
})

describe('combined overlays', () => {
  const samples = {
    width: 8,
    height: 8,
    values: Float32Array.from({ length: 64 }, (_, at) => at * 0.1),
  }

  function overlay(
    sculpt: ReliefSculpt,
    extra: { enabled?: boolean; alpha?: number } = {},
  ): { enabled: boolean; alpha: number; sculpt: ReliefSculpt } {
    return { enabled: extra.enabled ?? true, alpha: extra.alpha ?? 1, sculpt }
  }

  const hills = withChunkDelta(samples, undefined, {
    column: 0,
    row: 0,
    localX: 2,
    localZ: 1,
    delta: 3,
  })
  const valley = withChunkDelta(samples, undefined, {
    column: 0,
    row: 0,
    localX: 2,
    localZ: 1,
    delta: 1,
  })

  it('sums enabled overlays, each scaled by its alpha', () => {
    expect(
      combinedAt(
        samples,
        RELIEF_CHUNK_TEXELS,
        [overlay(hills), overlay(valley, { alpha: 0.5 })],
        2,
        1,
      ),
    ).toBeCloseTo(1.0 + 3 + 0.5)
  })

  it('skips a disabled overlay, leaving the others', () => {
    expect(
      combinedAt(
        samples,
        RELIEF_CHUNK_TEXELS,
        [overlay(hills, { enabled: false }), overlay(valley)],
        2,
        1,
      ),
    ).toBeCloseTo(1.0 + 1)
  })

  it('subtracts when alpha is negative', () => {
    expect(
      combinedAt(samples, RELIEF_CHUNK_TEXELS, [overlay(hills, { alpha: -1 })], 2, 1),
    ).toBeCloseTo(1.0 - 3)
  })
})

describe('containsXZ', () => {
  const extent = {
    origin: { x: 0, z: -4 },
    size: { x: 10, z: 6 },
    elevation: DEFAULT_RELIEF_ELEVATION,
  }

  it('includes the origin and the far edge, and refuses a point past either', () => {
    expect(containsXZ(extent, 0, -4)).toBe(true)
    expect(containsXZ(extent, 10, 2)).toBe(true)
    expect(containsXZ(extent, -0.01, 0)).toBe(false)
    expect(containsXZ(extent, 10.01, 0)).toBe(false)
    expect(containsXZ(extent, 5, 2.01)).toBe(false)
  })
})

describe('getHeightAt', () => {
  const quad: ReliefHeightLayer = {
    ...reliefLayer({ assetId: 'h' }, { id: 'quad', size: { x: 1, z: 1 } }),
    samples: { width: 2, height: 2, values: Float32Array.from([0, 4, 8, 12]) },
  }

  it('interpolates the four neighbouring texels at a point off the grid', () => {
    expect(getHeightAt([quad], 0.25, 0.5)).toBeCloseTo(5)
  })

  it('returns null when no enabled terrain contains the point', () => {
    expect(getHeightAt([quad], -1, 0.5)).toBeNull()
    expect(getHeightAt([{ ...quad, enabled: false }], 0.25, 0.5)).toBeNull()
  })

  it('reads the combined height, so a sculpted overlay is felt', () => {
    const painted: ReliefHeightLayer = {
      ...quad,
      edits: [
        {
          enabled: true,
          alpha: 1,
          sculpt: withChunkDelta(quad.samples, undefined, {
            column: 0,
            row: 0,
            localX: 0,
            localZ: 0,
            delta: 1,
          }),
        },
      ],
    }
    expect(getHeightAt([painted], 0, 0)).toBeCloseTo(1)
  })

  it('lets the first overlapping terrain in the list answer, not the second', () => {
    const low: ReliefHeightLayer = {
      ...reliefLayer(
        { assetId: 'low' },
        { origin: { x: 0, z: 0 }, size: { x: 10, z: 10 }, id: 'low' },
      ),
      samples: { width: 2, height: 2, values: new Float32Array(4).fill(0.2) },
    }
    const high: ReliefHeightLayer = {
      ...reliefLayer(
        { assetId: 'high' },
        { origin: { x: 0, z: 0 }, size: { x: 10, z: 10 }, id: 'high' },
      ),
      samples: { width: 2, height: 2, values: new Float32Array(4).fill(0.8) },
    }

    expect(getHeightAt([low, high], 5, 5)).toBeCloseTo(0.2)
    expect(getHeightAt([high, low], 5, 5)).toBeCloseTo(0.8)
  })
})

describe('smoothReliefDisk', () => {
  const width = 8
  const values = new Float32Array(width * width)
  values[3 * width + 3] = 1
  const samples = { width, height: width, values }
  const extent = {
    origin: DEFAULT_RELIEF_ORIGIN,
    size: DEFAULT_RELIEF_SIZE,
    elevation: DEFAULT_RELIEF_ELEVATION,
  }
  const stepX = extent.size.x / (width - 1)
  const disk = {
    x: extent.origin.x + 3 * stepX,
    z: extent.origin.z + 3 * (extent.size.z / (width - 1)),
    radius: stepX * 3,
  }

  it('reduces an isolated peak toward its neighbours without erasing it in one stroke', () => {
    const sculpt = smoothReliefDisk(samples, extent, undefined, disk, 0.1)
    const peak = heightAt(samples, sculpt, 3, 3)
    const neighbour = heightAt(samples, sculpt, 3, 2)

    expect(peak).toBeGreaterThan(0.8)
    expect(peak).toBeLessThan(1)
    expect(neighbour).toBeGreaterThan(0)
    expect(peak).toBeGreaterThan(neighbour)
  })

  it('is the same arithmetic applyReliefSculpt runs for kind smooth', () => {
    expect(
      applyReliefSculpt(samples, extent, undefined, { kind: 'smooth', disk, amount: 1 }),
    ).toEqual(smoothReliefDisk(samples, extent, undefined, disk, 1))
  })

  it('writes the correction into the armed overlay, so disabling it restores the others', () => {
    const flat = { width, height: width, values: new Float32Array(width * width) }
    const hills = withChunkDelta(flat, undefined, {
      column: 0,
      row: 0,
      localX: 3,
      localZ: 3,
      delta: 1,
    })
    const overlays = [{ enabled: true, alpha: 1, sculpt: hills }]
    const sculpt = smoothReliefDisk(
      flat,
      extent,
      undefined,
      disk,
      1,
      0,
      RELIEF_CHUNK_TEXELS,
      undefined,
      overlays,
    )

    expect(
      combinedAt(
        flat,
        RELIEF_CHUNK_TEXELS,
        [...overlays, { enabled: true, alpha: 1, sculpt }],
        3,
        3,
      ),
    ).toBeLessThan(1)
    expect(
      combinedAt(
        flat,
        RELIEF_CHUNK_TEXELS,
        [...overlays, { enabled: false, alpha: 1, sculpt }],
        3,
        3,
      ),
    ).toBeCloseTo(1)
  })
})

describe('flattenReliefDisk', () => {
  const width = 8
  const values = Float32Array.from({ length: width * width }, (_, at) => (at % width) * 0.1)
  const samples = { width, height: width, values }
  const extent = {
    origin: DEFAULT_RELIEF_ORIGIN,
    size: DEFAULT_RELIEF_SIZE,
    elevation: DEFAULT_RELIEF_ELEVATION,
  }
  const stepX = extent.size.x / (width - 1)
  const disk = {
    x: extent.origin.x + 3 * stepX,
    z: extent.origin.z + 3 * (extent.size.z / (width - 1)),
    radius: stepX * 2,
  }
  const target = heightAt(samples, undefined, 3, 3)

  it('pulls every texel in the disk toward the reference height', () => {
    const sculpt = flattenReliefDisk(samples, extent, undefined, disk, target, 1)

    expect(heightAt(samples, sculpt, 3, 3)).toBeCloseTo(target)
    expect(heightAt(samples, sculpt, 2, 3)).toBeCloseTo(target)
    expect(heightAt(samples, sculpt, 4, 3)).toBeCloseTo(target)
    expect(heightAt(samples, sculpt, 0, 0)).toBeCloseTo(0)
  })

  it('restores the surface when the overlay that holds the correction is disabled', () => {
    const sculpt = flattenReliefDisk(samples, extent, undefined, disk, target, 1)
    const before = heightAt(samples, undefined, 2, 3)

    expect(
      combinedAt(samples, RELIEF_CHUNK_TEXELS, [{ enabled: false, alpha: 1, sculpt }], 2, 3),
    ).toBeCloseTo(before)
  })

  it('is the same arithmetic applyReliefSculpt runs for kind flatten', () => {
    expect(
      applyReliefSculpt(samples, extent, undefined, {
        kind: 'flatten',
        disk,
        amount: 1,
        target,
      }),
    ).toEqual(flattenReliefDisk(samples, extent, undefined, disk, target, 1))
  })
})

describe('overlay masks', () => {
  const samples = {
    width: 8,
    height: 8,
    values: new Float32Array(64),
  }
  const extent = {
    origin: { x: 0, z: 0 },
    size: { x: 7, z: 7 },
    elevation: { min: 0, max: 1000 },
  }
  const hills = withChunkDelta(samples, undefined, {
    column: 0,
    row: 0,
    localX: 2,
    localZ: 2,
    delta: 1,
  })
  const valley = withChunkDelta(samples, undefined, {
    column: 0,
    row: 0,
    localX: 4,
    localZ: 2,
    delta: 1,
  })

  it('leaves an overlay without a mask as alpha times delta', () => {
    expect(
      combinedAt(
        samples,
        RELIEF_CHUNK_TEXELS,
        [{ enabled: true, alpha: 0.5, sculpt: hills }],
        2,
        2,
      ),
    ).toBeCloseTo(0.5)
  })

  it('zeroes a height-masked overlay outside the range and keeps it inside', () => {
    const overlay: ReliefOverlay = {
      enabled: true,
      alpha: 1,
      sculpt: hills,
      mask: { kind: 'height', min: 100, max: 800 },
    }
    const low = {
      ...samples,
      values: Float32Array.from({ length: 64 }, () => 0.05),
    }
    const mid = {
      ...samples,
      values: Float32Array.from({ length: 64 }, () => 0.4),
    }

    expect(combinedAt(low, RELIEF_CHUNK_TEXELS, [overlay], 2, 2, extent)).toBeCloseTo(0.05)
    expect(combinedAt(mid, RELIEF_CHUNK_TEXELS, [overlay], 2, 2, extent)).toBeCloseTo(1.4)
  })

  it('zeroes a slope-masked overlay on the flat and keeps it on a ramp', () => {
    const ramp = {
      width: 8,
      height: 8,
      values: Float32Array.from({ length: 64 }, (_, at) => (at % 8) * 0.2),
    }
    const overlay: ReliefOverlay = {
      enabled: true,
      alpha: 1,
      sculpt: withChunkDelta(ramp, undefined, {
        column: 0,
        row: 0,
        localX: 3,
        localZ: 3,
        delta: 1,
      }),
      mask: { kind: 'slope', min: 20, max: 90 },
    }

    expect(combinedAt(samples, RELIEF_CHUNK_TEXELS, [overlay], 3, 3, extent)).toBeCloseTo(0)
    expect(combinedAt(ramp, RELIEF_CHUNK_TEXELS, [overlay], 3, 3, extent)).toBeGreaterThan(
      ramp.values[3 * 8 + 3] ?? 0,
    )
  })

  it('modulates only the painted overlay, not its neighbour', () => {
    const paint = withChunkDelta(samples, undefined, {
      column: 0,
      row: 0,
      localX: 2,
      localZ: 2,
      delta: 1,
    })
    const overlays: ReliefOverlay[] = [
      {
        enabled: true,
        alpha: 1,
        sculpt: hills,
        mask: { kind: 'painted', weights: paint },
      },
      { enabled: true, alpha: 1, sculpt: valley },
    ]

    expect(combinedAt(samples, RELIEF_CHUNK_TEXELS, overlays, 2, 2)).toBeCloseTo(1)
    expect(combinedAt(samples, RELIEF_CHUNK_TEXELS, overlays, 4, 2)).toBeCloseTo(1)
    expect(combinedAt(samples, RELIEF_CHUNK_TEXELS, overlays, 3, 2)).toBeCloseTo(0)
  })
})
