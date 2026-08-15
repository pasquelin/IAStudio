import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProgressBar } from './ProgressBar'

describe('ProgressBar', () => {
  it('reports its ratio as a percentage', () => {
    render(<ProgressBar ratio={0.42} label="Sunset" />)

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42')
  })

  // A screen reader given "42%" alone has no idea what is at 42%.
  it('names what is progressing', () => {
    render(<ProgressBar ratio={0.42} label="Sunset" />)

    // The suites run in French, whose typography puts U+00A0 before the sign — the bar takes
    // that from the language rather than writing a space of its own.
    expect(screen.getByRole('progressbar')).toHaveAccessibleName('Sunset 42\u00a0%')
  })

  // A job reporting 1.02 must not paint past its track — nor announce past it. The name and the
  // value used to be the same rounded number; they are now computed apart, so both are asserted.
  it('clamps a ratio outside 0 and 1', () => {
    const { rerender } = render(<ProgressBar ratio={1.4} label="Sunset" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getByRole('progressbar')).toHaveAccessibleName('Sunset 100\u00a0%')

    rerender(<ProgressBar ratio={-0.3} label="Sunset" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
    expect(screen.getByRole('progressbar')).toHaveAccessibleName('Sunset 0\u00a0%')
  })
})
