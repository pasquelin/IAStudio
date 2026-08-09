import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Readout } from './Readout'

describe('the readout beside a track', () => {
  it('shows a round value as it is, with no decimals invented for it', () => {
    render(<Readout values={[1]} />)

    expect(screen.getByRole('status')).toHaveTextContent('1')
  })

  /**
   * An elevation in radians reads `0.5235987755982988`. Left whole it pushed the panel wider
   * than itself and gave an inspector a horizontal scrollbar — over a value nobody reads to the
   * sixteenth decimal.
   */
  it('cuts a long value at two decimals, which is what the layout can hold', () => {
    render(<Readout values={[0.5235987755982988]} />)

    expect(screen.getByRole('status')).toHaveTextContent('0.52')
  })

  it('offers the exact value to whoever wants it, rather than losing it', () => {
    render(<Readout values={[0.5235987755982988]} />)

    expect(screen.getByRole('status')).toHaveAttribute('data-tooltip-content', '0.5235987755982988')
  })

  // A tooltip that repeats what is already on screen is noise.
  it('tips nothing when nothing was cut', () => {
    render(<Readout values={[0.5]} />)

    expect(screen.getByRole('status')).not.toHaveAttribute('data-tooltip-content')
  })

  it('joins the two ends of a range with a dash', () => {
    render(<Readout values={[0, 1]} />)

    expect(screen.getByRole('status')).toHaveTextContent('0–1')
  })

  it('rounds both ends of a range, and tips both exactly', () => {
    render(<Readout values={[0.123456, 0.987654]} />)

    expect(screen.getByRole('status')).toHaveTextContent('0.12–0.99')
    expect(screen.getByRole('status')).toHaveAttribute('data-tooltip-content', '0.123456–0.987654')
  })

  it('never lets a negative sign turn into a stray dash', () => {
    render(<Readout values={[-1, 1]} />)

    expect(screen.getByRole('status')).toHaveTextContent('-1–1')
  })
})
