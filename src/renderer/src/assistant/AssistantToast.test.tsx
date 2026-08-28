import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAssistant } from '@/stores/assistant'
import { registerChatPanel } from './chatPanel'
import { AssistantToast } from './AssistantToast'

const turn = (id: number, lost = false) => ({
  id,
  said: 'ouvre un nouveau fichier 3D',
  answered: '',
  steps: [],
  lost,
})

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  useAssistant.setState({ busy: false, seen: 0, staged: 0, turns: [turn(1)] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('what became of the sentence, once', () => {
  /**
   * The half that talking without the window was missing: the sentence went, something happened
   * on screen, and nothing ever said it had come back. The echo is the point of it — one checks
   * that THESE words are the ones that left, not some other transcription of them.
   */
  it('says the assistant answered, and echoes what it heard', () => {
    render(<AssistantToast />)

    expect(screen.getByText('L’assistant a répondu')).toBeInTheDocument()
    expect(screen.getByText('ouvre un nouveau fichier 3D')).toBeInTheDocument()
  })

  it('says so when the assistant did not manage', () => {
    useAssistant.setState({ turns: [turn(1, true)] })
    render(<AssistantToast />)

    expect(screen.getByText(/n’a pas su répondre/)).toBeInTheDocument()
  })

  it('takes the reader to the conversation, on the detail', async () => {
    const focus = vi.fn()
    const drop = registerChatPanel({ focus })
    render(<AssistantToast />)

    await userEvent.click(screen.getByText('L’assistant a répondu'))

    expect(focus).toHaveBeenCalled()
    drop()
  })

  /**
   * It expires where the failure toasts deliberately do not, and the difference is who asked:
   * this answers a sentence spoken a moment ago, at the screen the person is watching precisely
   * because they are waiting for it.
   */
  it('takes itself away after a while', () => {
    render(<AssistantToast />)

    act(() => vi.advanceTimersByTime(6000))

    expect(screen.queryByText('L’assistant a répondu')).not.toBeInTheDocument()
  })

  // Whichever surface has it up — the modal or the empty centre. `open` means the modal ALONE,
  // and reading it here announced an answer over the page of words the person was reading.
  it('stays out of the way while a surface has the thread on screen', () => {
    useAssistant.setState({ staged: 1 })
    const { container } = render(<AssistantToast />)

    expect(container).toBeEmptyDOMElement()
  })

  it('waits for the plan to finish before saying anything', () => {
    useAssistant.setState({ busy: true })
    const { container } = render(<AssistantToast />)

    expect(container).toBeEmptyDOMElement()
  })

  /**
   * A turn joins the thread when it is SENT, not when it is answered. Opening the window while a
   * plan runs used to mark that answer read before it existed — close again before it landed and
   * nothing ever reported it: the status line only speaks while the plan runs, and this thought
   * it had been read.
   */
  it('still reports an answer that landed after the conversation came and went', () => {
    useAssistant.setState({ busy: true, turns: [turn(1)] })
    useAssistant.getState().stage()()
    useAssistant.setState({ busy: false })
    render(<AssistantToast />)

    expect(screen.getByText('L’assistant a répondu')).toBeInTheDocument()
  })
})
