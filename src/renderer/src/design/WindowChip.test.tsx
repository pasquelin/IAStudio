import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WindowChip } from './WindowChip'

describe('WindowChip', () => {
  it('reads as pressed when it is the choice in force', () => {
    render(<WindowChip label="30 days" hint="Counts the last thirty days" selected />)

    expect(screen.getByRole('button', { name: '30 days' })).toHaveAttribute('aria-pressed', 'true')
  })

  /**
   * The label is on screen, so the hint explains instead of repeating it — and an `aria-label`
   * set over a visible label replaces it for a screen reader (WCAG SC 2.5.3).
   */
  it('explains through the tooltip without renaming the button', () => {
    render(<WindowChip label="30 days" hint="Counts the last thirty days" selected={false} />)

    const chip = screen.getByRole('button', { name: '30 days' })
    expect(chip).not.toHaveAttribute('aria-label')
    expect(chip).toHaveAttribute('data-tooltip-content', 'Counts the last thirty days')
  })

  /**
   * The windows speak DaisyUI's tokens and the docks speak the studio's. A window chip that
   * reached for `Chip`'s skin would look like a panel control inside an ordinary window.
   */
  it('wears the window vocabulary, not the docks', () => {
    render(<WindowChip label="30 days" hint="Counts the last thirty days" selected />)

    expect(screen.getByRole('button')).toHaveClass('bg-primary')
  })
})
