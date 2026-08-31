import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Spinner } from './Spinner'

describe('the wait with no fraction to show', () => {
  /**
   * A spinner is the one control whose entire meaning is motion, and motion is exactly what a
   * screen reader cannot relay. Unnamed it is announced as nothing at all, so the name is a
   * required prop rather than an option — this is what checks it reaches the tree.
   */
  it('says what is running, since its movement cannot', () => {
    render(<Spinner label="Fetching…" />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Fetching…')
  })

  // `status` and not `progressbar`: there is no value to announce here, only the fact of the
  // wait. A `progressbar` with no `aria-valuenow` reads as a bar stuck at zero.
  it('announces a state and not a measurement', () => {
    render(<Spinner label="Fetching…" />)

    expect(screen.queryByRole('progressbar')).toBeNull()
  })
})
