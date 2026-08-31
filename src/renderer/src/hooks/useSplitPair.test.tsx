import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ResizeHandle } from '@/components/ResizeHandle'
import { useSplitPair } from './useSplitPair'

let pairSize = 1000
/** The callback of the observer under test, so a resize can be replayed after the mount. */
let notify: (() => void) | null = null

class ObserverStub {
  constructor(private readonly callback: () => void) {}

  // The real one reports the current size on `observe`, which is how the pair gets its first
  // measurement without asking for one.
  observe(): void {
    notify = this.callback
    this.callback()
  }

  unobserve(): void {}

  disconnect(): void {
    notify = null
  }
}

function Pair({ axis }: { axis: 'vertical' | 'horizontal' }) {
  const { pairRef, leadStyle, leadSize, onLeadSize } = useSplitPair(axis)

  return (
    <div ref={pairRef}>
      <div data-testid="lead" style={leadStyle} />
      <ResizeHandle axis={axis} size={leadSize} onSize={onLeadSize} />
    </div>
  )
}

function dragBy(pixels: number, axis: 'vertical' | 'horizontal' = 'horizontal'): void {
  const divider = screen.getByRole('separator', { hidden: true })
  const from = axis === 'vertical' ? { clientY: 0 } : { clientX: 0 }
  const to = axis === 'vertical' ? { clientY: pixels } : { clientX: pixels }
  fireEvent.pointerDown(divider, { pointerId: 1, ...from })
  fireEvent.pointerMove(divider, { pointerId: 1, ...to })
}

const lead = (): HTMLElement => screen.getByTestId('lead')

beforeAll(() => {
  // jsdom lays nothing out, so the pair would measure zero and every clamp would answer its floor.
  for (const dimension of ['clientWidth', 'clientHeight']) {
    Object.defineProperty(HTMLElement.prototype, dimension, {
      configurable: true,
      get: () => pairSize,
    })
  }
})

afterAll(() => {
  Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth')
  Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight')
})

beforeEach(() => vi.stubGlobal('ResizeObserver', ObserverStub))

afterEach(() => {
  pairSize = 1000
  notify = null
  vi.unstubAllGlobals()
})

describe('useSplitPair', () => {
  // The drag starts from the middle of the measured pair: `-200` reaching 300 says so on its own.
  it('gives the leading pane a width of its own once dragged side by side', () => {
    render(<Pair axis="horizontal" />)

    dragBy(-200)

    expect(lead().style.width).toBe('300px')
    expect(lead().style.flexShrink).toBe('0')
  })

  /** The sound pair stacks its monitors, and a stacked pane is sized by its height. */
  it('gives the leading pane a height of its own once dragged stacked', () => {
    render(<Pair axis="vertical" />)

    dragBy(-200, 'vertical')

    expect(lead().style.height).toBe('300px')
    expect(lead().style.width).toBe('')
  })

  /**
   * The pair loses room without any drag — the window, a panel, the timeline being opened. A size
   * kept in pixels through that leaves the trailing pane nothing.
   */
  it('re-clamps a dragged size when the pair shrinks under it', () => {
    render(<Pair axis="horizontal" />)
    dragBy(400)
    expect(lead().style.width).toBe('900px')

    pairSize = 400
    act(() => notify?.())

    // `MIN_SPLIT`, through the same `fitSplit` the shell clamps its own zones by.
    expect(lead().style.width).toBe('300px')
  })

  // Also the state a pair opens on: an equal share is what a size nobody made up looks like.
  it('makes up no size for a pair nobody has dragged', () => {
    render(<Pair axis="horizontal" />)

    pairSize = 400
    act(() => notify?.())

    expect(lead().style.width).toBe('')
    expect(lead().style.flexGrow).toBe('1')
  })
})
