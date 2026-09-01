import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HINT_TOP } from '@/helpers/tooltip'
import { Chip } from './Chip'

describe('Chip', () => {
  it('reads as pressed when it is the choice in force', () => {
    render(<Chip label="Sphere" hint="Shows the texture on a sphere" selected />)

    expect(screen.getByRole('button', { name: 'Sphere' })).toHaveAttribute('aria-pressed', 'true')
  })

  /**
   * The label is on screen, so the hint explains instead of repeating it — and an `aria-label`
   * set over a visible label replaces it for a screen reader (WCAG SC 2.5.3).
   */
  it('explains through the tooltip without renaming the button', () => {
    render(<Chip label="Sphere" hint="Shows the texture on a sphere" selected={false} />)

    const chip = screen.getByRole('button', { name: 'Sphere' })
    expect(chip).not.toHaveAttribute('aria-label')
    expect(chip).toHaveAttribute('data-tooltip-content', 'Shows the texture on a sphere')
  })

  it('opens the hint where the host says', () => {
    render(
      <Chip label="Sphere" hint="Shows the texture on a sphere" selected={false} tip={HINT_TOP} />,
    )

    expect(screen.getByRole('button')).toHaveAttribute('data-tooltip-place', 'top')
  })
})
