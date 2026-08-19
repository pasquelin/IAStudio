import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SliderRail } from './SliderRail'

function railOf(from: number, to: number): Element | null {
  return render(<SliderRail from={from} to={to} />).container.querySelector('[style]')
}

describe('SliderRail', () => {
  it('draws the span between its two ends', () => {
    expect(railOf(20, 70)).toHaveStyle({ left: '20%', width: '50%' })
  })

  /** A value read from a document before its span is known would otherwise draw past the end. */
  it('stays inside the rail when handed a span out of bounds', () => {
    expect(railOf(-40, 160)).toHaveStyle({ left: '0%', width: '100%' })
  })
})
