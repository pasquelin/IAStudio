import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GhostText } from './GhostText'

describe('the grey rest of a sentence', () => {
  /**
   * 🛑 The written half is PAINTED and hidden, never dropped: without it the tail starts at the
   * left edge instead of under the caret, and the two read as one wrong sentence.
   */
  it('holds the written half invisible, and says none of it to a reader', () => {
    const { container } = render(
      <GhostText typed="genere une im" tail="age" className="px-1 text-xs" />,
    )

    expect(container).toHaveTextContent('genere une image')
    expect(screen.getByText('genere une im')).toHaveClass('invisible')
    // The field beneath is what a reader hears; this layer would say the sentence twice.
    expect(container.firstElementChild).toHaveAttribute('aria-hidden')
  })

  // The host owns the metrics: a mirror with type of its own drifts from the field it copies.
  it('wears the type its host gives it', () => {
    const { container } = render(<GhostText typed="a" tail="bc" className="px-1 text-xs" />)

    expect(container.firstElementChild).toHaveClass('px-1', 'text-xs')
  })
})
