import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AssistantConversationGhost } from './AssistantConversationGhost'

describe('the grey rest of a sentence', () => {
  /**
   * 🛑 The written half is PAINTED and hidden, never dropped: without it the tail starts at the
   * left edge instead of under the caret, and the two read as one wrong sentence.
   */
  it('holds the written half invisible, and says none of it to a reader', () => {
    const { container } = render(
      <AssistantConversationGhost typed="genere une im" tail="age" accept="Tab" />,
    )

    expect(container).toHaveTextContent('genere une imageTab')
    expect(screen.getByText('genere une im')).toHaveClass('invisible')
    // The field's own text is what a reader hears; this layer would say the sentence twice.
    expect(container.firstElementChild).toHaveAttribute('aria-hidden')
  })
})
