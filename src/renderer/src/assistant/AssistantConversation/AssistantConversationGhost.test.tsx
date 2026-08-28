import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { AssistantConversationGhost } from './AssistantConversationGhost'

const paint = (typed: string, tail: string) =>
  render(
    <AssistantConversationGhost
      typed={typed}
      tail={tail}
      accept="Tab"
      ref={createRef<HTMLDivElement>()}
    />,
  )

describe('the grey rest of a sentence', () => {
  /**
   * 🛑 The written half is PAINTED and hidden, never dropped: without it the tail starts at the
   * left edge instead of where the caret is, and the two texts read as one wrong sentence.
   */
  it('holds the written half invisible, so the tail starts under the caret', () => {
    const { container } = paint('genere une im', 'age')

    expect(container).toHaveTextContent('genere une imageTab')
    expect(screen.getByText('genere une im')).toHaveClass('invisible')
  })

  // The field's own text is what a reader hears; this layer would say the sentence a second time.
  it('is kept from a reader, who has the live region instead', () => {
    const { container } = paint('genere une im', 'age')

    expect(container.firstElementChild).toHaveAttribute('aria-hidden')
  })
})
