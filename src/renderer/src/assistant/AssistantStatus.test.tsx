import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAssistant } from '@/stores/assistant'
import { AssistantStatus } from './AssistantStatus'

const turn = {
  id: 1,
  said: 'prépare une génération de casque',
  answered: '',
  steps: [],
  lost: false,
}

beforeEach(() => {
  useAssistant.setState({ open: false, busy: false, seen: 0, turns: [turn] })
})

describe('that the assistant is working on what was just said', () => {
  /**
   * One knew only that one was speaking: the sentence left and nothing said it had been taken.
   * The echo is what answers that — these words, and not some other transcription of them.
   */
  it('says it is thinking, and echoes the sentence it is thinking about', () => {
    useAssistant.setState({ busy: true })
    render(<AssistantStatus />)

    expect(screen.getByRole('status')).toHaveAccessibleName('L’assistant réfléchit…')
    expect(screen.getByText('prépare une génération de casque')).toBeInTheDocument()
  })

  it('says nothing once the plan has run', () => {
    const { container } = render(<AssistantStatus />)

    expect(container).toBeEmptyDOMElement()
  })

  // The thread itself is on screen saying all of this at length, and the scrim would have this
  // at 40% underneath it anyway.
  it('stays out of the way while the window is up', () => {
    useAssistant.setState({ busy: true, open: true })
    const { container } = render(<AssistantStatus />)

    expect(container).toBeEmptyDOMElement()
  })
})
