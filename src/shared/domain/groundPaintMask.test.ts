import { describe, expect, it } from 'vitest'
import { emptyGroundPaint } from './groundPaint'
import { scatterMaskFromGroundPaint } from './groundPaintMask'
import { unpackDeltas } from './relief'

describe('ground paint scatter mask', () => {
  it('derives placement weights from the painted green channel and alpha', () => {
    const paint = emptyGroundPaint(2, 2)
    paint.pixels.set([200, 255, 20, 255], 0)
    paint.pixels.set([0, 128, 0, 128], 4)

    const mask = scatterMaskFromGroundPaint(paint, 2)
    const weights = unpackDeltas(mask.chunks[0]?.payload ?? '', 4)

    expect(weights[0]).toBeCloseTo(1)
    expect(weights[1]).toBeCloseTo((128 / 255) ** 2)
    expect(weights[2]).toBe(0)
  })
})
