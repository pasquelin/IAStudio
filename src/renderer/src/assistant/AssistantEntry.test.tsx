import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAssistant } from '@/stores/assistant'
import { AssistantEntry } from './AssistantEntry'

beforeEach(() => {
  useAssistant.setState({ open: false, staged: 0 })
})

describe('the way to the assistant with a pointer', () => {
  it('opens the assistant', async () => {
    render(<AssistantEntry />)

    await userEvent.click(screen.getByRole('button', { name: 'Assistant' }))

    expect(useAssistant.getState().open).toBe(true)
  })

  /**
   * The word on it IS its name: an `aria-label` set over a visible label replaces that label for
   * a screen reader (WCAG 2.5.3), so the button would answer to a name nobody can see — and
   * anyone driving by voice could not ask for the button they are looking at.
   */
  it('answers to the word written on it', () => {
    render(<AssistantEntry />)

    expect(screen.getByRole('button')).not.toHaveAttribute('aria-label')
  })

  // The chord is the half of this nobody can guess, and it was the whole problem: ⌘K worked and
  // nothing on screen said so.
  it('announces its shortcut without writing it beside the word', () => {
    render(<AssistantEntry />)
    const button = screen.getByRole('button')

    expect(button).toHaveAttribute('aria-keyshortcuts')
    expect(button).toHaveTextContent(/^Assistant$/)
  })

  // Quiet rather than gone: a destination that vanishes is one nobody looks for again once a
  // document has taken the centre back.
  it('goes quiet while another surface holds the thread', async () => {
    useAssistant.setState({ staged: 1 })
    render(<AssistantEntry />)

    await userEvent.click(screen.getByRole('button'))

    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true')
    expect(useAssistant.getState().open).toBe(false)
  })
})
