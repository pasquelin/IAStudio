import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SliderRail } from './SliderRail'

function railOf(from: number, to: number, min = 0, max = 100): Element | null {
  return render(<SliderRail from={from} to={to} min={min} max={max} />).container.querySelector(
    '[style]',
  )
}

describe('SliderRail', () => {
  it('draws the span between its two ends, read against the bounds it was given', () => {
    expect(railOf(1, 3.5, 0, 5)).toHaveStyle({ left: '20%', width: '50%' })
  })

  /** A value read from a document before its span is known would otherwise draw past the end. */
  it('stays inside the rail when handed a span out of bounds', () => {
    expect(railOf(-40, 160)).toHaveStyle({ left: '0%', width: '100%' })
  })

  /** `NaN%` is an invalid declaration: the rail would lose its fill without a word. */
  it('draws nothing rather than NaN when the bounds meet', () => {
    expect(railOf(3, 3, 3, 3)).toHaveStyle({ left: '0%', width: '0%' })
  })
})
