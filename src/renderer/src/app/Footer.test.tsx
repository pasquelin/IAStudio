import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Footer } from './Footer'

/**
 * jsdom lays nothing out, so what is provable here is which gauge the line was measured with —
 * and that is the whole of the defect: two pixels written by hand, one of which happened to
 * match the rail in comfort and missed it everywhere else.
 */
describe('Footer', () => {
  it('takes its horizontal inset from the rail, the only thing above it at that edge', () => {
    render(<Footer left="project" right="jobs" />)

    expect(screen.getByRole('contentinfo').className).toContain('px-(--sc-rail-inset)')
  })

  // A height of its own centred the line and gave the leftover to both edges at once: the air
  // under the text then followed the height rather than the gauge the rest of the chassis uses.
  it('spaces itself vertically by the gutter rather than by a height', () => {
    render(<Footer left="project" right="jobs" />)

    expect(screen.getByRole('contentinfo').className).toContain('py-(--sc-gutter)')
  })
})
