import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Waveform } from './Waveform'

/**
 * jsdom answers null for a 2D context, so a painted surface draws nothing at all under test and
 * every assertion about it would pass on an empty component. The stub is what makes the paint
 * observable; only the two calls this component's own decisions reach are spied on.
 */
const spy = {
  clearRect: vi.fn(),
  fill: vi.fn(),
  beginPath: vi.fn(),
  closePath: vi.fn(),
  lineTo: vi.fn(),
  setTransform: vi.fn(),
}

/**
 * The parameter is what carries the type here: a const initialised from the stub narrows to it,
 * and the overload set only accepts a function whose answer may be null, as every context id's is.
 */
function stubContext(answer: Partial<CanvasRenderingContext2D> | null): void {
  // `as`: `getContext` is overloaded per context id, and a stub that answers only the 2D one
  // cannot satisfy the whole signature.
  HTMLCanvasElement.prototype.getContext = (() => answer) as HTMLCanvasElement['getContext']
}

const realContext = HTMLCanvasElement.prototype.getContext

beforeEach(() => stubContext(spy))

afterEach(() => {
  // Restored, or the next case to reach a real canvas reads this stub back instead of drawing.
  HTMLCanvasElement.prototype.getContext = realContext
  vi.clearAllMocks()
})

const peaks = (): Float32Array => new Float32Array([-0.5, 0.5, -0.8, 0.8, -0.2, 0.2])

describe('Waveform', () => {
  /**
   * The one that matters on a shelf: tiles are recycled, so a tile handed no take must not keep
   * showing the one the tile before it held.
   */
  it('wipes the box rather than leaving the take before it on screen', () => {
    render(<Waveform peaks={null} />)

    expect(spy.clearRect).toHaveBeenCalled()
    expect(spy.fill).not.toHaveBeenCalled()
  })

  /**
   * The ingest writes its pairs long after the tile is on screen. Its only caller subscribes by
   * selector (`AssetWaveform`), so the tile does re-render — but with a prop it must PAINT from,
   * not merely hold, and the repaint is an effect nothing else would fire.
   */
  it('draws a take that only arrives once it is already mounted', () => {
    const { rerender } = render(<Waveform peaks={null} />)
    expect(spy.fill).not.toHaveBeenCalled()

    rerender(<Waveform peaks={peaks()} />)

    expect(spy.fill).toHaveBeenCalled()
  })
})
