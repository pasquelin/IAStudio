import { describe, expect, it } from 'vitest'
import { emptyGroundPaint } from './groundPaint'
import { scatterMaskFromGroundPaint } from './groundPaintMask'
import { unpackDeltas } from './relief'

describe('ground paint scatter mask', () => {
  it('derives placement weights from the painted green channel and alpha', () => {
    const paint = emptyGroundPaint(2, 2)
    paint.pixels.set([200, 255, 20, 255], 0)
    paint.pixels.set([0, 128, 0, 128], 4)

    const extent = { origin: { x: 0, z: 0 }, size: { x: 10, z: 10 } }
    const mask = scatterMaskFromGroundPaint(paint, extent, extent, 64)
    const west = unpackDeltas(mask.chunks[0]?.payload ?? '', 64 * 64)
    const east = unpackDeltas(mask.chunks[3]?.payload ?? '', 64 * 64)
    const south = unpackDeltas(mask.chunks[12]?.payload ?? '', 64 * 64)

    expect(west[0]).toBeCloseTo(1)
    expect(east[63]).toBeCloseTo((128 / 255) ** 2)
    expect(south[0]).toBe(0)
  })
})
