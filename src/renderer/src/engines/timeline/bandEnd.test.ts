import { describe, expect, it } from 'vitest'
import { SECOND } from '@shared/domain/time'
import { paintBandEnd } from './bandEnd'
import { DEFAULT_VIEWPORT } from './viewport'

/** Only the rectangles matter here: where the rule lands, and whether one is drawn at all. */
function recorder(): { context: CanvasRenderingContext2D; rects: number[][] } {
  const rects: number[][] = []
  const context = {
    fillStyle: '',
    fillRect: (...box: number[]) => rects.push(box),
  } as unknown as CanvasRenderingContext2D

  return { context, rects }
}

const paint = (end: number, width = 800) => {
  const { context, rects } = recorder()
  paintBandEnd(context, { end, viewport: DEFAULT_VIEWPORT, width, height: 200, colour: '#fff' })
  return rects
}

describe('marking where a band stops', () => {
  it('draws the rule at the end, down the whole height', () => {
    const rects = paint(2 * SECOND)
    const x = Math.round(2 * SECOND * DEFAULT_VIEWPORT.scale)

    expect(rects).toEqual([[x, 0, 2, 200]])
  })

  it('draws nothing for a band with nothing in it, which would read as a left border', () => {
    expect(paint(0)).toEqual([])
  })

  it('draws nothing when the end is off screen, rather than clamping it to the edge', () => {
    // Clamped, the rule would say the montage stops at the right edge of whatever is on screen.
    expect(paint(60 * SECOND, 100)).toEqual([])
  })
})
