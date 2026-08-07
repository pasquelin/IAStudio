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

    expect(screen.getByRole('progressbar')).toHaveAccessibleName('Sunset 42%')
  })

  // A job reporting 1.02 must not paint past its track.
  it('clamps a ratio outside 0 and 1', () => {
    const { rerender } = render(<ProgressBar ratio={1.4} label="Sunset" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')

    rerender(<ProgressBar ratio={-0.3} label="Sunset" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })
})
