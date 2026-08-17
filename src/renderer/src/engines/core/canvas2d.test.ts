import { describe, expect, it, vi } from 'vitest'
import { paintOn } from './canvas2d'

/** jsdom has no 2D backend, so the context is the one thing that has to be stood in for. */
function canvasWith(context: Partial<CanvasRenderingContext2D> | null): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  // `as`: `getContext` is overloaded per context id, and a stub that answers only the 2D one
  // cannot satisfy the whole signature.
  canvas.getContext = (() => context) as HTMLCanvasElement['getContext']
  return canvas
}

const drawable = (): Partial<CanvasRenderingContext2D> => ({ setTransform: vi.fn() })

function sized(width: number, height: number): HTMLCanvasElement {
  const canvas = canvasWith(drawable())
  Object.defineProperty(canvas, 'clientWidth', { value: width })
  Object.defineProperty(canvas, 'clientHeight', { value: height })
  return canvas
}

describe('paintOn', () => {
  it('hands the painter a fitted context, and the size to paint in, in CSS pixels', () => {
    const draw = vi.fn()

    paintOn(sized(320, 180), draw)

    const [context, box] = draw.mock.calls[0] ?? []
    expect(box).toEqual({ width: 320, height: 180 })
    // Fitted BEFORE the painter runs: a painter that had to fit its own context would be back
    // to the four lines this exists to hold.
    expect(context.setTransform).toHaveBeenCalled()
  })

  /**
   * A repaint runs from a `ResizeObserver` and from store subscriptions, both of which outlive
   * the element for a moment. Nothing catches a throw there, so the surface simply skips its
   * turn — that skip is the whole point of the helper.
   *
   * Two ways in, one thing to observe: no canvas at all before the first commit and after
   * unmount, and a canvas already claimed by WebGL, which answers null for ever after.
   */
  it('paints nothing when there is nothing to paint on', () => {
    const draw = vi.fn()

    paintOn(null, draw)
    paintOn(canvasWith(null), draw)

    expect(draw).not.toHaveBeenCalled()
  })
})
