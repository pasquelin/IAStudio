import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VisibilityToggle } from './VisibilityToggle'

describe('VisibilityToggle', () => {
  const eye = () => screen.getByRole('button', { name: /Layer 1/ })

  it('announces the state its icon alone carries', () => {
    render(<VisibilityToggle visible label="Layer 1" onToggle={() => {}} />)

    expect(eye()).toHaveAttribute('aria-pressed', 'true')
  })

  /**
   * Every row is visible by default, so a painted eye is a permanent square on EVERY line of the
   * panel — and `bg-elevated` is the colour the row itself takes under the pointer, which made
   * the whole list read as hovered. Read off `classList`, never as a substring: the button always
   * carries `hover:bg-elevated`, which contains the name of the class this refuses.
   */
  it('paints nothing while it is showing, so the hover stays the only lit row', () => {
    render(<VisibilityToggle visible label="Layer 1" onToggle={() => {}} />)

    expect(eye().classList.contains('bg-elevated')).toBe(false)
  })
})
